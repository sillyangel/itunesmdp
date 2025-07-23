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

        // Clear all songs button
        const clearAllBtn = document.getElementById('clearAllBtn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAllSongs();
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
        const songList = document.getElementById('songList');
        const songCount = document.getElementById('songCount');
        const contentLayout = document.getElementById('contentLayout');
        
        songList.innerHTML = '';
        
        // Update song count
        songCount.textContent = `${filePaths.length} song${filePaths.length !== 1 ? 's' : ''}`;
        
        // Show content layout and hide file selection
        contentLayout.style.display = 'grid';
        document.querySelector('.file-selection').style.display = 'none';
        
        filePaths.forEach((filePath, index) => {
            const songItem = document.createElement('div');
            songItem.className = 'song-item';
            songItem.dataset.filePath = filePath; // Store full path for reference
            if (index === 0) songItem.classList.add('active');
            
            const fileName = filePath.split('\\').pop().split('/').pop();
            
            // Start with filename as title, will be updated when metadata loads
            songItem.innerHTML = `
                <button class="remove-song-btn" title="Remove song">×</button>
                <div class="song-title">${fileName.replace(/\.[^/.]+$/, '')}</div>
                <div class="song-details">
                    <div class="song-artist">Loading...</div>
                    <div class="song-year">-</div>
                </div>
            `;
            
            // Add click handler for song selection (but not on remove button)
            songItem.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-song-btn')) {
                    return; // Don't select song when clicking remove button
                }
                // Remove active class from all items
                document.querySelectorAll('.song-item').forEach(item => 
                    item.classList.remove('active')
                );
                // Add active class to clicked item
                songItem.classList.add('active');
                // Load metadata for this file
                this.loadFileMetadata(filePath);
            });
            
            // Add remove button functionality
            const removeBtn = songItem.querySelector('.remove-song-btn');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent song selection
                this.removeSongFromList(filePath);
            });
            
            songList.appendChild(songItem);
        });
        
        // Load metadata for all songs to populate sidebar info
        this.loadSongListMetadata(filePaths);
    }

    removeSongFromList(filePathToRemove) {
        // Remove from selectedFiles array
        this.selectedFiles = this.selectedFiles.filter(filePath => filePath !== filePathToRemove);
        
        // Check if the removed song was currently active
        const wasActive = document.querySelector(`.song-item[data-file-path="${filePathToRemove}"]`)?.classList.contains('active');
        
        // If no songs left, show file selection again
        if (this.selectedFiles.length === 0) {
            this.clearResults();
            this.showSuccess('All songs removed');
            return;
        }
        
        // Update the file list
        this.updateFileList(this.selectedFiles);
        
        // If the removed song was active, select the first song
        if (wasActive && this.selectedFiles.length > 0) {
            this.loadFileMetadata(this.selectedFiles[0]);
        }
        
        this.showSuccess('Song removed from list');
    }

    clearAllSongs() {
        if (this.selectedFiles.length === 0) {
            this.showWarning('No songs to clear');
            return;
        }
        
        // Clear all files
        this.selectedFiles = [];
        this.currentFile = null;
        
        // Show file selection and hide content
        this.clearResults();
        
        this.showSuccess('All songs cleared');
    }

    async loadSongListMetadata(filePaths) {
        for (const filePath of filePaths) {
            try {
                const result = await window.electronAPI.readMetadata(filePath);
                if (result.success && result.metadata) {
                    this.updateSongItemDisplay(filePath, result.metadata);
                }
            } catch (error) {
                console.log(`Failed to load metadata for sidebar: ${filePath}`, error);
            }
        }
    }

    updateSongItemDisplay(filePath, metadata) {
        const songItems = document.querySelectorAll('.song-item');
        songItems.forEach(item => {
            if (item.dataset.filePath === filePath) {
                const title = metadata.title || filePath.split('\\').pop().split('/').pop().replace(/\.[^/.]+$/, '');
                const artist = metadata.artist || 'Unknown Artist';
                const year = metadata.date || '-';
                
                const titleElement = item.querySelector('.song-title');
                const artistElement = item.querySelector('.song-artist');
                const yearElement = item.querySelector('.song-year');
                
                if (titleElement) titleElement.textContent = title;
                if (artistElement) artistElement.textContent = artist;
                if (yearElement) yearElement.textContent = year;
            }
        });
    }

    displayMetadata(metadata) {
        // Update current metadata display - metadata structure is already flattened from main.js
        document.getElementById('currentTitle').textContent = metadata.title || 'Unknown Title';
        document.getElementById('currentArtist').textContent = metadata.artist || 'Unknown Artist';
        document.getElementById('currentAlbum').textContent = metadata.album || 'Unknown Album';
        document.getElementById('currentAlbumArtist').textContent = metadata.albumartist || metadata.artist || 'Unknown Album Artist';
        document.getElementById('currentYear').textContent = metadata.date || 'Unknown Year';
        document.getElementById('currentTrack').textContent = 
            metadata.track?.no ? `${metadata.track.no}${metadata.track.of ? ` of ${metadata.track.of}` : ''}` : 'N/A';
        document.getElementById('currentGenre').textContent = metadata.genre || 'Unknown Genre';
        
        // Update technical info
        document.getElementById('fileName').textContent = metadata.fileName || 'Unknown File';
        document.getElementById('fileSize').textContent = this.formatFileSize(metadata.fileSize || 0);
        document.getElementById('duration').textContent = this.formatDuration(metadata.duration);
        document.getElementById('bitrate').textContent = metadata.bitrate ? `${Math.round(metadata.bitrate / 1000)} kbps` : 'N/A';
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
        // Hide content layout and show file selection
        const contentLayout = document.getElementById('contentLayout');
        if (contentLayout) contentLayout.style.display = 'none';
        
        const fileSelection = document.querySelector('.file-selection');
        if (fileSelection) fileSelection.style.display = 'block';
        
        // Clear song list
        const songList = document.getElementById('songList');
        if (songList) songList.innerHTML = '';
        
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

    // iTunes search functionality
    async searchItunes() {
        if (!this.currentFile) {
            this.showError('No file selected. Please select a file first.');
            return;
        }

        try {
            this.showLoading('Searching iTunes API...');
            
            const searchParams = {
                title: this.currentFile.title,
                artist: this.currentFile.artist,
                album: this.currentFile.album,
                duration: this.currentFile.duration
            };

            console.log('Searching iTunes with params:', searchParams);
            
            const result = await window.electronAPI.searchItunes(searchParams);
            
            if (result.success) {
                this.displayItunesResults(result.results, searchParams);
                this.showSuccess(`Found ${result.results.length} result(s) from iTunes`);
            } else {
                this.showError(`iTunes search failed: ${result.error}`);
            }
        } catch (error) {
            console.error('iTunes search error:', error);
            this.showError('Failed to search iTunes API');
        } finally {
            this.hideLoading();
        }
    }

    displayItunesResults(results, searchParams) {
        const itunesResults = document.getElementById('itunesResults');
        const itunesSection = document.getElementById('itunesSection');
        
        if (!itunesResults || !itunesSection) return;
        
        itunesResults.innerHTML = '';
        itunesSection.style.display = 'block';
        
        if (results.length === 0) {
            itunesResults.innerHTML = '<div class="no-results">No results found on iTunes</div>';
            return;
        }

        // Display top 10 results
        const topResults = results.slice(0, 10);
        
        topResults.forEach((result, index) => {
            const resultElement = document.createElement('div');
            resultElement.className = 'itunes-result';
            resultElement.dataset.resultIndex = index;
            
            // Format duration
            const duration = result.trackTimeMillis ? 
                this.formatDuration(result.trackTimeMillis / 1000) : 'N/A';
            
            // Format release date
            const releaseDate = result.releaseDate ? 
                new Date(result.releaseDate).getFullYear() : 'N/A';
            
            // Get match score color
            const scoreColor = this.getScoreColor(result.matchScore);
            
            resultElement.innerHTML = `
                <div class="result-header">
                    <div class="result-artwork">
                        ${result.artworkUrl100 ? 
                            `<img src="${result.artworkUrl100}" alt="Artwork" class="result-artwork-img">` :
                            '<div class="no-artwork-placeholder">♪</div>'
                        }
                    </div>
                    <div class="result-info">
                        <div class="result-title">${result.trackName || 'Unknown Title'}</div>
                        <div class="result-artist">${result.artistName || 'Unknown Artist'}</div>
                        <div class="result-album">${result.collectionName || 'Unknown Album'}</div>
                        <div class="result-meta">
                            <span class="result-year">${releaseDate}</span>
                            <span class="result-duration">${duration}</span>
                            <span class="result-genre">${result.primaryGenreName || 'Unknown'}</span>
                        </div>
                    </div>
                    <div class="result-actions">
                        <div class="match-score" style="color: ${scoreColor}">
                            ${result.matchScore}% Match
                        </div>
                        <button class="btn btn-primary apply-itunes-btn" onclick="app.applyItunesMetadata(${index})">
                            Apply Metadata
                        </button>
                    </div>
                </div>
                <div class="result-details">
                    <div class="itunes-tags">
                        <div class="tag-group">
                            <h4>iTunes Information</h4>
                            <div class="tag-item">
                                <span class="tag-label">Track ID:</span>
                                <span class="tag-value">${result.trackId || 'N/A'}</span>
                            </div>
                            <div class="tag-item">
                                <span class="tag-label">Collection ID:</span>
                                <span class="tag-value">${result.collectionId || 'N/A'}</span>
                            </div>
                            <div class="tag-item">
                                <span class="tag-label">Artist ID:</span>
                                <span class="tag-value">${result.artistId || 'N/A'}</span>
                            </div>
                            <div class="tag-item">
                                <span class="tag-label">Country:</span>
                                <span class="tag-value">${result.country || 'USA'}</span>
                            </div>
                            <div class="tag-item">
                                <span class="tag-label">Content Advisory:</span>
                                <span class="tag-value">${result.trackExplicitness || 'notExplicit'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            itunesResults.appendChild(resultElement);
        });
        
        // Store results for later use
        this.itunesSearchResults = results;
    }

    getScoreColor(score) {
        if (score >= 90) return '#10b981'; // Green
        if (score >= 70) return '#f59e0b'; // Yellow
        if (score >= 50) return '#ef4444'; // Orange
        return '#ef4444'; // Red
    }

    async applyItunesMetadata(resultIndex) {
        if (!this.itunesSearchResults || !this.itunesSearchResults[resultIndex]) {
            this.showError('iTunes result not found');
            return;
        }

        if (!this.currentFile) {
            this.showError('No file selected');
            return;
        }

        try {
            this.showLoading('Enriching metadata...');
            
            const itunesData = this.itunesSearchResults[resultIndex];
            
            console.log('Applying iTunes metadata:', itunesData);
            
            // Enrich metadata
            const enrichResult = await window.electronAPI.enrichMetadata(this.currentFile, itunesData);
            
            if (!enrichResult.success) {
                throw new Error(enrichResult.error);
            }
            
            // Write to file
            const writeResult = await window.electronAPI.writeMetadata(
                this.currentFile.filePath, 
                enrichResult.enrichedMetadata
            );
            
            if (writeResult.success) {
                // Reload the file metadata to show updated information
                await this.loadFileMetadata(this.currentFile.filePath);
                
                this.showSuccess(`Metadata successfully updated with ${itunesData.matchScore}% match from iTunes! Backup created.`);
                
                // Update the song in the sidebar
                this.updateSongItemDisplay(this.currentFile.filePath, enrichResult.enrichedMetadata);
                
                // Enable enrich button for other files
                const enrichMetadataBtn = document.getElementById('enrichMetadataBtn');
                if (enrichMetadataBtn) enrichMetadataBtn.disabled = false;
                
            } else {
                throw new Error(writeResult.error);
            }
            
        } catch (error) {
            console.error('Error applying iTunes metadata:', error);
            this.showError(`Failed to apply metadata: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async enrichMetadata() {
        if (!this.currentFile) {
            this.showError('No file selected. Please select a file first.');
            return;
        }

        if (!this.itunesSearchResults || this.itunesSearchResults.length === 0) {
            this.showError('No iTunes search results available. Please search iTunes first.');
            return;
        }

        // Apply the best match (first result which is already sorted by score)
        await this.applyItunesMetadata(0);
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
    window.app = new iTunesMetadataPuller();
});
