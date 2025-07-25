import {scanForGames} from './api.js';
import {showError, showNotification} from './utils.js';
import {renderGames} from './ui.js';

// Game state
let games = [];

// Load games from localStorage
export function loadGames() {
    try {
        const savedGames = localStorage.getItem('games');
        if (savedGames) {
            games = JSON.parse(savedGames);
            renderGames(games);
        }
    } catch (error) {
        console.error('Error loading games from localStorage:', error);
    }
}

// Save games to localStorage
function saveGames() {
    try {
        localStorage.setItem('games', JSON.stringify(games));
    } catch (error) {
        console.error('Error saving games to localStorage:', error);
    }
}

// Start auto-scan for games
export async function startAutoScan() {
    try {
        console.log('Starting game scan...');
        // Show loading state
        const gamesContainer = document.getElementById('games-container');
        if (gamesContainer) {
            gamesContainer.innerHTML = `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Scanning for games...</p>
                </div>
            `;
        }

        // Perform the scan
        console.log('Calling scanForGames...');
        const gamesList = await scanForGames();
        console.log('Scan result:', gamesList);

        if (Array.isArray(gamesList)) {
            console.log(`Found ${gamesList.length} games`);
            games = gamesList;  // The server returns the array directly, not as {games: [...]}
            saveGames();
            renderGames(games);
            showNotification(`Found ${games.length} games`);
            return games;
        } else {
            const error = new Error('Invalid response format from server');
            console.error(error);
        }
    } catch (error) {
        console.error('Error in startAutoScan:', {
            message: error.message, name: error.name, stack: error.stack, response: error.response ? {
                status: error.response.status, statusText: error.response.statusText, url: error.response.url
            } : 'No response object'
        });

        showError(`Failed to scan for games: ${error.message || 'Unknown error'}`);

        // Show error in the UI
        const gamesContainer = document.getElementById('games-container');
        if (gamesContainer) {
            gamesContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Failed to load games</h3>
                    <p>${error.message || 'An unknown error occurred'}</p>
                    <button class="btn btn-primary" onclick="window.startAutoScan()">
                        <i class="fas fa-sync-alt"></i> Try Again
                    </button>
                </div>
            `;
        }

        return [];
    }
}

// Launch a game
export function launchGame(gameId) {
    const game = games.find(g => g.id === gameId);
    if (!game) {
        showError('Game not found');
        return;
    }

    // Update last played time
    game.lastPlayed = new Date().toISOString();
    saveGames();

    // In a real app, this would launch the game
    showNotification(`Launching ${game.title}...`);
    console.log('Launching game:', game);

    // Simulate game launch
    setTimeout(() => {
        // Update UI to show game is running
        const playButton = document.querySelector(`.play-button[data-id="${gameId}"]`);
        if (playButton) {
            playButton.innerHTML = '<i class="fas fa-stop"></i> Stop';
            playButton.classList.add('playing');
        }

        // Simulate game closing after some time
        setTimeout(() => {
            if (playButton) {
                playButton.innerHTML = '<i class="fas fa-play"></i> Play';
                playButton.classList.remove('playing');
            }
            showNotification(`Finished playing ${game.title}`);
        }, 5000);
    }, 1000);
}
