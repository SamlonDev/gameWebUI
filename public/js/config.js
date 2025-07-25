import { loadConfig as apiLoadConfig, saveConfig as apiSaveConfig, validateDirectory } from './api.js';
import {escapeHtml, showError, showNotification} from './utils.js';

// Global state
export let config = {
    directories: [],
    cardSize: 'medium' // small, medium, large, xlarge
};

// DOM Elements
let directoryList;
let newDirectoryInput;
let addDirectoryBtn;

// Initialize configuration module
export async function initConfig(elements) {
    try {
        console.log('Initializing config module...');
        ({ directoryList, newDirectoryInput, addDirectoryBtn } = elements);
        
        // Expose functions to window first
        window.saveConfig = saveConfig;
        window.loadConfig = loadConfig;
        console.log('Exposed config functions to window');
        
        // Load the config
        await loadConfig();
        
        // Set up event listeners
        setupEventListeners();
        console.log('Config module initialized');
    } catch (error) {
        console.error('Error initializing config module:', error);
        throw error;
    }
}

// Load configuration
export async function loadConfig() {
    try {
        console.log('Attempting to load config from API...');
        const data = await apiLoadConfig();
        console.log('API response data:', data);
        
        if (data) {
            
            // Update the global config while preserving default values
            config = { 
                ...config, // Default values first
                ...data,   // Then override with saved values
                directories: data.directories || [] // Ensure directories array exists
            };
            
            // Make sure cardSize is one of the allowed values
            const validSizes = ['small', 'medium', 'large', 'xlarge'];
            if (!validSizes.includes(config.cardSize)) {
                console.log(`Invalid cardSize '${config.cardSize}', defaulting to 'medium'`);
                config.cardSize = 'medium';
            }
            
            console.log('Final config after processing:', config);
            
            // Store config in window for global access
            window.config = config;
            
            // Render directories after loading
            renderDirectories();
            
            return config;
        }
        
        // If no config exists, save the default one
        await saveConfig();
        renderDirectories();
        return config;
        
    } catch (error) {
        console.error('Error loading configuration:', error);
        showError('Failed to load configuration. Using default settings.');
        return { directories: [] };
    }
}

// Save configuration
export async function saveConfig() {
    console.log('Saving configuration...', config);

    // Don't try to save if we don't have a valid config
    if (!config || typeof config !== 'object') {
        console.error('Invalid config object, cannot save');
        return false;
    }

    try {
        // Create a clean copy of the config to save with only the necessary fields
        const dataToSave = {
            version: config.version || 1,
            directories: Array.isArray(config.directories) ? [...config.directories] : [],
            cardSize: ['small', 'medium', 'large', 'xlarge'].includes(config.cardSize) 
                ? config.cardSize 
                : 'medium'
        };

        console.log('Sending to apiSaveConfig:', dataToSave);
        const response = await apiSaveConfig(dataToSave);

        if (response && typeof response === 'object') {
            // Only update the local config with the response if it's valid
            // Filter out any unwanted fields from the response
            const cleanConfig = {
                version: response.version || dataToSave.version,
                directories: Array.isArray(response.directories) 
                    ? [...response.directories] 
                    : dataToSave.directories,
                cardSize: ['small', 'medium', 'large', 'xlarge'].includes(response.cardSize)
                    ? response.cardSize
                    : dataToSave.cardSize
            };

            Object.assign(config, cleanConfig);
            console.log('Configuration saved and updated successfully');
            showNotification('Settings saved!', 'success');
            return true;
        } else {
            console.error('Invalid response from server when saving config');
            return false;
        }
    } catch (error) {
        console.error('Error in saveConfig:', {
            error,
            errorMessage: error.message,
            stack: error.stack
        });

        // Only show error to user if it's not a network error (which might be temporary)
        if (error.name !== 'TypeError' || error.message.indexOf('NetworkError') === -1) {
            showError('Failed to save configuration. Please check the console for details.');
        } else {
            console.log('Network error when saving config, will retry on next change');
        }

        return false;
    }
}

// Expose functions to window for global access
console.log('Exposing config functions to window');
window.saveConfig = saveConfig;
window.loadConfig = loadConfig;

// Add a new directory
export async function addDirectory(path) {
    if (!path) return;

    // Normalize path (remove trailing slashes)
    path = path.replace(/[\\/]+$/, '');
    
    // Check if directory already exists in the list
    if (config.directories.includes(path)) {
        showError('This directory is already in the list');
        return false;
    }
    
    try {
        // Validate the directory exists on the server
        const validationResult = await validateDirectory(path);
        
        if (!validationResult.valid) {
            showError(validationResult.error || 'Failed to validate directory');
            return false;
        }
        
        // Add to config
        config.directories.push(path);
        
        // Save to server
        await saveConfig();
        
        // Update UI
        renderDirectories();
        showNotification('Directory added successfully. Scanning for games...');
        
        return true;
    } catch (error) {
        console.error('Error adding directory:', error);
        showError('Failed to add directory: ' + (error.message || 'Unknown error'));
        return false;
    }
}

// Remove a directory
export async function removeDirectory(index) {
    if (index < 0 || index >= config.directories.length) return false;
    
    try {
        // Remove from config
        config.directories.splice(index, 1);
        
        // Save to server
        await saveConfig();
        
        // Update UI
        renderDirectories();
        showNotification('Directory removed successfully');
        
        return true;
    } catch (error) {
        console.error('Error removing directory:', error);
        showError('Failed to remove directory: ' + (error.message || 'Unknown error'));
        return false;
    }
}

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

// Set up event listeners
function setupEventListeners() {
    if (!addDirectoryBtn || !newDirectoryInput) return;
    
    // Handle add directory button click
    addDirectoryBtn.addEventListener('click', () => {
        const path = newDirectoryInput.value.trim();
        if (path) {
            addDirectory(path).then(success => {
                if (success) {
                    newDirectoryInput.value = '';
                }
            });
        } else {
            showError('Please enter a directory path');
        }
    });
    
    // Handle Enter key in directory input
    newDirectoryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const path = newDirectoryInput.value.trim();
            if (path) {
                addDirectory(path).then(success => {
                    if (success) {
                        newDirectoryInput.value = '';
                    }
                });
            } else {
                showError('Please enter a directory path');
            }
        }
    });
}
