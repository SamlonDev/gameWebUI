// API endpoints
const API_BASE = '/api';
const ENDPOINTS = {
    CONFIG: `${API_BASE}/config`,
    GAMES: `${API_BASE}/games`
};

// Helper function for API calls
async function apiFetch(endpoint, options = {}) {
    try {
        console.log(`API Request: ${endpoint}`, options);
        
        const response = await fetch(endpoint, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options,
            // Ensure body is stringified if it's an object
            body: options.body && typeof options.body === 'object' 
                ? JSON.stringify(options.body) 
                : options.body
        });
        
        const data = await response.json().catch(() => ({
            status: 'error',
            message: 'Invalid JSON response'
        }));
        
        console.log(`API Response (${endpoint}):`, data);

        if (!response.ok) {
            const error = new Error(data.message || 'API request failed');
            error.response = response;
            error.data = data;
            console.error(error);
        }

        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

// Config functions
async function loadConfig() {
    try {
        const data = await apiFetch(ENDPOINTS.CONFIG);
        
        // Ensure we have the expected structure
        if (data) {
            // Handle migration from gameDirectories to directories if needed
            if (data.gameDirectories && !data.directories) {
                data.directories = data.gameDirectories;
                // Save the migrated config
                await saveConfig({ directories: data.directories });
            }
            
            // Update the global config with directories
            config.directories = data.directories || [];
            
            // If we're on the settings page, ensure the directories are rendered
            if (window.location.hash === '#settings') {
                renderDirectories();
            }
        }
        
        return data || { directories: [] };
    } catch (error) {
        console.error('Error loading configuration:', error);
        showError('Failed to load configuration. Using default settings.');
        return { directories: [] };
    }
}

async function saveConfig(updatedConfig) {
    try {
        // Ensure we only send the directories to the server
        const configToSave = {
            directories: updatedConfig.directories || []
        };
        
        const response = await apiFetch(ENDPOINTS.CONFIG, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configToSave)
        });
        
        // Update local config with the saved data
        if (response && response.directories) {
            config.directories = response.directories;
        }
        
        return response;
    } catch (error) {
        console.error('Error saving configuration:', error);
        showError('Failed to save configuration. Please try again.');
        throw error;
    }
}

async function scanForGames() {
    return apiFetch(ENDPOINTS.GAMES);
}

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const searchInput = document.querySelector('.search-bar input');

// Settings page elements
const directoryList = document.getElementById('directory-list');
const newDirectoryInput = document.getElementById('new-directory');
const addDirectoryBtn = document.getElementById('add-directory');

// Global state
let config = {
    directories: []
};

// Render directories in the UI
function renderDirectories() {
    if (!directoryList) return;
    
    directoryList.innerHTML = '';
    
    if (config.directories.length === 0) {
        directoryList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>No directories added yet</p>
            </div>
        `;
        return;
    }
    
    config.directories.forEach((dir, index) => {
        const dirElement = document.createElement('div');
        dirElement.className = 'directory-item';
        dirElement.innerHTML = `
            <span class="path">${escapeHtml(dir)}</span>
            <button class="remove-btn" data-index="${index}" title="Remove directory">
                <i class="fas fa-times"></i>
            </button>
        `;
        directoryList.appendChild(dirElement);
    });
    
    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.getAttribute('data-index'));
            removeDirectory(index);
        });
    });
}

// Add a new directory
async function addDirectory(path) {
    if (!path) return;
    
    // Normalize path (remove trailing slashes)
    path = path.replace(/[\\/]+$/, '');
    
    // Check if directory already exists in the list
    if (config.directories.includes(path)) {
        showError('This directory is already in the list');
        return;
    }
    
    try {
        // First validate the directory exists on the server
        const validationResponse = await fetch('/api/validate-directory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        
        const validationResult = await validationResponse.json();
        
        if (!validationResponse.ok || !validationResult.valid) {
            throw new Error(validationResult.error || 'Directory does not exist or is not accessible');
        }
        
        // Add to config
        config.directories.push(path);
        
        // Save to server
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ directories: config.directories })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save directory');
        }
        
        // Update UI
        renderDirectories();
        newDirectoryInput.value = '';
        showNotification('Directory added successfully. Scanning for games...');
        
        // Force a game search after adding a directory
        try {
            await startAutoScan();
        } catch (scanError) {
            console.error('Error during game scan after adding directory:', scanError);
            // Don't show error to user, just log it
        }
        
    } catch (error) {
        console.error('Error adding directory:', error);
        showError('Failed to add directory: ' + (error.message || 'Unknown error'));
    }
}

// Remove a directory
async function removeDirectory(index) {
    if (index < 0 || index >= config.directories.length) return;
    
    try {
        // Remove from config
        config.directories.splice(index, 1);
        
        // Save to server
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ directories: config.directories })
        });
        
        if (!response.ok) {
            throw new Error('Failed to remove directory');
        }
        
        // Update UI
        renderDirectories();
        showNotification('Directory removed successfully');
        
    } catch (error) {
        console.error('Error removing directory:', error);
        showError('Failed to remove directory: ' + (error.message || 'Unknown error'));
    }
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Show notification
function showNotification(message, duration = 3000) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Hide and remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

function showError(message, duration = 5000) {
    const notification = document.createElement('div');
    notification.className = 'notification error';

    // Create notification content with icon
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        </div>
    `;

    // Add to body
    document.body.appendChild(notification);

    // Show notification with animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Hide and remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}
// Sample game data (in a real app, this would come from a database)
let games = [];

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Load games from localStorage if available
    const savedGames = localStorage.getItem('games');
    if (savedGames) {
        games = JSON.parse(savedGames);
    }
    
    // Initialize the app
    async function initApp() {
        // Remove no-js class and add js class to enable JS-specific styles
        document.documentElement.classList.remove('no-js');
        document.documentElement.classList.add('js');
        
        // Show the app with a slight delay to ensure styles are loaded
        setTimeout(() => {
            const app = document.querySelector('.app');
            if (app) app.style.opacity = '1';
            
            // Hide the loader after the app is visible
            const loader = document.getElementById('loader-wrapper');
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => {
                    loader.style.display = 'none';
                }, 300);
            }
        }, 50);
        
        try {
            // Load configuration first
            config = await loadConfig();
            
            // Initialize UI components
            initNavigation();
            
            // Initialize refresh button
            const refreshBtn = document.getElementById('refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    console.log('Manual refresh triggered');
                    startAutoScan();
                });
            }
            
            // Add directory form submission
            if (addDirectoryBtn && newDirectoryInput) {
                // Handle add directory button click
                addDirectoryBtn.addEventListener('click', () => {
                    const path = newDirectoryInput.value.trim();
                    if (path) {
                        addDirectory(path);
                    } else {
                        showError('Please enter a directory path');
                    }
                });
                
                // Handle Enter key in directory input
                newDirectoryInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        const path = newDirectoryInput.value.trim();
                        if (path) {
                            addDirectory(path);
                        } else {
                            showError('Please enter a directory path');
                        }
                    }
                });
            }
            
            // Show library by default
            showPage('library');

            // Initial scan
            startAutoScan();
        } catch (error) {
            console.error('Error initializing app:', error);
            showError('Failed to initialize the application. Please check the console for details.');
        }
    }
    
    // Start the app
    initApp();
});

// Navigation
function initNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            if (page) {
                showPage(page);
                
                // Update active state
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });
}

function showPage(pageId) {
    pages.forEach(page => {
        if (page.id === `${pageId}-page`) {
            page.classList.add('active');

            // If showing settings page, ensure directories are loaded
            if (pageId === 'settings') {
                loadConfig().then(() => {
                    renderDirectories();
                }).catch(error => {
                    console.error('Error loading config for settings:', error);
                    showError('Failed to load directory list');
                });
            }
        } else {
            page.classList.remove('active');
        }
    });
}





// Manual game scanning
async function startAutoScan() {
    const gamesContainer = document.querySelector('.games-container');
    if (!gamesContainer) return;

    // Show loading state
    gamesContainer.innerHTML = `
        <div class="scanning-state">
            <div class="spinner"></div>
            <h3>Scanning for games...</h3>
            <p>Please wait while we scan your game directories</p>
        </div>
    `;

    try {
        console.log('Starting manual game scan...');
        const discoveredGames = await scanForGames();
        console.log(`Found ${discoveredGames.length} games`);

        // Update games list with discovered games
        if (discoveredGames.length > 0) {
            // Update the games array and re-render
            games = discoveredGames;
            renderGames();
        } else {
            gamesContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No Games Found</h3>
                    <p>No games were found in the specified directories.</p>
                    <button id="rescan-btn" class="btn btn-primary" style="margin-top: 20px;">
                        <i class="fas fa-sync"></i> Rescan
                    </button>
                </div>
            `;

            // Add event listener to rescan button
            document.getElementById('rescan-btn')?.addEventListener('click', startAutoScan);
        }
    } catch (error) {
        console.error("Error during game scan:", error);
        gamesContainer.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Scan Failed</h3>
                <p>${error.message || 'An error occurred while scanning for games.'}</p>
                <button id="retry-btn" class="btn btn-primary" style="margin-top: 20px;">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;

        // Add event listener to retry button
        document.getElementById('retry-btn')?.addEventListener('click', startAutoScan);
    }
}

// Add directory
addDirectoryBtn?.addEventListener('click', async () => {
    const directory = newDirectoryInput?.value.trim();
    if (!directory) return;
    
    try {
        // Update config with new directory
        if (!config.gameDirectories.includes(directory)) {
            config.gameDirectories.push(directory);
            await saveConfig(config);
            
            // Update UI
            renderDirectories();
            newDirectoryInput.value = '';
        }
    } catch (error) {
        console.error('Error adding directory:', error);
        showError('Failed to add directory. Please check the path and try again.');
    }
});

// Allow adding directory with Enter key
newDirectoryInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addDirectoryBtn.click();
    }
});

// Search functionality
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredGames = games.filter(game => 
        game.name.toLowerCase().includes(searchTerm)
    );
    renderGames(filteredGames);
});


// Render games
async function renderGames() {
    const gamesContainer = document.querySelector('.games-container');
    if (!gamesContainer) return;
    
    // If we're not on the library page, don't render
    const libraryPage = document.getElementById('library-page');
    if (libraryPage && !libraryPage.classList.contains('active')) {
        return;
    }
    
    try {
        // Show loading state
        gamesContainer.innerHTML = `
            <div class="scanning-state">
                <div class="spinner"></div>
                <p>Loading games...</p>
            </div>
        `;
        
        // Fetch games from the server
        const gamesToRender = await scanForGames();
        console.log(`Rendering ${gamesToRender.length} games`);
        
        // Handle empty state
        if (!gamesToRender || gamesToRender.length === 0) {
            gamesContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gamepad"></i>
                    <h3>No Games Found</h3>
                    <p>Try adding game directories in the settings or check your configuration.</p>
                    <button id="go-to-settings" class="btn btn-primary" style="margin-top: 20px;">
                        <i class="fas fa-cog"></i> Go to Settings
                    </button>
                </div>
            `;
            
            // Add event listener to settings button
            document.getElementById('go-to-settings')?.addEventListener('click', () => {
                showPage('settings');
            });
            return;
        }

    
    gamesContainer.innerHTML = gamesToRender.map(game => `
        <div class="game-card" data-id="${game.id}">
            <div class="game-cover">
                <img src="${game.icon}" alt="${game.name}">
            </div>
            <div class="game-info">
                <h3 class="game-title">${game.name}</h3>
                <div class="game-meta">
                    <span>${game.playTime} hrs</span>
                    <span>${game.lastPlayed ? 'Last played: ' + formatDate(game.lastPlayed) : 'Never played'}</span>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add click handlers to game cards
    document.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', () => {
            const gameId = card.getAttribute('data-id');
            launchGame(gameId);
        });
    });
} catch (error) {
    console.error('Error rendering games:', error);
    showError(error.message);
}
}

// Launch game (simulated)
function launchGame(gameId) {
    const game = games.find(g => g.id === gameId);
    if (!game) return;
    
    // In a real app, we would use Electron's child_process to launch the game
    console.log(`Launching game: ${game.name} at ${game.path}`);
    alert(`Would launch: ${game.name} (${game.path})`);
    
    // Update last played time
    game.lastPlayed = new Date();
    renderGames();
}

// Show error message


// Format date
function formatDate(dateString) {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}
