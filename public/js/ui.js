import {escapeHtml} from './utils.js';

// DOM Elements
let navItems;
let pages;
let searchInput;
let refreshBtn;
let cardSizeSlider;
let gamesContainer;

// Initialize UI module
export async function initUI(elements) {
    ({navItems, pages, searchInput, refreshBtn} = elements);

    // Initialize DOM elements
    cardSizeSlider = document.getElementById('cardSizeSlider');
    gamesContainer = document.querySelector('.games-container');

    // Wait for config to be loaded
    if (window.loadConfig) {
        try {
            console.log('Loading configuration...');
            await window.loadConfig();
            console.log('Configuration loaded, window.config:', window.config);
        } catch (error) {
            console.error('Failed to load configuration:', error);
            // Initialize empty config if loading fails
            window.config = {cardSize: 'medium'};
        }
    } else {
        console.warn('window.loadConfig not found, using default config');
        window.config = {cardSize: 'medium'};
    }

    // Set up card size slider if it exists
    if (cardSizeSlider) {
        console.log('Setting up card size controls...');
        setupCardSizeControls();
    } else {
        console.error('Card size slider not found in the DOM');
    }

    initNavigation();
    setupEventListeners();

    // Show initial page based on URL hash
    const initialPage = window.location.hash ? window.location.hash.substring(1) : 'library';
    showPage(initialPage);
}

// Set up card size slider controls
function setupCardSizeControls() {
    // Set initial slider value based on config
    const sizeToValue = {'small': 0, 'medium': 1, 'large': 2, 'xlarge': 3};
    const currentSize = window.config?.cardSize || 'medium';

    // Ensure the slider value is valid
    if (cardSizeSlider) {
        cardSizeSlider.value = sizeToValue[currentSize] || 1; // Default to 'medium' if invalid
    }

    updateCardSize(currentSize);

    // Add debounce function to prevent too many rapid updates
    let debounceTimer;

    // Add event listener for slider changes
    cardSizeSlider.addEventListener('input', (e) => {
        console.log('Card size slider moved to value:', e.target.value);
        const sizes = ['small', 'medium', 'large', 'xlarge'];
        const selectedSize = sizes[parseInt(e.target.value)];

        console.log('Updating card size to:', selectedSize);

        // Update UI immediately
        updateCardSize(selectedSize);

        // Update config immediately for local state
        if (window.config) {
            console.log('Updating local config with cardSize:', selectedSize);
            window.config.cardSize = selectedSize;

            // Debounce the save to prevent too many rapid saves
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                console.log('Saving configuration with cardSize:', selectedSize);
                if (window.saveConfig) {
                    try {
                        console.log('Calling saveConfig...');
                        const success = await window.saveConfig();
                        console.log('Configuration save successful:', success);

                        // Update the UI to reflect the new card size
                        updateCardSize(selectedSize);
                    } catch (error) {
                        console.error('Error saving card size:', error);
                        // Revert the UI if save fails
                        const currentSize = window.config?.cardSize || 'medium';
                        updateCardSize(currentSize);

                        // Reset the slider to the current config value
                        const sizeToValue = {'small': 0, 'medium': 1, 'large': 2, 'xlarge': 3};
                        cardSizeSlider.value = sizeToValue[currentSize];
                    }
                } else {
                    console.error('window.saveConfig is not defined');
                    // Revert the slider if saveConfig is not available
                    const currentSize = window.config?.cardSize || 'medium';
                    const sizeToValue = {'small': 0, 'medium': 1, 'large': 2, 'xlarge': 3};
                    cardSizeSlider.value = sizeToValue[currentSize];
                }
            }, 300); // 300ms debounce time
        }
    });
}

// Update card size in the UI
function updateCardSize(size) {
    if (!gamesContainer) return;

    // Remove all size classes
    gamesContainer.classList.remove('small-cards', 'medium-cards', 'large-cards', 'xlarge-cards');

    // Add the selected size class
    gamesContainer.classList.add(`${size}-cards`);
}

// Navigation functions
function initNavigation() {
    if (!navItems || !pages) {
        console.error('Navigation elements not found:', {navItems, pages});
        return;
    }

    console.log('Initializing navigation with items:', navItems.length);

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // Use data-page attribute
            const pageId = item.getAttribute('data-page');
            console.log('Nav item clicked, pageId:', pageId);
            if (pageId) {
                showPage(pageId);
            }
        });
    });
}

export function showPage(pageId) {
    if (!pageId) {
        console.error('No pageId provided to showPage');
        return;
    }

    // Remove -page suffix if present for URL hash
    const cleanPageId = pageId.replace('-page', '');

    console.log('Showing page:', cleanPageId);

    // Hide all pages
    if (pages && pages.length) {
        pages.forEach(page => {
            page.style.display = 'none';
        });
    } else {
        console.warn('No pages found to hide');
    }

    // Remove active class from all nav items
    if (navItems && navItems.length) {
        navItems.forEach(item => {
            item.classList.remove('active');
        });
    } else {
        console.warn('No nav items found to update');
    }

    // Show the selected page
    const pageElement = document.getElementById(cleanPageId + '-page') || document.getElementById(cleanPageId);
    if (pageElement) {
        pageElement.style.display = 'block';
        console.log('Page displayed:', cleanPageId);
    } else {
        console.error('Page not found:', cleanPageId);
    }

    // Update URL hash without -page suffix
    window.location.hash = cleanPageId;

    // Add active class to the clicked nav item
    const activeNavItem = document.querySelector(`.nav-item[data-page="${cleanPageId}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
        console.log('Active nav item set to:', cleanPageId);
    } else {
        console.warn('Could not find nav item for page:', cleanPageId);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterGames(searchTerm);
        });
    }

    // Refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            console.log('Manual refresh triggered');
            if (window.startAutoScan) {
                window.startAutoScan();
            }
        });
    }
}

// Filter games based on search term
export function filterGames(searchTerm) {
    const gameCards = document.querySelectorAll('.game-card');
    if (!gameCards) return;

    gameCards.forEach(card => {
        const title = card.querySelector('.game-title')?.textContent.toLowerCase() || '';
        const description = card.querySelector('.game-description')?.textContent.toLowerCase() || '';

        if (title.includes(searchTerm) || description.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Render games in the UI
export function renderGames(games) {
    const gamesContainer = document.getElementById('games-container');
    if (!gamesContainer) return;

    if (!games || games.length === 0) {
        gamesContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-gamepad"></i>
                <p>No games found. Add some game directories in settings.</p>
            </div>
        `;
        return;
    }

    gamesContainer.innerHTML = '';

    games.forEach(game => {
        const gameCard = document.createElement('div');
        gameCard.className = 'game-card';
        gameCard.setAttribute('data-id', game.id);
        if (game.path) {
            gameCard.setAttribute('data-path', game.path);
            // Add data attribute for Steam games
            if (game.path.toLowerCase().includes('steamapps/common/')) {
                gameCard.setAttribute('data-steam-game', 'true');
            }
        }

        // Prepare game data with defaults
        const gameTitle = game.name || 'Untitled Game';
        const gameImage = game.icon || 'default-game-image.jpg';

        // Check if it's a Steam game (either from path or from server-provided info)
        const isSteamGame = (game.path && game.path.toLowerCase().includes('steamapps/common/')) || game.type === 'steam';
        const steamAppId = game.appId || (game.path && game.path.match(/app_manifest_(\d+)\.acf$/i)?.[1]);

        // Create the game card HTML with full cover image and play button overlay
        gameCard.innerHTML = `
            <div class="game-cover">
                <img src="${gameImage}" alt="${escapeHtml(gameTitle)}" 
                    title="${escapeHtml(gameTitle)}" />
                ${isSteamGame ? `<div class="steam-badge" ${steamAppId ? `data-steam-appid="${steamAppId}"` : ''}>
                    <i class="fab fa-steam"></i> Steam
                </div>` : ''}
                <div class="game-overlay">
                    <button class="play-button" data-id="${game.id}" title="Play ${escapeHtml(gameTitle)}">
                        <i class="fas fa-play"></i> Play
                    </button>
                </div>
            </div>`;

        gamesContainer.appendChild(gameCard);
    });

    // Add event listeners to play buttons
    document.querySelectorAll('.play-button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const gameId = button.getAttribute('data-id');
            if (gameId && window.launchGame) {
                window.launchGame(gameId);
            }
        });
    });

    // Game cards now only launch games on play button click

// Add launchGame function to the window object
    window.launchGame = async (gameId) => {
        try {
            console.log('Attempting to launch game with ID:', gameId);

            // Find the game card in the DOM using the gameId
            const gameCard = document.querySelector(`.game-card[data-id="${gameId}"]`);

            if (!gameCard) {
                console.error('Could not find game card with ID:', gameId);
            }

            // Get the game path from the data attribute
            const gamePath = gameCard.dataset.path;

            if (!gamePath) {
                console.error('Game card does not have a path attribute:', gameCard);
            }

            console.log('Found game with path:', gamePath);

            // Get the game name from the alt text of the image or the card
            const gameName = gameCard.querySelector('img')?.alt || 'the game';
            console.log('Launching game:', gameName, 'at path:', gamePath);

            // Show loading state
            const playButton = gameCard.querySelector('.play-button');
            if (!playButton) {
                console.error('Could not find play button for game card:', gameCard);
            }

            playButton.disabled = true;
            playButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Launching...';

            try {
                // Call the backend to launch the game
                const response = await fetch('/api/games/launch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({gamePath})
                });

                const result = await response.json();

                if (!result.success) {
                    console.error('Failed to launch game:', result.error);
                }
                console.log('Game launched successfully');

                // Try to update last played time if the games module is available
                try {
                    const gamesModule = await import('./games.js');
                    if (gamesModule.launchGame) {
                        gamesModule.launchGame(gameId);
                    }
                } catch (e) {
                    console.log('Could not update last played time:', e.message);
                }
            } catch (error) {
                console.error('Failed to launch game:', error);
                alert(`Failed to launch game: ${error.message}`);
            } finally {
                // Reset button state
                if (playButton) {
                    playButton.disabled = false;
                    playButton.innerHTML = '<i class="fas fa-play"></i> Play';
                }
            }
        } catch (error) {
            console.error('Error in launchGame:', error);
            alert(`Error: ${error.message}`);
        }
    };
}
