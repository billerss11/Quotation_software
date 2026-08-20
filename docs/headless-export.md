# Headless PDF export

The packaged Electron application can import a schema-v2 quotation JSON and export one or both PDFs without opening the desktop interface.

```powershell
& 'D:\Tools\Quotation Software.exe' `
  --headless-export `
  --input 'C:\Work\quotation.json' `
  --quotation-pdf 'C:\Work\quotation.pdf' `
  --goods-receipt-pdf 'C:\Work\goods-receipt.pdf' `
  --refresh-exchange-rates `
  --result-json 'C:\Work\export-result.json'
```

`--quotation-pdf` and `--goods-receipt-pdf` are individually optional, but at least one is required. Goods-receipt export requires a valid `quotation.pendingGoodsReceiptDraft` in the input JSON. The two PDF output paths must be different.

`--refresh-exchange-rates` is optional. When present, the app reads the imported quotation currency, fetches Frankfurter's latest published daily rates for the other currencies already in the quotation's exchange-rate table, applies them before rendering either PDF, and preserves existing values for currencies that the provider does not return. Without this flag, the imported rates are left unchanged.

The process exits with code `0` on success and `1` on failure. It also writes one compact JSON result to standard output. A successful refresh adds `exchangeRateDate`, the exact applied `exchangeRates`, and may add `warnings` for unsupported currencies. When `--result-json` is supplied, the same result is written to that file; this is the reliable result channel for a Windows portable GUI executable.

The headless renderer uses temporary in-memory application storage. It does not replace the user's saved desktop drafts or modify the input JSON file.

Build a portable Windows executable with:

```powershell
npm run package:win:portable
```
