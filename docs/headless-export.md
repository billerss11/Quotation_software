# Automation CLI

The packaged Electron application provides strict `validate`, `render`, and sequential `batch` commands. It uses the V2 renderer API through an isolated hidden automation window; it does not mount the editor UI or modify the input file.

## Commands

```powershell
# Validate and write a machine-readable report.
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

Use `--automation help` for the complete built-in help, `--automation version` for the app version, and `--automation api-info` for machine-readable API/schema versions, commands, and exit codes. On Windows, packaged GUI executables may not expose standard output, so use `--automation api-info --result-json <path>` for a reliable file result. Top-level `--help`, `--version`, and `--api-info` are also supported when no automation command is present.

`--headless-export` remains a backward-compatible alias for `--automation render` and accepts the render flags below. Legacy `--headless-export --validate-only` maps to `--automation validate`; do not combine `--automation` and `--headless-export`.

## Options and safety

- `validate` requires `--input`. It accepts `--output-json`, `--result-json`, `--progress-json`, `--cancel-file`, `--timeout-ms`, `--no-network`, and `--force`/`--overwrite`.
- `render` requires `--input` plus at least one of `--quotation-pdf`, `--goods-receipt-pdf`, or `--output-json`. It accepts all validation options plus `--refresh-exchange-rates`.
- `batch` requires `--manifest`. It accepts `--result-json`, `--progress-json`, `--cancel-file`, `--timeout-ms`, `--no-network`, and `--force`/`--overwrite`.
- `--output-json` writes normalized schema-v2 quotation JSON after validation. It is valid for both `validate` and `render`.
- `--refresh-exchange-rates` fetches and applies the latest available rates before validation and rendering. It is valid only for `render`.
- `--no-network` prevents network-dependent phases and cannot be combined with `--refresh-exchange-rates`.
- `--timeout-ms` sets the per-phase timeout from 1 to 600000 milliseconds; the default is 30000.
- `--progress-json` atomically updates a schema-v1 progress record at every phase boundary and emits the same event as structured JSON on standard error.
- `--cancel-file` accepts a `.cancel`, `.json`, or `.txt` path. If that file exists, execution stops safely before the next phase with `automation_canceled`.
- Existing PDF, normalized JSON, result JSON, and progress JSON outputs fail before work starts. Use `--force` or its alias `--overwrite` to replace them.
- Input, output, result, progress, and cancellation paths must all be different.
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

Every `validate`, `render`, or `batch` execution writes one compact JSON report to standard output. Failures also write a structured diagnostic to standard error. `--result-json` writes the same final report atomically. Help and version output are plain text; `api-info` is JSON.

Job reports contain request/job IDs, API/app/schema versions, quotation identity, currency and canonical totals, applied exchange rates, structured warnings/errors, output paths with byte sizes and SHA-256 hashes, phase timings, and the exit code.

## Batch manifest

Manifest paths are resolved relative to the manifest file. Jobs run sequentially in isolated renderer sessions. A manifest is limited to 100 jobs and rejects unknown fields or duplicate job IDs.

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

Each job accepts `id`, `command`, `input`, `quotationPdf`, `goodsReceiptPdf`, `outputJson`, `refreshExchangeRates`, `noNetwork`, `force`, and `timeoutMs`. Batch-level `--no-network` and `--force` apply to every job, while a job-level `timeoutMs` overrides the batch default.

The final batch report includes each job report plus total/completed/succeeded/failed/canceled counts. A failed job does not stop later jobs. Cancellation is cooperative: it is checked between phases and jobs, so an in-flight PDF render or network request finishes or reaches its timeout before cancellation is observed.

To request cancellation from PowerShell while a command is running:

```powershell
New-Item -ItemType File -Path 'C:\Work\stop.cancel'
```

Delete an old cancellation file before starting another run. Progress and cancellation paths must be different from every input and output path.

## Packaging and release verification

Each Windows packaging run gets a new timestamped directory under `release/`; failed runs leave their partial output there for inspection.

```powershell
# NSIS installer (the default Windows target).
npm run package:win

# Portable executable.
npm run package:win:portable

# Portable executable plus release/current-portable.json.
# The version record is updated only after the executable passes an API-info probe.
npm run package:win:portable:current
```

Run the packaged Windows release verification with the required `-ExecutablePath` parameter:

```powershell
npm run verify:automation:win -- `
  -ExecutablePath 'C:\Path\To\Quotation Software.exe'
```

The verifier reads the tracked fixtures under `output/qa/automation-smoke/`, writes each run to a unique temporary directory, and checks Unicode input/output paths, quotation and goods-receipt PDFs, result/progress JSON, invalid schema, missing goods receipt, overwrite safety, exchange-rate failure without input mutation, renderer timeout, cancellation, and sequential batch summaries. Add `-KeepArtifacts` to print and preserve the temporary output directory for inspection.
