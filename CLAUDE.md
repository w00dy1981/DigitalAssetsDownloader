# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Development & Build
- `npm run dev` - Start development with hot reload (main process, renderer, and electron)
- `npm run build` - Build for production (both main and renderer processes)
- `npm run start:electron` - Start Electron (requires built files)

### Code Quality
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier

### Distribution
- `npm run dist` - Build and package for current platform
- `npm run dist:mac` - Build macOS DMG
- `npm run dist:win` - Build Windows installer
- `npm run dist:linux` - Build Linux packages

## Architecture Overview

### Core Structure
This is an Electron application built with React and TypeScript, migrating from a 2,485-line Python/PySide6 application. The architecture follows a clear separation of concerns:

- **Main Process** (`src/main/`) - Electron main process handling file system operations, native dialogs, and IPC
- **Renderer Process** (`src/renderer/`) - React frontend with three-tab workflow
- **Shared Types** (`src/shared/`) - TypeScript interfaces used across both processes
- **Services** (`src/services/`) - Business logic for Excel processing, downloads, and image processing
- **Workers** (`src/workers/`) - Background workers for heavy operations

### Key Components

#### Main Process (`src/main/main.ts`)
- `DigitalAssetDownloaderApp` class manages the entire application lifecycle
- Handles window state persistence using `electron-store`
- Implements comprehensive IPC handlers for file operations and configuration
- Provides native menu with keyboard shortcuts (Ctrl/Cmd+O, Ctrl/Cmd+S)

#### UI Architecture (`src/renderer/App.tsx`)
Three-tab workflow matching original Python application:
1. **File Selection** - Excel/CSV loading with drag & drop
2. **Column Selection** - Column mapping for part numbers, images, PDFs
3. **Process & Download** - Download execution with progress tracking

#### Data Flow
- `SpreadsheetData` interface for loaded Excel/CSV data
- `DownloadConfig` interface matching original Python configuration schema
- Configuration persistence with auto-load on startup

### Excel/CSV Processing (`src/services/excelService.ts`)
- Supports .xlsx, .xls, .xlsm, and .csv files using ExcelJS and fast-csv
- Handles multiple sheets with proper data type conversion
- Robust error handling for file format issues

### Download Engine (`src/services/downloadService.ts`)
- Complete implementation of sophisticated download functionality from Python app
- Source folder searching with part number and filename matching
- Comprehensive retry logic with exponential backoff (3 attempts)
- Image processing with Sharp (automatic JPG conversion with quality control)
- Network path separation for CSV logging
- Progress tracking with real-time updates and ETAs
- Concurrent download management with configurable workers (1-20 threads)
- Advanced error handling and validation

### TypeScript Configuration
- Path aliases configured (`@/` prefix for all source directories)
- Strict TypeScript settings enabled
- Separate tsconfig files for main and renderer processes

## Migration Context

This application is migrating from `OLD_Standalone_App/Digital_Asset_Downloader.py` with these key features to implement:

### Core Features (from Python original)
- **Multi-threaded downloads** with configurable worker count (1-20)
- **Source folder searching** - finds files by part number or custom filename column
- **Advanced image processing** - 4 background removal methods (smart_detect, ai_removal, color_replace, edge_detection)
- **Network path logging** - separate download paths vs. CSV log paths
- **Comprehensive retry logic** - exponential backoff with 3 attempts
- **Configuration persistence** - auto-load previous settings on startup

### Key Code References (Python app line numbers)
- `BackgroundProcessor` class (Lines 45-287) - Advanced image processing
- `DownloadWorker` class (Lines 290-486) - Download engine with retry logic
- Source folder search (Lines 340-362) - File matching by part number
- Configuration schema (Lines 1200-1225) - Settings persistence

## Development Notes

### Current Implementation Status
- **Phase 1 & 2 & 3 & 4 Complete** - Full UI, Excel/CSV processing, column mapping, and advanced download engine working
- **Phase 5-8 Planned** - Background image processing (4 methods), advanced features, testing, and distribution

### Core Features Implemented
- **Multi-threaded downloads** with configurable worker count (1-20)
- **Source folder searching** - finds files by part number or custom filename column
- **Advanced retry logic** - exponential backoff with 3 attempts, 30s timeout
- **Network path logging** - separate download paths vs. CSV log paths
- **Configuration validation** - prevents invalid operations with clear error messages
- **Real-time progress tracking** - with ETAs and success/failure counters
- **Comprehensive CSV logging** - matches original Python format exactly

### File Naming Conventions
- React components use PascalCase (e.g., `FileSelectionTab.tsx`)
- Services use camelCase (e.g., `excelService.ts`)
- Types are defined in `src/shared/types.ts` with comprehensive interfaces

### IPC Communication
- All channels defined in `IPC_CHANNELS` constant in `src/shared/types.ts`
- Follows request-response pattern with proper error handling
- Uses `electron-store` for configuration persistence

### Error Handling
- Comprehensive try-catch blocks in all async operations
- User-friendly error messages in UI
- Console logging for debugging (no production logging setup yet)

## Key Implementation Details

### Window Management
- Window state (size, position, maximized) persists between sessions
- Minimum window size: 900x700 (matching original Python app)
- Proper window showing/hiding with ready-to-show events

### File Operations
- Drag & drop support for Excel/CSV files
- Recent files tracking (up to 10 files)
- Native file dialogs for folder selection

### Configuration Schema
The `DownloadConfig` interface exactly matches the original Python app's configuration structure, ensuring compatibility and feature parity.

## Testing Strategy

When implementing new features, validate against the original Python application behavior:
- Test file format compatibility (.xlsx, .xls, .xlsm, .csv)
- Verify column mapping preserves data types
- Ensure configuration persistence works correctly
- Test error scenarios (invalid files, network issues, etc.)

## Next Development Priorities

1. **Column Selection UI** - Complete the mapping interface
2. **Download Engine** - Port sophisticated download logic from Python
3. **Image Processing** - Implement four background removal methods
4. **Progress Tracking** - Real-time download status and logging
5. **Source Folder Search** - Critical feature for file matching