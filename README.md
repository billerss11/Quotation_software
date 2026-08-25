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
