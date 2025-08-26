# Suggested Commands - Digital Assets Downloader

## Development Commands

### Primary Development
- `npm run dev` - **Main development command** - starts development with hot reload (concurrently runs build:main:watch, build:renderer:watch, start:electron)
- `npm run start:electron` - Start Electron app (requires build first)

### Building
- `npm run build` - Production build (both main and renderer) 
- `npm run build:main` - Build Electron main process only
- `npm run build:main:watch` - Build main process in watch mode
- `npm run build:renderer` - Build React renderer only  
- `npm run build:renderer:watch` - Build renderer in watch mode

### Testing & Quality (ALWAYS RUN AFTER CHANGES)
- `npm test` - Run all tests (should show 214 passing)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report (50% threshold enforced)
- `npm run lint` - ESLint checking (REQUIRED after changes)
- `npm run lint:fix` - Auto-fix ESLint issues  
- `npm run format` - Prettier formatting

### Distribution & Release
- `npm run dist` - Package for current platform
- `npm run dist:mac` - Package for macOS (.dmg)
- `npm run dist:win` - Package for Windows (.exe)
- `npm run dist:linux` - Package for Linux (.AppImage/.deb)
- `npm run publish` - Build and publish to GitHub releases
- `npm run release` - Full release workflow (test + build + version patch + publish)
- `npm run release:minor` - Minor version release
- `npm run release:major` - Major version release

## Verification Sequence (Run After Any Changes)
```bash
npm run build && npm test && npm run lint
```
This must pass cleanly for any code changes.

## System Commands (Darwin)
- `ls` - List files
- `grep` / `rg` (ripgrep) - Text search  
- `find` - File search
- `cd` - Change directory
- `git` - Version control
- Standard Unix commands available