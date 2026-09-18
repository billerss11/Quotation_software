# Template layout regression inputs

Fabricated schema-v2 quotations from the 2026-09-15 template audit. No real customer data.

- S06: large money values and long units.
- S09: long identity fields, SKU and descriptions.
- S11: two-group summary that must remain complete on one page.
- S21: ordinary header with an unbroken SKU and specification URL.
- S22/S23: practical English/Chinese paragraphs and explicit specification lines, wide/sparse pricing columns.

These inputs remain active regression fixtures:

- [QuotationItemsTable.templates.browser.spec.ts](../QuotationItemsTable.templates.browser.spec.ts) checks S06, S09, S21, S22, and S23 across all seven templates.
- [QuotationPaginatedDocument.browser.spec.ts](../../../components/QuotationPaginatedDocument.browser.spec.ts) checks S11 across all seven templates and S06 header amounts in Executive Summary and Luminous. It also generates quotations for long-text and continuation-page checks.

Run both suites from the repository root with `npm run test:browser`. The browser configuration uses installed Google Chrome in headless mode.

These small input files are kept with the tests so the suites do not depend on locally generated audit reports or PDFs. Preserve their scenario-specific text and values when maintaining the fixtures; the tests assert content, amounts, and containment.
