# Digital Asset Downloader

A modern, cross-platform desktop application for bulk downloading and processing digital assets (images, PDFs, etc.) from Excel/CSV data sources. This project is a migration and enhancement of a 2,485-line Python/PySide6 application, now rebuilt using Electron, React, and TypeScript.

---

## Key Features

- Multi-threaded bulk downloads from Excel/CSV data
- Advanced image processing with four background removal methods:
  - Smart background detection
  - AI background removal
  - Color range replacement
  - Edge detection
- Supports both URL downloads and local file copying
- Intelligent filename matching from source folders (by part number or custom column)
- Comprehensive logging and error handling
- Configurable download folders and network path logging
- Persistent configuration and session auto-load
- Real-time progress tracking and summary logs
- Modern, user-friendly UI with tabbed workflow

---

## Migration Overview

This project is a full rewrite of the original Python app (`/OLD_Standalone_App/Digital_Asset_Downloader.py`). The new version aims for:
- **Feature parity** with the original, including all advanced processing and search logic
- **Improved performance** and stability
- **Modern UI/UX** using React and Material-UI/Ant Design
- **Easy distribution** with auto-update support

### Key References from the Original App
- `BackgroundProcessor` class: Advanced image processing (Lines 45-287)
- `DownloadWorker` class: Download engine, retry logic, and file handling (Lines 290-486)
- Source folder search logic: Smart file discovery (Lines 340-362)
- Configuration schema: Persistent settings (Lines 1200-1225)

---

## Project Structure

- `/src/main` - Electron main process (file system, native dialogs)
- `/src/renderer` - React application (UI)
- `/src/shared` - Shared types and interfaces
- `/src/services` - Business logic (downloads, processing)
- `/src/workers` - Background workers for downloads/processing

---

## Getting Started

1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Start the app in development mode:**
   ```sh
   npm run dev
   ```
3. **Build for production:**
   ```sh
   npm run build
   ```
4. **Package installers:**
   ```sh
   npm run dist
   ```

---

## Usage Workflow

1. **File Selection:**
   - Load Excel/CSV file
   - Select sheet and preview data
2. **Column Mapping:**
   - Map part number, image/PDF URLs, and filename columns
   - Configure download and source folders
3. **Processing & Download:**
   - Choose background processing method and quality
   - Start downloads with real-time progress and logging
   - View summary and export logs

---

## Configuration & Customization

- All settings are saved and auto-loaded on startup
- Supports custom path templates for downloads and network logging
- Advanced options for background processing and concurrency

---

## Technology Stack

- **Frontend:** React 18, TypeScript, Material-UI/Ant Design
- **Backend:** Electron, Node.js, Sharp (image processing), ExcelJS, Axios
- **Other:** fast-csv, electron-store, rembg-node (AI background removal)

---

## License

MIT License

---

## Credits

- Original Python app by Shane Boaden
- Migration and modernization by the Digital Asset Downloader team

---

## Development Plan

See `DEVELOPMENT_PLAN.md` for a detailed, phase-based migration and implementation guide, including code references to the original application.
