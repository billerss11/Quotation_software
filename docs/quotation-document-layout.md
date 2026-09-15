# Quotation document layout

The editor preview and quotation PDF use `QuotationPaginatedDocument.vue`. It renders the selected template at its natural A4 width, waits for fonts/images, and uses `quotationPagination.ts` to create the pages. Display zoom changes only the visible page scale; it must not change the measured layout. Use outlines/shadows, not borders, to decorate preview pages.

`QuotationPreview.vue` is the unpaginated template host used for measurement and template tests. Do not use it alone as the final print preview.

## Content and pricing

- All item descriptions, including root groups, are printed. Detail level 1/2 explicitly identifies omitted deeper items; their prices remain included in group totals.
- Child quantities and amounts are per one immediate parent unit. Group quantity multiplies its child rollup. The document labels inclusion and local quantity scope; the pricing calculations are unchanged.
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

For Windows release verification, compare actual Electron editor preview pages with the generated PDF. A browser at a different zoom/DPI can have slightly different font rounding, so it is not a substitute for checking both Electron paths in the same environment.
