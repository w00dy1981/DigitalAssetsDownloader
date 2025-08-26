# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Digital Assets Downloader - Claude Development Guide

## 🚨 CRITICAL INSTRUCTION
**NEVER TELL THE USER THE APP IS "PRODUCTION READY"!**
This application is in the middle of an ongoing refactor. Always acknowledge this is development/refactoring work, not a finished production application.

Use the Serena MCP to search efficiently through the codebase

## 📋 Current Session Handoff
For active development sessions, reference **`PHASE_6_HANDOFF.md`** for current task status, GitHub issues, and session handoff templates.

## Core Development Commands

### Development & Build
- `npm run dev` - Start development with hot reload (main command for development)
- `npm run build` - Production build (both main and renderer)
- `npm run build:main` - Build Electron main process only
- `npm run build:renderer` - Build React renderer only
- `npm start:electron` - Start Electron app (requires build first)

### Testing & Quality
- `npm test` - Run all tests (214 passing tests as of current version)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report (50% threshold enforced)
- `npm run lint` - ESLint checking (REQUIRED after changes)
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Prettier formatting

### Distribution
- `npm run dist` - Package for current platform
- `npm run dist:mac` - Package for macOS (.dmg)
- `npm run dist:win` - Package for Windows (.exe)
- `npm run publish` - Build and publish to GitHub releases

## High-Level Architecture

This is an **Electron application** built with **React + TypeScript** that handles bulk downloading of digital assets from Excel/CSV data.

### Directory Structure
```
src/
├── main/           # Electron main process (Node.js context)
│   ├── main.ts     # Entry point, window management, IPC handlers
│   └── preload.ts  # Bridge between main and renderer
├── renderer/       # React frontend (browser context)
│   ├── App.tsx     # Main component with 4-tab workflow
│   ├── components/ # UI components (FileSelection, ColumnSelection, Process, Settings)
│   ├── hooks/      # Custom React hooks (useElectronIPC, useStatusMessage, etc.)
│   └── types.d.ts  # Type definitions
├── services/       # Business logic layer (shared between processes)
│   ├── LoggingService.ts      # ✅ Centralized logging (100% coverage)
│   ├── ValidationService.ts   # ✅ Input validation (95.65% coverage)  
│   ├── ConfigurationService.ts # ✅ Settings management (91.86% coverage)
│   ├── IPCService.ts         # ✅ IPC communication (89.92% coverage)
│   ├── ErrorHandlingService.ts # ✅ Error handling (92.25% coverage)
│   ├── excelService.ts       # Excel/CSV processing with ExcelJS
│   ├── downloadService.ts    # Multi-threaded downloads with retry logic
│   └── pathSecurity.ts       # Security utilities (96.1% coverage)
├── shared/         # Types and interfaces used across processes
└── workers/        # Background workers for heavy operations
```

### Key Application Flow
1. **File Selection Tab**: Load Excel/CSV files, select sheets, preview data
2. **Column Selection Tab**: Map columns (part numbers, URLs), configure paths
3. **Process Tab**: Execute downloads with progress tracking
4. **Settings Tab**: Configure defaults, download behavior, image processing

### Inter-Process Communication (IPC)
- Uses `electron` IPC with `preload.ts` as secure bridge
- All IPC channels defined in `IPC_CHANNELS` constant
- Type-safe communication via `IPCService.ts` (Phase 3 service)
- Request-response patterns for file operations and downloads

### State Management
- React `useState` and `useCallback` patterns
- `electron-store` for persistent configuration
- Custom hooks for common patterns (`useElectronIPC`, `useStatusMessage`)

## Core Refactoring Principles (KISS/DRY)

### 🎯 KISS (Keep It Simple, Stupid)
- Prefer simple, readable solutions over complex ones
- Avoid over-engineering
- If a solution requires extensive explanation, it's probably too complex

### ♻️ DRY (Don't Repeat Yourself)
- Extract shared logic into reusable components/functions
- Centralize configuration and constants
- **Apply the Rule of 3**: Only extract to a shared component when you have 3+ instances of duplication

### 🏗️ SOLID Principles
- **S**ingle Responsibility: Each module/class should have one reason to change
- **O**pen/Closed: Open for extension, closed for modification
- **L**iskov Substitution: Derived classes must be substitutable for base classes
- **I**nterface Segregation: Many specific interfaces are better than one general interface
- **D**ependency Inversion: Depend on abstractions, not concretions

### ⏳ YAGNI (You Aren't Gonna Need It)
- Don't add functionality until it's actually needed
- Avoid speculative generalization
- Build for current requirements, not hypothetical future needs

### 📏 Rule of 3
- **First instance**: Write the code inline
- **Second instance**: Note the duplication but don't refactor yet
- **Third instance**: Now refactor into a shared component/function

## CRITICAL: Production Application Safety

**This application is PRODUCTION READY and FULLY FUNCTIONAL.** Any changes must follow strict safeguards:

### Change Implementation Pattern
1. **Plan First**: Always explain what you plan to change and why
2. **Single Feature Focus**: Implement one feature at a time with minimal scope
3. **Test Instructions**: After implementation, provide specific testing steps
4. **Wait for Confirmation**: Never proceed until current changes are confirmed working

### Breaking Change Prevention
- **ONE CHANGE AT A TIME**: Never modify multiple files simultaneously
- **MINIMAL VIABLE CHANGES**: Use the smallest possible change to achieve the goal
- **ADDITIVE-ONLY DEVELOPMENT**: Extend interfaces rather than modify existing ones
- **IMMEDIATE TESTING**: Run `npm run dev` and `npm run lint` after every file change

### Required Testing After Changes
1. Run `npm run build` - Verify TypeScript compilation
2. Run `npm run lint` - Check code quality
3. Run `npm test` - Ensure all 214 tests still pass
4. Run `npm run dev` - Test application manually
5. Test the critical path: File Selection → Column Selection → Process tabs

## Service Layer Architecture (Phase 3 - COMPLETE)

**6 Production-Ready Services** with comprehensive testing:

```typescript
// Import pattern for all services
import { logger } from '@/services/LoggingService';
import { validationService } from '@/services/ValidationService';
import { configService } from '@/services/ConfigurationService';
import { ipcService } from '@/services/IPCService';
import { errorHandler } from '@/services/ErrorHandlingService';
import { imageProcessingService } from '@/services/ImageProcessingService';
```

### Service Integration Patterns
- **ErrorHandlingService** → uses **LoggingService** for error logging
- **ConfigurationService** → uses **ValidationService** for settings validation
- **IPCService** → integrates with React hooks for type-safe IPC
- All services follow singleton pattern with `getInstance()`

## UI Component Library (Phase 2 - COMPLETE)

**Established components in `src/renderer/components/ui/`:**
- `NumberInput.tsx` - Used 6x across components
- `Select.tsx` - Used 5x in ColumnSelectionTab  
- `FolderSelector.tsx` - Used 5x in ColumnSelectionTab
- `StatusMessage.tsx` - Integrated with useStatusMessage hook
- `FormSection.tsx` - Layout consistency

## Custom Hooks (Phase 1 - COMPLETE)

**React hooks in `src/renderer/hooks/`:**
- `useElectronIPC.ts` - Type-safe IPC communication
- `useStatusMessage.ts` - UI state management with timeout
- `useFolderDialog.ts` - File system interaction
- `useEventListeners.ts` - Event cleanup management

## Path Aliases & Imports

TypeScript path mapping configured in `tsconfig.json`:
```typescript
import { SpreadsheetData } from '@/shared/types';
import { logger } from '@/services/LoggingService';
import { NumberInput } from '@/renderer/components/ui';
```

## Technology Stack Specifics

### Core Dependencies
- **React 18** with functional components and hooks
- **TypeScript** with strict mode enabled (`"strict": true`)
- **Electron 28** for desktop application framework
- **ExcelJS** for Excel/CSV file processing
- **Jimp** for image processing (replaced Sharp in recent versions)
- **Axios** with retry logic for HTTP downloads

### Development Tools
- **Jest** for testing with TypeScript support (`ts-jest`)
- **ESLint** with TypeScript, React, and Prettier integration
- **Webpack** for bundling (separate configs for main/renderer)

## Current Refactoring Status

- **Phase 1**: ✅ Custom Hooks (Complete - 23 lines saved)
- **Phase 2**: ✅ UI Components (Complete - 119 lines saved)  
- **Phase 3**: ✅ Business Logic Services (Complete - 300+ patterns consolidated)
- **Phase 4**: ✅ Component Decomposition (Complete - Large components → focused components)
- **Phase 5**: ✅ Method Simplification (Complete - Break down complex methods)
- **Phase 6A**: ✅ DRY Violations Cleanup (Complete - 200+ lines saved)
- **Phase 6B-C**: 📋 Configuration Enhancement & Final Cleanup (In Progress)

## Key Metrics to Track

- **Testing**: Maintain 214+ passing tests, >90% coverage for services
- **Build Performance**: Keep builds under 30 seconds
- **Type Safety**: Zero TypeScript errors required
- **Component Size**: Target <200 lines per component
- **Method Size**: Target <50 lines per method

## GitHub Integration

- **Auto-updates**: via `electron-updater` and GitHub Releases
- **Issues**: Track Phase 6 cleanup in GitHub Issues #22, #23, #24
- **Branch**: Active development on `main` (production-ready)
- **Publishing**: `npm run publish` creates GitHub releases automatically