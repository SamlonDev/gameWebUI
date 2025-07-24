// Default configuration
const defaultConfig = {
    version: 1,
    gameDirectories: [
        "C:\\Program Files\\Steam\\steamapps\\common",
        "C:\\Program Files (x86)\\Steam\\steamapps\\common"
    ],
    autoScan: true,
    scanInterval: 60, // in minutes
    defaultView: "grid",
    theme: {
        primaryColor: "#6c5ce7",
        darkMode: true
    }
};

// Load configuration from localStorage
function loadConfig() {
    const savedConfig = localStorage.getItem('gameLauncherConfig');
    if (savedConfig) {
        try {
            return JSON.parse(savedConfig);
        } catch (e) {
            console.error("Error parsing config, using defaults", e);
            return { ...defaultConfig };
        }
    }
    return { ...defaultConfig };
}

// Save configuration to localStorage
function saveConfig(config) {
    try {
        localStorage.setItem('gameLauncherConfig', JSON.stringify(config));
        return true;
    } catch (e) {
        console.error("Error saving config", e);
        return false;
    }
}

// Reset configuration to defaults
function resetConfig() {
    const config = { ...defaultConfig };
    saveConfig(config);
    return config;
}

// Add a directory to the config
function addGameDirectory(path) {
    const config = loadConfig();
    if (!config.gameDirectories.includes(path)) {
        config.gameDirectories.push(path);
        saveConfig(config);
    }
    return config;
}

// Remove a directory from the config
function removeGameDirectory(path) {
    const config = loadConfig();
    config.gameDirectories = config.gameDirectories.filter(dir => dir !== path);
    saveConfig(config);
    return config;
}

// Helper function to check if a file is an executable
function isExecutable(filename) {
    // Check for PE (Windows) or ELF (Linux) executables
    const execExts = ['.exe', '.bin', '.x86_64', '.x86', '.sh'];
    return execExts.some(ext => filename.endsWith(ext));
}

// Helper function to get all directories in a path
async function getDirectories(path) {
    try {
        // In a real Electron app, we would use the file system API
        // For now, we'll simulate it with a placeholder
        console.log("Getting directories in:", path);
        // This would be replaced with actual file system calls in Electron
        return [];
    } catch (error) {
        console.error(`Error reading directory ${path}:`, error);
        return [];
    }
}

// Helper function to get all files in a directory
async function getFiles(path) {
    try {
        // In a real Electron app, we would use the file system API
        // For now, we'll simulate it with a placeholder
        console.log("Getting files in:", path);
        // This would be replaced with actual file system calls in Electron
        return [];
    } catch (error) {
        console.error(`Error reading files in ${path}:`, error);
        return [];
    }
}

// Helper function to find the main executable in a directory
async function findMainExecutable(dirPath, dirName) {
    const files = await getFiles(dirPath);
    const dirNameLower = dirName.toLowerCase();
    
    // First pass: look for exact or close matches
    const possibleExecutables = files.filter(file => {
        const fileName = file.toLowerCase();
        // Check if file is an executable and name matches directory name
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
    const anyExecutable = files.find(isExecutable);
    return anyExecutable || null;
}

// Scan directories for games
async function scanForGames() {
    const config = loadConfig();
    console.log("Scanning directories for games:", config.gameDirectories);
    
    const discoveredGames = [];
    
    for (const gameDir of config.gameDirectories) {
        try {
            console.log(`Scanning directory: ${gameDir}`);
            
            // Get all subdirectories (potential game folders)
            const subDirs = await getDirectories(gameDir);
            
            for (const subDir of subDirs) {
                try {
                    const dirName = subDir.split(/[\\/]/).pop();
                    const fullPath = `${gameDir}/${subDir}`;
                    
                    // Find the main executable
                    const mainExecutable = await findMainExecutable(fullPath, dirName);
                    
                    if (mainExecutable) {
                        const gameName = dirName
                            .replace(/[_-]/g, ' ') // Replace underscores and dashes with spaces
                            .replace(/\b\w/g, l => l.toUpperCase()) // Title case
                            .trim();
                        
                        discoveredGames.push({
                            id: `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            name: gameName,
                            path: `${fullPath}/${mainExecutable}`,
                            lastPlayed: null,
                            playTime: 0,
                            icon: `https://via.placeholder.com/200x280/2d3436/6c5ce7?text=${encodeURIComponent(gameName.charAt(0).toUpperCase())}`
                        });
                        
                        console.log(`Found game: ${gameName} (${mainExecutable})`);
                    }
                } catch (error) {
                    console.error(`Error processing directory ${subDir}:`, error);
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${gameDir}:`, error);
        }
    }
    
    console.log("Scan complete. Found", discoveredGames.length, "games.");
    return discoveredGames;
}

export {
    loadConfig,
    saveConfig,
    resetConfig,
    addGameDirectory,
    removeGameDirectory,
    scanForGames
};
