# Quotation Automation Implementation Progress

Last updated: 2026-08-26

## Completed phases

- Added the versioned `QuotationAgentApiV2` contract and `window.quotationAgentV2`.
- Added the stable `window.quotationAgentReady` promise.
- Added API, application, schema, host, and capability discovery.
- Added structured v2 results with request IDs, observed revisions, warnings, and errors.
- Added detached quotation snapshots and schema-v2 serialization.
- Added non-mutating validation for active quotations and supplied quotation JSON.
- Kept `window.quotationAgent` and the existing headless export behavior compatible.
- Marked hidden headless renderer windows with `mode=automation` for accurate capability reporting.
- Defined persistence timestamps as non-undoable metadata and stabilized the legacy agent undo test.
- Completed Phase 2 full quotation authoring (AUT-005 through AUT-008):
  - quotation lifecycle, header, template, locale, branding, entry-mode, and output settings;
  - three-level item-tree CRUD and section headers using stable IDs;
  - pricing, tax, exchange-rate, extra-charge, and all goal-seek targets;
  - queued mutations, revision-conflict checks, and atomic clone-then-commit batches.
- Kept the UI and automation paths on the same editor/tree history operations and canonical calculation/goal-seek utilities.
- Added an explicit history commit boundary so separate automation calls remain separate undo entries while batches create one entry.
- Added V2 structured wrappers for quotation/CSV/XLSX imports, quotation JSON saving, and quotation/goods-receipt PDF exports while retaining the legacy API.
- Migrated headless export to `quotationAgentReady` and `window.quotationAgentV2`.
- Added a lightweight `mode=automation` host that owns quotation state and automation registration without mounting the editor UI.
- Added `saveQuotationToFile()` with explicit path persistence behavior.
- Added semantic validation issues with stable codes and field paths for IDs, hierarchy, tax/FX references, output settings, numeric ranges, and goods-receipt payloads.
- Published [`quotation-v2.schema.json`](schemas/quotation-v2.schema.json).
- Completed AUT-009 typed goods-receipt automation, including stable-ID edits, presets, structured preflight warnings, deterministic clear/history behavior, and concrete persisted types.
- Completed AUT-010 production CLI modes: strict `validate`, `render`, and sequential `batch`, plus help/version/API info and the backward-compatible `--headless-export` alias.
- Added overwrite preflight, distinct-path checks, configurable phase timeouts, exact exit categories, structured stdout/stderr reports, normalized JSON output, output size/hash metadata, and atomic PDF writes.
- Completed AUT-011 shared limits for quotation JSON, CSV, XLSX, logos, goods-receipt drafts, and batch manifests/jobs across content and file paths.
- Added pre-decode base64 size checks plus logo MIME/signature/dimension validation with stable `input_too_large` failures.
- Completed AUT-013 customer and company-profile library list/get/apply methods using the existing undoable editor actions.
- Completed AUT-014 atomic progress JSON, structured progress events, phase-boundary cancellation, and complete batch summary counts.
- Completed AUT-012 integration coverage for all templates/locales and full quotation roundtrip authoring, plus a packaged Windows release verifier covering PDFs, reports, Unicode paths/content, failure exit codes, timeout, cancellation, and batch execution.

## Current limitations

- Revisions are in-memory and observed for UI-originated edits; they are not persisted across application restarts.
- Batch header updates intentionally exclude quotation-currency changes; use `setQuotationCurrency()` as a separate revision-safe call.
- Cancellation is cooperative between phases; an in-flight PDF render or network request finishes or reaches its configured timeout before cancellation is observed.

## Status

AUT-001 through AUT-014 are complete. AUT-015 remains intentionally deferred because the action notes make external MCP/JSON-RPC/HTTP adapters optional and recommend adding one only for a concrete consumer.

## Verification command

```powershell
npm test -- --run src/features/quotations/composables/useQuotationAgentApiV2.test.ts src/features/quotations/composables/useQuotationAgentApi.test.ts src/features/goods-receipts/utils/goodsReceipt.test.ts src/features/quotations/utils/quotationDraft.test.ts src/shared/utils/logoDataUrl.test.ts src/shared/runtime/quotationRuntime.test.ts electron/automationCli.test.ts electron/headlessExport.test.ts electron/atomicFile.test.ts electron/ipcValidation.test.ts
npm run typecheck
```
