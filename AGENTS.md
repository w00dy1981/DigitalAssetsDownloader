# Digital Assets Downloader

This Electron desktop app downloads images, PDFs, and other assets in bulk from Excel files, CSV files, or SQL Server query results. The interface uses React and TypeScript.

Describe the app as under development. Never claim it is ready for production. Use the current code and check results when describing what works.

## Working in this repository

- Start with what the request or issue asks to change and why. Inspect the affected code and tell Shane what you plan to change before editing.
- Keep changes small and focused. Reuse existing components, hooks, and services where they fit. Preserve existing behaviour, file formats, and saved settings unless the task calls for a change.
- When adding settings, use the existing types and provide defaults that work with older saved settings.
- Use CodeGraph or Serena to trace code. Prefer GitHub CLI (`gh`) when working with issues and pull requests.
- Use plain language when reporting to Shane. Summarise what changed, which files you touched, the commands you ran and their results, and any gaps. Include steps Shane can follow when a change affects what people see or how the app behaves.
- At pull request acceptance, use the `architect-review-and-acceptance` skill if you are deciding whether to accept the work.

## Where to look

- [src/renderer/App.tsx](src/renderer/App.tsx) connects the tabs in order: Input Selection, Column Selection, Process & Download, and Settings. Tab components live in `src/renderer/components/`. Shared controls live in `src/renderer/components/ui/`.
- [src/main/main.ts](src/main/main.ts) creates the app window, handles requests from the interface, and uses `electron-store` for saved configuration.
- [src/main/preload.ts](src/main/preload.ts) exposes `window.electronAPI` to the interface. [src/shared/types.ts](src/shared/types.ts) defines `IPC_CHANNELS` and shared types. If a request or event changes, check its sender, handler, and types together.
- [downloadPlan.ts](src/services/downloadPlan.ts) decides which destinations belong to each product. [downloadService.ts](src/services/downloadService.ts) runs the workers and reports progress and cancellation. [saveAsset.ts](src/services/saveAsset.ts) tries the sources and saves the selected asset.
- [ImageProcessingService.ts](src/services/ImageProcessingService.ts) converts image bytes. [downloadWorkbook.ts](src/services/downloadWorkbook.ts) turns saved results into the download log and ABM import sheets. These modules run in Node without Electron.
- [excelService.ts](src/services/excelService.ts) reads Excel and CSV input. [updates.ts](src/main/updates.ts) owns desktop updates.
- [src/sql/query.ts](src/sql/query.ts) runs SQL previews and loads. [src/sql/queryPolicy.ts](src/sql/queryPolicy.ts) applies the read-only checks. [src/main/sqlCredentials.ts](src/main/sqlCredentials.ts) encrypts saved SQL passwords using Electron's `safeStorage`. Preserve query validation and keep passwords out of logs.
- `@/` points to `src/`. [package.json](package.json) lists the available commands.

## Development checks

- `npm run dev` starts the app and watches the main process and interface source files.
- `npm run build` builds both parts of the app.
- `npm run lint` checks the TypeScript source. Run it after code changes.
- `npm test` runs Jest. Use `npm run test:watch` for watch mode or `npm run test:coverage` for a coverage report.
- For app changes, run the build and tests and try the affected workflow in the running app. For download changes, load a small input, map its columns, and check the download output in a temporary folder. For Markdown-only edits, check the links, commands, and instructions you changed.
- `npm run dist` packages the app. `npm run publish` publishes a GitHub release. Run publishing commands only when Shane asks to publish.

## Writing issues and docs

Follow [the shared writing guide](/home/shaneb/vs_code_projects/standards/docs-and-task-writing.md). Start with what changes for people using the app and why. Record Shane's decisions and any open questions. Put code details last.

Use GitHub issues for scoped work and pull requests for progress, review, and test evidence. Search existing issues before opening one. Keep this guide focused on instructions future sessions need.
