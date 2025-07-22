# Testing Feature 2: File Selection & Metadata Reading

## What to Test

### 1. File Selection Button
- Click the "Select Files" button
- Choose one or more .m4a files from your system
- Verify files are loaded and displayed in the file list

### 2. Drag and Drop
- Drag .m4a files from your file explorer
- Drop them onto the drop zone
- Verify files are processed and displayed

### 3. File List Display
- Multiple files should show in a list
- First file should be automatically selected (highlighted)
- Click on different files to switch between them
- File names and paths should be displayed

### 4. Metadata Reading
- When a file is selected, metadata should display:
  - Title, Artist, Album, Album Artist, Year, Track, Genre
  - Technical info: File name, size, duration, bitrate, sample rate
  - Current artwork (if available)

### 5. Error Handling
- Try dropping non-.m4a files (should show warning)
- Try selecting invalid files (should show error)
- All errors should display as notifications

### 6. UI Features
- Loading indicators should appear during operations
- Notifications should appear for success/error/warning messages
- iTunes search button should be enabled after loading a file
- Metadata enrichment button should show "coming soon" message

## Expected Behavior

✅ File selection works via button and drag-and-drop
✅ Only .m4a files are accepted
✅ File list displays with clickable items
✅ Metadata is extracted and displayed correctly
✅ Technical information is shown
✅ Artwork is displayed (if present)
✅ Loading states and notifications work
✅ Error handling for invalid files

## Sample Test Files

You can test with any .m4a files you have, or create test files using:
- iTunes/Apple Music exports
- Converted MP3 files (using ffmpeg or similar)
- Downloaded .m4a files from various sources

## Next Steps

After testing Feature 2, we'll implement:
- **Feature 3**: iTunes API integration for searching and matching
- **Feature 4**: Metadata enrichment and file writing

The app should now be fully functional for file selection and metadata reading!
