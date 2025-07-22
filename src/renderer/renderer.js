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

        // Drop zone events
        const dropZone = document.getElementById('dropZone');
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            this.handleFileDrop(e);
        });

        dropZone.addEventListener('click', () => {
            this.selectFiles();
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

    async handleFileDrop(event) {
        try {
            this.showLoading('Processing dropped files...');
            
            const files = Array.from(event.dataTransfer.files);
            const filePaths = files.map(file => file.path);
            
            console.log('Dropped files:', filePaths);
            
            // Validate dropped files
            const result = await window.electronAPI.validateDroppedFiles(filePaths);
            
            if (result.success) {
                if (result.validFiles.length > 0) {
                    this.selectedFiles = result.validFiles;
                    await this.processSelectedFiles(result.validFiles);
                    
                    // Show warnings for invalid files
                    if (result.errors.length > 0) {
                        const invalidCount = result.errors.length;
                        this.showWarning(`${invalidCount} file(s) were skipped (not .m4a files)`);
                    }
                } else {
                    this.showError('No valid .m4a files found in the dropped files');
                }
            } else {
                this.showError(`Failed to process dropped files: ${result.error}`);
            }
        } catch (error) {
            console.error('Failed to handle dropped files:', error);
            this.showError('Failed to process dropped files. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async processSelectedFiles(filePaths) {
        try {
            this.clearResults();
            this.updateFileList(filePaths);
            
            // Process first file automatically
            if (filePaths.length > 0) {
                await this.loadFileMetadata(filePaths[0]);
            }
            
            this.showSuccess(`Loaded ${filePaths.length} file(s)`);
        } catch (error) {
            console.error('Error processing selected files:', error);
            this.showError('Failed to process selected files');
        }
    }

    async loadFileMetadata(filePath) {
        try {
            this.showLoading('Reading metadata...');
            
            const result = await window.electronAPI.readMetadata(filePath);
            
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

    updateFileList(filePaths) {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';
        
        filePaths.forEach((filePath, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            if (index === 0) fileItem.classList.add('active');
            
            const fileName = filePath.split('\\').pop().split('/').pop();
            fileItem.innerHTML = `
                <div class="file-icon">🎵</div>
                <div class="file-info">
                    <div class="file-name">${fileName}</div>
                    <div class="file-path">${filePath}</div>
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
