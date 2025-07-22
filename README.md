# iTunesMetadataPuller

A cross-platform desktop app that extracts metadata from local .m4a (AAC) files and enriches it using the iTunes Search API.

## Features

- 🎵 Extract metadata from .m4a files
- 🔍 Search iTunes API for enriched metadata
- 🎨 High-resolution album artwork download
- 📝 Manual collection ID entry support
- 💻 Cross-platform compatibility (Windows, Linux, macOS)
- 🖱️ Drag-and-drop file support

## Installation

1. Clone the repository:
```bash
git clone https://github.com/sillyangel/itunesmdp.git
cd itunesmdp
```

2. Install dependencies:
```bash
npm install
```

3. Run the app in development mode:
```bash
npm run dev
```

## Building

To build the app for your platform:

```bash
npm run build
```

The built app will be available in the `dist` folder.

## Development

- `npm start` - Start the app
- `npm run dev` - Start the app with developer tools
- `npm run build` - Build the app for distribution

## Tech Stack

- **Electron** - Cross-platform desktop framework
- **Node.js** - Backend logic
- **music-metadata** - Audio file metadata extraction
- **axios** - HTTP requests for iTunes API
- **HTML/CSS/JavaScript** - Frontend

## Project Structure

```
src/
├── main.js           # Main Electron process
├── preload.js        # Preload script for security
└── renderer/         # Renderer process (UI)
    ├── index.html    # Main HTML file
    ├── styles.css    # Styling
    └── renderer.js   # Frontend logic
```

## License

[MIT License](./LICENSE) 

