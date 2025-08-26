# Code Architecture - Digital Assets Downloader

## High-Level Architecture
**Electron application** with React frontend built using a modular service-based architecture.

## Directory Structure
```
src/
├── main/           # Electron main process (Node.js context)  
│   ├── main.ts     # Entry point, window management, IPC handlers
│   └── preload.ts  # Secure bridge between main and renderer
├── renderer/       # React frontend (browser context)
│   ├── App.tsx     # Main component with 4-tab workflow  
│   ├── components/ # UI components organized by feature
│   └── hooks/      # Custom React hooks  
├── services/       # Business logic layer (shared between processes)
├── shared/         # Types and interfaces
├── utils/          # Utility functions
└── workers/        # Background workers (if any)
```

## Key Architectural Patterns

### Service Layer (6 Production Services)
- **LoggingService.ts** - Centralized logging (100% test coverage)
- **ValidationService.ts** - Input validation (95.65% coverage)
- **ConfigurationService.ts** - Settings management (91.86% coverage)  
- **IPCService.ts** - IPC communication (89.92% coverage)
- **ErrorHandlingService.ts** - Error handling (92.25% coverage)
- **ImageProcessingService.ts** - Image processing with Jimp
- All follow singleton pattern with `getInstance()`

### Component Organization (Post-Refactoring)
```
src/renderer/components/
├── ui/                    # Reusable UI components
│   ├── NumberInput.tsx    # Used 6x across app
│   ├── Select.tsx         # Used 5x  
│   ├── FolderSelector.tsx # Enhanced with editable input
│   ├── StatusMessage.tsx  # Integrated with useStatusMessage hook
│   └── FormSection.tsx    # Layout consistency
├── settings/              # 5 focused components (204 lines total)
├── process/               # 3 focused components (231 lines total)
└── column-selection/      # 3 focused components (267 lines total)
```

### Custom Hooks
- `useElectronIPC.ts` - Type-safe IPC communication
- `useStatusMessage.ts` - UI state management with timeout
- `useFolderDialog.ts` - File system interaction
- `useEventListeners.ts` - Event cleanup management

## Inter-Process Communication (IPC)
- Uses Electron IPC with `preload.ts` as secure bridge
- All channels defined in `IPC_CHANNELS` constant  
- Type-safe communication via `IPCService.ts`
- Request-response patterns for file operations and downloads

## Application Flow
1. **File Selection Tab** - Load Excel/CSV, select sheets, preview data
2. **Column Selection Tab** - Map columns, configure paths
3. **Process Tab** - Execute downloads with progress tracking  
4. **Settings Tab** - Configure defaults and behavior

## State Management
- React `useState` and `useCallback` patterns
- `electron-store` for persistent configuration
- Custom hooks for common patterns

## Path Aliases
TypeScript path mapping configured for clean imports:
- `@/*` - Root src directory
- `@/renderer/*` - Renderer process
- `@/services/*` - Service layer
- `@/shared/*` - Shared types