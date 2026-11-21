# Digital Assets Downloader

This Electron desktop app downloads images, PDFs, and other assets in bulk from Excel files, CSV files, or SQL Server query results. The interface uses React and TypeScript.

Describe the app as under development. Never claim it is ready for production. Use the current code and check results when describing what works.

## Working in this repository

- Start with what the request or issue asks to change and why. Inspect the affected code and tell Shane what you plan to change before editing.
- Keep changes small and focused. Reuse existing components, hooks, and services where they fit. Preserve existing behaviour, file formats, and saved settings unless the task calls for a change.
- Deliver the whole capability. Build everything the task asks for. A task that doesn't mention a limit wants none, so don't add result caps, searches over part of the data, maximum counts or lengths, size caps or deadlines, dropped rows or values, hard-coded options that should come from the data or the person using the app, or Electron, browser or library behaviour switched off because it's awkward to support. Each limit or extra check needs a reason in the pull request: Shane asked for it, the platform really has that limit, it stops a real security problem, or measurement shows the complete version fails, and then you fix how the work is done, not how much. Nothing is cut short without the person using the app seeing it. Detail and examples: `/home/shaneb/vs_code_projects/standards/complete-capability.md`.
- When adding settings, use the existing types and provide defaults that work with older saved settings.
- Use CodeGraph or Serena to trace code. Prefer GitHub CLI (`gh`) when working with issues and pull requests.
- Use plain language when reporting to Shane. Summarise what changed, which files you touched, the commands you ran and their results, and any gaps. Include steps Shane can follow when a change affects what people see or how the app behaves.
- At pull request acceptance, use the `architect-review-and-acceptance` skill if you are deciding whether to accept the work.

## Where to look

- [App.tsx](src/renderer/App.tsx) owns navigation, the loaded input summary and the confirmed mapping. Each screen keeps its own controls and behaviour under [components](src/renderer/components). Update notifications and the manual check live together under [updater](src/renderer/components/updater).
- [main.ts](src/main/main.ts) creates windows and menus and opens native dialogs. [configuration.ts](src/main/configuration.ts) owns the desktop store. [sqlCredentials.ts](src/main/sqlCredentials.ts) saves device passwords with Electron's safeStorage. Keep credentials out of preferences and logs.
- [assetWorkflow.ts](src/main/assetWorkflow.ts) keeps the loaded rows and accepts a mapping for that input. [preload.ts](src/main/preload.ts) exposes the allowed desktop requests and events. Check the caller, bridge and handler together when changing a request.
- [spreadsheet.ts](src/input/spreadsheet.ts) reads Excel and CSV. [query.ts](src/sql/query.ts) runs the supplied SQL on SQL Server. Execute each batch once per explicit run. The sample, count and mapping come from the chosen result set. The SQL login’s grants control what it can execute.
- [downloadRun.ts](src/download/downloadRun.ts) runs the workers, emits progress and handles cancellation. [downloadPlan.ts](src/download/downloadPlan.ts) assigns stable destinations. [assetSource.ts](src/download/assetSource.ts) selects and reads local files and web links. [saveAsset.ts](src/download/saveAsset.ts) checks the content and saves the file. [processImage.ts](src/download/processImage.ts) converts image bytes. [downloadWorkbook.ts](src/download/downloadWorkbook.ts) writes Download Log and ERP Import from actual results. These modules run in Node.
- [userSettings.ts](src/shared/userSettings.ts) defines preferences and restores older settings. [downloadSettings.ts](src/shared/downloadSettings.ts) checks mappings and settings and shares supported numeric values with the controls.
- `@/` points to `src/`. [package.json](package.json) lists the available commands.

## Development checks

- `npm run dev` starts the app and watches the main process and interface source files.
- `npm run build` builds both parts of the app.
- `npm run lint` checks the TypeScript source. It enforces the [shared structure standard](/home/shaneb/vs_code_projects/standards/code-structure.md) for TypeScript with 600 lines per file and 300 nonblank lines per function. There are no listed exceptions. Pull requests run lint, tests and the build on the project runner.
- `npm test` runs Jest. Use `npm run test:watch` for watch mode or `npm run test:coverage` for a coverage report.
- For app changes, run the build and tests and try the affected workflow in the running app. For download changes, load a small input, map its columns, and check the download output in a temporary folder. For Markdown-only edits, check the links, commands, and instructions you changed.
- `npm run dist` packages the app. `npm run publish` publishes a GitHub release. Run publishing commands only when Shane asks to publish.

## Writing issues and docs

Follow [the shared writing guide](/home/shaneb/vs_code_projects/standards/docs-and-task-writing.md). Start with what changes for people using the app and why. Record Shane's decisions and any open questions. Put code details last.

Follow the [shared Git workflow](/home/shaneb/vs_code_projects/standards/git-workflow.md). For a merge without a release, include `[skip-release]` in the merge commit message.

Use GitHub issues for scoped work and pull requests for progress, review, and test evidence. Search existing issues before opening one. Keep this guide focused on instructions future sessions need.
