// Import modules
import { initConfig } from './config.js';
import { initUI, showPage } from './ui.js';
import { loadGames, startAutoScan, launchGame } from './games.js';
import { showError } from './utils.js';

// Make some functions available globally for HTML event handlers
window.startAutoScan = startAutoScan;
window.launchGame = launchGame;

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
    try {
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
        
        // Initialize UI
        initUI({
            navItems: document.querySelectorAll('.nav-item'),
            pages: document.querySelectorAll('.page'),
            searchInput: document.querySelector('.search-bar input'),
            refreshBtn: document.getElementById('refresh-btn'),
            navContainer: document.querySelector('.nav-container')
        });
        
        // Initialize config
        await initConfig({
            directoryList: document.getElementById('directory-list'),
            newDirectoryInput: document.getElementById('new-directory'),
            addDirectoryBtn: document.getElementById('add-directory')
        });
        
        // Load games from localStorage
        loadGames();
        
        // Show the default page based on URL hash or default to 'library'
        const defaultPage = window.location.hash ? 
            window.location.hash.substring(1) : 'library';
        showPage(defaultPage);
        
        // Initial scan if on the library page
        if (defaultPage === 'library') {
            startAutoScan();
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Failed to initialize the application. Please check the console for details.');
    }
});
