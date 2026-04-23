# Line Item Workbench UI Design

## Goal

Rearrange the quotation editor around fast line-item entry for staff who prepare quotations frequently.

## Recommended Approach

Use a spreadsheet-style workbench. The line-item grid becomes the dominant surface. Quotation metadata, exchange rates, totals, and preview move into a right-side inspector with tabs.

## Layout

The editor has three zones:

- Command bar: compact, always visible actions and quotation context.
- Line-item workbench: wide, dense item editor optimized for repeated entry.
- Inspector: supporting panels in tabs for totals, exchange rates, header fields, and preview.

## Component Boundaries

- `QuotationEditor.vue`: feature container and state wiring only.
- `QuotationCommandBar.vue`: new/save/load/print/logo actions and quotation summary.
- `LineItemsTable.vue`: primary workbench for major items and sub-items.
- `QuotationInspector.vue`: PrimeVue tab surface for supporting panels.
- Existing panels remain focused: `TotalsPanel.vue`, `ExchangeRatePanel.vue`, `QuotationHeaderForm.vue`, `QuotationPreview.vue`.

## Data Flow

`useQuotationEditor()` remains the source of quotation state and actions. Child components receive typed props and emit typed events. Calculations remain in pure utilities.

## Visual Direction

The UI should be denser and less card-heavy. Major items become section rows, sub-items become grid rows, and calculated totals stay close to the rows they explain. The right inspector should be secondary and compact.

## Constraints

No calculation behavior changes. No AI commits.
