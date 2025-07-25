// API endpoints
const API_BASE = '/api';
const ENDPOINTS = {
    CONFIG: `${API_BASE}/config`,
    GAMES: `${API_BASE}/games`,
    VALIDATE_DIRECTORY: `${API_BASE}/validate-directory`
};

// Helper function for API calls
export async function apiFetch(endpoint, options = {}) {
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
            console.error(`API Error (${endpoint}):`, error);
        }

        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

export async function loadConfig() {
    try {
        return await apiFetch(ENDPOINTS.CONFIG);
    } catch (error) {
        console.error('Error loading configuration:', error);
        throw error;
    }
}

export async function saveConfig(config) {
    try {
        // Create a clean config object with only the fields we want to save
        const cleanConfig = {
            version: config.version || 1,
            directories: Array.isArray(config.directories) 
                ? [...config.directories] 
                : [],
            cardSize: ['small', 'medium', 'large', 'xlarge'].includes(config.cardSize)
                ? config.cardSize
                : 'medium'
        };
        
        console.log('Sending clean config to server:', cleanConfig);
        const response = await apiFetch(ENDPOINTS.CONFIG, {
            method: 'POST',
            body: cleanConfig
        });
        
        console.log('Server response:', response);
        
        // Return the response, but make sure it doesn't include any success flags or nested configs
        if (response && typeof response === 'object') {
            const { success, config: nestedConfig, ...cleanResponse } = response;
            return nestedConfig || cleanResponse;
        }
        
        return response;
    } catch (error) {
        console.error('Error saving configuration:', error);
        throw error;
    }
}

export async function scanForGames() {
    try {
        console.log('Initiating game scan...');
        const response = await apiFetch(ENDPOINTS.GAMES);
        console.log('Scan response:', response);
        return response;
    } catch (error) {
        console.error('Error in scanForGames:', {
            error: error.message,
            stack: error.stack,
            response: error.response ? {
                status: error.response.status,
                statusText: error.response.statusText,
                url: error.response.url
            } : 'No response object'
        });
        throw error;
    }
}

export async function validateDirectory(path) {
    try {
        return await apiFetch(ENDPOINTS.VALIDATE_DIRECTORY, {
            method: 'POST',
            body: {path}
        });
    } catch (error) {
        console.error('Error validating directory:', error);
        throw error;
    }
}
