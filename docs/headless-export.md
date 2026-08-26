# Automation CLI

The packaged Electron application provides strict `validate`, `render`, and sequential `batch` commands. It uses the V2 renderer API through an isolated hidden automation window; it does not mount the editor UI or modify the input file.

## Commands

```powershell
# Validate without creating output files.
& 'D:\Tools\Quotation Software.exe' --automation validate `
  --input 'C:\Work\quotation.json' `
  --result-json 'C:\Work\validation-result.json'

# Validate, render, and save normalized quotation JSON.
& 'D:\Tools\Quotation Software.exe' --automation render `
  --input 'C:\Work\quotation.json' `
  --quotation-pdf 'C:\Work\quotation.pdf' `
  --goods-receipt-pdf 'C:\Work\goods-receipt.pdf' `
  --output-json 'C:\Work\normalized-quotation.json' `
  --no-network `
  --result-json 'C:\Work\render-result.json'

# Process jobs sequentially.
& 'D:\Tools\Quotation Software.exe' --automation batch `
  --manifest 'C:\Work\jobs.json' `
  --progress-json 'C:\Work\batch-progress.json' `
  --cancel-file 'C:\Work\stop.cancel' `
  --result-json 'C:\Work\batch-result.json'
```

Use `--automation help` for the complete built-in help, `--automation version` for the app version, and `--automation api-info` for machine-readable API/schema versions, commands, and exit codes. On Windows, packaged GUI executables may not expose standard output, so use `--automation api-info --result-json <path>` for a reliable file result. Top-level `--help`, `--version`, and `--api-info` are also supported.

`--headless-export` remains a backward-compatible alias for `--automation render` with the existing `--input`, PDF, exchange-rate, and result flags.

## Options and safety

- `--quotation-pdf`, `--goods-receipt-pdf`, and `--output-json` select render outputs. A render command requires at least one.
- `--refresh-exchange-rates` fetches and applies the latest available rates before validation and rendering.
- `--no-network` prevents network-dependent phases and cannot be combined with `--refresh-exchange-rates`.
- `--timeout-ms` sets the per-phase timeout from 1 to 600000 milliseconds; the default is 30000.
- `--progress-json` atomically updates a schema-v1 progress record at every phase boundary and emits the same event as structured JSON on standard error.
- `--cancel-file` accepts a `.cancel`, `.json`, or `.txt` path. If that file exists, execution stops safely before the next phase with `automation_canceled`.
- Existing outputs fail before rendering. Use `--force` or its alias `--overwrite` to replace them.
- Input and output paths must all be different.
- PDF and JSON writes are atomic. Existing files replaced with `--force` retain the normal `.backup` copy behavior.
- Goods-receipt export requires a valid pending draft. The V2 API can create that draft programmatically before saving the quotation JSON.
- Inputs use the shared automation limits: 10 MB quotation JSON, 5 MB pending goods-receipt draft, and 2 MB/100 jobs for a batch manifest.

Unknown flags, duplicate flags, unsupported command/flag combinations, and missing values are rejected before a renderer starts.

## Exit codes and reports

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `2` | Usage or argument error |
| `3` | Input, schema, or validation error |
| `4` | Network or exchange-rate provider error |
| `5` | Filesystem or overwrite error |
| `6` | Renderer, PDF export, timeout, or requested cancellation |
| `7` | Unexpected internal error |

Every execution writes one compact JSON report to standard output. Failures also write a structured diagnostic to standard error. `--result-json` writes the same final report atomically.

Job reports contain request/job IDs, API/app/schema versions, quotation identity, currency and canonical totals, applied exchange rates, structured warnings/errors, output paths with byte sizes and SHA-256 hashes, phase timings, and the exit code.

## Batch manifest

Manifest paths are resolved relative to the manifest file. Jobs run sequentially in isolated renderer sessions.

```json
{
  "schemaVersion": 1,
  "jobs": [
    {
      "id": "quote-001",
      "command": "render",
      "input": "input/quote-001.json",
      "quotationPdf": "output/quote-001.pdf",
      "outputJson": "output/quote-001.normalized.json"
    },
    {
      "id": "quote-002-validation",
      "command": "validate",
      "input": "input/quote-002.json",
      "noNetwork": true,
      "timeoutMs": 45000
    }
  ]
}
```

The final batch report includes each job report plus total/completed/succeeded/failed/canceled counts. A failed job does not stop later jobs. Cancellation stops before the next phase or job.

To request cancellation from PowerShell while a command is running:

```powershell
New-Item -ItemType File -Path 'C:\Work\stop.cancel'
```

Delete an old cancellation file before starting another run. Progress and cancellation paths must be different from every input and output path.

Build a portable Windows executable with:

```powershell
npm run package:win:portable
```

Run the packaged Windows release verification against the unpacked or installed application executable:

```powershell
npm run verify:automation:win -- `
  -ExecutablePath 'C:\Path\To\Quotation Software.exe'
```

The verifier uses temporary files and checks Unicode input/output paths, quotation and goods-receipt PDFs, result/progress JSON, invalid schema, missing goods receipt, overwrite safety, exchange-rate failure without input mutation, renderer timeout, cancellation, and sequential batch summaries. Add `-KeepArtifacts` to preserve its temporary output for inspection.
