# Quotation Excel export

The editor's **Export Excel** dialog defaults to **Customer workbook** each time it opens. It exports the selected saved revision, or a detached copy of the working quotation after pending edits are committed. Exporting does not change quotation files or revision history.

## Workbook modes

- Customer: the PDF's item detail level, selling prices, taxes and extra charges. Costs, markups, exchange rates and undisclosed item names are excluded from the workbook package.
- Internal: the full item hierarchy with editable costs, inherited/override markups, manual prices and exchange rates. Formula rounding follows the quotation utilities.

Both modes always include tax rate, unit price, unit tax, unit price including tax, tax amount, net amount and gross amount. PDF column visibility and single/mixed tax mode do not remove workbook columns. Internal costing fields follow the common commercial columns.

Both modes use the quotation's document language and currency. Blue numeric cells are editable; calculated cells contain formulas and cached results. Each group includes its children once, multiplied by the group's quantity. The quotation subtotal sums root items only.

Customer unit prices are rounded to cents before multiplication, matching the app. The internal FX table includes all configured currencies; an unknown currency produces an Excel lookup error instead of silently setting its rate to zero. Totals use bounded range formulas keyed by the generated item numbers and tax-class identifiers, avoiding oversized formulas on large quotations. Item numbers describe the exported hierarchy and are not pricing inputs.

Informational breakdowns are omitted from both Excel modes, including their membership/contribution helpers. The quotation's breakdown settings and PDF output remain unchanged. Incomplete or stale breakdown selections do not block Excel export; PDF validation continues to apply.

Supporting tax rows are hidden; the main table, totals and internal exchange-rate inputs remain visible. Single-tax nodes use their existing net amount without duplicating unit-price and intermediate rounding calculations. Shared tax-class calculations run once per class, and a class with only one root contributor needs no allocation ranking. Mixed-tax groups retain the per-class bases and rounding reconciliation needed to match the quotation. Customer supporting rows contain only public commercial figures, never an internal cost model.

For customer groups whose children are omitted by the PDF detail setting, aggregate price edits preserve the exported tax proportions.

The workbook follows `totalsConfig.taxAllocationVersion`. Legacy policy `1` (also used when the field is missing) preserves legacy tax rounding and totals. Its rounding cents retain the app's original row allocation while the whole tax class is unchanged; after edits, equal decimal remainders are resolved in row order.

Under policy `2`, tax-class and local-node formulas round integer subtotal cents multiplied by the exact decimal rate fraction half up. Root allocation uses exact integer remainders, with ties resolved by quotation root order. Both recalculate after price, quantity, or tax-rate edits. This can correct a one-cent tax difference at decimal boundaries; pre-tax pricing, markup, FX, and hierarchy formulas retain their existing rules. Unsupported precision is rejected during export, and formulas return an Excel error if an edited input exceeds their supported precision.

## Implementation

- `quotationExcelExport.ts` builds customer/internal pricing formulas and public tax allocations.
- `quotationExcelWorkbook.ts` writes a single-sheet XLSX package using the existing `fflate` dependency.
- `useQuotationFileActions.exportQuotationExcel` resolves the revision and handles localized results.
- `QuotationRuntime.saveQuotationExcelFile` uses the Electron save dialog or browser save/download workflow.

The generated workbook is independent of the app. Changes made in Excel are not imported back. The existing line-item XLSX import template remains a separate format.

Automation API 2.3 adds `exportExcelToFile(path, { mode?, quotationRevisionId? })` for desktop/headless hosts; it defaults to customer mode and advertises `directExcelExport`. The CLI accepts `--quotation-customer-xlsx` and `--quotation-internal-xlsx` together or separately. Both routes call the same workbook builder as the dialog and preserve quotation history. See [headless-export.md](headless-export.md) for collision and overwrite rules.

Changes to Electron handlers or preload APIs require restarting the development desktop app; renderer changes use Vite hot reload.
