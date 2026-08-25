# Quotation Automation Implementation Progress

Last updated: 2026-08-25

## Completed foundation

- Added the versioned `QuotationAgentApiV2` contract and `window.quotationAgentV2`.
- Added the stable `window.quotationAgentReady` promise.
- Added API, application, schema, host, and capability discovery.
- Added structured v2 results with request IDs, observed revisions, warnings, and errors.
- Added detached quotation snapshots and schema-v2 serialization.
- Added non-mutating validation for active quotations and supplied quotation JSON.
- Kept `window.quotationAgent` and the existing headless export behavior compatible.
- Marked hidden headless renderer windows with `mode=automation` for accurate capability reporting.
- Defined persistence timestamps as non-undoable metadata and stabilized the legacy agent undo test.

## Current limitations

- V2 does not yet expose the legacy import, mutation, or export actions.
- Headless export still polls for and invokes `window.quotationAgent`.
- Headless mode still mounts the full application UI; there is no lightweight automation host yet.
- Validation uses the existing quotation-file parser. A published JSON schema and complete field-level semantic validation are still pending.
- Revision tracking observes changed quotation snapshots. Expected-revision checks, command queuing, and atomic batches are not implemented.
- Saving serialized quotation JSON to a supplied path is not yet exposed through v2.

## Recommended next slice

1. Wrap the existing legacy import/export actions in v2 structured results without removing the legacy methods.
2. Migrate headless export to `quotationAgentReady` and v2 calls.
3. Add the lightweight `mode=automation` host so headless execution no longer mounts the full editor.
4. Add `saveQuotationToFile`, stronger validation issues, and the published schema.

After that, continue with header/output operations, hierarchical item CRUD, pricing/tax/FX operations, revisions/batches, goods receipts, and the expanded CLI in the order described by `QUOTATION_AUTOMATION_API_ACTION_NOTES.md`.

## Verification command

```powershell
npm test -- --run src/features/quotations/composables/useQuotationAgentApiV2.test.ts src/features/quotations/services/quotationAutomationRegistration.test.ts src/features/quotations/composables/useQuotationAgentApi.test.ts src/shared/runtime/quotationRuntime.test.ts electron/headlessExport.test.ts src/features/quotations/utils/quotationFile.test.ts
npm run typecheck
```
