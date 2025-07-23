const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // File operations
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readMetadata: (filePath) => ipcRenderer.invoke('read-metadata', filePath),
  
  // iTunes API operations
  searchItunes: (searchParams) => ipcRenderer.invoke('search-itunes', searchParams),
  enrichMetadata: (originalMetadata, itunesData) => ipcRenderer.invoke('enrich-metadata', originalMetadata, itunesData),
  writeMetadata: (filePath, enrichedMetadata) => ipcRenderer.invoke('write-metadata', filePath, enrichedMetadata),
  
  // Testing
  testMetadataWriting: () => ipcRenderer.invoke('test-metadata-writing'),
});
