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
    return apiFetch(ENDPOINTS.CONFIG);
}

async function saveConfig(config) {
    return apiFetch(ENDPOINTS.CONFIG, {
        method: 'POST',
        body: JSON.stringify(config)
    });
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
let config = {};

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
            // Load configuration
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
        } else {
            page.classList.remove('active');
        }
    });
}

function renderDirectories() {
    if (!directoryList || !config.gameDirectories) return;
    
    directoryList.innerHTML = '';
    
    if (config.gameDirectories.length === 0) {
        directoryList.innerHTML = '<div class="empty-directories">No directories added yet</div>';
        return;
    }
    
    config.gameDirectories.forEach(directory => {
        const dirElement = document.createElement('div');
        dirElement.className = 'directory-item';
        dirElement.innerHTML = `
            <span class="path">${directory}</span>
            <button class="remove-btn" data-path="${directory}">
                <i class="fas fa-times"></i>
            </button>
        `;
        directoryList.appendChild(dirElement);
        
        // Add event listener to remove button
        const removeBtn = dirElement.querySelector('.remove-btn');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeDirectory(directory);
        });
    });
}

async function removeDirectory(path) {
    if (!confirm(`Remove directory "${path}" from the list?`)) return;

    try {
        // Update config
        config.gameDirectories = config.gameDirectories.filter(dir => dir !== path);
        await saveConfig(config);

        // Update UI
        renderDirectories();

        // Rescan if auto-scan is enabled
        if (config.autoScan) {
            await startAutoScan();
        }
    } catch (error) {
        console.error('Error removing directory:', error);
        showError('Failed to remove directory. Please try again.');
    }
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
            
            // If auto-scan is enabled, scan the new directory
            if (config.autoScan) {
                await startAutoScan();
            }
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
    saveGames();
    renderGames();
}

// Show error message
function showError(message) {
    const gamesContainer = document.querySelector('.games-container');
    if (!gamesContainer) return;
    
    gamesContainer.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error</h3>
            <p>${message}</p>
            <button id="retry-btn" class="btn btn-primary" style="margin-top: 20px;">
                <i class="fas fa-redo"></i> Retry
            </button>
        </div>
    `;
    
    document.getElementById('retry-btn')?.addEventListener('click', () => window.location.reload());
}

// Format date
function formatDate(dateString) {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}
