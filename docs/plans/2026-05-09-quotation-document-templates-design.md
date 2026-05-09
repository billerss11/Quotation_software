# Quotation Document Templates Design

**Date:** 2026-05-09

## Goal

Add four separate quotation document templates so the same quotation data can be previewed and exported as PDF in four clearly different visual styles.

## Decisions

### Four dedicated templates, not one themeable layout

- The app will use four separate document template components.
- Templates will share the same quotation data and calculations.
- Templates will differ only in layout, structure, typography, spacing, and styling.
- Templates will not differ in business content, totals, or calculation rules.

### Saved per quotation, overrideable at preview/export time

- Each quotation stores a persistent `templateId`.
- Preview uses the saved template by default.
- Preview may temporarily override the template without changing the saved quotation.
- PDF export may also temporarily override the template.
- If no override is chosen, preview/export use the saved template.

### Current layout becomes the default template

- New quotations default to the current document design.
- The current design becomes one named template, not a special fallback path.
- Even though the product has no existing users, normalization should still fill a missing `templateId` when loading old test fixtures or manual JSON imports.

## Data model

### Quotation draft

`QuotationDraft` gains:

- `templateId: QuotationTemplateId`

This field lives on the quotation draft itself rather than under `header` or `branding`, because it controls full-document rendering.

### Template ids

Use a stable shared union or constant set for template ids. A practical initial set is:

- `standard`
- `classic`
- `minimal`
- `bold`

`standard` is the current design and is the default for new quotations and normalized missing values.

### PDF payload

The PDF render payload should carry the resolved template choice so the print window only renders the requested template and does not repeat template-selection logic.

## Rendering architecture

### Shared document pipeline

All non-visual quotation document logic should be extracted from the current preview component into a shared document view-model layer. That shared layer owns:

- preview row generation
- row pricing lookup
- tax-mode column decisions
- totals visibility
- tax bucket visibility
- locale-aware formatting inputs
- company/customer snapshot selection
- page sizing inputs

Templates receive already-prepared document data and focus on presentation only.

### Renderer component

Add a renderer component that:

- accepts quotation document inputs
- accepts an optional override template id
- resolves `overrideTemplateId ?? quotation.templateId`
- mounts exactly one of four template components

Suggested structure:

- `QuotationDocumentRenderer.vue`
- `QuotationTemplateStandard.vue`
- `QuotationTemplateClassic.vue`
- `QuotationTemplateMinimal.vue`
- `QuotationTemplateBold.vue`

## UI behavior

### Saved template selection

The persistent template selector belongs in the quote configuration area, not the command bar.

- Add a `Document Template` selector to `QuoteInfoPanel.vue`.
- The selector edits the saved `quotation.templateId`.
- This keeps document language, currency, validity, and template choice together in one place.

### Preview override

- Opening preview uses the saved template by default.
- The floating preview gets its own temporary template selector.
- Changing the selector updates only the active preview session unless the user separately changes the saved quotation template.

### Export override

- Export PDF opens a lightweight dialog before export.
- The dialog defaults to the saved template.
- If export is launched from preview, the dialog can preload the current preview override.
- Confirming export sends the resolved template in the export payload.

## I18n

All new user-facing strings must be added in both locales:

- template selector label
- four template names
- preview override label
- export dialog title and actions
- any new status or helper text

No user-visible strings should be hardcoded in components.

## Error handling

- Missing `templateId` during load/import normalizes to `standard`.
- Missing preview/export override uses the saved quotation template.
- Unknown template ids should fail loudly in development and surface a normal app error in UI flows rather than silently rendering the wrong template.

## Testing strategy

Testing should focus on shared document correctness and routing rather than brittle full-template snapshots.

- Add normalization coverage for `templateId`.
- Add file roundtrip coverage for `templateId`.
- Add shared document view-model tests for row/tax/totals behavior.
- Add renderer tests to verify the correct template component mounts.
- Add focused export tests to verify override template ids are passed into PDF export payloads.
- Keep per-template component tests as smoke tests for core headings and totals presence.

## Scope boundaries

Included:

- saved template selection
- preview override
- export override
- four built-in templates
- shared document data preparation

Not included:

- user-created template editing
- per-template custom content blocks
- per-template business-rule differences
- separate pricing logic per template
