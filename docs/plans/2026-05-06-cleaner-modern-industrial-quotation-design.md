# Cleaner Modern Industrial Quotation Design

## Goal

Upgrade the quotation preview and exported PDF so they read like a polished industrial sales document instead of a styled app export.

This pass is presentation-only:

- no pricing formula changes
- no item rollup logic changes
- no file/export workflow changes
- no quotation schema changes

## Scope

Primary files:

- `src/features/quotations/components/QuotationPreview.vue`
- `src/features/quotations/components/QuotationPrintDocumentView.vue`

Secondary files only if needed for copy or print fit:

- `src/shared/i18n/messages.ts`

## Design Direction

The document should feel:

- clean
- modern
- industrial
- controlled
- credible for high-value quotations

It should not feel:

- decorative
- soft
- card-heavy
- spreadsheet-like
- internally generated

## Problems In The Current Template

1. The top section uses too much space for too little information.
2. The blue/green palette and filled rows feel dated.
3. The metadata cards add chrome without adding authority.
4. The line-item area becomes visually noisy once descriptions get long.
5. Parent rows, child rows, and prices are not separated by a strong enough hierarchy.
6. Repeated metadata makes the page feel less disciplined.

## Proposed Changes

### 1. Header compression

Keep the left/right header structure, but tighten it substantially:

- reduce empty vertical space
- strengthen company identity
- make quotation metadata feel more precise and aligned
- keep the title prominent, but less oversized relative to the rest of the page

### 2. Cleaner metadata band

Keep customer/project information, but restyle it away from "boxed cards":

- lighter surfaces or plain white sections
- thinner rules
- better spacing discipline
- remove redundant repeated date/validity content from the project block

### 3. Table restyling

Preserve the current table data and hierarchy, but redesign the visual system:

- white or near-white rows instead of large pale-blue fills
- stronger header rule and cleaner column alignment
- clearer indentation for level 2 and level 3 rows
- make parent rows authoritative through type weight and spacing, not heavy background blocks
- keep sub-item/detail text quieter and easier to scan

### 4. Controlled palette

Use a restrained industrial palette:

- one dark primary ink color
- one accent derived from branding
- neutral grays for borders and secondary text

Accent color should support branding, but the document should remain clean even when the accent is vivid.

### 5. Totals and terms refinement

Make the commercial close feel more intentional:

- notes/terms become quieter and cleaner
- totals box becomes sharper and more authoritative
- grand total gets stronger emphasis without looking like a highlighted app panel

### 6. Print fidelity

Preserve A4 output behavior and page-break safety:

- do not introduce layout that is fragile in Electron PDF rendering
- keep major sections and totals from splitting awkwardly
- keep the print wrapper minimal

## Component Boundaries

`QuotationPreview.vue` remains the single shared document component for:

- floating preview
- browser print
- Electron PDF export

No quotation calculation utilities should change unless a tiny presentation-only helper is required. The existing preview-row generation and pricing display helpers remain the source of row content.

## Expected User-Visible Outcome

After this pass, the same quotation data should render as:

- denser in the right places
- less dated
- easier to scan
- more brandable
- more credible as an official industrial quotation

## Verification

- run `npm run typecheck`
- run focused tests only if any non-style helper changes are required
- if feasible, visually inspect the preview and print/export rendering after the styling pass
