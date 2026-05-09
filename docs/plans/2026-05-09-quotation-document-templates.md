# Quotation Document Templates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add four distinct quotation document templates with one saved `templateId` per quotation plus temporary preview/export overrides.

**Architecture:** Move shared preview/PDF document preparation out of the current monolithic preview component into a reusable document view-model utility. Route both floating preview and print/PDF rendering through a dedicated renderer component that selects one of four template components from the saved or override template id.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, PrimeVue `Select` and `Dialog`, vue-i18n, Electron PDF bridge, Vite, Vitest, Vue Test Utils.

**Repo note:** Do not add commit steps while executing this plan. `AGENTS.md` says git commits are handled by the user.

---

### Task 1: Add template ids to quotation data and normalization

**Files:**
- Create: `src/features/quotations/utils/quotationDocumentTemplates.ts`
- Modify: `src/features/quotations/types.ts`
- Modify: `src/features/quotations/utils/quotationDraft.ts`
- Modify: `src/features/quotations/utils/quotationDraft.test.ts`

**Step 1: Write the failing normalization tests**

Add coverage asserting that:

- new quotations default `templateId` to `standard`
- normalization preserves a supported template id
- normalization fills a missing template id with `standard`

**Step 2: Run the draft tests to confirm failure**

Run: `npm test -- quotationDraft.test.ts`

Expected: FAIL because `QuotationDraft` does not have `templateId` yet.

**Step 3: Add shared template constants and types**

Create `quotationDocumentTemplates.ts` with:

- the stable template id union
- a `DEFAULT_QUOTATION_TEMPLATE_ID`
- helper guards such as `isQuotationTemplateId(...)`

**Step 4: Extend the quotation draft type**

Add `templateId` to `QuotationDraft` in `types.ts`.

**Step 5: Update draft creation and normalization**

In `quotationDraft.ts`:

- initialize new quotations with `DEFAULT_QUOTATION_TEMPLATE_ID`
- normalize missing or invalid template ids back to the default

**Step 6: Re-run the draft tests**

Run: `npm test -- quotationDraft.test.ts`

Expected: PASS

### Task 2: Roundtrip template ids through quotation files and PDF payloads

**Files:**
- Modify: `src/shared/contracts/quotationApp.ts`
- Modify: `src/features/quotations/utils/quotationFile.test.ts`
- Modify: `src/features/quotations/utils/quotationFile.ts`
- Modify: `src/shared/runtime/quotationRuntime.test.ts`

**Step 1: Write failing roundtrip tests**

Add coverage asserting that:

- `createQuotationFileContent(...)` preserves `templateId`
- `parseQuotationFileContent(...)` returns a quotation with the same `templateId`
- missing `templateId` in imported JSON normalizes to `standard`

**Step 2: Extend the PDF payload contract**

Add a resolved `templateId` field to `QuotationPdfRenderPayload` and therefore `ExportQuotationPdfOptions`.

**Step 3: Update file parsing expectations**

Rely on `normalizeQuotationDraft(...)` so imported quotations fill missing `templateId` consistently.

**Step 4: Update runtime test fixtures**

Adjust PDF payload construction in `quotationRuntime.test.ts` to include the new resolved `templateId`.

**Step 5: Run focused tests**

Run: `npm test -- quotationFile.test.ts quotationRuntime.test.ts`

Expected: PASS

### Task 3: Extract shared quotation document view-model logic

**Files:**
- Create: `src/features/quotations/utils/quotationDocumentViewModel.ts`
- Create: `src/features/quotations/utils/quotationDocumentViewModel.test.ts`
- Modify: `src/features/quotations/components/QuotationPreview.test.ts`

**Step 1: Write failing view-model tests**

Add coverage for:

- section header rows
- single-tax vs mixed-tax column counts
- row pricing lookup
- visible tax bucket filtering
- locale-sensitive header/totals inputs needed by templates

**Step 2: Run the new view-model tests**

Run: `npm test -- quotationDocumentViewModel.test.ts`

Expected: FAIL because the shared view-model utility does not exist.

**Step 3: Implement the shared utility**

Move reusable document preparation logic out of the current preview component into a pure utility that accepts:

- `quotation`
- `summaries`
- `totals`
- `globalMarkupRate`
- `exchangeRates`
- `companyProfile`

Return a single object that templates can render without recalculating document structure.

**Step 4: Trim old preview-specific tests**

Update `QuotationPreview.test.ts` so any remaining assertions cover shared behavior that still belongs at the component layer. Move calculation-heavy assertions into the new utility test.

**Step 5: Re-run focused tests**

Run: `npm test -- quotationDocumentViewModel.test.ts QuotationPreview.test.ts`

Expected: PASS

### Task 4: Split the current preview layout into a standard template and add a renderer

**Files:**
- Create: `src/features/quotations/components/QuotationDocumentRenderer.vue`
- Create: `src/features/quotations/components/QuotationDocumentRenderer.test.ts`
- Create: `src/features/quotations/components/document-templates/QuotationTemplateStandard.vue`
- Modify: `src/features/quotations/components/QuotationPreview.vue`

**Step 1: Write the failing renderer test**

Assert that:

- the renderer mounts `QuotationTemplateStandard` for `standard`
- the renderer prefers an explicit override template id over the saved quotation template id

**Step 2: Run the renderer test to verify failure**

Run: `npm test -- QuotationDocumentRenderer.test.ts`

Expected: FAIL because the renderer does not exist.

**Step 3: Move the current document markup into the standard template**

Take the current `QuotationPreview.vue` layout and styling and move it into `QuotationTemplateStandard.vue`, fed by the shared document view-model.

**Step 4: Implement the renderer**

Create `QuotationDocumentRenderer.vue` that:

- builds the shared view-model once
- resolves `overrideTemplateId ?? quotation.templateId`
- mounts the correct template component

**Step 5: Reduce or remove the old preview wrapper**

Either:

- replace `QuotationPreview.vue` with a thin renderer wrapper, or
- remove it and migrate callers directly

Choose the smaller change set that keeps imports clear and tests readable.

**Step 6: Re-run the renderer tests**

Run: `npm test -- QuotationDocumentRenderer.test.ts`

Expected: PASS

### Task 5: Build the other three document templates

**Files:**
- Create: `src/features/quotations/components/document-templates/QuotationTemplateClassic.vue`
- Create: `src/features/quotations/components/document-templates/QuotationTemplateMinimal.vue`
- Create: `src/features/quotations/components/document-templates/QuotationTemplateBold.vue`
- Modify: `src/features/quotations/components/QuotationDocumentRenderer.test.ts`

**Step 1: Add failing smoke coverage for the remaining templates**

Add assertions that the renderer can select:

- `classic`
- `minimal`
- `bold`

Use lightweight component markers or structural assertions instead of full snapshots.

**Step 2: Implement the three new templates**

Each template must:

- render the same business content
- display the same rows and totals
- remain print-safe on A4
- feel visually distinct from the others

**Step 3: Re-run the renderer test**

Run: `npm test -- QuotationDocumentRenderer.test.ts`

Expected: PASS

### Task 6: Wire saved template selection into the quotation editor

**Files:**
- Modify: `src/features/quotations/components/QuoteInfoPanel.vue`
- Modify: `src/features/quotations/components/QuotationEditor.vue`
- Modify: `src/features/quotations/composables/useQuotationEditor.ts`
- Modify: `src/shared/i18n/messages.ts`

**Step 1: Write or extend a focused UI test**

If adding a new dedicated UI test is cheaper, create one for `QuoteInfoPanel.vue`. Otherwise extend an editor-level test to assert the saved template selector is present and bound.

**Step 2: Add template option i18n keys**

Add bilingual keys for:

- `Document template`
- four template labels
- helper text if needed

**Step 3: Expose template options to the panel**

Update `QuotationEditor.vue` and `QuoteInfoPanel.vue` so the quote-info area can edit `quotation.templateId`.

**Step 4: Keep the data flow simple**

Avoid introducing new global state. This should remain a direct quotation draft field update like other quote configuration values.

**Step 5: Run the focused UI test**

Run: `npm test -- QuotationEditor.analysis.test.ts`

Expected: PASS after any necessary stub updates

### Task 7: Add preview-time template override

**Files:**
- Create: `src/features/quotations/components/QuotationTemplateSelector.vue`
- Modify: `src/features/quotations/components/FloatingPreviewWindow.vue`
- Modify: `src/features/quotations/components/QuotationEditor.vue`
- Modify: `src/shared/i18n/messages.ts`

**Step 1: Write the failing preview override test**

Add coverage asserting that the floating preview:

- opens using the saved template
- can switch to another template locally
- does not mutate `quotation.templateId` when only the preview override changes

**Step 2: Run the preview-focused test**

Run: `npm test -- QuotationDocumentRenderer.test.ts`

Expected: FAIL once the override behavior is asserted but not implemented.

**Step 3: Add a reusable template selector component**

Create a small selector component backed by the shared template option list so preview and export do not duplicate template-picking UI logic.

**Step 4: Store override state in the preview flow only**

Keep preview override state local to `QuotationEditor.vue` / `FloatingPreviewWindow.vue`. Do not write override state into the saved draft.

**Step 5: Switch preview rendering to the renderer**

Update `FloatingPreviewWindow.vue` to render `QuotationDocumentRenderer.vue` with the local override template id.

**Step 6: Re-run the focused preview test**

Run: `npm test -- QuotationDocumentRenderer.test.ts`

Expected: PASS

### Task 8: Add export-time template override and resolved payload handling

**Files:**
- Create: `src/features/quotations/components/QuotationExportDialog.vue`
- Modify: `src/features/quotations/composables/useQuotationFileActions.ts`
- Modify: `src/features/quotations/composables/useQuotationFileActions.test.ts`
- Modify: `src/features/quotations/components/QuotationEditor.vue`
- Modify: `src/features/quotations/components/FloatingPreviewWindow.vue`
- Modify: `src/features/quotations/components/QuotationPrintDocumentView.vue`
- Modify: `src/shared/i18n/messages.ts`

**Step 1: Write the failing export override test**

Extend `useQuotationFileActions.test.ts` to assert that:

- export without override uses `quotation.templateId`
- export with override uses the override template id in the payload sent to `runtime.exportQuotationDocument(...)`

**Step 2: Run the file-action tests**

Run: `npm test -- useQuotationFileActions.test.ts`

Expected: FAIL because export does not yet accept a template override.

**Step 3: Add the export dialog**

Create a lightweight PrimeVue dialog that:

- shows the current template selection
- allows override before export
- confirms or cancels cleanly

**Step 4: Thread the override through export actions**

Update `useQuotationFileActions.ts` so `createQuotationPdfExportOptions(...)` accepts an optional override template id and writes the resolved value into the export payload.

**Step 5: Use the renderer in print/PDF mode**

Update `QuotationPrintDocumentView.vue` so the print document path renders `QuotationDocumentRenderer.vue` using the resolved payload template id.

**Step 6: Re-run the export tests**

Run: `npm test -- useQuotationFileActions.test.ts quotationRuntime.test.ts`

Expected: PASS

### Task 9: Final verification

**Files:**
- Test: `src/features/quotations/utils/quotationDraft.test.ts`
- Test: `src/features/quotations/utils/quotationFile.test.ts`
- Test: `src/features/quotations/utils/quotationDocumentViewModel.test.ts`
- Test: `src/features/quotations/components/QuotationDocumentRenderer.test.ts`
- Test: `src/features/quotations/composables/useQuotationFileActions.test.ts`

**Step 1: Run the focused quotation document test set**

Run: `npm test -- quotationDraft.test.ts quotationFile.test.ts quotationDocumentViewModel.test.ts QuotationDocumentRenderer.test.ts useQuotationFileActions.test.ts`

Expected: PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS

**Step 3: Do a manual desktop verification**

Check in the app that:

- saved template selection persists
- preview opens with the saved template
- preview override does not rewrite saved template
- export dialog resolves the correct template
- exported PDF matches the selected template
- all four templates paginate acceptably on A4

**Step 4: Record any verification gaps**

If PDF export cannot be manually verified in the current environment, note that explicitly before handing work back.
