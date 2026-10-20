# Quotation Excel export

The editor's **Export Excel** dialog defaults to **Customer workbook** each time it opens. It exports the selected saved revision, or a detached copy of the working quotation after pending edits are committed. Exporting does not change quotation files or revision history.

## Workbook modes

- **Customer — Quotation:** a single, values-only document using the PDF's item rows, detail level, descriptions, section headings, quantities, units and visible prices. Single-tax output has the standard unit price and amount columns. Mixed-tax output includes only the selected document columns, in their document order; an empty selection adds no price columns. Header and closing content use the same company/customer identity, quotation reference, revision, date, currency, project, validity, notes/terms and totals as the document. There are no pricing controls, comparison totals, formulas or hidden calculation sheets. Cells are ordinary, unprotected values: editing one does not recalculate any others.
- **Internal — Pricing and Costs:** Pricing reviews root quantities, calculated prices, price overrides, net amounts, margins and pricing status. Costs lists leaf items with their hierarchy paths, locked quantities per parent, calculated total quantities, original source costs, cost overrides, converted costs, pricing methods and effective markups. Its FX table includes only currencies used by leaf items. The default markup can be overridden; existing local/parent markup overrides remain in effect and have no new editing controls.

Both modes use the quotation's document language and currency. Customer output uses the shared document pricing and summary helpers: custom subtotal labels and visible informational totals are preserved, single-tax summary rows appear only for positive tax, mixed-tax buckets appear when their taxable subtotal is positive, and only finite positive extra charges are shown. Notes fall back to the document's default terms when both notes and terms are empty. Chinese documents include the amount in words. Printed pages repeat the table header and page numbers. Visible informational totals follow the PDF's selection validation; undisclosed items and internal costing data are excluded from the package.

Internal selling unit prices exclude tax. The visible offer includes tax by class, total tax, extra charges and the grand total, plus supplier/contact information, validity, terms and notes when provided. The original grand total stays fixed beside the revised total and difference. Extra charges have separate original, override and effective amounts. Internal informational breakdowns and their membership/contribution helpers remain omitted; their settings and PDF validation are unchanged.

## Editing and calculation

The following editing features apply only to the internal workbook. Pale-blue cells are the editable inputs. A blank override restores the original quantity, cost, FX rate, default markup or charge; a blank price returns to the applicable calculated or original manual price. Zero is an intentional value for quantity, price, cost, markup and charges; FX overrides must be positive. Only root quantities can change. Item scope, child quantities, currencies, tax classes and tax rates remain fixed; change these in the app and export again.

Internal cost-plus prices follow cost, FX and applicable markup changes. Original manual prices and entered root price overrides stay fixed when costs change; quantity changes still affect their amounts. Clearing a root price override restores its underlying pricing method. Margins use net selling amounts and item costs. Manual-price items whose converted line cost rounds to zero trigger **Cost review** and leave the affected root margin blank rather than implying a known 100% margin. This includes missing FX; supplying a valid rate or cost restores the margin.

Input validation, changed-input highlighting and error highlighting support editing. Formulas also validate inputs, so pasted text, negative values, invalid FX and out-of-range markup do not silently become zero. Affected calculations return Excel errors; visible summaries report that totals are unavailable. Clear or correct the input to recover.

Internal sheets protect source values and formulas while allowing filters and input edits. Excel cannot natively sort these locked tables while protection is active: unprotect the sheet, then sort the entire table, including item numbers and formulas. Stable item-number lookups keep inputs associated with their items after a whole-table sort; do not edit the numbers or sort individual columns.

The internal protected **Calculations** sheet is `veryHidden` and holds the fixed-order hierarchy and tax model. The customer workbook has no calculation sheet, cost model, markups or FX data. Sheet hiding and protection are not the confidentiality boundary.

Internal root price overrides scale the calculated tax mix. A mixed-tax item with zero tax basis cannot acquire a positive price without a defined split: formulas return an error instead of inventing a tax allocation.

## Rounding

Customer cells contain the final values returned by the shared document helpers. Internal calculated cells contain formulas and cached results. Unit selling prices round to cents before quantity multiplication, matching the app. Child quantities are per immediate parent unit; each group multiplies its child rollup once, and the quotation subtotal sums roots only. Bounded internal range formulas avoid oversized expressions on large quotations.

The model keeps `totalsConfig.taxAllocationVersion`. Legacy policy `1` (also used when missing) preserves original rounding allocation while a tax class is unchanged; after edits, equal decimal remainders use quotation root order. Policy `2` rounds integer subtotal cents multiplied by the exact decimal rate fraction half up, with root allocation based on exact integer remainders and quotation root order for ties. Price and quantity edits recalculate these allocations. Unsupported precision is rejected during export or produces an Excel error after an unsupported edit; pre-tax pricing, markup, FX and hierarchy rules are unchanged.

## Implementation

- `quotationExcelExport.ts` routes customer output to the document exporter and builds the internal review sheets, wiring overrides to the model through stable lookups.
- `quotationCustomerExcel.ts` writes public document values using the shared preview rows, pricing columns, summary helpers and document translations.
- `quotationExcelModel.ts` builds the hierarchy, pricing and tax formulas on the fixed-order calculation sheet.
- `quotationExcelWorkbook.ts` writes the XLSX package using the existing `fflate` dependency, including multiple sheets, protection, filters, validations, conditional formatting and print settings.
- `useQuotationFileActions.exportQuotationExcel` resolves the revision and handles localized results.
- `QuotationRuntime.saveQuotationExcelFile` uses the Electron save dialog or browser save/download workflow.

The generated workbook is independent of the app. Changes made in Excel are not imported back. The existing line-item XLSX import template remains a separate format.

Automation API 2.3 remains unchanged: `exportExcelToFile(path, { mode?, quotationRevisionId? })` defaults to customer mode and advertises `directExcelExport`. The CLI accepts `--quotation-customer-xlsx` and `--quotation-internal-xlsx` together or separately. Both routes use the dialog's workbook builder and preserve quotation history. See [headless-export.md](headless-export.md) for collision and overwrite rules.

Generate synthetic workbooks and a scenario manifest, then exercise them in an installed native Excel instance:

```powershell
node scripts/create-excel-verification.mjs output/qa/excel-redesign
powershell -NoProfile -File scripts/verify-excel-redesign.ps1 -Directory output/qa/excel-redesign
```

The harness uses disposable copies for internal recalculation, input edits, invalid pasted values, whole-table sorts and save/reopen checks. It writes results and edited copies to a new `native-excel-*` folder; consult that run's results rather than treating fixture generation as a successful Excel check.

Changes to Electron handlers or preload APIs require restarting the development desktop app; renderer changes use Vite hot reload.
