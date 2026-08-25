# Quotation Software Automation API
## Gap Analysis and Actionable Implementation Notes

**Repository:** `billerss11/Quotation_software`<br>
**Reviewed branch:** `main`<br>
**Reviewed commit:** `2f33d4443250381ddca2809c1238dc1999487a87`
**Review scope:** renderer automation API, Electron preload/IPC bridge, quotation file contract, headless PDF command, goods-receipt automation, validation, tests, and operational reliability.

---

## 1. Executive conclusion

The current automation foundation is good and should be retained. The application already has:

1. A semantic renderer API through `window.quotationAgent`.
2. A secure Electron preload bridge through `window.quotationApp`.
3. A packaged headless command that can load a quotation JSON file and export quotation and goods-receipt PDFs.
4. A schema-versioned quotation file envelope with v1-to-v2 migration.
5. Centralized pricing, exchange-rate, tax, rounding, hierarchy, and goal-seek logic.
6. Focused Vitest coverage for the current agent methods and argument parser.

However, the current interface is still primarily an **import/export adapter**, not a complete quotation automation API. It can replace a full quotation, import rows, change a few document settings, and export PDFs. It cannot reliably build and maintain a quotation through granular domain operations.

The largest practical problem is that an external agent must currently do one of the following:

- construct and replace the complete quotation JSON;
- import CSV/XLSX and then use the remaining UI manually; or
- fall back to browser/UI automation for unsupported actions.

All three approaches become brittle as the quotation schema and business rules evolve.

### Recommended direction

Keep the application local-first. Build a **versioned quotation command service** that is shared by:

- the Vue UI;
- `window.quotationAgent`;
- the packaged headless CLI; and
- a future MCP or JSON-RPC adapter, only if one is later required.

Do **not** add an HTTP server at this stage. Do **not** make generic DOM clicking or a tool such as CLI Anything the primary automation route. The existing semantic API is the correct foundation; it needs to be completed and hardened.

---

## 2. Current automation surface

### 2.1 Renderer API: `window.quotationAgent`

Current action methods:

- `importQuotationFile(path)`
- `importQuotationContent(json, name?)`
- `importLineItemsCsvFile(path)`
- `importLineItemsCsvContent(csv, name?)`
- `importLineItemsXlsxFile(path)`
- `importLineItemsXlsxContent(base64, name?)`
- `uploadLogo(dataUrl)`
- `exportPdfToFile(path)`
- `exportGoodsReceiptPdfToFile(path)`
- `setBaseCurrency(code, rates?)`
- `refreshExchangeRates()`
- `setTaxMode(mode, options?)`
- `setOutputItemDetailLevel(level)`
- `setMixedTaxDocumentColumns(columns)`

Current read methods:

- `getQuotationSummary()`
- `getTotals()`
- `getLineItems()`
- `getOutputSettings()`
- `getQuotationSnapshot()`

### 2.2 Electron preload API: `window.quotationApp`

This layer correctly handles desktop infrastructure such as opening/saving files and rendering PDFs. It should remain an internal runtime bridge rather than becoming the public quotation-domain API.

### 2.3 Packaged headless command

The current command supports:

- one quotation JSON input;
- quotation PDF output;
- goods-receipt PDF output when a pending draft already exists;
- optional latest exchange-rate refresh;
- a JSON execution report;
- exit code `0` or `1`.

This is useful, but it is a **headless renderer/export command**, not yet a general quotation CLI.

---

## 3. Main gaps

### 3.1 The public API exposes only a small part of the existing editor capability

The editor already supports:

- creating a quotation;
- updating every header field;
- adding, editing, removing, duplicating, and moving hierarchical items;
- section headers;
- template selection;
- line-item entry mode;
- cost-plus and manual-price modes;
- individual and global markup;
- exchange-rate add/update/remove/rebase;
- tax-class add/update/remove/default selection;
- extra-charge add/update/remove;
- item and whole-quotation goal seek;
- customer and company-profile application;
- goods-receipt draft creation and editing.

Most of these operations are not exposed through `window.quotationAgent`.

### 3.2 Modified quotation state cannot be exported as a quotation JSON file

The API can import a quotation and export PDFs, but it has no first-class method to:

- serialize the current state into the schema-v2 file envelope;
- save the current quotation to a specified JSON path;
- return the normalized quotation JSON after automation changes; or
- persist exchange-rate changes made by the headless command into a new quotation JSON file.

`--result-json` currently writes an execution report, not the updated quotation.

### 3.3 Errors are not sufficiently machine-readable

The current action result contains an optional string `error` and a string array `warnings`. Several failure paths return only a localized `statusMessage` or a generic code such as `export_failed`.

This is inadequate for reliable automation because a caller cannot consistently distinguish:

- malformed JSON;
- invalid quotation envelope;
- unsupported schema version;
- unsupported currency;
- missing item or tax class;
- invalid field value;
- file access failure;
- existing output file;
- exchange-rate network failure;
- PDF renderer timeout; or
- missing/invalid goods-receipt draft.

### 3.4 The API has no version, capability, or readiness contract

`window.quotationAgent` exists only while `QuotationEditor.vue` is mounted. The headless process polls the page until this object appears.

There is currently no API method or stable object describing:

- automation API version;
- application version;
- quotation schema version;
- supported templates and locales;
- desktop/browser/headless capabilities;
- supported output columns;
- whether direct path access and direct PDF export are available; or
- whether the automation service is ready.

This creates unnecessary coupling between headless automation and the editor component lifecycle.

### 3.5 The file validator is too coarse for an external API

The schema-v2 parser provides useful basic validation and migration, but it is a hand-written shape validator. It mainly checks object types, required core fields, finite numbers, and supported currencies.

It does not provide field-level issue paths, and it does not fully express every `QuotationDraft` field and cross-field invariant. Examples include template support, document locale, company-profile shape, mixed-tax column values, duplicate IDs, item depth, tax-class references, goods-receipt content, and business-range rules.

### 3.6 No atomic multi-operation workflow

An agent often needs to update the header, add several nested rows, configure tax, add charges, and set output options as one logical change. The current API would require separate calls, and many required calls do not yet exist.

Without a transaction/revision model, parallel or retried calls can produce:

- partial quotations;
- duplicate rows;
- operations applied to stale state; or
- multiple unwanted undo/history entries.

### 3.7 Goods-receipt automation is export-only

The headless exporter can export `pendingGoodsReceiptDraft`, but the automation API cannot create or edit that draft. External automation must embed the entire pending draft inside an imported quotation file.

The codebase already has a concrete `GoodsReceiptDraft` model, creation logic, validation logic, selection presets, and line-editing behavior. These should become part of the automation contract.

### 3.8 The headless command needs production-grade CLI behavior

Current limitations include:

- no `--help` or dedicated API/version output;
- unknown flags are not rejected strictly;
- no validation-only mode;
- no normalized/updated quotation JSON output;
- no explicit output overwrite policy;
- only generic success/failure exit codes;
- no batch manifest;
- no configurable timeout;
- no structured timing or output metadata;
- direct PDF writes are not atomic; and
- no packaged Windows end-to-end test is visible in the current test surface.

### 3.9 Input limits are inconsistent

Electron text-file paths have a 50 MB limit, but equivalent content methods and binary imports should have explicit limits as well. In particular, add limits for:

- quotation content strings;
- CSV content strings;
- XLSX path and base64 imports;
- decoded logos; and
- goods-receipt payloads.

The current logo validation checks data-URL/base64 syntax but not decoded size or actual image signature.

---

## 4. Prioritized implementation backlog

## P0 — Complete a reliable single-quotation automation workflow

### AUT-001 — Add API identity, discovery, and readiness

**Required API:**

```ts
interface QuotationAutomationApiInfo {
  apiVersion: string
  appVersion: string
  quotationSchemaVersion: number
  capabilities: {
    host: 'desktop-ui' | 'web-ui' | 'headless'
    pathImport: boolean
    pathExport: boolean
    directPdfExport: boolean
    browserPrint: boolean
    exchangeRateRefresh: boolean
    goodsReceipt: boolean
    batchOperations: boolean
  }
  supportedTemplates: string[]
  supportedLocales: string[]
  supportedTaxModes: string[]
  supportedMixedTaxColumns: string[]
}
```

Add:

- `getApiInfo()`
- `waitUntilReady()` or a stable `window.quotationAgentReady` promise
- `getCapabilities()` if capabilities are not included in `getApiInfo()`

**Implementation notes:**

- Do not register the automation API only inside `QuotationEditor.vue`.
- Add a lightweight automation host for headless mode, or move API ownership to the same application-level owner as quotation state.
- Load a dedicated `mode=automation` renderer for headless execution instead of depending on the complete editor UI being mounted.
- Keep the current global API as a compatibility adapter during migration.

**Acceptance criteria:**

1. A caller can determine API/app/schema versions before loading a quotation.
2. Headless execution no longer depends on polling for an editor-owned object.
3. Capability values are accurate in desktop, web, and headless hosts.
4. Existing automation methods continue to work during the migration period.

---

### AUT-002 — Introduce structured success, warning, and error contracts

Use a discriminated result instead of relying on localized status text:

```ts
interface AutomationIssue {
  code: string
  severity: 'warning' | 'error'
  message: string
  fieldPath?: string
  row?: number
  column?: string
  details?: Record<string, unknown>
}

interface AutomationMeta {
  requestId: string
  apiVersion: string
  revision: number
  warnings: AutomationIssue[]
}

type AutomationResult<T> =
  | { ok: true; data: T; meta: AutomationMeta }
  | {
      ok: false
      error: {
        code: string
        message: string
        fieldPath?: string
        details?: Record<string, unknown>
      }
      meta: AutomationMeta
    }
```

**Minimum stable error codes:**

- `not_ready`
- `invalid_argument`
- `validation_failed`
- `invalid_json`
- `invalid_envelope`
- `unsupported_schema`
- `unsupported_currency`
- `item_not_found`
- `invalid_parent`
- `duplicate_id`
- `tax_class_not_found`
- `exchange_rate_required`
- `goods_receipt_missing`
- `goods_receipt_invalid`
- `file_read_failed`
- `file_write_failed`
- `output_exists`
- `network_failed`
- `render_timeout`
- `render_failed`
- `revision_conflict`
- `internal_error`

**Implementation notes:**

- Preserve the original internal exception/code instead of converting every failure to `false`, `export_failed`, or a translated status string.
- Keep user-visible translated status messages separate from the machine contract.
- Convert CSV/XLSX row diagnostics into structured issues while retaining human-readable messages.
- Include the action/request ID in logs and headless result files.

**Acceptance criteria:**

1. Every public method returns a stable code on failure.
2. Callers never need to parse a translated message to decide what happened.
3. Import errors include field or row/column location when available.
4. Filesystem, network, and render failures are distinguishable.

---

### AUT-003 — Define deterministic session and persistence behavior

Add:

- `createQuotation(input?)`
- `serializeQuotation()`
- `saveQuotationToFile(path, options?)`
- `exportQuotationContent()` as an alias if preferred
- `getQuotationSnapshot()` with schema version and revision

Suggested return from serialization:

```ts
{
  schemaVersion: 2,
  quotation: QuotationDraft,
  content: string,
  revision: number
}
```

**Required behavior:**

- Serialization must use the existing canonical schema-v2 envelope function.
- Saving must update quotation metadata consistently with normal UI save behavior.
- Headless automation must be able to write an updated quotation after exchange-rate refresh or other mutations.
- Clarify whether a mutation changes only the active session, local draft storage, or a file. Avoid host-dependent hidden behavior.

**Acceptance criteria:**

1. A quotation can be created, modified, serialized, saved, reloaded, and compared without losing data.
2. `--result-json` remains an execution report; a separate `--output-json` writes the updated quotation.
3. The UI and automation paths produce the same file envelope.
4. The result states whether the state was changed in memory, local draft storage, or a file.

---

### AUT-004 — Publish a complete schema and add non-mutating validation/preflight

Add:

- `validateQuotation()`
- `validateQuotationContent(content)`
- `validateForExport({ document: 'quotation' | 'goods_receipt' })`
- a generated or maintained `quotation-v2.schema.json`

Validation should have two layers:

1. **Schema validation:** types, enums, required fields, data formats, IDs, and allowed structures.
2. **Semantic validation:** cross-field and business rules, such as missing exchange rates, unknown tax-class references, duplicate IDs, invalid hierarchy, invalid pricing combinations, and goods-receipt readiness.

**Implementation notes:**

- Keep normalization separate from validation. Do not silently repair an invalid automation payload without reporting what changed.
- Return normalized values only when normalization is explicitly requested.
- Use the same validation service for file import, API mutations, batch operations, and CLI validation.
- Prevent TypeScript model, hand-written parser, and documentation from drifting independently.

**Acceptance criteria:**

1. Validation can run without changing active quotation state.
2. Every issue has a stable code and field path.
3. The published schema accepts every valid file produced by the application.
4. Invalid tax references, duplicate IDs, invalid item parents/depth, and malformed goods receipts are detected before export.

---

### AUT-005 — Expose quotation lifecycle, header, branding, and output settings

Add:

```ts
createQuotation(input?: CreateQuotationInput)
updateHeader(patch: Partial<QuotationHeader>)
setTemplate(templateId: QuotationTemplateId)
setDocumentLocale(locale: SupportedLocale)
setBranding(patch: { logoDataUrl?: string; accentColor?: string })
setLineItemEntryMode(mode: LineItemEntryMode)
setOutputSettings(patch: Partial<QuotationOutputSettings>)
```

**Required rules:**

- Reject unknown patch fields by default.
- Validate dates, locale, template, currency, and numeric ranges.
- Return the normalized changed values and new revision.
- Reuse `useQuotationEditor` operations rather than writing directly into reactive objects.
- Keep each API call as one undoable change and save the local draft at most once.

**Acceptance criteria:**

1. A caller can build the complete quotation header without importing a full JSON file.
2. All UI-selectable templates and output settings are available by API.
3. Invalid template/locale/branding values return structured errors.
4. UI and API edits create equivalent state and totals.

---

### AUT-006 — Expose complete hierarchical item CRUD

Add:

```ts
addLineItem(input: {
  parentId?: string | null
  index?: number
  item: NewQuotationItem
}): AutomationResult<{ itemId: string }>

addSectionHeader(input: {
  index?: number
  title: string
}): AutomationResult<{ itemId: string }>

getItem(itemId: string)
getItemTree()
updateLineItem(itemId: string, patch: QuotationItemPatch)
updateSectionHeader(itemId: string, patch: { title: string })
removeItem(itemId: string)
duplicateItem(itemId: string)
moveItem(itemId: string, target: { parentId: string | null; index: number })
```

**Implementation notes:**

- Reuse `useQuotationTreeEditor` and existing item-update methods.
- Generate IDs inside the application and return them. Allow caller-supplied IDs only if there is a defined idempotency use case and duplicate checking.
- Return explicit errors for missing IDs, invalid parent, circular move, invalid depth, and invalid index.
- Rename or deprecate `getLineItems()`: it returns a root tree that can also contain section headers. `getItemTree()` is clearer.
- Ensure duplicate operations generate new IDs for the complete copied subtree.

**Acceptance criteria:**

1. An external caller can create a three-level quotation tree without CSV/XLSX import.
2. Every operation uses stable item IDs rather than row positions.
3. Moving/removing a parent maintains a valid tree.
4. Invalid operations do not partially mutate the quotation.
5. Calculated totals update exactly as they do after the corresponding UI action.

---

### AUT-007 — Expose pricing, tax, exchange-rate, charge, and goal-seek workflows

Add or complete:

```ts
setGlobalMarkupRate(rate: number)
setItemPricingMethod(itemId: string, method: PricingMethod)
updateExchangeRate(currency: string, rate: number)
addExchangeRate(currency: string, rate?: number)
removeExchangeRate(currency: string)
setQuotationCurrency(currency: string, rates?: ExchangeRateTable)
refreshExchangeRates(options?)

addTaxClass(input: NewTaxClass)
updateTaxClass(id: string, patch: TaxClassPatch)
removeTaxClass(id: string)
setDefaultTaxClass(id: string)
assignItemTaxClass(itemId: string, taxClassId: string)

addExtraCharge(input: NewExtraCharge)
updateExtraCharge(id: string, patch: ExtraChargePatch)
removeExtraCharge(id: string)

previewItemGoalSeek(input)
applyItemGoalSeek(input)
previewQuotationGoalSeek(input)
applyQuotationGoalSeek(input)
```

**Implementation notes:**

- Reuse the current editor methods and existing goal-seek solvers.
- Return the existing rich goal-seek result, including minimum, maximum, closest value, projected value, and failure reason.
- Rename `setBaseCurrency` to the clearer `setQuotationCurrency`; retain the old method as an alias during migration.
- Make exchange-rate direction explicit in the type, for example `ratesToQuotationCurrency`, to prevent reciprocal-rate mistakes.
- Do not create a second pricing or goal-seek implementation for the API or CLI.

**Acceptance criteria:**

1. Every pricing/tax control available in the UI can be set through the API.
2. Invalid rate, markup, tax, and charge values are rejected consistently.
3. Goal-seek preview does not mutate state; apply changes state in one transaction.
4. API totals match UI totals for single tax, mixed tax, manual price, extra charges, and all three quotation goal-seek targets.

---

### AUT-008 — Add revision control and atomic batch operations

Add a monotonically increasing in-memory `revision` to the active automation session.

Add:

```ts
applyOperations(request: {
  expectedRevision?: number
  operations: QuotationOperation[]
}): AutomationResult<{
  revision: number
  operationResults: OperationResult[]
  snapshot: QuotationSnapshot
}>
```

**Recommended implementation:**

1. Clone the active quotation.
2. Apply all requested operations to the clone.
3. Validate and normalize the completed clone.
4. If any operation fails, discard the clone and return errors.
5. If all operations pass, replace the active quotation once, create one undo entry, and save once.

Also serialize mutation calls through a command queue/mutex.

**Acceptance criteria:**

1. A failed batch leaves the original quotation unchanged.
2. A successful batch creates one revision and one undo entry.
3. `expectedRevision` prevents stale callers from overwriting newer state.
4. Simultaneous mutation calls cannot interleave and corrupt the tree.
5. Retrying a request can be made safe through a request or idempotency key in a later extension.

---

### AUT-009 — Add goods-receipt draft automation

First, use the existing concrete `GoodsReceiptDraft` and `GoodsReceiptRecord` types in the shared quotation contract instead of exposing pending/history draft data as `unknown`.

Add:

```ts
createGoodsReceiptDraft(options: {
  documentDate: string
  templateId?: GoodsReceiptTemplateId
  selectionPreset?: GoodsReceiptSelectionPreset
})

getPendingGoodsReceiptDraft()
updateGoodsReceiptHeader(patch)
updateGoodsReceiptLine(lineId: string, patch)
setGoodsReceiptLineSelected(lineId: string, selected: boolean)
applyGoodsReceiptSelectionPreset(preset)
validateGoodsReceiptDraft()
clearPendingGoodsReceiptDraft()
exportGoodsReceiptPdfToFile(path, options?)
```

**Implementation notes:**

- Reuse `createGoodsReceiptDraft`, line-generation utilities, parsing, and validation already present under `src/features/goods-receipts/`.
- Keep quotation identity synchronized.
- Define whether successful export clears the pending draft and appends history; expose this behavior as an explicit option if necessary.
- Return validation warnings such as quantity exceeding quoted quantity as structured issues.

**Acceptance criteria:**

1. A goods receipt can be created and exported without opening the dialog or manually embedding a pending draft in the quotation JSON.
2. Line selection, quantity, unit, description, and remarks can be updated by stable line ID.
3. Invalid drafts are rejected before PDF rendering.
4. Export history behavior is deterministic and tested.

---

### AUT-010 — Upgrade the headless command into a stable automation CLI

Keep `--headless-export` as a backward-compatible alias, but introduce clearer command modes such as:

```powershell
Quotation Software.exe --automation validate `
  --input quotation.json `
  --result-json validation-result.json

Quotation Software.exe --automation render `
  --input quotation.json `
  --quotation-pdf quotation.pdf `
  --goods-receipt-pdf goods-receipt.pdf `
  --output-json normalized-quotation.json `
  --refresh-exchange-rates `
  --result-json result.json

Quotation Software.exe --automation batch `
  --manifest jobs.json `
  --result-json batch-result.json
```

Add:

- `--help`
- `--version`
- `--api-info`
- `--validate-only` or a `validate` command
- `--output-json`
- `--force` / `--overwrite`
- `--timeout-ms`
- strict unknown and duplicate flag detection
- optional `--no-network`
- later: stdin/stdout and manifest support

**Recommended exit codes:**

- `0` success
- `2` usage/argument error
- `3` input/schema/validation error
- `4` network/provider error
- `5` filesystem error
- `6` render/export error
- `7` unexpected internal error

**Result report should include:**

- API, app, and quotation schema versions;
- request/job ID;
- quotation ID and quotation number;
- currency and final totals;
- applied exchange-rate date and exact rates;
- warnings and errors with stable codes;
- output paths, file sizes, and optionally SHA-256 hashes;
- elapsed time by phase; and
- final exit code.

**File safety:**

- Fail when an output already exists unless `--force` is supplied.
- Write PDFs to a temporary file and atomically rename after a successful render.
- Remove temporary files on failure.
- Keep execution reports atomic, as the current text writer already does.

**Acceptance criteria:**

1. CLI behavior is fully documented by `--help` and machine-readable through `--api-info`.
2. Unknown flags and accidental overwrites fail before rendering.
3. Validation can run without creating PDFs.
4. Updated exchange rates can be persisted to `--output-json`.
5. Failure category is available through both error code and process exit code.

---

### AUT-011 — Apply consistent input and asset limits

Define shared limits for:

- quotation JSON path and content input;
- CSV path and content input;
- XLSX path and base64 input;
- logo bytes and dimensions;
- goods-receipt draft size; and
- batch manifest size/job count.

**Implementation notes:**

- Check encoded and decoded sizes before allocating large buffers.
- Validate supported logo MIME types and file signatures, not only the data-URL prefix.
- Keep Electron context isolation, sandboxing, trusted-renderer checks, path-extension validation, and navigation blocking.
- Do not expose unrestricted arbitrary file-read/write methods through the quotation-domain API.

**Acceptance criteria:**

1. Path-based and content-based imports enforce equivalent limits.
2. Oversized input returns a stable `input_too_large` error.
3. A malformed or falsely labelled image is rejected.
4. Security settings in the existing Electron windows remain enabled.

---

### AUT-012 — Add contract, integration, packaged, and documentation tests

The current focused unit/composable tests should remain. Add the following layers.

#### Contract tests

- Every public method has success and failure coverage.
- Results conform to the v2 result contract.
- Unknown fields are rejected.
- snapshots are deep-cloned and cannot mutate live state.
- API version/capability output is stable.

#### Domain integration tests

- create quotation → update header → create nested tree → configure tax/FX/charges → validate → serialize → reload;
- all templates and both locales;
- single and mixed tax;
- manual and cost-plus pricing;
- goal seek for each target;
- batch rollback and revision conflict;
- goods-receipt creation, validation, export-history behavior.

#### Packaged Windows end-to-end tests

Run the packaged executable and verify:

- valid quotation PDF begins with `%PDF` and has nonzero size;
- quotation and goods-receipt export together;
- execution report is valid JSON;
- invalid schema returns the correct exit code;
- missing pending goods receipt returns the correct error;
- existing/unwritable output is handled safely;
- exchange-rate failure is reported without corrupting the quotation;
- renderer timeout is categorized correctly; and
- Unicode paths and quotation content work on Windows.

#### Documentation checks

- Keep `docs/quotation-agent-api.md` and `docs/headless-export.md` synchronized with the TypeScript contract.
- Add runnable Playwright/TypeScript and PowerShell examples.
- Add a browser/desktop/headless capability matrix.
- Prefer generated API-reference tables where practical.

**Acceptance criteria:**

1. A packaged Windows smoke test runs in CI or a repeatable release verification script.
2. The API contract cannot change without a failing test.
3. Documentation examples are executed as tests or copied from tested fixtures.
4. Canonical totals are compared across UI, renderer API, and headless output.

---

## P1 — Operational completeness

### AUT-013 — Expose customer and company-profile library operations

Add read/apply methods first:

- `listCustomers()`
- `getCustomer(id)`
- `applyCustomer(id)`
- `listCompanyProfiles()`
- `getCompanyProfile(id)`
- `applyCompanyProfile(id)`

Add create/update/delete only when external automation genuinely needs library maintenance. Keep the quotation snapshot self-contained through its company-profile snapshot.

### AUT-014 — Add batch manifest, progress, cancellation, and structured logs

For multiple quotations, support a manifest with sequential processing by default. PDF rendering should not start with high concurrency until memory and renderer stability have been measured.

Add:

- job IDs;
- per-job result objects;
- progress events or a progress JSON file;
- cancellation between phases;
- configurable timeout;
- structured stderr diagnostics; and
- final batch summary.

### AUT-015 — Add optional external adapters only after the core contract is stable

A future MCP, named-pipe, or JSON-RPC adapter can map directly to the command service. It should not contain independent quotation logic.

An HTTP API is justified only if another machine or user process must access the app remotely. It is not required for the current Windows-local automation use case.

---

## 5. Suggested v2 API shape

```ts
interface QuotationAgentApiV2 {
  getApiInfo(): Promise<QuotationAutomationApiInfo>
  waitUntilReady(): Promise<QuotationAutomationApiInfo>

  createQuotation(input?: CreateQuotationInput): Promise<AutomationResult<QuotationSnapshot>>
  importQuotationFile(path: string): Promise<AutomationResult<QuotationSnapshot>>
  importQuotationContent(content: string, name?: string): Promise<AutomationResult<QuotationSnapshot>>
  validateQuotationContent(content: string): Promise<AutomationResult<ValidationReport>>
  validateQuotation(): Promise<AutomationResult<ValidationReport>>
  validateForExport(input: ExportPreflightInput): Promise<AutomationResult<ValidationReport>>

  updateHeader(patch: Partial<QuotationHeader>): Promise<AutomationResult<QuotationHeader>>
  setTemplate(templateId: QuotationTemplateId): Promise<AutomationResult<void>>
  setBranding(patch: BrandingPatch): Promise<AutomationResult<void>>
  setOutputSettings(patch: OutputSettingsPatch): Promise<AutomationResult<void>>

  addLineItem(input: AddLineItemInput): Promise<AutomationResult<{ itemId: string }>>
  addSectionHeader(input: AddSectionHeaderInput): Promise<AutomationResult<{ itemId: string }>>
  getItem(itemId: string): Promise<AutomationResult<QuotationItem | QuotationSectionHeader>>
  getItemTree(): Promise<AutomationResult<QuotationRootItem[]>>
  updateLineItem(itemId: string, patch: QuotationItemPatch): Promise<AutomationResult<void>>
  removeItem(itemId: string): Promise<AutomationResult<void>>
  duplicateItem(itemId: string): Promise<AutomationResult<{ itemId: string }>>
  moveItem(itemId: string, target: MoveItemTarget): Promise<AutomationResult<void>>

  setQuotationCurrency(currency: string, rates?: ExchangeRateTable): Promise<AutomationResult<void>>
  updateExchangeRate(currency: string, rate: number): Promise<AutomationResult<void>>
  removeExchangeRate(currency: string): Promise<AutomationResult<void>>
  refreshExchangeRates(options?: RefreshExchangeRateOptions): Promise<AutomationResult<ExchangeRateRefreshResult>>

  addTaxClass(input: NewTaxClass): Promise<AutomationResult<{ taxClassId: string }>>
  updateTaxClass(id: string, patch: TaxClassPatch): Promise<AutomationResult<void>>
  removeTaxClass(id: string): Promise<AutomationResult<void>>
  addExtraCharge(input: NewExtraCharge): Promise<AutomationResult<{ extraChargeId: string }>>
  updateExtraCharge(id: string, patch: ExtraChargePatch): Promise<AutomationResult<void>>
  removeExtraCharge(id: string): Promise<AutomationResult<void>>

  previewItemGoalSeek(input: ItemGoalSeekInput): Promise<AutomationResult<ItemGoalSeekResult>>
  applyItemGoalSeek(input: ItemGoalSeekInput): Promise<AutomationResult<ItemGoalSeekResult>>
  previewQuotationGoalSeek(input: QuotationGoalSeekInput): Promise<AutomationResult<QuotationGoalSeekResult>>
  applyQuotationGoalSeek(input: QuotationGoalSeekInput): Promise<AutomationResult<QuotationGoalSeekResult>>

  createGoodsReceiptDraft(input: CreateGoodsReceiptInput): Promise<AutomationResult<GoodsReceiptDraft>>
  getPendingGoodsReceiptDraft(): Promise<AutomationResult<GoodsReceiptDraft | null>>
  updateGoodsReceiptHeader(patch: GoodsReceiptHeaderPatch): Promise<AutomationResult<void>>
  updateGoodsReceiptLine(lineId: string, patch: GoodsReceiptLinePatch): Promise<AutomationResult<void>>
  validateGoodsReceiptDraft(): Promise<AutomationResult<GoodsReceiptValidationResult>>
  clearPendingGoodsReceiptDraft(): Promise<AutomationResult<void>>

  applyOperations(request: ApplyOperationsRequest): Promise<AutomationResult<ApplyOperationsResult>>

  getQuotationSummary(): Promise<AutomationResult<QuotationAgentSummary>>
  getTotals(): Promise<AutomationResult<QuotationTotals>>
  getQuotationSnapshot(): Promise<AutomationResult<QuotationSnapshot>>
  serializeQuotation(): Promise<AutomationResult<SerializedQuotation>>
  saveQuotationToFile(path: string, options?: SaveOptions): Promise<AutomationResult<ExportedFile>>
  exportPdfToFile(path: string, options?: ExportOptions): Promise<AutomationResult<ExportedFile>>
  exportGoodsReceiptPdfToFile(path: string, options?: ExportOptions): Promise<AutomationResult<ExportedFile>>
}
```

### Compatibility recommendation

Do not change every existing method’s return shape in place unless there are no external users. Safer options are:

1. add v2 methods/result types alongside the existing methods and deprecate the legacy contract; or
2. expose `window.quotationAgentV2` temporarily while `window.quotationAgent` delegates to the new service through a legacy adapter.

The headless command should move to v2 first because it is controlled by the same repository.

---

## 6. Recommended internal architecture

```text
Canonical quotation utilities
        ↑
Quotation editor/tree/file/goods-receipt domain services
        ↑
Versioned Quotation Automation Service
        ↑
 ┌───────────────┬─────────────────┬────────────────────┐
 │ Vue UI adapter│ window API      │ Headless CLI adapter│
 └───────────────┴─────────────────┴────────────────────┘
                                      ↑
                         Optional future MCP/JSON-RPC
```

### Rules for implementation

1. Keep all pricing, tax, exchange-rate, rounding, hierarchy, and goal-seek calculations in their current canonical utilities.
2. Do not duplicate business rules in Electron `main.ts` or the CLI argument parser.
3. Keep Electron IPC limited to desktop capabilities and validated payloads.
4. Put the automation contract in `src/shared/contracts/quotationApp.ts` or a dedicated `quotationAutomation.ts` contract.
5. Put orchestration in a dedicated service/composable rather than expanding `QuotationEditor.vue` with more API wiring.
6. Use immutable snapshots at the API boundary.
7. Queue mutations and return a revision with every result.
8. Make validation and serialization reusable by the UI, window API, and CLI.

### Likely files to change

- `src/shared/contracts/quotationApp.ts`
- `src/features/quotations/composables/useQuotationAgentApi.ts`
- `src/features/quotations/composables/useQuotationEditor.ts`
- `src/features/quotations/composables/useQuotationTreeEditor.ts`
- `src/features/quotations/utils/quotationFile.ts`
- `src/features/quotations/utils/quotationGoalSeek.ts`
- `src/features/goods-receipts/utils/goodsReceipt.ts`
- `src/features/goods-receipts/composables/useGoodsReceiptExport.ts`
- application bootstrap/automation-host component
- `electron/headlessExport.ts` or a new `electron/automationCli.ts`
- `electron/main.ts`
- `electron/ipcValidation.ts`
- `docs/quotation-agent-api.md`
- `docs/headless-export.md`
- new schema, examples, and end-to-end tests

---

## 7. Recommended implementation sequence

### Phase 1 — Contract and reliability foundation

Implement AUT-001 through AUT-004:

- API version/capabilities/readiness;
- v2 result/error contract;
- deterministic serialization/save behavior;
- JSON schema and non-mutating validation;
- dedicated automation host;
- contract tests.

This phase should be completed before adding many new mutation methods, because it defines how all later methods behave.

### Phase 2 — Full quotation authoring

Implement AUT-005 through AUT-008:

- lifecycle/header/output operations;
- item tree CRUD;
- pricing/tax/FX/charges/goal seek;
- revision and atomic batch operations.

At the end of this phase, a complete quotation must be buildable without importing a prepared JSON/CSV/XLSX file and without UI clicks.

### Phase 3 — Goods receipt and production CLI

Implement AUT-009 through AUT-011:

- typed goods-receipt draft API;
- validation and editing;
- CLI validate/render/output-json modes;
- output overwrite and atomic-write policy;
- consistent input limits.

### Phase 4 — Release quality and optional integrations

Implement AUT-012 through AUT-015:

- packaged Windows E2E verification;
- CI/release checks;
- library access;
- batch manifests/progress;
- optional MCP or JSON-RPC adapter.

---

## 8. Definition of done

The automation interface is complete for the current product when a fresh external script can perform the following workflow without DOM selectors or manual interaction:

1. Read API/app/schema versions and capabilities.
2. Create a new quotation.
3. Set every required header field and document option.
4. Create and rearrange a hierarchical item tree.
5. Configure cost, manual price, markup, currencies, exchange rates, tax classes, mixed-tax columns, and extra charges.
6. Preview and apply goal seek.
7. Obtain totals and a complete immutable snapshot.
8. Validate the quotation and receive field-level diagnostics.
9. Serialize and save the updated schema-v2 quotation JSON.
10. Export a quotation PDF safely.
11. Create, edit, validate, and export a goods receipt.
12. Receive stable result/error codes, revision, warnings, and output metadata.
13. Apply a batch atomically with no partial state on failure.
14. Run the same workflow through the packaged Windows CLI.
15. Produce totals and documents that match the normal UI path.

---

## 9. Items that should not be implemented now

- A REST/HTTP server solely to automate a local desktop application.
- A second pricing, tax, goal-seek, or validation engine for the CLI.
- Generic DOM selectors as the normal automation contract.
- Arbitrary JavaScript evaluation exposed as a public API method.
- Unrestricted filesystem access through the quotation-domain API.
- An MCP adapter before the versioned command contract and tests are stable.
- A broad framework rewrite of the existing Vue/Electron application.

The correct next step is to finish the existing semantic automation layer, not replace it.
