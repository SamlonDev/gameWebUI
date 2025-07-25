import { escapeHtml } from './utils.js';

// DOM Elements
let navItems;
let pages;
let searchInput;
let refreshBtn;
let cardSizeSlider;
let gamesContainer;

// Initialize UI module
export async function initUI(elements) {
    ({ navItems, pages, searchInput, refreshBtn } = elements);
    
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
            window.config = { cardSize: 'medium' };
        }
    } else {
        console.warn('window.loadConfig not found, using default config');
        window.config = { cardSize: 'medium' };
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
    const sizeToValue = { 'small': 0, 'medium': 1, 'large': 2, 'xlarge': 3 };
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
                        const sizeToValue = { 'small': 0, 'medium': 1, 'large': 2, 'xlarge': 3 };
                        cardSizeSlider.value = sizeToValue[currentSize];
                    }
                } else {
                    console.error('window.saveConfig is not defined');
                    // Revert the slider if saveConfig is not available
                    const currentSize = window.config?.cardSize || 'medium';
                    const sizeToValue = { 'small': 0, 'medium': 1, 'large': 2, 'xlarge': 3 };
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
        console.error('Navigation elements not found:', { navItems, pages });
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
        
        // Prepare game data with defaults
        const gameTitle = game.name || 'Untitled Game';
        const gameImage = game.icon || 'default-game-image.jpg';
        
        // Create the game card HTML with full cover image and play button overlay
        gameCard.innerHTML = `
            <div class="game-cover">
                <img src="${gameImage}" alt="${escapeHtml(gameTitle)}" 
                    title="${escapeHtml(gameTitle)}" />
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
}
