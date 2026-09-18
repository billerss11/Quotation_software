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

Call `getApiInfo()` instead of hard-coding the current API version (`2.0.0`) or host capabilities.

## Capability matrix

| Capability | Desktop UI | Web UI | Headless CLI |
| --- | --- | --- | --- |
| Host value | `desktop-ui` | `web-ui` | `headless` |
| Path import/export | Yes | No | Yes |
| Direct PDF export | Yes | No | Yes |
| Browser print | No | Yes | No |
| Exchange-rate refresh | Yes | Yes | Yes, unless `--no-network` |
| Goods-receipt workflow | Yes | Yes | Yes |
| Atomic API batches | Yes | Yes | Yes |

Browser automation should use content methods and browser print; local path methods are desktop/headless only.

## V2 authoring methods

The exact TypeScript contract is [`QuotationAgentApiV2`](../src/shared/contracts/quotationAutomation.ts). The main authoring groups are:

| Group | Methods |
| --- | --- |
| Discovery and reads | `getApiInfo`, `waitUntilReady`, `getQuotationSnapshot`, `getItem`, `getItemTree` |
| Files | `importQuotationFile`, `importQuotationContent`, `importLineItemsCsvFile`, `importLineItemsCsvContent`, `importLineItemsXlsxFile`, `importLineItemsXlsxContent`, `serializeQuotation`, `saveQuotationToFile`, `exportPdfToFile`, `exportGoodsReceiptPdfToFile` |
| Lifecycle and document | `createQuotation`, `updateHeader`, `setTemplate`, `setDocumentLocale`, `setBranding`, `setOutputSettings` |
| Reusable libraries | `listCustomers`, `getCustomer`, `applyCustomer`, `listCompanyProfiles`, `getCompanyProfile`, `applyCompanyProfile` |
| Item tree | `addLineItem`, `addSectionHeader`, `getItem`, `getItemTree`, `updateLineItem`, `updateSectionHeader`, `removeItem`, `duplicateItem`, `moveItem` |
| Pricing and FX | `setGlobalMarkupRate`, `setItemPricingMethod`, `setQuotationCurrency`, `addExchangeRate`, `updateExchangeRate`, `removeExchangeRate`, `refreshExchangeRates` |
| Tax and charges | `setTaxMode`, `setMixedTaxDocumentColumns`, `addTaxClass`, `updateTaxClass`, `removeTaxClass`, `setDefaultTaxClass`, `assignItemTaxClass`, `addExtraCharge`, `updateExtraCharge`, `removeExtraCharge` |
| Goal seek | `previewItemGoalSeek`, `applyItemGoalSeek`, `previewQuotationGoalSeek`, `applyQuotationGoalSeek` |
| Goods receipts | `createGoodsReceiptDraft`, `getPendingGoodsReceiptDraft`, `updateGoodsReceiptHeader`, `updateGoodsReceiptLine`, `setGoodsReceiptLineSelected`, `applyGoodsReceiptSelectionPreset`, `validateGoodsReceiptDraft`, `clearPendingGoodsReceiptDraft`, `exportGoodsReceiptPdfToFile` |
| Atomic workflow | `applyOperations` |
| Validation | `validateQuotation`, `validateQuotationContent`, `validateForExport` |

Quotation-level Quick/Detailed entry mode is no longer part of the V2 contract. Use `setItemPricingMethod(itemId, method)` for each leaf item; newly added items default to `cost_plus`.

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

Mutations are serialized. Each completed mutation reports the latest revision in `meta.revision`. Revisions belong to the current renderer session and are not persisted across application restarts. Use `applyOperations({ expectedRevision, operations })` when multiple supported changes must either all succeed or leave the open quotation unchanged. A successful batch replaces the quotation once and creates one undo entry; a stale `expectedRevision` returns `revision_conflict`.

`applyOperations()` accepts only the operations in the `QuotationOperation` union. Its `updateHeader` operation excludes `currency`; change quotation currency with the separate revision-safe `setQuotationCurrency()` method.

Currency tables use quotation direction: `1 <currency> = rate <quotation currency>`. The quotation currency itself always has rate `1`.

`applyOperations` also enforces that base-rate lock before running subsequent operations. Quotation JSON imports canonicalize currency codes and reject duplicate currency keys or item IDs. A currency rebase is rejected if any resulting rate would be outside the supported range.

An item goal-seek result can return `ok: false, reason: 'target_unreachable'` when cent rounding and four-decimal markup precision cannot reproduce the requested price. Inspect the nested goal-seek result as well as the outer API result; failed solves do not apply a markup. Every successful solve reproduces the requested amount using the quotation's canonical pricing calculation.

Goods-receipt drafts are concrete, detached data objects. Create one with a document date and optional `standard`/`compact` template plus `summary`/`grouped`/`detailed` selection preset. Line edits use the stable line ID returned by creation. Successful direct PDF export clears the pending draft, appends one history record, and saves the updated quotation to local draft storage. Call `serializeQuotation()` or `saveQuotationToFile()` afterward to include that bookkeeping in a JSON export. Validation warnings such as `quantity_exceeds_quote` are returned as structured issues.

```ts
const receipt = await api.createGoodsReceiptDraft({
  documentDate: '2026-08-26',
  templateId: 'compact',
  selectionPreset: 'detailed',
})
if (!receipt.ok) throw new Error(receipt.error.code)

const lineId = receipt.data.lines[0]?.id
if (lineId) await api.updateGoodsReceiptLine(lineId, { quantity: 2, remarks: 'Partial delivery' })

const preflight = await api.validateGoodsReceiptDraft()
if (!preflight.ok || !preflight.data.valid) throw new Error('Goods receipt is not exportable')
```

Branding patches currently support only `logoDataUrl` and `accentColor`. `setBranding()` validates the supplied data URL but does not resize it; the interactive UI may resize an uploaded image before updating the quotation.

V2 validation reports stable issue codes and field paths for unsupported templates/locales/output columns, duplicate IDs, invalid hierarchy depth and numeric ranges, missing tax-class/exchange-rate references, and malformed goods-receipt data. The maintained [`quotation-v2.schema.json`](schemas/quotation-v2.schema.json) describes the persisted JSON structure, but it is not a replacement for `validateQuotationContent()` or `validateQuotation()`: semantic rules such as cross-field references, hierarchy constraints, and export readiness are enforced by the API.

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
