# GitHub Copilot Instructions for Digital Assets Downloader

## Project Context

This is an Electron application built with React and TypeScript, migrating from a 2,485-line Python/PySide6 application. The app handles bulk downloading of digital assets (images/PDFs) from Excel/CSV data with advanced processing capabilities.

This application is **PRODUCTION READY** and **FULLY FUNCTIONAL**. Any changes must follow strict safeguards to prevent breaking existing functionality.

## Architecture Guidelines

We use a clear separation of concerns with these directories:
- `src/main/` - Electron main process handling file system and IPC
- `src/renderer/` - React frontend with three-tab workflow  
- `src/shared/` - TypeScript interfaces used across both processes
- `src/services/` - Business logic for Excel processing and downloads
- `src/workers/` - Background workers for heavy operations

## Code Standards

We use strict TypeScript with no `any` types allowed. Always include proper error handling with try-catch blocks. IPC communication follows request-response patterns using channels defined in `IPC_CHANNELS` constant.

## UI Components

We follow a three-tab workflow: File Selection → Column Selection → Process & Download. All React components use functional components with hooks, not class components. State management uses useState and useCallback patterns.

## File Processing

We support Excel (.xlsx, .xls, .xlsm) and CSV files using ExcelJS and fast-csv libraries. Always handle multiple sheets and provide proper data type conversion.

## Download Engine

We implement multi-threaded downloads with configurable worker counts (1-20), comprehensive retry logic with exponential backoff, and source folder searching with part number matching.

## Development Workflow

Always use `npm run dev` for development with hot reload. Run `npm run lint` after changes to verify TypeScript compilation. Make minimal changes and test immediately. Use electron-store for configuration persistence.

### Implementation Process
1. **Plan First**: Always explain what you plan to change and why before making any modifications
2. **Single Feature Focus**: Implement one feature at a time with minimal scope
3. **Test Instructions**: After implementation, provide specific testing steps for the user to verify the change works
4. **Git Commit Message**: Only provide a commit message after user confirms testing is successful
5. **Wait for Confirmation**: Never proceed to the next feature until current changes are confirmed working

### Change Implementation Pattern
- Analyze the request and propose a minimal implementation plan
- Make the smallest possible change to achieve the goal
- Provide specific testing instructions (which tabs to check, what to click, expected outcomes)
- Wait for user confirmation that tests pass
- Provide a descriptive git commit message
- Only then proceed to next changes if requested

## CRITICAL SAFETY CONSTRAINTS

### KISS (Keep It Simple, Stupid) & DRY (Don't Repeat Yourself) Principles

This application is **PRODUCTION READY** and **FULLY FUNCTIONAL**. Any changes must follow strict safeguards to prevent breaking existing functionality.

### Breaking Change Prevention Rules
- **ONE CHANGE AT A TIME**: Never modify multiple files simultaneously
- **MINIMAL VIABLE CHANGES**: Use the smallest possible change to achieve the goal
- **ADDITIVE-ONLY DEVELOPMENT**: Extend interfaces rather than modify existing ones
- **IMMEDIATE TESTING**: Run `npm run dev` and `npm run lint` after every file change

### Forbidden Actions
- Never make global CSS changes - only modify specific selectors
- Never rewrite working components - only add to them
- Never change IPC channel names - these are working contracts
- Never modify core types - extend them instead
- Never refactor existing working code "while you're at it"
- Never remove "unused" code without thorough analysis

### Architectural Constraints
- **IPC Communication**: Use existing channels in `IPC_CHANNELS`
- **State Management**: React useState/useCallback patterns only
- **Configuration**: electron-store with `AppConfig` interface
- **File Structure**: Keep all files in their current directories
- **TypeScript**: Strict typing, no `any` types

### Settings Implementation Requirements
- Extend `AppConfig` interface (don't replace)
- Use electron-store (already working)
- Provide defaults for ALL new settings
- Make settings optional (app works without them)
- Use existing IPC patterns

### Emergency Procedures
If something breaks:
1. **STOP IMMEDIATELY** - Don't try to "fix" it
2. **Revert using Git**: `git checkout HEAD -- <filename>`
3. **Test revert works**: `npm run dev`
4. **Plan a smaller change**

### Success Criteria for Any Change
- `npm run dev` starts application successfully
- All three tabs (File, Column, Process) load without errors
- Existing download functionality works
- No TypeScript compilation errors
- No console errors in browser dev tools

## Development Philosophy

This application took multiple phases to reach production quality. Focus on:
- Adding value without removing functionality
- Extending capabilities without changing existing patterns
- Following established patterns rather than creating new ones

**Remember**: A working application with hardcoded values is infinitely better than a broken application with perfect architecture.
