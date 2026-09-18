# Quotation Software

Quotation Software is a Windows-first, local-first application for creating and managing customer quotations. It runs as an Electron desktop app and can also be built for the web.

The current package version is `0.1.0`. Quotation files use schema v2, and new automation integrations use API v2; these versions are independent.

## Features

- English and Simplified Chinese interfaces and quotation documents
- Reusable company profiles and customer records
- Flat or three-level hierarchical line items
- Cost-plus and manual-price pricing, markup, taxes, extra charges, and multi-currency costs
- Calculation sheets, calculation explanations, goal seek, and quotation analysis
- Seven quotation templates, live preview, paginated PDF/print output, and goods-receipt generation
- JSON quotation import/export, CSV export, and CSV/XLSX line-item imports
- Local library backup and restore
- Undo/redo in both versions and desktop activity history
- Renderer automation API and Windows CLI validation, rendering, and sequential batch jobs

## Tech stack

- Electron
- Vue 3 + TypeScript
- Vite
- PrimeVue
- Vitest

## Getting started

Use Node.js 22.12 or newer and npm. The installed Vite 8 package also accepts Node.js 20.19 or later in the 20.x series. Windows is the primary desktop target.

```bash
npm ci
npm run dev
```

`npm run dev` starts Vite at `http://127.0.0.1:5173`, compiles and watches the Electron code, and opens the desktop app. Port 5173 must be available.

To run only the browser version:

```bash
npm run dev:web
```

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run the Electron app in development mode. |
| `npm run dev:web` | Run the browser version with Vite. |
| `npm run typecheck` | Type-check the renderer and Electron code. |
| `npm test` | Start Vitest; watches for changes in an interactive terminal. |
| `npm test -- --run` | Run the unit/component suite once. |
| `npm run test:browser` | Run layout regression tests headlessly using installed Google Chrome. |
| `npm run build` | Compile the desktop renderer and Electron code into `dist/` and `dist-electron/`. |
| `npm run build:web` | Build the browser version into `dist-web/`. |
| `npm run build:all` | Build both desktop and web versions. |
| `npm run preview` | Serve the compiled desktop renderer in a browser, without Electron capabilities. |
| `npm run preview:web` | Serve the compiled browser version. |
| `npm run package:win` | Create a Windows installer. |
| `npm run package:win:portable` | Create a portable Windows build. |
| `npm run package:win:portable:current` | Build a portable EXE, check its automation API, and select it for the quotation skill. |
| `npm run verify:automation:win -- -ExecutablePath "C:\path\Quotation Software.exe"` | Verify a packaged Windows executable using the automation smoke fixtures. |

Run `npm run typecheck` and focused tests for code changes. Document layout changes also need `npm run test:browser`; its Playwright configuration uses the `chrome` channel. The packaged automation verifier is a separate release check, not part of `npm test`.

## Windows packaging and versions

Run `npm run package:win` for an installer or `npm run package:win:portable` for a portable executable.
Each command uses a new folder under `release/`, named with the app version, UTC timestamp, and a unique suffix
(for example, `release/0.1.0-2026-09-15T08-30-00-000Z-a1b2c3/`).
The command prints the full output path. That folder contains the executable and `win-unpacked/`.
Previous builds are preserved, so rebuilding does not overwrite a running older executable or reuse partial output from a failed build.
Old folders can be deleted manually when no longer needed, after closing any apps running from them.
Use the npm packaging commands above to get this isolation; calling electron-builder directly uses its configured output directory.

To update the version used by `quotation-json-generator`, run `npm run package:win:portable:current`.
After packaging and an automation API check succeed, it atomically updates `release/current-portable.json`
with the exact portable EXE path (relative to the record), app version, and completion time.
Failed builds or API checks leave the previous record untouched. Ordinary packaging commands do not change it.
Configure the skill once with `node <skill-folder>/scripts/quotation-software.mjs configure-current <project>/release/current-portable.json`.
The skill reads this record on each operation; it never scans old build folders to guess a version.
Keep the folder referenced by this record when manually cleaning old builds.

The app version comes from `package.json`; rebuilding alone does not increment it.
To advance a patch release (for example, `0.1.0` to `0.1.1`), run:

```bash
npm version patch --no-git-tag-version
npm run package:win
```

This updates `package.json` and `package-lock.json` without creating a Git commit or tag.
`npm run build` only compiles the app into `dist/` and `dist-electron/`; it does not create a distributable executable.

## Data and backups

Quotation drafts, reusable libraries, and app settings use local storage in the current app/browser profile. Save quotation JSON files and library backup files to archive or transfer work between machines; local draft storage is not a substitute for file backups. Editing a reusable company or customer record does not alter quotations that already use it.

The desktop app supports native file dialogs, direct PDF export, path-based automation, and activity logs. The browser version uses file pickers/downloads and browser Print / Save as PDF. Desktop and browser profiles do not automatically share their local data.

## Automation

Use `window.quotationAgentV2` after awaiting `window.quotationAgentReady` in the quotation renderer. The legacy `window.quotationAgent` remains available for existing integrations. These are renderer APIs, not an HTTP service.

For non-interactive Windows work, the packaged executable supports `--automation validate`, `--automation render`, and `--automation batch`. The CLI starts a dedicated automation host; it does not require opening the quotation editor. See the API and CLI references below for inputs, capabilities, overwrite behavior, and exit codes.

## Documentation

- [User manual](docs/user-manual.md)
- [Quotation calculation reference](docs/math-reference.md)
- [Quotation document layout and pagination](docs/quotation-document-layout.md)
- [Programmatic quotation API](docs/quotation-agent-api.md)
- [Windows automation CLI and headless export](docs/headless-export.md)
- [Quotation JSON schema v2](docs/schemas/quotation-v2.schema.json)

## Project layout

```text
src/       Vue application and quotation features
electron/  Electron main process and preload bridge
docs/      User and technical documentation
scripts/   Development and build scripts
file/      Bundled quotation templates and example data
```

Within `src/`, feature code lives in `features/`, and shared contracts, runtime adapters, storage, and translations live in `shared/`. See [agents.md](agents.md) for contribution rules.
