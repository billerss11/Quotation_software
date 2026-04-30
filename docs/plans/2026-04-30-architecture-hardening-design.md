# Architecture Hardening Design

**Date:** 2026-04-30

**Goal**

Harden the top architectural hotspots in the quotation app without changing user-visible behavior, without introducing broad new layers, and without scattering files across the repo.

**Scope**

- Refactor `QuotationEditor.vue` so it remains the quotation feature composition surface instead of owning file workflows, PDF export orchestration, workbench state, and keyboard/save side effects.
- Refactor `LineItemsTable.vue` so it remains the line-item table container instead of holding most row rendering and repeated item interaction markup in one oversized file.
- Remove duplicated Electron bridge and quotation app contract types so renderer and Electron code consume one shared source of truth.
- Reorganize only the tests tied to these hotspots when the current placement makes maintenance harder.

**Non-Goals**

- No repo-wide architecture rewrite.
- No domain-core or plugin-style abstraction work.
- No user-visible behavior or UI changes unless they are required to preserve the existing workflow after decoupling.
- No broad test relocation outside the approved hotspots.

**Target File Layout**

Production code stays in existing feature folders.

- Keep `src/features/quotations/components/QuotationEditor.vue` as the quotation composition surface.
- Keep `src/features/quotations/components/LineItemsTable.vue` as the table-level container.
- Add `src/features/quotations/composables/useQuotationFileActions.ts` for JSON/CSV/PDF/import/export/save behavior and related status handling.
- Add `src/features/quotations/composables/useQuotationWorkbench.ts` for support-panel state, resize persistence, preview-window state, keyboard save, and focused-item scroll behavior.
- Add a small number of quotation-local subcomponents under `src/features/quotations/components/` only where they remove repeated row markup from `LineItemsTable.vue`.
- Add `src/shared/contracts/quotationApp.ts` as the single source of truth for Electron bridge contracts.

**Responsibility Split**

`QuotationEditor.vue` keeps:

- quotation state creation
- workbench composition
- prop passing to feature components
- UI event wiring from components to composable actions

`QuotationEditor.vue` moves out:

- quotation file save/load/import/export flows
- CSV template export and CSV import/export handling
- PDF export orchestration
- browser download fallback logic
- support-panel collapse and resize persistence
- preview-window visibility state
- keyboard `Ctrl+S` handling
- delayed scroll-to-focused-item behavior

`LineItemsTable.vue` keeps:

- table-level layout
- root-level iteration
- root collapse/expand state
- shared table props and emits

`LineItemsTable.vue` moves out:

- repeated root item card markup
- repeated row field clusters
- deep child-row rendering branches that make the file hard to scan

**Shared Contract Cleanup**

- Move `QuotationAppApi` and related Electron bridge payload/result types to `src/shared/contracts/quotationApp.ts`.
- Update renderer typing to reference that shared contract directly.
- Reduce `electron/preload-api.ts` to a thin contract consumer/export site instead of a second type definition source.

**Testing Rules**

- Keep utility tests next to the utility they verify.
- Keep composable tests next to the composable they verify.
- Keep component integration tests with the top-level component they exercise.
- Move file workflow tests from editor-heavy locations to `useQuotationFileActions.test.ts` when that behavior no longer belongs to the Vue component.
- Add `useQuotationWorkbench.test.ts` for extracted workbench behavior where it creates stable, focused coverage.
- Avoid duplicate coverage across component and composable layers for the same logic.

**Guardrails**

- Prefer deleting duplication over adding abstraction.
- Keep the new file count small and local to `src/features/quotations/`.
- Avoid new top-level folders beyond the single shared contract file under `src/shared/contracts/`.
- Preserve existing behavior, storage format, Electron bridge behavior, and quotation workflows.
