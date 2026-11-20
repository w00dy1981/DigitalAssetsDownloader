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

- [App.tsx](src/renderer/App.tsx) owns navigation, the loaded input summary and the confirmed mapping. Each screen keeps its own controls and behaviour under [components](src/renderer/components). Update notifications and the manual check live together under [updater](src/renderer/components/updater).
- [main.ts](src/main/main.ts) creates windows and menus and opens native dialogs. [configuration.ts](src/main/configuration.ts) owns the desktop store. [sqlCredentials.ts](src/main/sqlCredentials.ts) saves device passwords with Electron's safeStorage. Keep credentials out of preferences and logs.
- [assetWorkflow.ts](src/main/assetWorkflow.ts) keeps the loaded rows and accepts a mapping for that input. [preload.ts](src/main/preload.ts) exposes the allowed desktop requests and events. Check the caller, bridge and handler together when changing a request.
- [spreadsheet.ts](src/input/spreadsheet.ts) reads Excel and CSV. [query.ts](src/sql/query.ts) opens a SQL connection and returns normalised rows and an exact count. [queryPolicy.ts](src/sql/queryPolicy.ts) checks the read-only query and permitted databases before connecting.
- [downloadRun.ts](src/download/downloadRun.ts) runs the workers, emits progress and handles cancellation. [downloadPlan.ts](src/download/downloadPlan.ts) assigns stable destinations. [saveAsset.ts](src/download/saveAsset.ts) resolves sources and saves files. [processImage.ts](src/download/processImage.ts) converts image bytes. [downloadWorkbook.ts](src/download/downloadWorkbook.ts) writes Download Log and ERP Import from actual results. These modules run in Node.
- [userSettings.ts](src/shared/userSettings.ts) defines preferences and restores older settings. [downloadSettings.ts](src/shared/downloadSettings.ts) checks mappings and settings and supplies numeric limits to the controls.
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
