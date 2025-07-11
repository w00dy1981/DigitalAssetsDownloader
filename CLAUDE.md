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

## Current Implementation Status

### ✅ **COMPLETED - Production Ready Application**

#### **Phase 1-5 Complete** - All Core Features Implemented:
- **Phase 1**: Electron + React + TypeScript foundation ✅
- **Phase 2**: Excel/CSV processing with ExcelJS ✅  
- **Phase 3**: Column mapping & configuration UI ✅
- **Phase 4**: Advanced download engine with retry logic ✅
- **Phase 5**: Smart background processing & dark theme ✅

#### **Key Features Working:**
✅ **Multi-threaded downloads** with configurable worker count (1-20)  
✅ **Source folder searching** - finds files by part number or custom filename  
✅ **Smart background processing** - PNG transparency → white backgrounds  
✅ **Advanced retry logic** - exponential backoff with 3 attempts, 30s timeout  
✅ **Network path logging** - separate download paths vs. CSV log paths  
✅ **Configuration validation** - prevents invalid operations with clear error messages  
✅ **Real-time progress tracking** - with ETAs and success/failure counters  
✅ **Comprehensive CSV logging** - matches original Python format exactly  
✅ **Dark theme UI** - professional appearance, easy on the eyes  
✅ **Cross-platform compatibility** - macOS development → Windows production  

#### **Enterprise Features:**
✅ **Background processing enabled by default** - optimized for supplier workflows  
✅ **Sharp image processing** - cross-platform PNG → JPEG conversion  
✅ **Intelligent transparency detection** - only processes images that need it  
✅ **ERP integration ready** - with default network paths configured  
✅ **Professional UI** - streamlined layout for 27" monitors without scrolling  

### **Production Deployment Ready:**
The application now has full feature parity with the original Python application plus modern improvements:
- **Better Performance**: JavaScript concurrency vs Python threading
- **Modern UI**: Dark theme, better UX than original PySide6 interface  
- **Cross-Platform**: Single codebase for macOS and Windows
- **Maintainable**: TypeScript, modular architecture, comprehensive error handling

---

# 🚨 CRITICAL DEVELOPMENT SAFEGUARDS - FOLLOW STRICTLY

## **KISS (Keep It Simple, Stupid) & DRY (Don't Repeat Yourself) Principles**

### **⚠️ MANDATORY: Read Before ANY Code Changes**

This application is **PRODUCTION READY** and **FULLY FUNCTIONAL**. Any changes must follow these strict safeguards to prevent breaking existing functionality.

---

## **🛡️ BREAKING CHANGE PREVENTION RULES**

### **Rule #1: ONE CHANGE AT A TIME**
- ❌ **NEVER** modify multiple files simultaneously
- ❌ **NEVER** make multiple unrelated changes in one session
- ✅ **ALWAYS** make one targeted change, test immediately, then proceed
- ✅ **ALWAYS** test `npm run dev` after each file modification

### **Rule #2: MINIMAL VIABLE CHANGES**
- ❌ **NEVER** refactor existing working code "while you're at it"
- ❌ **NEVER** change patterns that already work (IPC, state management, etc.)
- ✅ **ALWAYS** use the smallest possible change to achieve the goal
- ✅ **ALWAYS** preserve existing interfaces and function signatures

### **Rule #3: ADDITIVE-ONLY DEVELOPMENT**
- ❌ **NEVER** delete or rename existing functions/interfaces
- ❌ **NEVER** change existing type definitions that are in use
- ✅ **ALWAYS** add new optional properties with defaults
- ✅ **ALWAYS** extend interfaces rather than modify them

### **Rule #4: IMMEDIATE TESTING REQUIREMENT**
```bash
# MANDATORY after EVERY file change:
npm run dev      # Test application still starts and works
npm run lint     # Verify no TypeScript errors
```

---

## **📋 CHANGE IMPLEMENTATION CHECKLIST**

### **Before Starting ANY Task:**
- [ ] Read the current implementation in the target files
- [ ] Identify the MINIMAL change needed (not the "best" or "cleanest")
- [ ] Plan to preserve ALL existing functionality
- [ ] Verify the change is truly necessary vs. nice-to-have

### **During Implementation:**
- [ ] Make ONE file change at a time
- [ ] Test immediately with `npm run dev`
- [ ] If anything breaks, revert immediately using git
- [ ] Only proceed to next file after current change works

### **After Each Change:**
- [ ] Application starts without errors
- [ ] All existing tabs load correctly
- [ ] Previous functionality still works
- [ ] No TypeScript compilation errors

---

## **🚫 FORBIDDEN ACTIONS**

### **Never Do These:**
1. **Global CSS Changes** - Only modify specific selectors
2. **Rewrite Working Components** - Only add to them
3. **Change IPC Channel Names** - These are working contracts
4. **Modify Core Types** - Extend them instead
5. **Refactor "While You're Here"** - Stay focused on the task
6. **Remove "Unused" Code** - It might be used in ways you don't see

### **Phase 5 CSS Failure Lesson:**
```css
/* ❌ WRONG - Broke entire application */
input, .form-control { border: none !important; }

/* ✅ CORRECT - Minimal, targeted */
.folder-input-group .form-control { border: none !important; }
```

---

## **📐 ARCHITECTURAL CONSTRAINTS**

### **Existing Patterns MUST Be Preserved:**
- **IPC Communication**: Use existing channels in `IPC_CHANNELS`
- **State Management**: React useState/useCallback patterns
- **Configuration**: electron-store with `AppConfig` interface
- **File Structure**: Keep all files in their current directories
- **TypeScript**: Strict typing, no `any` types

### **Settings Implementation MUST:**
- Extend `AppConfig` interface (don't replace)
- Use electron-store (already working)
- Provide defaults for ALL new settings
- Make settings optional (app works without them)
- Use existing IPC patterns

---

## **🎯 PHASE 6 SPECIFIC CONSTRAINTS**

### **Settings System Requirements:**
```typescript
// ✅ CORRECT - Extends existing AppConfig
interface AppConfig {
  windowState: WindowState;
  lastConfiguration?: DownloadConfig;
  recentFiles: string[];
  userSettings?: UserSettings;  // OPTIONAL - app works without this
}

// ✅ CORRECT - All settings have defaults
interface UserSettings {
  defaultPaths: {
    lastFileDialogPath: string;
    imageNetworkPath: string;    // Replaces hardcoded value
    pdfNetworkPath: string;      // Replaces hardcoded value
  };
  // ... other sections
}
```

### **File Dialog Path Memory:**
```typescript
// ✅ CORRECT - Minimal addition to existing code
const result = await window.electronAPI.openFileDialog({
  title: 'Select Excel or CSV File',
  defaultPath: lastPath || undefined,  // Graceful fallback
  properties: ['openFile'],
  filters: [...] // Keep existing filters
});

// Save path after successful selection
if (result.filePaths.length > 0) {
  const directory = path.dirname(result.filePaths[0]);
  // Save to settings (optional operation)
}
```

### **Hardcoded Value Replacement:**
```typescript
// ✅ CORRECT - Replace with settings fallback
const imageNetworkPath = userSettings?.defaultPaths?.imageNetworkPath || 
                        "U:\\old_g\\IMAGES\\ABM Product Images";  // Keep as fallback
```

---

## **🔧 EMERGENCY PROCEDURES**

### **If Something Breaks:**
1. **STOP IMMEDIATELY** - Don't try to "fix" it
2. **Revert using Git**: `git checkout HEAD -- <filename>`
3. **Test revert works**: `npm run dev`
4. **Re-read these guidelines**
5. **Plan a smaller change**

### **If Tests Fail:**
```bash
# Verify application state:
npm run dev      # Must start without errors
npm run lint     # Must pass without errors

# If either fails, revert ALL changes and start over
```

---

## **✅ SUCCESS CRITERIA FOR ANY CHANGE**

### **Before Marking Complete:**
- [ ] `npm run dev` starts application successfully
- [ ] All three tabs (File, Column, Process) load without errors
- [ ] Existing download functionality works
- [ ] No TypeScript compilation errors
- [ ] No console errors in browser dev tools
- [ ] File selection, column mapping, and downloads still work

### **Phase 6 Success Criteria:**
- [ ] Settings can be saved and loaded
- [ ] File dialog remembers last path (when enabled)
- [ ] Hardcoded network paths replaced but with same defaults
- [ ] ALL existing functionality preserved
- [ ] Settings are optional (app works without them)

---

## **📖 IMPLEMENTATION MANTRAS**

1. **"Does it work now? Don't touch it."**
2. **"Minimal change for maximum safety."**
3. **"Add, don't modify."**
4. **"Test immediately, revert quickly."**
5. **"When in doubt, make it optional."**

---

## **🏆 DEVELOPMENT PHILOSOPHY**

This application took 5 phases to reach production quality. **DO NOT** undo that work by making unnecessary changes. Focus on:

- **Adding value** without removing functionality
- **Extending capabilities** without changing existing patterns  
- **Improving user experience** without breaking existing workflows
- **Following established patterns** rather than creating new ones

**Remember**: A working application with hardcoded values is infinitely better than a broken application with perfect architecture.