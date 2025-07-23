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

// iTunes API search handler
ipcMain.handle('search-itunes', async (event, searchParams) => {
  try {
    // Build search query
    const { title, artist, album } = searchParams;
    let searchTerm = '';
    
    if (title) searchTerm += title;
    if (artist) searchTerm += ` ${artist}`;
    if (album) searchTerm += ` ${album}`;
    
    searchTerm = searchTerm.trim();
    
    if (!searchTerm) {
      throw new Error('No search terms provided');
    }
    
    // iTunes Search API URL
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=music&entity=song&limit=20`;
    
    console.log('Searching iTunes API:', url);
    
    // Use built-in fetch (Node.js 18+) or fallback to https module
    let response, data;
    
    try {
      // Try built-in fetch first
      response = await fetch(url);
      if (!response.ok) {
        throw new Error(`iTunes API request failed: ${response.status}`);
      }
      data = await response.json();
    } catch (fetchError) {
      // Fallback to https module
      const https = require('https');
      const urlParsed = new URL(url);
      
      data = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: urlParsed.hostname,
          path: urlParsed.pathname + urlParsed.search,
          method: 'GET',
          headers: {
            'User-Agent': 'iTunes-Metadata-Puller/1.0'
          }
        }, (res) => {
          let responseData = '';
          res.on('data', chunk => responseData += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(responseData));
            } catch (parseError) {
              reject(parseError);
            }
          });
        });
        
        req.on('error', reject);
        req.end();
      });
    }
    
    if (!data.results || data.results.length === 0) {
      return {
        success: true,
        results: [],
        message: 'No results found on iTunes'
      };
    }
    
    // Calculate matching scores for each result
    const resultsWithScores = data.results.map(result => {
      const score = calculateMatchingScore(searchParams, result);
      return {
        ...result,
        matchScore: score
      };
    });
    
    // Sort by matching score (highest first)
    resultsWithScores.sort((a, b) => b.matchScore - a.matchScore);
    
    return {
      success: true,
      results: resultsWithScores,
      searchTerm: searchTerm
    };
    
  } catch (error) {
    console.error('iTunes search error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Helper function to calculate matching score
function calculateMatchingScore(original, itunesResult) {
  let score = 0;
  let totalChecks = 0;
  
  // Compare title
  if (original.title && itunesResult.trackName) {
    totalChecks++;
    const titleScore = calculateStringSimilarity(
      original.title.toLowerCase(), 
      itunesResult.trackName.toLowerCase()
    );
    score += titleScore;
  }
  
  // Compare artist
  if (original.artist && itunesResult.artistName) {
    totalChecks++;
    const artistScore = calculateStringSimilarity(
      original.artist.toLowerCase(), 
      itunesResult.artistName.toLowerCase()
    );
    score += artistScore;
  }
  
  // Compare album
  if (original.album && itunesResult.collectionName) {
    totalChecks++;
    const albumScore = calculateStringSimilarity(
      original.album.toLowerCase(), 
      itunesResult.collectionName.toLowerCase()
    );
    score += albumScore;
  }
  
  // Compare duration (if available) - allow 5 second tolerance
  if (original.duration && itunesResult.trackTimeMillis) {
    totalChecks++;
    const originalDuration = Math.round(original.duration);
    const itunesDuration = Math.round(itunesResult.trackTimeMillis / 1000);
    const durationDiff = Math.abs(originalDuration - itunesDuration);
    
    if (durationDiff <= 5) {
      score += 1; // Perfect match
    } else if (durationDiff <= 30) {
      score += 0.7; // Close match
    } else {
      score += 0.3; // Poor match
    }
  }
  
  // Return percentage
  return totalChecks > 0 ? Math.round((score / totalChecks) * 100) : 0;
}

// Helper function to calculate string similarity using Levenshtein distance
function calculateStringSimilarity(str1, str2) {
  if (str1 === str2) return 1;
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  const matrix = [];
  
  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);
  
  return (maxLength - distance) / maxLength;
}

// Enrich metadata with iTunes data
ipcMain.handle('enrich-metadata', async (event, originalMetadata, itunesData) => {
  try {
    const { parseFile } = await import('music-metadata');
    const NodeID3 = await import('node-id3');
    
    // Prepare enriched metadata with iTunes-specific tags
    const enrichedTags = {
      title: itunesData.trackName || originalMetadata.title,
      artist: itunesData.artistName || originalMetadata.artist,
      album: itunesData.collectionName || originalMetadata.album,
      albumartist: itunesData.artistName || originalMetadata.albumartist,
      year: itunesData.releaseDate ? new Date(itunesData.releaseDate).getFullYear().toString() : originalMetadata.date,
      genre: itunesData.primaryGenreName || originalMetadata.genre,
      
      // iTunes-specific tags
      'itunesCountry': itunesData.country || 'USA',
      'itunesAlbumId': itunesData.collectionId ? itunesData.collectionId.toString() : '',
      'itunesArtistId': itunesData.artistId ? itunesData.artistId.toString() : '',
      'itunesCatalogId': itunesData.trackId ? itunesData.trackId.toString() : '',
      'itunesGenreId': itunesData.primaryGenreId ? itunesData.primaryGenreId.toString() : '18',
      'itunesAdvisory': itunesData.trackExplicitness || 'notExplicit',
      
      // Additional professional tags
      'mastered': 'Mastered for iTunes',
      'copyright': itunesData.copyright || `℗ ${new Date().getFullYear()} ${itunesData.artistName || originalMetadata.artist}`,
      
      // Track information
      trackNumber: itunesData.trackNumber || originalMetadata.track?.no,
      trackCount: itunesData.trackCount || originalMetadata.track?.of,
      
      // Disc information
      discNumber: itunesData.discNumber || originalMetadata.disk?.no || 1,
      discCount: itunesData.discCount || originalMetadata.disk?.of || 1,
      
      // Additional metadata
      comment: {
        language: 'eng',
        text: `Enhanced with iTunes metadata - Match Score: ${itunesData.matchScore}%`
      }
    };
    
    // Download and add artwork if available
    if (itunesData.artworkUrl100) {
      try {
        const artworkUrl = itunesData.artworkUrl100.replace('100x100', '600x600'); // Get higher resolution
        let artworkBuffer;
        
        try {
          // Try built-in fetch first
          const artworkResponse = await fetch(artworkUrl);
          if (artworkResponse.ok) {
            artworkBuffer = Buffer.from(await artworkResponse.arrayBuffer());
          }
        } catch (fetchError) {
          // Fallback to https module
          const https = require('https');
          const urlParsed = new URL(artworkUrl);
          
          artworkBuffer = await new Promise((resolve, reject) => {
            const req = https.request({
              hostname: urlParsed.hostname,
              path: urlParsed.pathname + urlParsed.search,
              method: 'GET'
            }, (res) => {
              const chunks = [];
              res.on('data', chunk => chunks.push(chunk));
              res.on('end', () => resolve(Buffer.concat(chunks)));
            });
            
            req.on('error', reject);
            req.end();
          });
        }
        
        if (artworkBuffer) {
          enrichedTags.image = {
            mime: 'image/jpeg',
            type: {
              id: 3,
              name: 'front cover'
            },
            description: 'Front Cover',
            imageBuffer: artworkBuffer
          };
        }
      } catch (artworkError) {
        console.warn('Failed to download artwork:', artworkError.message);
      }
    }
    
    return {
      success: true,
      enrichedMetadata: enrichedTags,
      matchScore: itunesData.matchScore
    };
    
  } catch (error) {
    console.error('Error enriching metadata:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Write enriched metadata to file
ipcMain.handle('write-metadata', async (event, filePath, enrichedMetadata) => {
  try {
    const NodeID3 = await import('node-id3');
    
    // Convert our metadata format to node-id3 format
    const id3Tags = {
      title: enrichedMetadata.title,
      artist: enrichedMetadata.artist,
      album: enrichedMetadata.album,
      albumartist: enrichedMetadata.albumartist,
      year: enrichedMetadata.year,
      genre: enrichedMetadata.genre,
      trackNumber: enrichedMetadata.trackNumber ? enrichedMetadata.trackNumber.toString() : undefined,
      partOfSet: enrichedMetadata.discNumber ? enrichedMetadata.discNumber.toString() : undefined,
      comment: enrichedMetadata.comment,
      copyright: enrichedMetadata.copyright,
      
      // iTunes-specific tags (using TXXX frames for custom tags)
      userDefinedText: [
        { description: 'iTunesCountry', value: enrichedMetadata.itunesCountry },
        { description: 'iTunesAlbumId', value: enrichedMetadata.itunesAlbumId },
        { description: 'iTunesArtistId', value: enrichedMetadata.itunesArtistId },
        { description: 'iTunesCatalogId', value: enrichedMetadata.itunesCatalogId },
        { description: 'iTunesGenreId', value: enrichedMetadata.itunesGenreId },
        { description: 'iTunesAdvisory', value: enrichedMetadata.itunesAdvisory },
        { description: 'Mastered', value: enrichedMetadata.mastered }
      ].filter(tag => tag.value) // Only include tags with values
    };
    
    // Add artwork if available
    if (enrichedMetadata.image && enrichedMetadata.image.imageBuffer) {
      id3Tags.image = enrichedMetadata.image;
    }
    
    // Create backup of original file
    const backupPath = filePath + '.backup';
    await fs.copyFile(filePath, backupPath);
    
    // Write new tags
    const success = NodeID3.default.write(id3Tags, filePath);
    
    if (success) {
      return {
        success: true,
        message: 'Metadata written successfully',
        backupPath: backupPath
      };
    } else {
      // Restore backup if write failed
      await fs.copyFile(backupPath, filePath);
      throw new Error('Failed to write metadata tags');
    }
    
  } catch (error) {
    console.error('Error writing metadata:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Drag and drop file validation handler (removed - no longer needed)
// ipcMain.handle('validate-dropped-files', async (event, filePaths) => {
//   // This functionality has been removed in favor of file/folder selection
// });
