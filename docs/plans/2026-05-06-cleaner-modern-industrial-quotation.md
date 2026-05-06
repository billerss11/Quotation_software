# Cleaner Modern Industrial Quotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the quotation preview and exported PDF into a cleaner modern industrial document without changing pricing, item hierarchy, or export logic.

**Architecture:** Keep `src/features/quotations/components/QuotationPreview.vue` as the single shared document component for floating preview, browser print, and Electron PDF export. Limit changes to markup, styling, and print-fit behavior so the existing preview-row builders and quotation pricing helpers remain untouched.

**Tech Stack:** Vue 3 with `<script setup lang="ts">`, scoped CSS, Electron print-to-PDF flow, Vitest, TypeScript.

---

Project rule override: do not create git commits. Verify with `npm run typecheck`, then run focused tests only if code outside styling/template structure changes.

### Task 1: Reshape The Shared Quotation Document

**Files:**
- Modify: `src/features/quotations/components/QuotationPreview.vue`

- [ ] **Step 1: Review the existing document markup and identify presentation-only redundancies**

Check these areas before editing:

```vue
<header class="document-header">...</header>
<section class="meta-band">...</section>
<section class="items-section">...</section>
<section class="summary-section">...</section>
```

Expected findings:
- repeated quotation date / validity inside the project block
- heavy card-like metadata styling
- pale filled hierarchy rows that can be replaced with lighter spacing/type hierarchy

- [ ] **Step 2: Tighten the document header and metadata markup**

Update the template so the project block no longer repeats quotation date and validity, while keeping all core commercial fields visible:

```vue
<section class="meta-band" :aria-label="documentT('quotations.document.partiesAria')">
  <div class="meta-box">
    <span class="meta-label">{{ documentT('quotations.document.preparedFor') }}</span>
    <strong>{{ quotation.header.customerCompany || quotation.header.contactPerson || documentT('quotations.document.customerFallback') }}</strong>
    <p>{{ quotation.header.contactPerson }}</p>
    <p>{{ quotation.header.contactDetails }}</p>
  </div>

  <div class="meta-box">
    <span class="meta-label">{{ documentT('quotations.document.project') }}</span>
    <strong>{{ quotation.header.projectName || documentT('quotations.document.projectFallback') }}</strong>
    <p>{{ quotation.header.notes ? quotation.header.notes : documentT('quotations.document.projectSummaryFallback') }}</p>
  </div>
</section>
```

Implementation note:
- If a new fallback string is needed, add matching `en-US` and `zh-CN` entries in `src/shared/i18n/messages.ts`.

- [ ] **Step 3: Replace the current visual system with a restrained industrial style**

Refactor the scoped CSS in `QuotationPreview.vue` around:

```css
.quotation-document {
  --preview-ink: #0f172a;
  --preview-muted: #475569;
  --preview-line: #d5dde6;
  --preview-line-strong: #9aa8b8;
  --preview-surface: #f6f8fb;
}
```

Apply these style changes:
- compress header spacing
- reduce box chrome
- remove large pale-blue fills from hierarchy rows
- use stronger typography and rules for level 1 rows
- keep level 2 and level 3 rows mostly white with subtle indentation guides
- sharpen totals styling so the grand total is authoritative without looking like an app card

- [ ] **Step 4: Keep the row hierarchy readable without touching row-generation logic**

Preserve existing table rendering:

```vue
<tr
  v-for="row in previewRows"
  :key="row.key"
  :class="[
    `row-${row.type}`,
    `row-level-${row.level}`,
    {
      'row-group': isGroupRow(row),
      'row-detail': row.level === 3,
    },
  ]"
>
```

But restyle the classes so:
- level 1 rows use stronger type and top rules
- level 2 rows use lighter indentation guides
- level 3 rows stay compact and quiet
- monetary columns remain visually stable and right-aligned

- [ ] **Step 5: Re-read `QuotationPreview.vue` and remove dead styling or repeated selectors introduced by the refactor**

Cleanup targets:
- old blue-tint variables no longer used
- selectors tied to removed repeated metadata lines
- any spacing rules made obsolete by the new layout

### Task 2: Keep Print/PDF Rendering Tight

**Files:**
- Modify: `src/features/quotations/components/QuotationPrintDocumentView.vue`

- [ ] **Step 1: Review the print wrapper against the new document spacing**

Confirm the wrapper still only does print-shell work:

```vue
<main class="print-document-shell">
  <QuotationPreview ... />
</main>
```

Expected review outcome:
- print wrapper remains minimal
- page-level margins and section break controls still belong here

- [ ] **Step 2: Adjust print-shell spacing only if the new document layout needs it**

If the refreshed `QuotationPreview.vue` spacing makes current print rules too loose or too tight, update only the shell-level selectors:

```css
.print-document-shell :deep(.quotation-document) {
  margin: 0;
  border: 0;
  box-shadow: none;
  display: block;
  min-height: auto;
}
```

Allowed changes:
- spacing between top-level sections
- summary/footer top margins
- page-break protection selectors

Not allowed:
- duplicating styling that belongs in `QuotationPreview.vue`
- any export/runtime logic changes

### Task 3: Internationalization Support For New Copy

**Files:**
- Modify: `src/shared/i18n/messages.ts` if needed

- [ ] **Step 1: Add any new document fallback text in both locales**

If Task 1 introduces any new visible text such as a project-summary fallback, add matching keys under:

```ts
quotations: {
  document: {
    // new keys here
  }
}
```

Required rule:
- do not hardcode new user-visible strings in `QuotationPreview.vue`

- [ ] **Step 2: Re-read both locale blocks for parity**

Confirm:
- same keys exist in `en-US` and `zh-CN`
- wording stays practical and quotation-focused
- no mojibake or accidental smart-quote corruption

### Task 4: Verification

**Files:**
- Verify changed files only

- [ ] **Step 1: Run TypeScript/Vue verification**

Run:

```bash
npm run typecheck
```

Expected:
- exit code `0`

- [ ] **Step 2: Run focused tests only if implementation touched non-style behavior**

Run only if helper logic or i18n structure changes require it:

```bash
npm test -- quotationPreviewRows
```

Expected:
- targeted pass for any affected helper coverage

- [ ] **Step 3: Inspect the diff for scope discipline**

Run:

```bash
git diff -- src/features/quotations/components/QuotationPreview.vue src/features/quotations/components/QuotationPrintDocumentView.vue src/shared/i18n/messages.ts
```

Expected:
- changes stay within presentation, print fit, and text support
- no quotation calculation logic changes
