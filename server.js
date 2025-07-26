import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import {fileURLToPath} from 'url';
import {dirname, join, resolve} from 'path';
import {readFile, readdir, access, constants} from 'fs/promises';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import SGDB from "steamgriddb";
import {exec} from 'child_process';
import {promisify} from 'util';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configure SteamGridDB API
const STEAMGRID_API_KEY = process.env.STEAMGRID;
const client = new SGDB(STEAMGRID_API_KEY);

// Cache for storing game assets
const gameAssetCache = new Map();

/**
 * Search for a game on SteamGridDB
 * @param {string} gameName - Name of the game to search for
 * @returns {Promise<Object|null>} - Game data or null if not found
 */
async function searchGameOnSteamGridDB(gameName) {
    try {
        const games = await client.searchGame(gameName);
        return games && games.length > 0 ? games[0] : null;
    } catch (error) {
        console.error('Error searching SteamGridDB:', error.message);
        return null;
    }
}

/**
 * Get game cover from SteamGridDB
 * @param {string} gameId - SteamGridDB game ID
 * @returns {Promise<string|null>} - URL of the game cover or null if not found
 */
async function getGameCover(gameId) {
    const cacheKey = `cover-${gameId}`;
    if (gameAssetCache.has(cacheKey)) {
        return gameAssetCache.get(cacheKey);
    }

    try {
        // First try to get 2:3 aspect ratio grids (600x900 is 2:3)
        const grids = await client.getGridsById(gameId, {
            dimensions: ['600x900'],
            types: ['static'],
            styles: ['alternate', 'blurred', 'material', 'no_logo']
        });

        // Filter for 2:3 aspect ratio (within a small tolerance)
        const filteredGrids = grids ? grids.filter(grid => {
            if (!grid.width || !grid.height) return false;
            const aspectRatio = grid.width / grid.height;
            // Check if aspect ratio is approximately 2:3 (0.666...)
            return Math.abs(aspectRatio - (2 / 3)) < 0.1; // 10% tolerance
        }) : [];

        if (filteredGrids.length > 0) {
            // Sort by resolution (area) in descending order
            const sortedByResolution = [...filteredGrids].sort((a, b) =>
                (b.width * b.height) - (a.width * a.height)
            );

            const coverUrl = sortedByResolution[0].url;
            gameAssetCache.set(cacheKey, coverUrl);
            return coverUrl;
        }

        // If no 2:3 grids found, return null
        console.log(`No 2:3 aspect ratio grid found for game ID: ${gameId}`);
        return null;
    } catch (error) {
        console.error('Error fetching game cover:', error.message);
        return null;
    }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static('public'));

// Default config
const defaultConfig = {
    version: 1,
    directories: [
        "/home/salmon/Games",
        "/home/salmon/.local/share/Steam/steamapps/common"
    ],
    cardSize: "medium"
};

// Config file path
const CONFIG_FILE = join(__dirname, 'config.json');

// Helper function to check if config file exists
async function configExists() {
    try {
        await fs.access(CONFIG_FILE);
        return true;
    } catch (error) {
        return false;
    }
}

// Helper function to read config
async function readConfig() {
    // Check if config file exists
    const exists = await configExists();
    if (!exists) {
        console.log('Config file not found, creating with default settings...');
        // Create the directory if it doesn't exist
        await fs.mkdir(path.dirname(CONFIG_FILE), {recursive: true});
        // Write default config
        await fs.writeFile(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2) + '\n', 'utf-8');
        return {...defaultConfig};
    }

    try {
        // Read and parse the config file
        const data = await fs.readFile(CONFIG_FILE, 'utf-8');
        const config = JSON.parse(data);

        // Ensure all required fields exist
        const mergedConfig = {...defaultConfig, ...config};

        // If we had to merge in defaults, update the config file
        if (JSON.stringify(mergedConfig) !== JSON.stringify(config)) {
            console.log('Upgrading config with new defaults...');
            await fs.writeFile(CONFIG_FILE, JSON.stringify(mergedConfig, null, 2) + '\n', 'utf-8');
        }

        return mergedConfig;
    } catch (error) {
        console.error('Error reading config:', error);
        // Return defaults without saving to avoid loops
        return {...defaultConfig};
    }
}

// Helper function to write config
async function writeConfig(newConfig) {
    try {
        // Ensure the directory exists
        await fs.mkdir(path.dirname(CONFIG_FILE), {recursive: true});

        // If we're writing a partial config, merge with existing config if it exists
        let mergedConfig;
        const exists = await configExists();

        if (exists) {
            try {
                const currentConfig = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf-8'));
                mergedConfig = {...defaultConfig, ...currentConfig, ...newConfig};

                // Preserve all non-array config properties that aren't being updated
                Object.keys(currentConfig).forEach(key => {
                    // Preserve existing values if they're not being updated and aren't arrays
                    if (!(key in newConfig) && !Array.isArray(currentConfig[key])) {
                        mergedConfig[key] = currentConfig[key];
                    }

                    // Special handling for arrays - only preserve if not being updated
                    if (Array.isArray(currentConfig[key]) && !(key in newConfig)) {
                        mergedConfig[key] = currentConfig[key];
                    }
                });
            } catch (error) {
                console.error('Error reading existing config for merge:', error);
                // If we can't read the current config, use defaults with new values
                mergedConfig = {...defaultConfig, ...newConfig};
            }
        } else {
            // No existing config, just merge defaults with new values
            mergedConfig = {...defaultConfig, ...newConfig};
        }

        // Ensure version is always set to current
        mergedConfig.version = defaultConfig.version;

        // Write the config file with pretty printing
        const configStr = JSON.stringify(mergedConfig, null, 2) + '\n'; // Add newline at end
        await fs.writeFile(CONFIG_FILE, configStr, 'utf-8');

        console.log('Config saved successfully to', CONFIG_FILE);
        return mergedConfig;
    } catch (error) {
        console.error('Error writing config:', error);
        throw new Error(`Failed to save configuration: ${error.message}`);
    }
}

// Steam related functions
async function findSteamLibraries() {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const steamPaths = [
        join(homeDir, '.local/share/Steam'),
        join(homeDir, '.steam/steam'),
        join(homeDir, 'Library/Application Support/Steam'),
        'C:\\Program Files (x86)\\Steam',
        'C:\\Program Files\\Steam'
    ];

    const validPaths = [];

    for (const path of steamPaths) {
        await access(path, constants.F_OK);
        validPaths.push(path);

    }

    return validPaths;
}

async function findSteamAppManifests(steamPath) {
    const manifestsPath = join(steamPath, 'steamapps');
    const files = await readdir(manifestsPath, {withFileTypes: true});
    return files
        .filter(file => file.isFile() && file.name.startsWith('appmanifest_') && file.name.endsWith('.acf'))
        .map(file => join(manifestsPath, file.name));
}

async function parseAppManifest(manifestPath) {
    try {
        const content = await readFile(manifestPath, 'utf8');
        const appId = content.match(/"appid"\s*"(\d+)"/)?.[1];
        const name = content.match(/"name"\s*"([^"]+)"/)?.[1];
        const installDir = content.match(/"installdir"\s*"([^"]+)"/)?.[1];

        if (!appId || !name || !installDir) return null;

        return {
            appId,
            name,
            installDir,
            manifestPath,
            installPath: join(dirname(manifestPath), 'common', installDir)
        };
    } catch (err) {
        console.error(`Error parsing manifest ${manifestPath}:`, err);
        return null;
    }
}

async function findSteamGameByPath(gamePath) {
    const steamPaths = await findSteamLibraries();

    for (const steamPath of steamPaths) {
        try {
            const manifests = await findSteamAppManifests(steamPath);

            for (const manifestPath of manifests) {
                const gameInfo = await parseAppManifest(manifestPath);
                if (!gameInfo) continue;

                // Check if the game path matches the install path or is inside it
                const normalizedGamePath = resolve(gamePath);
                const normalizedInstallPath = resolve(gameInfo.installPath);

                if (normalizedGamePath.startsWith(normalizedInstallPath)) {
                    return gameInfo;
                }
            }
        } catch (err) {
            console.error(`Error processing Steam library at ${steamPath}:`, err);
        }
    }

    return null;
}

// Check if file is an executable
function isExecutable(filename) {
    const execExts = ['.exe', '.bin', '.x86_64', '.x86', '.sh', '.AppImage'];
    const ext = path.extname(filename);
    return execExts.includes(ext);
}

// Scan a directory for games
async function scanDirectory(dirPath) {
    try {
        // Validate directory before scanning
        const validation = await validateDirectory(dirPath);
        if (!validation.valid) {
            console.error(`Cannot scan directory ${dirPath}: ${validation.error}`);
            return [];
        }

        const entries = await fs.readdir(dirPath, {withFileTypes: true});
        const games = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const gameDir = path.join(dirPath, entry.name);
            let gameFiles = [];

            try {
                gameFiles = (await fs.readdir(gameDir)).map(f => f);
            } catch (err) {
                console.error(`Error reading game directory ${gameDir}:`, err);
                continue;
            }

            // Find main executable
            const mainExecutable = findMainExecutable(gameFiles, entry.name);
            if (!mainExecutable) continue;

            const gameName = formatGameName(entry.name);
            const gamePath = path.join(gameDir, mainExecutable);

            // Create base game object
            const game = {
                id: `${entry.name}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                name: gameName,
                path: gamePath,
                icon: '',
                description: '',
                lastPlayed: null,
                added: new Date().toISOString(),
                directory: entry.name
            };

            // Try to find game on SteamGridDB
            try {
                const steamGame = await searchGameOnSteamGridDB(gameName);
                if (steamGame) {
                    game.name = steamGame.name || gameName; // Use the name from SteamGridDB if available

                    // Get game cover
                    const coverUrl = await getGameCover(steamGame.id);
                    if (coverUrl) {
                        game.icon = coverUrl;
                    }
                }
            } catch (error) {
                console.error(`Error fetching data from SteamGridDB for ${gameName}:`, error.message);
            }

            // If still no description, try to read from local files
            if (!game.description) {
                const metadataFiles = {
                    'description.txt': (content) => content.trim(),
                    'about.txt': (content) => content.trim(),
                    'readme.txt': (content) => content.split('\n')[0].trim()
                };

                for (const [file, processor] of Object.entries(metadataFiles)) {
                    if (gameFiles.includes(file)) {
                        try {
                            const content = await fs.readFile(path.join(gameDir, file), 'utf-8');
                            game.description = processor(content).substring(0, 200);
                            break;
                        } catch (err) {
                            console.error(`Error reading ${file} for ${gameName}:`, err);
                        }
                    }
                }
            }

            games.push(game);
        }

        return games;
    } catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error);
        return [];
    }
}

// Find main executable in game directory
function findMainExecutable(files, dirName) {
    const dirNameLower = dirName.toLowerCase();

    // First pass: look for exact or close matches
    const possibleExecutables = files.filter(file => {
        const fileName = file.toLowerCase();
        return isExecutable(file) &&
            (fileName.startsWith(dirNameLower) ||
                fileName.includes(dirNameLower) ||
                dirNameLower.includes(fileName.split('.')[0].toLowerCase()));
    });

    // If we found matches, return the first one
    if (possibleExecutables.length > 0) {
        return possibleExecutables[0];
    }

    // Second pass: look for any executable if no good match found
    return files.find(isExecutable);
}

// Format game name for display
function formatGameName(dirName) {
    return dirName
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
}


const execAsync = promisify(exec);

/**
 * Determine the type of game and launch it
 * @param {string} gamePath - Path to the game executable
 * @returns {Promise<{success: boolean, error?: string}>} - Result of the launch attempt
 */
async function launchGame(gamePath) {
    try {
        // Check if it's a Steam game using our new detection
        const steamGame = await findSteamGameByPath(gamePath);
        if (steamGame) {
            console.log(`Launching Steam game: ${steamGame.name} (AppID: ${steamGame.appId})`);
            await execAsync(`xdg-open "steam://rungameid/${steamGame.appId}"`, {detached: true});
            return {
                success: true,
                type: 'steam',
                appId: steamGame.appId,
                name: steamGame.name
            };
        }


        // Check if file exists and is executable
        try {
            await fs.access(gamePath, fs.constants.X_OK);
        } catch (error) {
            // If not executable, try to make it executable
            if (error.code === 'EACCES') {
                await fs.chmod(gamePath, 0o755);
            } else {
                console.error('Error accessing game file:', error);
                return {success: false, error: error.message};
            }
        }

        // Get file type using file command
        const {stdout: fileType} = await execAsync(`file -b "${gamePath}"`);

        if (fileType.includes('ELF')) {
            // Linux native game
            await execAsync(`"${gamePath}"`, {detached: true});
            return {success: true};
        } else if (fileType.includes('PE32') || fileType.includes('PE32+')) {
            // Windows executable - try with Wine
            await execAsync(`wine "${gamePath}"`, {detached: true});
            return {success: true};
        } else if (gamePath.endsWith('.desktop')) {
            // Linux desktop entry
            await execAsync(`xdg-open "${gamePath}"`, {detached: true});
            return {success: true};
        } else {
            // Try to execute directly as a last resort
            await execAsync(`"${gamePath}"`, {detached: true});
            return {success: true};
        }
    } catch (error) {
        console.error('Error launching game:', error);
        return {success: false, error: error.message};
    }
}

// Helper function to validate directory
async function validateDirectory(dirPath) {
    try {
        // Check if path is absolute
        if (!path.isAbsolute(dirPath)) {
            return {valid: false, error: 'Path must be absolute'};
        }

        // Check if directory exists and is accessible
        try {
            await fs.access(dirPath, fs.constants.R_OK | fs.constants.X_OK);
            const stats = await fs.stat(dirPath);

            if (!stats.isDirectory()) {
                return {valid: false, error: 'Path is not a directory'};
            }

            return {valid: true};
        } catch (err) {
            if (err.code === 'ENOENT') {
                return {valid: false, error: 'Directory does not exist'};
            } else if (err.code === 'EACCES') {
                return {valid: false, error: 'Permission denied'};
            }

            console.error('Error accessing directory:', err);
            return {valid: false, error: 'Error accessing directory'};
        }
    } catch (error) {
        console.error('Error validating directory:', error);
        return {valid: false, error: 'Error validating directory'};
    }
}

// Serve game assets (icons, etc.)
app.get('/games/:gameDir/:filename', async (req, res) => {
    try {
        const {gameDir, filename} = req.params;
        const decodedGameDir = decodeURIComponent(gameDir);

        // Find which directory contains this game
        const config = await readConfig();
        const gameDirs = config.directories || [];

        for (const dir of gameDirs) {
            const gamePath = path.join(dir, decodedGameDir);
            try {
                const filePath = path.join(gamePath, filename);
                await fs.access(filePath);
                return res.sendFile(filePath);
            } catch (err) {
                // File not found in this directory, continue to next

            }
        }

        res.status(404).send('File not found');
    } catch (error) {
        console.error('Error serving game asset:', error);
        res.status(500).send('Error serving file');
    }
});

// API Endpoints
// Validate directory endpoint
app.post('/api/validate-directory', express.json(), async (req, res) => {
    try {
        const {path: dirPath} = req.body;

        if (!dirPath) {
            return res.status(400).json({valid: false, error: 'Path is required'});
        }

        const result = await validateDirectory(dirPath);
        res.json(result);
    } catch (error) {
        console.error('Error validating directory:', error);
        res.status(500).json({valid: false, error: 'Internal server error'});
    }
});

app.get('/api/config', async (req, res) => {
    try {
        const config = await readConfig();
        res.json(config);
    } catch (error) {
        console.error('Error reading config:', error);
        res.status(500).json({error: 'Failed to read config'});
    }
});

app.post('/api/config', async (req, res) => {
    try {
        console.log('Received config update:', JSON.stringify(req.body, null, 2));
        const updatedConfig = await writeConfig(req.body);
        res.json({success: true, config: updatedConfig});
    } catch (error) {
        console.error('Error saving config:', error);
        res.status(500).json({
            error: 'Failed to save config',
            details: error.message
        });
    }
});

// Launch game endpoint
app.post('/api/games/launch', express.json(), async (req, res) => {
    try {
        const {gamePath} = req.body;
        if (!gamePath) {
            return res.status(400).json({success: false, error: 'Game path is required'});
        }

        // Try to find if this is a Steam game
        const steamGame = await findSteamGameByPath(gamePath);
        if (steamGame) {
            console.log(`Launching Steam game: ${steamGame.name} (AppID: ${steamGame.appId})`);
            const command = `xdg-open "steam://rungameid/${steamGame.appId}"`;
            exec(command, {detached: true});
            return res.json({
                success: true,
                type: 'steam',
                appId: steamGame.appId,
                name: steamGame.name
            });
        }

        const result = await launchGame(gamePath);
        res.json(result);
    } catch (error) {
        console.error('Error launching game:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

app.get('/api/games', async (req, res) => {
    try {
        console.log('Scanning for games...');
        const config = await readConfig();
        console.log('Using config:', JSON.stringify(config, null, 2));

        let allGames = [];

        if (!config.directories || !Array.isArray(config.directories)) {
            console.warn('No game directories configured');
            return res.json([]);
        }

        // Scan all directories for games
        for (const dir of config.directories) {
            try {
                console.log(`Scanning directory: ${dir}`);
                const games = await scanDirectory(dir);
                console.log(`Found ${games.length} games in ${dir}`);
                allGames = [...allGames, ...games];
            } catch (dirError) {
                console.error(`Error scanning directory ${dir}:`, dirError);
                // Continue with next directory even if one fails
            }
        }

        console.log(`Total games found: ${allGames.length}`);
        res.json(allGames);
    } catch (error) {
        console.error('Error in /api/games:', error);
        res.status(500).json({
            error: 'Failed to scan for games',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Serve the frontend for any other route
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
