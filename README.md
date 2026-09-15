# Quotation Software

Quotation Software is a Windows-first, local-first application for creating and managing customer quotations. It runs as an Electron desktop app and can also be built for the web.

## Features

- English and Simplified Chinese interfaces and quotation documents
- Reusable company profiles and customer records
- Flat or three-level hierarchical line items
- Cost-plus and manual-price pricing, markup, taxes, extra charges, and multi-currency costs
- Calculation sheets, calculation explanations, goal seek, and quotation analysis
- Customer-facing quotation previews, PDF export, and goods-receipt generation
- JSON quotation import/export, CSV export, and CSV/XLSX line-item imports
- Local library backup and restore

## Tech stack

- Electron
- Vue 3 + TypeScript
- Vite
- PrimeVue
- Vitest

## Getting started

Use a current Node.js LTS release and npm. Windows is the primary desktop target.

```bash
npm ci
npm run dev
```

`npm run dev` starts Vite and opens the Electron desktop app.

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
| `npm test` | Run the Vitest suite. |
| `npm run build` | Build the Electron app. |
| `npm run build:web` | Build the browser version. |
| `npm run build:all` | Build both desktop and web versions. |
| `npm run package:win` | Create a Windows installer. |
| `npm run package:win:portable` | Create a portable Windows build. |
| `npm run package:win:portable:current` | Build a portable EXE, check its automation API, and select it for the quotation skill. |

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

The application is local-first. Save quotation JSON files and library backup files to archive or transfer work between machines. Editing a reusable company or customer record does not alter quotations that already use it.

## Documentation

- [User manual](docs/user-manual.md)
- [Quotation calculation reference](docs/math-reference.md)
- [Programmatic quotation API](docs/quotation-agent-api.md)
- [Headless export command](docs/headless-export.md)

## Project layout

```text
src/       Vue application and quotation features
electron/  Electron main process and preload bridge
docs/      User and technical documentation
scripts/   Development and build scripts
file/      Bundled quotation templates and example data
```
