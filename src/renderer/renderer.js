// Renderer process script
class iTunesMetadataPuller {
    constructor() {
        this.selectedFiles = [];
        this.currentFile = null;
        this.isDarkMode = false;
        this.init();
    }

    async init() {
        // Check for saved theme preference
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.applyTheme();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load app version
        try {
            const version = await window.electronAPI.getAppVersion();
            document.getElementById('appVersion').textContent = `Version ${version}`;
        } catch (error) {
            console.error('Failed to get app version:', error);
        }
    }

    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });

        // File selection button
        const selectFilesBtn = document.getElementById('selectFilesBtn');
        selectFilesBtn.addEventListener('click', () => {
            this.selectFiles();
        });

        // Folder selection button
        const selectFolderBtn = document.getElementById('selectFolderBtn');
        selectFolderBtn.addEventListener('click', () => {
            this.selectFolder();
        });

        // Metadata action buttons
        const searchItunesBtn = document.getElementById('searchItunesBtn');
        const enrichMetadataBtn = document.getElementById('enrichMetadataBtn');
        
        if (searchItunesBtn) {
            searchItunesBtn.addEventListener('click', () => {
                this.searchItunes();
            });
        }

        if (enrichMetadataBtn) {
            enrichMetadataBtn.addEventListener('click', () => {
                this.enrichMetadata();
            });
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode.toString());
        this.applyTheme();
    }

    applyTheme() {
        const body = document.body;
        const themeIcon = document.getElementById('themeIcon');
        
        if (this.isDarkMode) {
            body.classList.add('dark-mode');
            themeIcon.innerHTML = '☀️';
        } else {
            body.classList.remove('dark-mode');
            themeIcon.innerHTML = '🌙';
        }
    }

    async selectFiles() {
        try {
            this.showLoading('Selecting files...');
            console.log('Calling electronAPI.selectFiles()');
            
            const result = await window.electronAPI.selectFiles();
            console.log('File selection result:', result);
            
            if (result.success && result.files.length > 0) {
                this.selectedFiles = result.files;
                await this.processSelectedFiles(result.files);
            } else if (result.error) {
                this.showError(`Failed to select files: ${result.error}`);
            } else {
                console.log('No files selected');
            }
        } catch (error) {
            console.error('Failed to select files:', error);
            this.showError('Failed to select files. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async selectFolder() {
        try {
            this.showLoading('Scanning folder for M4A files...');
            console.log('Calling electronAPI.selectFolder()');
            
            const result = await window.electronAPI.selectFolder();
            console.log('Folder selection result:', result);
            
            if (result.success && result.files.length > 0) {
                this.selectedFiles = result.files;
                await this.processSelectedFiles(result.files, result.folderPath);
                this.showSuccess(`Found ${result.files.length} M4A file(s) in folder`);
            } else if (result.error) {
                this.showError(`Failed to scan folder: ${result.error}`);
            } else if (result.success && result.files.length === 0) {
                this.showWarning('No M4A files found in the selected folder');
            } else {
                console.log('No folder selected');
            }
        } catch (error) {
            console.error('Failed to select folder:', error);
            this.showError('Failed to scan folder. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async processSelectedFiles(filePaths, folderPath = null) {
        try {
            this.clearResults();
            this.updateFileList(filePaths, folderPath);
            
            // Prefetch artwork for all files
            this.prefetchArtwork(filePaths);
            
            // Process first file automatically
            if (filePaths.length > 0) {
                await this.loadFileMetadata(filePaths[0]);
            }
            
            const source = folderPath ? `folder: ${folderPath}` : 'selected files';
            this.showSuccess(`Loaded ${filePaths.length} file(s) from ${source}`);
        } catch (error) {
            console.error('Error processing selected files:', error);
            this.showError('Failed to process selected files');
        }
    }

    async prefetchArtwork(filePaths) {
        // Prefetch artwork for up to 50 files to avoid overwhelming the system
        const filesToPrefetch = filePaths.slice(0, 50);
        
        for (const filePath of filesToPrefetch) {
            try {
                const result = await window.electronAPI.readMetadata(filePath);
                if (result.success && result.metadata.picture) {
                    // Store artwork data for quick access
                    this.cacheArtwork(filePath, result.metadata.picture);
                    // Update the file item icon
                    this.updateFileItemArtwork(filePath, result.metadata.picture);
                }
            } catch (error) {
                console.log(`Failed to prefetch artwork for ${filePath}:`, error);
            }
        }
    }

    cacheArtwork(filePath, picture) {
        if (!this.artworkCache) {
            this.artworkCache = new Map();
        }
        this.artworkCache.set(filePath, picture);
    }

    getArtworkFromCache(filePath) {
        if (!this.artworkCache) {
            return null;
        }
        return this.artworkCache.get(filePath);
    }

    updateFileItemArtwork(filePath, picture) {
        const fileItems = document.querySelectorAll('.file-item');
        fileItems.forEach(item => {
            const storedPath = item.dataset.filePath;
            if (storedPath === filePath) {
                const iconElement = item.querySelector('.file-icon');
                if (iconElement && picture && picture.data) {
                    const blob = new Blob([picture.data], { type: picture.format });
                    const url = URL.createObjectURL(blob);
                    iconElement.innerHTML = `<img src="${url}" alt="Album Art" class="file-artwork">`;
                } else if (iconElement) {
                    // Keep default icon if no artwork
                    iconElement.innerHTML = `<div class="default-music-icon">🎵</div>`;
                }
            }
        });
    }

    async loadFileMetadata(filePath) {
        try {
            this.showLoading('Reading metadata...');
            
            // Check cache first
            const cachedArtwork = this.getArtworkFromCache(filePath);
            let result;
            
            if (cachedArtwork) {
                // Use cached data if available, but still need to read full metadata
                result = await window.electronAPI.readMetadata(filePath);
                if (result.success) {
                    result.metadata.picture = cachedArtwork;
                }
            } else {
                result = await window.electronAPI.readMetadata(filePath);
                if (result.success && result.metadata.picture) {
                    this.cacheArtwork(filePath, result.metadata.picture);
                }
            }
            
            if (result.success) {
                this.currentFile = result.metadata;
                this.displayMetadata(result.metadata);
                this.showSuccess('Metadata loaded successfully');
            } else {
                this.showError(`Failed to read metadata: ${result.error}`);
            }
        } catch (error) {
            console.error('Failed to load metadata:', error);
            this.showError('Failed to load file metadata');
        } finally {
            this.hideLoading();
        }
    }

    updateFileList(filePaths, folderPath = null) {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';
        
        // Add folder info if files came from folder selection
        if (folderPath) {
            const folderInfo = document.createElement('div');
            folderInfo.className = 'folder-info';
            folderInfo.innerHTML = `
                <div class="folder-icon">📁</div>
                <div class="folder-details">
                    <div class="folder-name">Folder: ${folderPath.split('\\').pop().split('/').pop()}</div>
                    <div class="folder-path">${folderPath}</div>
                    <div class="file-count">${filePaths.length} M4A file(s) found</div>
                </div>
            `;
            fileList.appendChild(folderInfo);
        }
        
        filePaths.forEach((filePath, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.filePath = filePath; // Store full path for reference
            if (index === 0) fileItem.classList.add('active');
            
            const fileName = filePath.split('\\').pop().split('/').pop();
            const relativePath = folderPath ? 
                filePath.replace(folderPath, '').replace(/^[\\\/]/, '') : 
                filePath;
            
            // Start with default music icon, artwork will be loaded via prefetch
            fileItem.innerHTML = `
                <div class="file-icon">
                    <div class="default-music-icon">🎵</div>
                </div>
                <div class="file-info">
                    <div class="file-name">${fileName}</div>
                    <div class="file-path">${relativePath}</div>
                </div>
            `;
            
            fileItem.addEventListener('click', () => {
                // Remove active class from all items
                document.querySelectorAll('.file-item').forEach(item => 
                    item.classList.remove('active')
                );
                // Add active class to clicked item
                fileItem.classList.add('active');
                // Load metadata for this file
                this.loadFileMetadata(filePath);
            });
            
            fileList.appendChild(fileItem);
        });
        
        // Show file list section
        document.getElementById('fileListSection').style.display = 'block';
    }

    displayMetadata(metadata) {
        // Update current metadata display
        document.getElementById('currentTitle').textContent = metadata.title;
        document.getElementById('currentArtist').textContent = metadata.artist;
        document.getElementById('currentAlbum').textContent = metadata.album;
        document.getElementById('currentAlbumArtist').textContent = metadata.albumartist;
        document.getElementById('currentYear').textContent = metadata.date;
        document.getElementById('currentTrack').textContent = 
            metadata.track.no ? `${metadata.track.no}${metadata.track.of ? ` of ${metadata.track.of}` : ''}` : 'N/A';
        document.getElementById('currentGenre').textContent = metadata.genre;
        
        // Update technical info
        document.getElementById('fileName').textContent = metadata.fileName;
        document.getElementById('fileSize').textContent = this.formatFileSize(metadata.fileSize);
        document.getElementById('duration').textContent = this.formatDuration(metadata.duration);
        document.getElementById('bitrate').textContent = metadata.bitrate ? `${metadata.bitrate} kbps` : 'N/A';
        document.getElementById('sampleRate').textContent = metadata.sampleRate ? `${metadata.sampleRate} Hz` : 'N/A';
        
        // Show current artwork
        this.displayCurrentArtwork(metadata.picture);
        
        // Show metadata section
        document.getElementById('metadataSection').style.display = 'block';
        
        // Enable iTunes search button
        if (document.getElementById('searchItunesBtn')) {
            document.getElementById('searchItunesBtn').disabled = false;
        }
    }

    displayCurrentArtwork(picture) {
        const currentArtwork = document.getElementById('currentArtwork');
        
        if (picture && picture.data) {
            const blob = new Blob([picture.data], { type: picture.format });
            const url = URL.createObjectURL(blob);
            currentArtwork.innerHTML = `<img src="${url}" alt="Current Artwork" class="artwork-image">`;
        } else {
            currentArtwork.innerHTML = '<div class="no-artwork">No artwork found</div>';
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(seconds) {
        if (!seconds) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    clearResults() {
        // Clear file list
        const fileList = document.getElementById('fileList');
        if (fileList) fileList.innerHTML = '';
        
        const fileListSection = document.getElementById('fileListSection');
        if (fileListSection) fileListSection.style.display = 'none';
        
        // Clear metadata
        const metadataSection = document.getElementById('metadataSection');
        if (metadataSection) metadataSection.style.display = 'none';
        
        // Clear iTunes results
        const itunesResults = document.getElementById('itunesResults');
        if (itunesResults) itunesResults.innerHTML = '';
        
        const itunesSection = document.getElementById('itunesSection');
        if (itunesSection) itunesSection.style.display = 'none';
        
        // Disable action buttons
        const searchItunesBtn = document.getElementById('searchItunesBtn');
        if (searchItunesBtn) searchItunesBtn.disabled = true;
        
        const enrichMetadataBtn = document.getElementById('enrichMetadataBtn');
        if (enrichMetadataBtn) enrichMetadataBtn.disabled = true;
        
        // Clear current file
        this.currentFile = null;
    }

    // Placeholder methods for iTunes functionality (Feature 3)
    async searchItunes() {
        console.log('iTunes search will be implemented in Feature 3');
        this.showInfo('iTunes search functionality will be available in the next feature');
    }

    async enrichMetadata() {
        console.log('Metadata enrichment will be implemented in Feature 4');
        this.showInfo('Metadata enrichment functionality will be available in a future feature');
    }

    // UI Helper methods
    showLoading(message = 'Loading...') {
        const loadingEl = document.getElementById('loadingIndicator');
        const messageEl = document.getElementById('loadingMessage');
        if (loadingEl && messageEl) {
            messageEl.textContent = message;
            loadingEl.style.display = 'flex';
        }
    }

    hideLoading() {
        const loadingEl = document.getElementById('loadingIndicator');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        // Add to notifications container
        const container = document.getElementById('notifications');
        if (container) {
            container.appendChild(notification);
        }
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    new iTunesMetadataPuller();
});
