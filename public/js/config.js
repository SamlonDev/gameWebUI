import { loadConfig as apiLoadConfig, saveConfig as apiSaveConfig, validateDirectory } from './api.js';
import {escapeHtml, showError, showNotification} from './utils.js';

// Global state
export let config = {
    directories: []
};

// DOM Elements
let directoryList;
let newDirectoryInput;
let addDirectoryBtn;

// Initialize configuration module
export function initConfig(elements) {
    ({ directoryList, newDirectoryInput, addDirectoryBtn } = elements);
    setupEventListeners();
}

// Load configuration
export async function loadConfig() {
    try {
        const data = await apiLoadConfig();
        
        if (data) {
            // Handle migration from gameDirectories to directories if needed
            if (data.gameDirectories && !data.directories) {
                data.directories = data.gameDirectories;
                // Save the migrated config
                await saveConfig();
            }
            
            // Update the global config with directories
            config.directories = data.directories || [];
            
            // If we're on the settings page, ensure the directories are rendered
            if (window.location.hash === '#settings') {
                renderDirectories();
            }
        }
        
        return { directories: config.directories };
    } catch (error) {
        console.error('Error loading configuration:', error);
        showError('Failed to load configuration. Using default settings.');
        return { directories: [] };
    }
}

// Save configuration
export async function saveConfig() {
    try {
        const response = await apiSaveConfig(config);
        
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
