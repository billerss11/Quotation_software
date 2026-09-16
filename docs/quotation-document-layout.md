# Quotation document layout

The editor uses `QuotationPreview.vue` directly for a continuous, reactive preview. Opening the preview, changing pricing columns, and switching templates must not run document pagination or clone all quotation rows. Fit-width/100% zoom changes the display scale; the template retains its natural A4 width.

For previews over 100 rows, the existing virtual scroller renders only the rows near the viewport and measures their variable heights. It accounts for preview zoom and the header above the table. All quotation data remains available while scrolling; this optimization is enabled only by the floating preview's context.

PDF export uses `QuotationPaginatedDocument.vue`, which measures the same template at its natural A4 width, waits for fonts/images, and uses `quotationPagination.ts` to create print pages. Exact page breaks and page numbers are applied during export; the interactive preview identifies itself as continuous.
The print route does not provide the floating preview context, so its table always contains every selected quotation row.

## Content and pricing

- All item descriptions, including root groups, are printed. Detail level 1/2 explicitly identifies omitted deeper items; their prices remain included in group totals.
- Child quantities and amounts are per one immediate parent unit. Group quantity multiplies its child rollup. Hierarchy is expressed through numbering, indentation, weight and row styling, without repeated relationship sentences. The pricing calculations are unchanged.
- A mixed-tax group is labeled as mixed with an effective rate. Its displayed effective rate is not a separately configured tax class.
- Normal mixed-tax selections retain separate pricing columns. If full formatted values cannot fit alongside a readable description, the table uses a labeled pricing breakdown containing every selected field.
- Description, monetary and unit text have a readable minimum size. Ordinary words wrap naturally; unbroken identifiers can wrap inside their cells without truncation.

## Pagination

- Repeat table headers, quotation reference, page number and ancestor/item continuation context.
- Keep group headings with their first child when the pair fits a page.
- Oversized rows split at text boundaries. Each cell's remaining content is carried forward; completed amount cells stay empty on continuation fragments.
- Small closing summaries stay together when possible. Long notes flow across pages; ordinary tax/charge/total rows stay intact.
- The printer is notified only after the actual page layout is ready. Quotation PDFs honor the component's CSS A4 orientation. Goods-receipt printing is unchanged.

## Verification

Run `npm run typecheck`, focused quotation tests, and `npm run test:browser` after layout changes. Browser coverage includes all seven templates, large values, long identifiers and practical descriptions. Pagination tests also cover text preservation, oversized sections/units, group boundaries and compact summaries.

For Windows release verification, check the actual Electron preview for responsive column/template changes and preserved content, then inspect the generated PDF for page breaks, continuation context and footer containment. Include a large quotation (at least 1,000 rows) in performance checks. The PDF paginator must reuse empty page/table shells, rather than deep-cloning the full quotation for every page.
