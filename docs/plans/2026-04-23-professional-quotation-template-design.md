# Professional Quotation Template Design

## Goal

Make the quotation output clear, simple, and professional for printing and PDF export.

## Layout

The quotation preview should read like a commercial document rather than an app panel. The page has:

- Header with logo/company identity on the left and quotation metadata on the right.
- Customer/project metadata in a two-column band.
- Structured item table with major section rows, sub-item rows, and parent subtotal rows.
- Right-aligned totals summary.
- Notes/terms section.
- Signature/footer area.

## Pricing Visibility

The output must show customer-facing selling prices only. Internal unit cost, cost currency, exchange rate, and markup stay hidden.

## Component Boundaries

`QuotationPreview.vue` remains the output component. It can use computed row helpers internally, but pricing calculations still come from `quotationCalculations.ts`.

## Style Direction

Use a white A4-like document surface, restrained typography, light gray dividers, and one accent color. Avoid heavy card styling inside the quotation document.
