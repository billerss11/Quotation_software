# Programmatic Quotation API

Use `window.quotationAgent` for quotation automation. It is available only while the quotation editor is mounted. Imports, logo changes, and setting changes appear in the open editor and preview immediately.

This is a renderer API, not HTTP. External programs must execute JavaScript in the page, for example through Playwright. Prefer content methods in browsers; path methods are intended for Electron.

```ts
const api = window.quotationAgent
if (!api) throw new Error('Open the quotation editor first')

const result = await api.importQuotationContent(JSON.stringify(quotation))
if (!result.ok) throw new Error(result.error ?? result.warnings.join('; '))

await api.uploadLogo('data:image/png;base64,...')
```

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
| `setBaseCurrency(code, rates?)` | Set a supported ISO currency code and optional exchange-rate table. |
| `setTaxMode(mode, options?)` | Set `single` or `mixed`; `single` may require `{ taxClassId }`. |
| `setOutputItemDetailLevel(level)` | Set output hierarchy depth to `1`, `2`, or `3`. |
| `setMixedTaxDocumentColumns(columns)` | Select mixed-tax PDF columns. |

For `setBaseCurrency(code, rates)`, each rate is stored in quotation direction: `1 <currency> = rate <base currency>`. For example, a USD quotation where `1 CNY = 0.1470588235 USD` uses `{ USD: 1, CNY: 0.1470588235 }`, not `{ USD: 1, CNY: 6.8 }`.

Allowed mixed-tax columns: `taxRate`, `unitPrice`, `unitTax`, `unitPriceWithTax`, `taxAmount`, `netAmount`, `grossAmount`.

Action methods return `{ ok, action, currentFilePath, statusMessage, summary, warnings, filePath?, error? }`.

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

Source of truth: [`QuotationAgentApi`](../src/shared/contracts/quotationApp.ts) and [`useQuotationAgentApi`](../src/features/quotations/composables/useQuotationAgentApi.ts).
