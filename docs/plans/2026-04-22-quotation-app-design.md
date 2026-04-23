# Quotation App MVP Design

## Goal

Build a Windows-first desktop quotation application with a fixed professional template, fast data entry, hierarchical line items, automatic totals, and local-first persistence.

## Architecture

The app uses Electron for the desktop shell and Vue 3 for the renderer. Vite owns the renderer build and TypeScript owns the Electron main and preload builds. The renderer is organized by feature so quotation logic, customer logic, settings, and shared utilities can grow independently.

Core domain calculations live in pure TypeScript utilities under `src/features/quotations`. Vue components consume those utilities through a quotation editor composable, keeping templates declarative and making totals easy to test.

## Component Map

- `App.vue`: app shell, top navigation, and feature composition.
- `QuotationEditor.vue`: quotation workspace container and source of quotation editor state.
- `QuotationHeaderForm.vue`: edits quotation metadata and customer fields through `v-model`.
- `LineItemsTable.vue`: renders major items and sub-items, emits item actions, and owns no totals logic.
- `TotalsPanel.vue`: shows markup, discount, tax, subtotal, and grand total controls.
- `QuotationPreview.vue`: print-style preview using the same quotation state as the editor.
- `SettingsPanel.vue`: company profile and logo/color placeholders for the MVP.
- `CustomersPanel.vue`: reusable customer history placeholder for later full management.

## Data Flow

Quotation state starts in `useQuotationEditor()`. Child components receive typed props and emit typed events or use explicit `v-model` contracts. Derived values such as item amounts, parent subtotals, markup, discounts, taxes, and grand total use `computed()` and pure utility functions rather than watcher-assigned state.

## Storage

Initial save/load uses a typed local storage service behind `src/shared/services/localQuotationStorage.ts`. This is intentionally small and replaceable; future SQLite or file-backed storage can keep the same public methods.

## Testing

The first test surface is quotation calculation behavior. Unit tests cover parent rollups, global/per-item markup, discounts, tax, and quotation numbering. UI tests can be added once the first editor workflows stabilize.

## Constraints

No AI-generated git commits. The user will commit all changes.
