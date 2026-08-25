# Programmatic Quotation API

`window.quotationAgent` is the legacy quotation automation API. It remains available for compatibility while the versioned API is built out. Imports, logo changes, and setting changes appear in the open editor and preview immediately.

This is a renderer API, not HTTP. External programs must execute JavaScript in the page, for example through Playwright. Prefer content methods in browsers; path methods are intended for Electron.

```ts
const api = window.quotationAgent
if (!api) throw new Error('Open the quotation editor first')

const result = await api.importQuotationContent(JSON.stringify(quotation))
if (!result.ok) throw new Error(result.error ?? result.warnings.join('; '))

await api.uploadLogo('data:image/png;base64,...')
```

## Versioned API foundation

The renderer installs `window.quotationAgentReady` before mounting the quotation editor. The promise resolves when `window.quotationAgentV2` is registered and returns its API information.

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

The current v2 foundation provides:

- `getApiInfo()` and `waitUntilReady()`
- `getQuotationSnapshot()`
- `serializeQuotation()`
- `validateQuotation()`
- `validateQuotationContent(content)`

Every v2 operation returns a discriminated result containing a stable `requestId`, API version, observed quotation revision, and structured issues or errors. Snapshots and serialized quotation objects are detached copies.

The legacy mutation and export methods below have not moved to v2 yet. Headless export also continues to call the legacy API during this compatibility stage.

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

There are no direct methods for editing individual header fields or adding, updating, or deleting individual line items. Import JSON, CSV, or XLSX, or extend the API for those operations.

Sources of truth:

- v2: [`QuotationAgentApiV2`](../src/shared/contracts/quotationAutomation.ts) and [`useQuotationAgentApiV2`](../src/features/quotations/composables/useQuotationAgentApiV2.ts)
- legacy: [`QuotationAgentApi`](../src/shared/contracts/quotationApp.ts) and [`useQuotationAgentApi`](../src/features/quotations/composables/useQuotationAgentApi.ts)

For unattended export from a packaged desktop application, use the [headless export command](headless-export.md) instead of attaching browser automation to this renderer API.
