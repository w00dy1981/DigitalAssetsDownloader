# Digital Assets Downloader - Project Overview

## Project Purpose
Modern cross-platform desktop application for bulk downloading and processing digital assets (images, PDFs) from Excel/CSV data sources. Built for professional workflows with enterprise features.

## Current Status
- **Version**: 1.3.0
- **Status**: Production-ready, fully functional
- **Tests**: 214 passing tests with 50%+ coverage threshold
- **Architecture**: Mid-refactoring phase (Phases 4-5 complete, 54.3% code reduction achieved)
- **Branch**: `main` (clean, production-ready)

## Key Features
- Excel/CSV data processing with multi-sheet support
- Multi-threaded downloads (1-20 concurrent) with retry logic
- Image processing (PNG transparency detection, JPEG conversion) via Jimp
- Network path logging for enterprise workflows
- Auto-updates via GitHub Releases
- Cross-platform (Windows, macOS, Linux)

## Technology Stack
- **Desktop Framework**: Electron 28
- **Frontend**: React 18 + TypeScript (strict mode)
- **Image Processing**: Jimp (replaced Sharp in recent commits)  
- **Excel Processing**: ExcelJS
- **HTTP Client**: Axios with retry logic
- **Configuration**: electron-store
- **Auto-Updates**: electron-updater
- **Testing**: Jest with ts-jest, @testing-library/react
- **Build**: Webpack (separate configs for main/renderer)
- **Code Quality**: ESLint + Prettier + TypeScript