# Programmatic Quotation API

Use `window.quotationAgentV2` for new integrations. `window.quotationAgent` is the legacy compatibility API and should only be used by existing consumers that depend on its older result shape.

Both APIs are renderer APIs, not HTTP APIs. External programs must execute JavaScript in the page, for example through Playwright. Prefer content methods in browsers; path methods require the Electron desktop or headless host.

## Recommended V2 API

The renderer installs `window.quotationAgentReady` before mounting the quotation editor or dedicated automation host. The promise resolves when `window.quotationAgentV2` is registered and returns its API information.

```ts
const info = await window.quotationAgentReady
const api = window.quotationAgentV2
if (!api) throw new Error('Quotation automation API v2 is unavailable')

const validation = await api.validateQuotationContent(jsonContent)
if (!validation.ok) throw new Error(validation.error.code)
if (!validation.data.valid) {
  console.error(validation.data.issues)
}

const serialized = await api.serializeQuotation()
if (!serialized.ok) throw new Error(serialized.error.code)
console.log(serialized.data.content)
```

The V2 API provides:

- `getApiInfo()` and `waitUntilReady()`
- `getQuotationSnapshot()`
- `listQuotationRevisions()` and `getQuotationRevision(id)`
- `createQuotationRevision(options?)`, `restoreQuotationRevision(id, options?)`, and `deleteQuotationRevision(id, options?)`
- `serializeQuotation()`
- quotation, CSV, and XLSX path/content imports
- `saveQuotationToFile(path, options?)`
- quotation and pending goods-receipt PDF path exports
- `validateQuotation()`
- `validateQuotationContent(content)`
- `validateForExport({ document: 'quotation' | 'goods_receipt' })`
- quotation creation and header/output/branding settings
- hierarchical line-item and section-header CRUD by stable ID
- pricing, tax, exchange-rate, extra-charge, and goal-seek operations
- complete pending goods-receipt creation, editing, selection, validation, clearing, and export
- read/apply access to the existing customer and company-profile libraries
- queued mutations with observed revisions
- `applyOperations()` for expected-revision checks and atomic clone-then-commit batches

`getApiInfo()` and `waitUntilReady()` return `QuotationAutomationApiInfo` directly. Every other V2 method returns a discriminated `AutomationResult<T>` with a request ID, API version, observed in-memory revision, structured warnings, and either `data` or a structured `error`. Snapshots and serialized quotation objects are detached copies.

```ts
type AutomationResult<T> =
  | { ok: true; data: T; meta: AutomationMeta }
  | { ok: false; error: { code: string; message: string; fieldPath?: string }; meta: AutomationMeta }
```

Call `getApiInfo()` instead of hard-coding the current API version (`2.3.0`) or host capabilities. The API version and quotation file schema version are separate: current files use schema 5, while schema 1, 2, 3, and 4 files remain importable. Schema 3 and 4 imports preserve all archived revisions.

## Capability matrix

| Capability | Desktop UI | Web UI | Headless CLI |
| --- | --- | --- | --- |
| Host value | `desktop-ui` | `web-ui` | `headless` |
| Path import/export | Yes | No | Yes |
| Direct PDF export | Yes | No | Yes |
| Direct Excel export (`directExcelExport`) | Yes | No | Yes |
| Browser print | No | Yes | No |
| Exchange-rate refresh | Yes | Yes | Yes, unless `--no-network` |
| Goods-receipt workflow | Yes | Yes | Yes |
| Atomic API batches | Yes | Yes | Yes |
| Revision reads (`revisionRead`) | Yes | Yes | Yes |
| Persisted revision changes (`revisionWrite`) | Yes | No | Yes |

Browser automation should use content methods and browser print; local path methods are desktop/headless only.

## V2 authoring methods

The exact TypeScript contract is [`QuotationAgentApiV2`](../src/shared/contracts/quotationAutomation.ts). The main authoring groups are:

| Group | Methods |
| --- | --- |
| Discovery and reads | `getApiInfo`, `waitUntilReady`, `getQuotationSnapshot`, `getItem`, `getItemTree` |
| Files | `importQuotationFile`, `importQuotationContent`, `importLineItemsCsvFile`, `importLineItemsCsvContent`, `importLineItemsXlsxFile`, `importLineItemsXlsxContent`, `serializeQuotation`, `saveQuotationToFile`, `exportPdfToFile`, `exportExcelToFile`, `exportGoodsReceiptPdfToFile` |
| Lifecycle and document | `createQuotation`, `updateHeader`, `setTemplate`, `setDocumentLocale`, `setBranding`, `setOutputSettings` |
| Persisted revision history | `listQuotationRevisions`, `getQuotationRevision`, `createQuotationRevision`, `restoreQuotationRevision`, `deleteQuotationRevision` |
| Reusable libraries | `listCustomers`, `getCustomer`, `applyCustomer`, `listCompanyProfiles`, `getCompanyProfile`, `applyCompanyProfile` |
| Item tree | `addLineItem`, `addSectionHeader`, `getItem`, `getItemTree`, `updateLineItem`, `updateSectionHeader`, `removeItem`, `duplicateItem`, `moveItem` |
| Pricing and FX | `setGlobalMarkupRate`, `setItemPricingMethod`, `setQuotationCurrency`, `addExchangeRate`, `updateExchangeRate`, `removeExchangeRate`, `refreshExchangeRates` |
| Tax and charges | `setTaxMode`, `setMixedTaxDocumentColumns`, `addTaxClass`, `updateTaxClass`, `removeTaxClass`, `setDefaultTaxClass`, `assignItemTaxClass`, `addExtraCharge`, `updateExtraCharge`, `removeExtraCharge` |
| Goal seek | `previewItemGoalSeek`, `applyItemGoalSeek`, `previewQuotationGoalSeek`, `applyQuotationGoalSeek` |
| Goods receipts | `createGoodsReceiptDraft`, `getPendingGoodsReceiptDraft`, `updateGoodsReceiptHeader`, `updateGoodsReceiptLine`, `setGoodsReceiptLineSelected`, `applyGoodsReceiptSelectionPreset`, `validateGoodsReceiptDraft`, `clearPendingGoodsReceiptDraft`, `exportGoodsReceiptPdfToFile` |
| Atomic workflow | `applyOperations` |
| Validation | `validateQuotation`, `validateQuotationContent`, `validateForExport` |

Quotation-level Quick/Detailed entry mode is no longer part of the V2 contract. Use `setItemPricingMethod(itemId, method)` for each leaf item; newly added items default to `cost_plus`.

`setOutputSettings()` accepts partial updates to `itemDetailLevel`, `subtotalLabel`, `informationalTotalsNote`, `showInformationalTotals`, and `informationalTotals`. An informational row is `{ id, label, sectionIds, visible, source?, itemIds? }`:

- `source: 'sections'` (the default when omitted) uses `sectionIds`. Each selected root section includes all priced root items up to the next header.
- `source: 'items'` uses `itemIds` to select individual items or groups at any depth. Keep `sectionIds: []` when unused. Selected IDs remain selected when items move; selected groups include their current descendants. Contributions include all ancestor quantities and reconcile rounding to the quotation's existing parent totals. Selecting both a parent and its descendants counts the parent once.

Inactive source selections and hidden rows remain saved. A blank row label uses selected section titles or item names. Amounts are selling subtotals before tax and extra charges; they never change the grand total. An empty `subtotalLabel` restores the document-language default. Visible rows with empty or deleted active selections block quotation PDF/print export, but can still be saved to JSON. Settings are preserved in revision snapshots, and changing output detail level does not change their amounts.

`informationalTotalsNote` is optional plain text printed above the breakdown. When omitted, the note is the localized equivalent of “Already included in {subtotalLabel}.” A supplied string is preserved as written, including line breaks; an empty or whitespace-only string hides the note. Custom text is not interpreted as HTML or a template and does not alter calculations. The note is retained when the breakdown is hidden.

```ts
const created = await api.createQuotation({
  header: {
    quotationDate: '2026-08-25',
    projectName: 'Pump package',
    currency: 'USD',
    documentLocale: 'en-US',
  },
  templateId: 'technical-bid',
})
if (!created.ok) throw new Error(created.error.code)

const root = await api.addLineItem({ item: { name: 'Pump package' } })
if (!root.ok) throw new Error(root.error.code)

await api.addLineItem({
  parentId: root.data.itemId,
  item: { name: 'Pump', quantity: 2, unitCost: 1000, costCurrency: 'USD' },
})
```

Mutations are serialized. Each completed mutation reports the latest concurrency counter in `meta.revision`. This counter belongs to the current renderer session and is not persisted across application restarts; it is separate from `quotation.header.revisionNumber` and archived quotation revisions. Changes to the active quotation, history, or history availability update the counter. Use `applyOperations({ expectedRevision, operations })` when multiple supported changes must either all succeed or leave the open quotation unchanged. A successful batch replaces the quotation once and creates one undo entry; a stale `expectedRevision` returns `revision_conflict`.

`applyOperations()` accepts only the operations in the `QuotationOperation` union. Its `updateHeader` operation excludes `currency`; change quotation currency with the separate revision-safe `setQuotationCurrency()` method.

Currency tables use quotation direction: `1 <currency> = rate <quotation currency>`. The quotation currency itself always has rate `1`.

`applyOperations` also enforces that base-rate lock before running subsequent operations. Quotation JSON imports canonicalize currency codes and reject duplicate currency keys or item IDs. A currency rebase is rejected if any resulting rate would be outside the supported range.

An item goal-seek result can return `ok: false, reason: 'target_unreachable'` when cent rounding and four-decimal markup precision cannot reproduce the requested price. Inspect the nested goal-seek result as well as the outer API result; failed solves do not apply a markup. Every successful solve reproduces the requested amount using the quotation's canonical pricing calculation.

Goods-receipt drafts are concrete, detached data objects. Create one with a document date and optional `standard`/`compact` template plus `summary`/`grouped`/`detailed` selection preset. Line edits use the stable line ID returned by creation. Successful direct PDF export clears the pending draft, appends one history record, and attempts to save the updated quotation to local draft storage. If that cache write fails, the PDF result remains successful and V2 returns `local_cache_write_failed` in `meta.warnings`; V1 uses its existing warning strings. The completed in-memory state is retained. Call `serializeQuotation()` or `saveQuotationToFile()` afterward to preserve that bookkeeping in a JSON file. Validation warnings such as `quantity_exceeds_quote` are returned as structured issues.

Creation, header edits, line edits, selection toggles, and presets all check the resulting pending draft against the size limit before committing it. An `input_too_large` failure leaves the quotation, automation revision, and undo history unchanged. Clearing the pending draft remains available.

If a pending receipt was created before its quotation received a number, export fills that blank reference from the active quotation's manually entered number. Existing nonblank receipt references remain unchanged. A canceled or failed export does not modify the pending draft.

### Quotation numbers and storage failures

If automatic number reservation cannot be persisted, a new quotation is created with a blank number instead of an unreserved generated number. Set a manual number through `updateHeader({ quotationNumber: 'YOUR-NUMBER' })`. The app preserves the supplied number exactly and does not replace it when storage becomes available again.

Observed manual/imported `Q-YYYY-N` numbers are retained in memory until their high-water mark is durably tracked, so storage recovery does not reuse those numbers within the session. Failed automatic reservations do not advance that record. Successfully resetting or replacing the entire reusable library clears those observations and uses the replacement library's numbering state; a failed replacement keeps the existing state.

Saving quotation JSON, writing revisions, exporting the active quotation PDF, and exporting a receipt require a nonblank quotation number. A blank number returns `invalid_argument` with `fieldPath: 'quotation.header.quotationNumber'`. Imports, recovery, snapshots, raw `serializeQuotation()`, and rendering an existing archived revision remain available. A blank working draft can therefore still be inspected and serialized for recovery.

`validateForExport()` checks that number requirement for both document types and reports `valid: false` with a field-specific issue when it is blank. General quotation and receipt validation remain available for incomplete drafts.

Quotation imports reject duplicate normalized IDs within tax classes and within extra charges, including archived quotations. The validation report includes a `duplicate_id` issue with the offending field path. These are separate namespaces: the same text may identify a tax class and an extra charge. Validation finishes before the imported document replaces live state.

```ts
const receipt = await api.createGoodsReceiptDraft({
  documentDate: '2026-08-26',
  templateId: 'compact',
  selectionPreset: 'detailed',
})
if (!receipt.ok) throw new Error(receipt.error.code)

const lineId = receipt.data.lines[0]?.id
if (lineId) await api.updateGoodsReceiptLine(lineId, { quantity: 2, remarks: 'Partial delivery' })

const preflight = await api.validateForExport({ document: 'goods_receipt' })
if (!preflight.ok || !preflight.data.valid) throw new Error('Goods receipt is not exportable')
```

Branding patches currently support only `logoDataUrl` and `accentColor`. `setBranding()` validates the supplied data URL but does not resize it; the interactive UI may resize an uploaded image before updating the quotation.

V2 validation reports stable issue codes and field paths for unsupported templates/locales/output columns, duplicate IDs, invalid hierarchy depth and numeric ranges, missing tax-class/exchange-rate references, and malformed goods-receipt data. It checks archived snapshots as well as the active quotation; archived issue paths begin with `revisions[index].quotation`. The maintained [`quotation-v5.schema.json`](schemas/quotation-v5.schema.json) describes the current persisted JSON structure; [`quotation-v3.schema.json`](schemas/quotation-v3.schema.json) and [`quotation-v2.schema.json`](schemas/quotation-v2.schema.json) describe older files. These schemas do not replace `validateQuotationContent()` or `validateQuotation()`: semantic rules such as cross-field references, hierarchy constraints, and export readiness are enforced by the API.

### Tax-calculation compatibility

`quotation.totalsConfig.taxAllocationVersion` accepts `1` or `2` and controls tax rounding and allocation. `createQuotation()` uses policy `2`: tax-class and local-node taxes use exact integer subtotal cents and decimal rate fractions, rounded half up. Each class's rounded tax is then allocated to root items by largest exact remainder, with ties resolved by quotation root order; section headers do not participate. Policy `2` can correct a one-cent tax difference at decimal boundaries. The V2 `getTotals()` result shape, pre-tax pricing, markup, and exchange-rate rules are unchanged.

A missing policy means legacy policy `1`, including for older files and local recovery drafts. Import normalizes the working draft to `1` without changing its legacy tax rounding or totals. Copying, editing, exporting, and reopening a quotation preserve its policy. Archived snapshots remain unchanged, including an absent policy field; restoring one uses its original policy. Unknown policy values are rejected as `invalid_quotation` for the working draft or `invalid_revisions` for archived history. Policy `2` requires schema 5 and is rejected when inserted into an older envelope. There is no automation command to change a quotation's tax policy.

Schema 5 prevents older applications from silently recalculating policy-2 taxes with legacy rules: those applications reject the unsupported envelope. Integrations must support schema 5 before processing current files; changing the version number to 4 is not a compatible conversion. Until a schema-4-only JSON helper is updated separately, use the native V2 API or CLI for current files.

## Persisted quotation revisions

`listQuotationRevisions()` returns detached summaries with `id`, `revisionNumber`, `createdAt`, and optional `note`. `getQuotationRevision(id)` returns a detached full record including its `quotation` snapshot. The schema-5 envelope stores the working `quotation`, a separate `revisions` array, and shared `images`; snapshots do not contain nested history. `serializeQuotation()` returns detached, expanded `quotation` and `revisions` fields with `branding.logoDataUrl`, plus the optimized schema-5 JSON `content`.

### Shared images and legacy files

Schema 5 retains the shared-image format introduced in schema 4. Each distinct logo data URL is stored once in a top-level `images` object. Its keys are file-local identifiers such as `image-1`; the working quotation and every archived snapshot use `branding.logoImageId` instead of `branding.logoDataUrl`. A null image ID represents an empty logo. IDs may be reassigned when saving; integrations must not treat them as persistent identifiers. Images are deduplicated by exact data URL without resizing or recompression, and older logos remain available while any snapshot references them.

The editor and API snapshot objects retain full `logoDataUrl` values. Only the persisted JSON uses references. Invalid or missing image references are rejected in both schema 4 and 5. Opening a legacy file does not modify it; a normal save, JSON export, or CLI `--output-json` writes schema 5 automatically. Schema 3 and 4 history is preserved, including revision IDs, numbers, timestamps, notes, original image bytes, and each snapshot's tax-allocation policy. Update integrations and the desktop executable together.

`createQuotationRevision({ note?, filePath? })` archives the current working quotation and starts the next revision number with the same content. `restoreQuotationRevision(id, { filePath? })` archives the current work and starts the next revision using the selected snapshot. Restoration retains completed goods-receipt history for the quotation family and clears the restored pending goods-receipt draft. Once history exists or the current revision number has advanced beyond 1, `updateHeader` and `applyOperations` cannot manually change `revisionNumber`.

`deleteQuotationRevision(id, { filePath? })` permanently removes one archived snapshot and saves the current working quotation, including its latest edits. It preserves the active quotation's contents, existing undo/redo history, and all remaining revision numbers. The current quotation itself cannot be deleted with this method. Deleting the final archive leaves an empty `revisions` array; the active revision number remains unchanged, and the next created revision continues from it. Deletion cannot be reversed through quotation undo.

All three mutation methods require `revisionWrite` and save the full quotation file before publishing the new state. They use the supplied `filePath` or the current file path; an unsaved quotation requires an explicit path. Automation never opens a save dialog. A successful result is `{ filePath, savedAt, cacheWarning? }`; `cacheWarning: true` means the JSON file was saved but the local recovery cache could not be updated. A failed write leaves the open quotation and history unchanged. Revision creation, restoration, and file imports reset the undo history at the document boundary. Calls queued while a revision write is busy fail with `operation_in_progress`.

```ts
const info = await api.getApiInfo()
if (!info.capabilities.revisionWrite) throw new Error('Desktop revision persistence is unavailable')

const saved = await api.createQuotationRevision({
  note: 'Issued to customer',
  filePath: 'C:\\Quotes\\pump-package.json',
})
if (!saved.ok) throw new Error(saved.error.code)

const history = await api.listQuotationRevisions()
if (!history.ok) throw new Error(history.error.code)
const first = history.data[0]
if (first) {
  await api.exportPdfToFile('C:\\Quotes\\pump-package-issued.pdf', {
    quotationRevisionId: first.id,
  })
  await api.restoreQuotationRevision(first.id)
}
```

`exportPdfToFile(path, { quotationRevisionId? })` exports the selected archived snapshot when an ID is supplied; otherwise it exports the working quotation. Archived export recalculates using the snapshot's original tax-allocation policy and does not replace or modify active content or history.

`exportExcelToFile(path, { mode?: 'customer' | 'internal', quotationRevisionId? })` writes an `.xlsx` through the same exporter as the editor, without a save dialog. Omitted mode means `customer`; choose `internal` explicitly to include costs and markup. It requires `directExcelExport`, keeps the selected quotation and history unchanged, and supports archived snapshots with their original calculation policy. Informational breakdowns are omitted, so their PDF-only selection checks do not block Excel export. Unsupported exact numeric precision returns a structured error, not an approximated workbook.

The local recovery cache contains only the working draft and a history marker. After recovering such a draft without its source file, history reads, revision creation/restoration/deletion, JSON serialization/saving, and archived PDF export return `history_unavailable`. Reopen the original JSON file to recover history. Missing snapshot IDs return `revision_not_found`; malformed options or a missing required path return `invalid_argument`; browser revision mutations return `unsupported_operation`; failed persisted writes return `file_write_failed`.

Automation limits are shared across browser content methods and desktop path methods:

| Input | Limit |
| --- | --- |
| Quotation JSON | 10 MB |
| Line-items CSV | 10 MB |
| Line-items XLSX | 25 MB decoded at the automation boundary; the workbook parser accepts files up to 10 MB |
| Logo | 5 MB and 4096 x 4096 pixels |
| Pending goods-receipt draft | 5 MB serialized |
| Batch manifest | 2 MB and 100 jobs |

Oversized input returns `input_too_large`. Logos are limited to valid PNG, JPEG, GIF, or WebP bytes; the declared MIME type, binary signature, and dimensions must agree.

## Legacy compatibility API

The legacy mutation/import/export methods below remain available through `window.quotationAgent` and retain their older result and error shapes for compatibility. Imports, logo changes, and setting changes appear in the open editor and preview immediately.

```ts
const api = window.quotationAgent
if (!api) throw new Error('Open the quotation editor first')

const result = await api.importQuotationContent(JSON.stringify(quotation))
if (!result.ok) throw new Error(result.error ?? result.warnings.join('; '))

await api.uploadLogo('data:image/png;base64,...')
```

The headless CLI waits on `quotationAgentReady`, invokes V2, and mounts a dedicated automation host instead of the editor UI.

## Action methods

| Method | Purpose |
| --- | --- |
| `importQuotationFile(path)` | Import quotation JSON from an Electron-accessible path. |
| `importQuotationContent(json, name?)` | Import quotation JSON text. |
| `importLineItemsCsvFile(path)` | Import line items from an Electron-accessible CSV path. |
| `importLineItemsCsvContent(csv, name?)` | Import line items from CSV text. |
| `importLineItemsXlsxFile(path)` | Import line items from an Electron-accessible `.xlsx` path. |
| `importLineItemsXlsxContent(base64, name?)` | Import line items from raw base64-encoded `.xlsx` bytes. |
| `uploadLogo(dataUrl)` | Set a base64 image data URL as the logo. |
| `exportPdfToFile(path)` | Export the current quotation PDF to a path. |
| `exportGoodsReceiptPdfToFile(path)` | Export `pendingGoodsReceiptDraft` to a goods-receipt PDF path. |
| `setBaseCurrency(code, rates?)` | Set a supported ISO currency code and optional exchange-rate table. |
| `refreshExchangeRates()` | Fetch the latest published Frankfurter rates for currencies in the current quotation. |
| `setTaxMode(mode, options?)` | Set `single` or `mixed`; `single` may require `{ taxClassId }`. |
| `setOutputItemDetailLevel(level)` | Set output hierarchy depth to `1`, `2`, or `3`. |
| `setMixedTaxDocumentColumns(columns)` | Select mixed-tax PDF columns. |

For `setBaseCurrency(code, rates)`, each rate is stored in quotation direction: `1 <currency> = rate <base currency>`. For example, a USD quotation where `1 CNY = 0.1470588235 USD` uses `{ USD: 1, CNY: 0.1470588235 }`, not `{ USD: 1, CNY: 6.8 }`.

Allowed mixed-tax columns: `taxRate`, `unitPrice`, `unitTax`, `unitPriceWithTax`, `taxAmount`, `netAmount`, `grossAmount`.

Action methods return `{ ok, action, currentFilePath, statusMessage, summary, warnings, filePath?, exchangeRateDate?, error? }`. `refreshExchangeRates()` preserves existing values for currencies that Frankfurter does not return and lists them in `warnings`.

XLSX imports require a sheet named exactly `Import Data` with the template headers in row one. They import immediately, like the CSV automation methods. The content method accepts raw base64 only, not a `data:` URL, and defaults the file name to `agent-import.xlsx`.

```ts
// Browser or Electron: encode an XLSX File as raw base64.
const bytes = new Uint8Array(await file.arrayBuffer())
let binary = ''
for (const byte of bytes) binary += String.fromCharCode(byte)

const result = await window.quotationAgent!.importLineItemsXlsxContent(
  btoa(binary),
  file.name,
)
```

`importLineItemsXlsxFile(path)` is desktop-only because browsers cannot open arbitrary local paths. Browser automation should use `importLineItemsXlsxContent()` instead. Malformed base64 returns `invalid_xlsx_base64`; workbook or row validation failures return `xlsx_import_failed` with details in `warnings`.

## Read methods

- `getQuotationSummary()`
- `getTotals()`
- `getLineItems()`
- `getOutputSettings()`
- `getQuotationSnapshot()`

These read methods belong to the legacy API. For new automation, prefer the structured v2 snapshot and item-tree methods described above.

Sources of truth:

- v2: [`QuotationAgentApiV2`](../src/shared/contracts/quotationAutomation.ts) and [`useQuotationAgentApiV2`](../src/features/quotations/composables/useQuotationAgentApiV2.ts)
- legacy: [`QuotationAgentApi`](../src/shared/contracts/quotationApp.ts) and [`useQuotationAgentApi`](../src/features/quotations/composables/useQuotationAgentApi.ts)

For unattended validation, rendering, or sequential batch work from a packaged desktop application, use the [automation CLI](headless-export.md) instead of attaching browser automation to this renderer API.
