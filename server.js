import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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
    ]
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
        await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
        // Write default config
        await fs.writeFile(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2) + '\n', 'utf-8');
        return { ...defaultConfig };
    }
    
    try {
        // Read and parse the config file
        const data = await fs.readFile(CONFIG_FILE, 'utf-8');
        const config = JSON.parse(data);
        
        // Ensure all required fields exist
        const mergedConfig = { ...defaultConfig, ...config };
        
        // If we had to merge in defaults, update the config file
        if (JSON.stringify(mergedConfig) !== JSON.stringify(config)) {
            console.log('Upgrading config with new defaults...');
            await fs.writeFile(CONFIG_FILE, JSON.stringify(mergedConfig, null, 2) + '\n', 'utf-8');
        }
        
        return mergedConfig;
    } catch (error) {
        console.error('Error reading config:', error);
        // Return defaults without saving to avoid loops
        return { ...defaultConfig };
    }
}

// Helper function to write config
async function writeConfig(newConfig) {
    try {
        // Ensure the directory exists
        await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
        
        // If we're writing a partial config, merge with existing config if it exists
        let mergedConfig;
        const exists = await configExists();
        
        if (exists) {
            try {
                const currentConfig = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf-8'));
                mergedConfig = { ...defaultConfig, ...currentConfig, ...newConfig };
                
                // Preserve arrays and nested objects if they exist in current config
                if (currentConfig.directories && !newConfig.directories) {
                    mergedConfig.directories = currentConfig.directories;
                }
            } catch (error) {
                console.error('Error reading existing config for merge:', error);
                // If we can't read the current config, use defaults with new values
                mergedConfig = { ...defaultConfig, ...newConfig };
            }
        } else {
            // No existing config, just merge defaults with new values
            mergedConfig = { ...defaultConfig, ...newConfig };
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

// Check if file is an executable
function isExecutable(filename) {
    const execExts = ['.exe', '.bin', '.x86_64', '.x86', '.sh', '.AppImage'];
    const ext = path.extname(filename).toLowerCase();
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

        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const games = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const gameDir = path.join(dirPath, entry.name);
            
            try {
                const gameFiles = await fs.readdir(gameDir);
                
                // Find main executable
                const mainExecutable = findMainExecutable(gameFiles, entry.name);

                if (mainExecutable) {
                    const gameName = formatGameName(entry.name);
                    games.push({
                        id: `${entry.name}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                        name: gameName,
                        path: path.join(gameDir, mainExecutable),
                        icon: '',
                        lastPlayed: null,
                        playTime: 0,
                        added: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error(`Error reading game directory ${gameDir}:`, error);
                continue;
            }
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

// Helper function to validate directory
async function validateDirectory(dirPath) {
    try {
        // Check if path is absolute
        if (!path.isAbsolute(dirPath)) {
            return { valid: false, error: 'Path must be absolute' };
        }

        // Check if directory exists and is accessible
        try {
            await fs.access(dirPath, fs.constants.R_OK | fs.constants.X_OK);
            const stats = await fs.stat(dirPath);
            
            if (!stats.isDirectory()) {
                return { valid: false, error: 'Path is not a directory' };
            }
            
            return { valid: true };
        } catch (err) {
            if (err.code === 'ENOENT') {
                return { valid: false, error: 'Directory does not exist' };
            } else if (err.code === 'EACCES') {
                return { valid: false, error: 'Permission denied' };
            }
            throw err;
        }
    } catch (error) {
        console.error('Error validating directory:', error);
        return { valid: false, error: 'Error validating directory' };
    }
}

// API Endpoints
// Validate directory endpoint
app.post('/api/validate-directory', express.json(), async (req, res) => {
    try {
        const { path: dirPath } = req.body;
        
        if (!dirPath) {
            return res.status(400).json({ valid: false, error: 'Path is required' });
        }
        
        const result = await validateDirectory(dirPath);
        res.json(result);
    } catch (error) {
        console.error('Error validating directory:', error);
        res.status(500).json({ valid: false, error: 'Internal server error' });
    }
});

app.get('/api/config', async (req, res) => {
    try {
        const config = await readConfig();
        res.json(config);
    } catch (error) {
        console.error('Error reading config:', error);
        res.status(500).json({ error: 'Failed to read config' });
    }
});

app.post('/api/config', async (req, res) => {
    try {
        console.log('Received config update:', JSON.stringify(req.body, null, 2));
        const updatedConfig = await writeConfig(req.body);
        res.json({ success: true, config: updatedConfig });
    } catch (error) {
        console.error('Error saving config:', error);
        res.status(500).json({
            error: 'Failed to save config',
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
