# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project

Electron + React + TypeScript desktop app for bulk downloading digital assets, including images and PDFs, from Excel/CSV spreadsheet data or SQL Server queries.

This is an actively maintained prototype/refactor project. Do not describe it as production ready unless the user explicitly asks for release-status wording and the current repository state has been verified.

## Commands

```bash
npm run dev            # Start with hot reload
npm run build          # Build main + renderer
npm run lint           # ESLint check
npm run lint:fix       # Auto-fix ESLint issues
npm test               # Run all tests
npm run test:watch     # Tests in watch mode
npm run test:coverage  # Tests with coverage report
npm run dist           # Package for current platform
npm run dist:win       # Package for Windows
npm run dist:mac       # Package for macOS
npm run publish        # Build and publish to GitHub Releases
```

Run only the checks relevant to the change unless the user asks for full validation.

Always state which checks were run and which checks were not run.

## Architecture

```text
src/
├── main/           # Electron main process, Node.js context
│   ├── main.ts     # App entry, window management, IPC handlers
│   └── preload.ts  # Secure bridge, exposes window.electronAPI to renderer
├── renderer/       # React frontend, browser context
│   ├── App.tsx     # Root layout and main workflow
│   ├── components/ # Tab components and UI primitives
│   └── hooks/      # Custom React hooks
├── services/       # Business logic, used from main and renderer where appropriate
├── shared/         # Types, constants, and utilities used across processes
│   ├── types.ts
│   └── constants.ts
└── workers/        # Background workers for heavy operations
```

Inspect current files before assuming architecture. Do not rely on this file as the only source of truth.

## IPC Communication

All IPC channels are defined in `IPC_CHANNELS` in `src/shared/types.ts`.

The renderer calls `window.electronAPI.*` methods typed in `preload.ts`.

The main process registers handlers via `ipcMain.handle(IPC_CHANNELS.*)`.

Do not change IPC channel names unless the user explicitly asks for an IPC contract change. If changing one, update all related main, preload, renderer, and type definitions together.

## Path Aliases

TypeScript `@/` maps to `src/`.

Prefer `@/` imports for internal modules.

```typescript
import { IPC_CHANNELS } from '@/shared/types';
import { logger } from '@/services/LoggingService';
```

## Service Singletons

Core services export named singletons. Use existing exported instances instead of creating new service instances.

Examples:

```typescript
import { logger } from '@/services/LoggingService';
import { ipcService } from '@/services/IPCService';
import { configurationService } from '@/services/ConfigurationService';
import { errorHandler } from '@/services/ErrorHandlingService';
import { imageProcessor } from '@/services/ImageProcessingService';
import { appConstants } from '@/services/AppConstantsService';
```

Before adding a new service, check whether an existing service already handles the responsibility.

## SQL Server

`SqlServerService` is intended for read-only queries.

It blocks write or destructive SQL operations such as `INSERT`, `UPDATE`, `DELETE`, `DROP`, and `EXEC` before executing queries.

Queries are stripped of comments first using `stripSqlComments` from `src/shared/sqlUtils.ts`.

SQL credentials are persisted via `SqlCredentialService` using the OS keychain.

Do not weaken SQL safety rules unless the user explicitly asks for that change and understands the risk.

## Configuration Persistence

Configuration uses `electron-store` with `AppConfig` from `src/shared/types.ts`.

When adding settings:

- extend existing `AppConfig` / `UserSettings` shapes instead of replacing them
- provide safe defaults
- preserve backward compatibility with existing stored config
- avoid migrations unless they are actually required

## Coding Rules

- Make surgical changes.
- Prefer simple, readable code.
- Preserve existing behaviour unless the task explicitly changes it.
- Do not refactor unrelated code.
- Do not add abstractions before there are 3 real uses.
- Do not add compatibility layers, wrappers, fallbacks, validators, docs, migrations, or cleanup changes unless asked.
- Avoid speculative generalisation.
- Avoid `any`. Prefer `unknown` with narrowing. If `any` is unavoidable at a third-party boundary, keep it local and explain why.
- Do not change public contracts, file formats, config shapes, or IPC contracts unless the user asks.

## External Tool Context

When the user explains how an external tool, app, API, plugin, database, service, or workflow already works, treat that explanation as context only.

Do not implement behaviour that the user says is already handled externally.

If the requested change touches an external system boundary, first identify:

1. what the external system already handles
2. what this app is responsible for
3. what is explicitly out of scope

## Scope Discipline

Default to the smallest useful change.

Before editing, state:

1. the exact requested change
2. files you intend to change
3. why each file needs changing
4. what is out of scope
5. behaviour that must remain unchanged

Then make the smallest change that satisfies the request.

Do not continue into adjacent improvements after the requested change is complete.

## Before Editing

Before modifying files:

1. inspect the relevant current files
2. check existing patterns before introducing new ones
3. identify the minimal change path
4. call out any ambiguity that affects implementation

If the task is clear, proceed with the smallest safe implementation. Do not ask unnecessary confirmation questions.

## After Editing

After making changes, summarise:

1. what changed
2. files changed
3. checks run
4. checks not run
5. any remaining risks or follow-up work

Do not claim that checks passed unless they were actually run.

Do not describe the app as production ready unless explicitly asked and verified.
