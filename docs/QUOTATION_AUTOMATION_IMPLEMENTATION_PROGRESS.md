# Quotation Automation Implementation Progress

Last updated: 2026-08-25

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

## Current limitations

- V2 does not yet expose the legacy import or export actions.
- Headless export still polls for and invokes `window.quotationAgent`.
- Headless mode still mounts the full application UI; there is no lightweight automation host yet.
- Validation uses the existing quotation-file parser. A published JSON schema and complete field-level semantic validation are still pending.
- Revisions are in-memory and observed for UI-originated edits; they are not persisted across application restarts.
- Batch header updates intentionally exclude quotation-currency changes; use `setQuotationCurrency()` as a separate revision-safe call.
- Saving serialized quotation JSON to a supplied path is not yet exposed through v2.

## Recommended next slice

Before Phase 3, close the remaining carryover foundation work:

1. Wrap the existing legacy import/export actions in v2 structured results without removing the legacy methods.
2. Migrate headless export to `quotationAgentReady` and v2 calls.
3. Add the lightweight `mode=automation` host so headless execution no longer mounts the full editor.
4. Add `saveQuotationToFile`, stronger validation issues, and the published schema.

Then begin Phase 3 (AUT-009 through AUT-011): typed goods-receipt draft automation, production CLI modes, and consistent input limits.

## Verification command

```powershell
npm test -- --run src/features/quotations/composables/useQuotationAgentApiV2.test.ts src/features/quotations/composables/useQuotationEditor.history.test.ts src/features/quotations/composables/useQuotationAgentApi.test.ts src/features/quotations/utils/quotationGoalSeek.test.ts src/features/quotations/services/quotationAutomationRegistration.test.ts src/shared/runtime/quotationRuntime.test.ts electron/headlessExport.test.ts src/features/quotations/utils/quotationFile.test.ts
npm run typecheck
```
