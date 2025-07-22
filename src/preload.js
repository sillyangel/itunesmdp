const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // File operations (will be added as we build features)
  // selectFiles: () => ipcRenderer.invoke('select-files'),
  // readMetadata: (filePath) => ipcRenderer.invoke('read-metadata', filePath),
  
  // iTunes API operations (will be added later)
  // searchItunes: (query) => ipcRenderer.invoke('search-itunes', query),
  // getByCollectionId: (collectionId) => ipcRenderer.invoke('get-by-collection-id', collectionId),
});
