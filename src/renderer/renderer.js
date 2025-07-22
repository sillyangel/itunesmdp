// Renderer process script
class iTunesMetadataPuller {
    constructor() {
        this.selectedFiles = [];
        this.currentFile = null;
        this.init();
    }

    async init() {
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

        // Metadata action buttons (will be implemented later)
        const searchItunesBtn = document.getElementById('searchItunesBtn');
        const enrichMetadataBtn = document.getElementById('enrichMetadataBtn');
        
        searchItunesBtn.addEventListener('click', () => {
            this.searchItunes();
        });

        enrichMetadataBtn.addEventListener('click', () => {
            this.enrichMetadata();
        });
    }

    async selectFiles() {
        try {
            // This will be implemented when we add the IPC handler
            console.log('File selection will be implemented in the next feature');
            // const files = await window.electronAPI.selectFiles();
            // this.handleSelectedFiles(files);
        } catch (error) {
            console.error('Failed to select files:', error);
        }
    }

    handleFileDrop(event) {
        const files = Array.from(event.dataTransfer.files);
        const m4aFiles = files.filter(file => 
            file.name.toLowerCase().endsWith('.m4a') || 
            file.type === 'audio/mp4'
        );
        
        if (m4aFiles.length > 0) {
            console.log('Dropped files:', m4aFiles);
            // File processing will be implemented in the next feature
        } else {
            this.showNotification('Please drop .m4a files only', 'warning');
        }
    }

    handleSelectedFiles(files) {
        this.selectedFiles = files;
        this.updateFileList();
        this.showFileListSection();
    }

    updateFileList() {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';

        this.selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-name">${file.name}</div>
                <div class="file-path">${file.path}</div>
            `;
            
            fileItem.addEventListener('click', () => {
                this.selectFile(index);
            });
            
            fileList.appendChild(fileItem);
        });
    }

    showFileListSection() {
        document.getElementById('fileListSection').style.display = 'block';
    }

    selectFile(index) {
        this.currentFile = this.selectedFiles[index];
        console.log('Selected file:', this.currentFile);
        
        // Highlight selected file
        const fileItems = document.querySelectorAll('.file-item');
        fileItems.forEach((item, i) => {
            if (i === index) {
                item.style.background = 'rgba(102, 126, 234, 0.1)';
                item.style.borderLeft = '4px solid #667eea';
            } else {
                item.style.background = 'rgba(255, 255, 255, 0.95)';
                item.style.borderLeft = 'none';
            }
        });

        // Show metadata section and load metadata (will be implemented)
        this.showMetadataSection();
        this.loadFileMetadata();
    }

    showMetadataSection() {
        document.getElementById('metadataSection').style.display = 'block';
    }

    async loadFileMetadata() {
        if (!this.currentFile) return;

        try {
            console.log('Loading metadata for:', this.currentFile.path);
            // Metadata reading will be implemented in the next feature
            // const metadata = await window.electronAPI.readMetadata(this.currentFile.path);
            // this.populateMetadataForm(metadata);
        } catch (error) {
            console.error('Failed to load metadata:', error);
            this.showNotification('Failed to load file metadata', 'error');
        }
    }

    populateMetadataForm(metadata) {
        document.getElementById('title').value = metadata.title || '';
        document.getElementById('artist').value = metadata.artist || '';
        document.getElementById('album').value = metadata.album || '';
        
        // Display artwork if available
        if (metadata.artwork) {
            this.displayArtwork(metadata.artwork);
        }
    }

    displayArtwork(artworkData) {
        const artworkContainer = document.getElementById('artworkContainer');
        
        if (artworkData) {
            const img = document.createElement('img');
            img.className = 'artwork-image';
            img.src = `data:${artworkData.format};base64,${artworkData.data}`;
            artworkContainer.innerHTML = '';
            artworkContainer.appendChild(img);
        } else {
            artworkContainer.innerHTML = '<div class="no-artwork">No artwork available</div>';
        }
    }

    async searchItunes() {
        const title = document.getElementById('title').value;
        const artist = document.getElementById('artist').value;
        const album = document.getElementById('album').value;
        const collectionId = document.getElementById('collectionId').value;

        try {
            console.log('Searching iTunes...');
            // iTunes search will be implemented in a future feature
            this.showNotification('iTunes search will be implemented in the next feature', 'info');
        } catch (error) {
            console.error('iTunes search failed:', error);
            this.showNotification('iTunes search failed', 'error');
        }
    }

    async enrichMetadata() {
        try {
            console.log('Enriching metadata...');
            // Metadata enrichment will be implemented in a future feature
            this.showNotification('Metadata enrichment will be implemented in the next feature', 'info');
        } catch (error) {
            console.error('Metadata enrichment failed:', error);
            this.showNotification('Metadata enrichment failed', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Simple notification system - can be enhanced later
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? '#e53e3e' : type === 'warning' ? '#d69e2e' : '#3182ce'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new iTunesMetadataPuller();
});

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
