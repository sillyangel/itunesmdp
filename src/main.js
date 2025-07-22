const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'), // We'll add this later
    show: false // Don't show until ready
  });

  // Load the app
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent navigation to external websites
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (parsedUrl.origin !== 'null') {
      event.preventDefault();
    }
  });
});

// IPC handlers for file operations and metadata reading
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// File selection handler
ipcMain.handle('select-files', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select M4A Files',
      defaultPath: app.getPath('music'),
      filters: [
        { name: 'M4A Audio Files', extensions: ['m4a'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    });

    if (result.canceled) {
      return { success: false, files: [] };
    }

    return { success: true, files: result.filePaths };
  } catch (error) {
    console.error('Error selecting files:', error);
    return { success: false, error: error.message, files: [] };
  }
});

// Folder selection handler
ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Folder Containing M4A Files',
      defaultPath: app.getPath('music'),
      properties: ['openDirectory']
    });

    if (result.canceled) {
      return { success: false, files: [] };
    }

    // Scan folder for .m4a files
    const folderPath = result.filePaths[0];
    const m4aFiles = await scanFolderForM4AFiles(folderPath);

    return { success: true, files: m4aFiles, folderPath: folderPath };
  } catch (error) {
    console.error('Error selecting folder:', error);
    return { success: false, error: error.message, files: [] };
  }
});

// Helper function to scan folder for .m4a files
async function scanFolderForM4AFiles(folderPath) {
  const m4aFiles = [];
  
  async function scanDirectory(dirPath) {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          // Recursively scan subdirectories
          await scanDirectory(fullPath);
        } else if (item.isFile() && path.extname(item.name).toLowerCase() === '.m4a') {
          m4aFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }
  }
  
  await scanDirectory(folderPath);
  return m4aFiles;
}

// Metadata reading handler
ipcMain.handle('read-metadata', async (event, filePath) => {
  try {
    // Dynamic import for ES module
    const { parseFile } = await import('music-metadata');
    
    // Check if file exists
    await fs.access(filePath);
    
    // Check if file is .m4a
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.m4a') {
      throw new Error('File is not a .m4a file');
    }

    // Parse metadata using music-metadata
    const metadata = await parseFile(filePath);
    
    // Extract relevant information
    const fileInfo = {
      filePath: filePath,
      fileName: path.basename(filePath),
      fileSize: (await fs.stat(filePath)).size,
      
      // Basic metadata
      title: metadata.common.title || 'Unknown Title',
      artist: metadata.common.artist || 'Unknown Artist',
      album: metadata.common.album || 'Unknown Album',
      albumartist: metadata.common.albumartist || metadata.common.artist || 'Unknown Album Artist',
      date: metadata.common.date || metadata.common.year || 'Unknown Year',
      track: metadata.common.track || { no: null, of: null },
      disk: metadata.common.disk || { no: null, of: null },
      genre: metadata.common.genre ? metadata.common.genre[0] : 'Unknown Genre',
      
      // Duration and technical info
      duration: metadata.format.duration || 0,
      bitrate: metadata.format.bitrate || 0,
      sampleRate: metadata.format.sampleRate || 0,
      
      // Existing artwork
      picture: metadata.common.picture ? metadata.common.picture[0] : null,
      
      // Raw metadata for debugging
      rawMetadata: {
        common: metadata.common,
        format: metadata.format
      }
    };

    return { success: true, metadata: fileInfo };
  } catch (error) {
    console.error('Error reading metadata:', error);
    return { 
      success: false, 
      error: error.message,
      filePath: filePath 
    };
  }
});

// Drag and drop file validation handler (removed - no longer needed)
// ipcMain.handle('validate-dropped-files', async (event, filePaths) => {
//   // This functionality has been removed in favor of file/folder selection
// });
