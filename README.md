# Game Launcher Web UI

A modern, responsive web-based game launcher with automatic game detection. This application helps you organize and launch your games from a single interface.

## Features

- 🎮 Automatic game detection from specified directories
- 🖥️ Clean, modern, and responsive UI
- 🎨 Dark/light theme support
- ⚡ Fast and lightweight
- 🔄 Auto-scan for new games
- ⚙️ Configurable settings

## Architecture

The application follows a client-server architecture:

- **Frontend**: HTML, CSS, and vanilla JavaScript
- **Backend**: Node.js with Express
- **Data Storage**: JSON file for configuration

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd game-launcher
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```
   For development with auto-reload:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Configuration

The application will create a `config.json` file in the project root with default settings. You can modify this file directly or use the web interface to change settings.

### Default Configuration

```json
{
  "version": 1,
  "gameDirectories": [
    "/path/to/your/games"
  ],
  "autoScan": true,
  "scanInterval": 60,
  "defaultView": "grid",
  "theme": {
    "primaryColor": "#6c5ce7",
    "darkMode": true
  }
}
```

## Usage

1. **Add Game Directories**:
   - Go to Settings > Game Directories
   - Click "Add Directory" and enter the path to your games folder
   - The app will automatically scan for games

2. **Launch Games**:
   - Click on any game in your library to launch it

3. **Customize Appearance**:
   - Toggle between dark/light mode in Settings > Appearance
   - Change the primary color theme

## Development

### Project Structure

```
game-launcher/
├── public/               # Frontend files
│   ├── index.html        # Main HTML file
│   ├── styles.css        # Main styles
│   └── script.js         # Frontend JavaScript
├── server.js            # Backend server
├── config.json          # Configuration file (auto-created)
└── package.json         # Project dependencies
```

### Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with auto-reload
- `npm test` - Run tests (coming soon)

## License

This project is licensed under the GNU General Public License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with ❤️ using Node.js and Express
- Icons by [Font Awesome](https://fontawesome.com/)
- Fonts from [Google Fonts](https://fonts.google.com/)
