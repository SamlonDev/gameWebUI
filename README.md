# Game Launcher Web UI

A modern, responsive web-based game launcher with automatic game detection. This application helps you organize and launch your games from a single interface.

## Features

- 🎮 Automatic game detection from specified directories
- 🖥️ Clean, modern, and responsive UI
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
   git clone https://github.com/SalmonDev/gameWebUI
   cd gameWebUI
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
3. Create the .env file and get the SteamGridDB API key:
   Add the following line to the .env file:
   ```
   STEAMGRID=STEAMGRID_API_KEY
   ```
   Replace `STEAMGRID_API_KEY` with your actual SteamGridDB API key.

4. Start the server:
   ```bash
   npm start
   ```
   For development with auto-reload:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

### Default Configuration

```json
{
   "version": 1,
   "directories": [
      "/home/salmon/Games",
      "/home/salmon/.local/share/Steam/steamapps/common"
   ]
}
```

## Usage

1. **Add Game Directories**:
   - Game dirs can be added in the settings tab

2. **Launch Games**:
   - Click on any game in your library to launch it

### Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with auto-reload

## Notes

- If you want to run the server on startup:
- on Linux, create a systemd service
- on Windows, create a shortcut in the startup folder 
- All info regarding services and startup folder can be found on google

## License

This project is licensed under the GNU General Public License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with ❤️ using Node.js and Express
- Icons by [Font Awesome](https://fontawesome.com/)
- Fonts from [Google Fonts](https://fonts.google.com/)
