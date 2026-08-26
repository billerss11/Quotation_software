import { createHash, randomUUID } from 'node:crypto'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IpcMainInvokeEvent } from 'electron'
import type {
  ExportGoodsReceiptPdfOptions,
  ExportQuotationPdfOptions,
  GoodsReceiptPdfRenderPayload,
  QuotationPdfRenderPayload,
  SaveQuotationFileOptions,
} from './preload-api.js'
import type {
  AutomationIssue,
  AutomationResult,
  ExchangeRateRefreshResult,
  QuotationAutomationApiInfo,
  QuotationAutomationSnapshot,
  QuotationValidationReport,
  SerializedQuotation,
} from '../src/shared/contracts/quotationAutomation.js'
import { QUOTATION_AUTOMATION_API_VERSION } from '../src/shared/contracts/quotationAutomation.js'
import { AUTOMATION_LIMITS } from '../src/shared/contracts/automationLimits.js'
import {
  getQuotationDocumentOrientation,
  getQuotationPdfViewportSize,
  type QuotationDocumentOrientation,
} from '../src/features/quotations/utils/quotationDocumentPage.js'
import { writeBufferFileAtomically, writeTextFileAtomically } from './atomicFile.js'
import {
  AUTOMATION_CLI_EXIT_CODES,
  findAutomationBatchPathConflict,
  getAutomationCliHelp,
  parseAutomationCliArguments,
  type AutomationBatchOptions,
  type AutomationCliExitCode,
  type AutomationCliInvocation,
  type AutomationJobOptions,
} from './automationCli.js'
import {
  MAX_TEXT_FILE_BYTES,
  isDevAutoImportQuotationFileName,
  isTrustedRendererUrl,
  parseGoodsReceiptPdfOptions,
  parsePdfJobId,
  parseQuotationPdfOptions,
  parseSaveFileOptions,
  resolveAllowedFilePath,
} from './ipcValidation.js'
import { QUOTATION_FILE_SCHEMA_VERSION } from '../src/shared/contracts/quotationSchema.js'

const require = createRequire(import.meta.url)
const electron = require('electron') as typeof import('electron')
const { app, BrowserWindow, dialog, ipcMain } = electron
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PDF_RENDER_READY_TIMEOUT_MS = 30_000

type PdfRenderPayload = QuotationPdfRenderPayload | GoodsReceiptPdfRenderPayload

interface AutomationOutputReport {
  kind: 'quotation-pdf' | 'goods-receipt-pdf' | 'quotation-json'
  filePath: string
  sizeBytes: number
  sha256: string
}

interface AutomationErrorReport {
  code: string
  message: string
  fieldPath?: string
  details?: Record<string, unknown>
}

interface AutomationJobReport {
  ok: boolean
  command: 'validate' | 'render'
  requestId: string
  jobId?: string
  exitCode: AutomationCliExitCode
  apiVersion?: string
  appVersion?: string
  quotationSchemaVersion?: number
  inputFile?: string
  quotationId?: string
  quotationNumber?: string
  currency?: string
  totals?: QuotationAutomationSnapshot['totals']
  exchangeRateDate?: string
  exchangeRates?: ExchangeRateRefreshResult['rates']
  warnings: AutomationIssue[]
  errors: AutomationErrorReport[]
  outputs: AutomationOutputReport[]
  timingMs: Record<string, number>
}

interface AutomationBatchReport {
  ok: boolean
  command: 'batch'
  requestId: string
  exitCode: AutomationCliExitCode
  apiVersion: string
  appVersion: string
  quotationSchemaVersion: number
  manifestFile: string
  jobs: AutomationJobReport[]
  summary: {
    total: number
    completed: number
    succeeded: number
    failed: number
    canceled: number
  }
  errors: AutomationErrorReport[]
  timingMs: Record<string, number>
}

type AutomationExecutionReport = AutomationJobReport | AutomationBatchReport

type AutomationProgressStatus = 'starting' | 'running' | 'completed' | 'failed' | 'canceled'

interface AutomationProgressControl {
  requestId: string
  command: 'validate' | 'render' | 'batch'
  progressJsonPath?: string
  cancelFilePath?: string
  jobRequestId?: string
  jobId?: string
  jobIndex?: number
  totalJobs?: number
}

class AutomationCliError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly exitCode: AutomationCliExitCode,
    public readonly fieldPath?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AutomationCliError'
  }
}

interface PendingQuotationPdfJob {
  payload: PdfRenderPayload
  readyPromise: Promise<void>
  resolveReady: () => void
}

const pendingQuotationPdfJobs = new Map<string, PendingQuotationPdfJob>()
let automationCliRunning = false

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    title: 'Quotation Software',
    backgroundColor: '#f5f7fb',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  secureRendererWindow(mainWindow)

  void loadRendererWindow(mainWindow)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

function createQuotationPdfWindow(orientation: QuotationDocumentOrientation = 'portrait') {
  const pdfViewport = getQuotationPdfViewportSize(orientation)

  const pdfWindow = new BrowserWindow({
    show: false,
    width: pdfViewport.width,
    height: pdfViewport.height,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  secureRendererWindow(pdfWindow)
  return pdfWindow
}

function createHeadlessExportWindow() {
  const exportWindow = new BrowserWindow({
    show: false,
    width: 1440,
    height: 960,
    backgroundColor: '#f5f7fb',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: `quotation-headless-${randomUUID()}`,
    },
  })

  secureRendererWindow(exportWindow)
  exportWindow.webContents.on('render-process-gone', (_event, details) => {
    process.stderr.write(`[headless renderer exited] ${details.reason}\n`)
  })
  return exportWindow
}

function getPreloadPath() {
  return path.join(__dirname, 'preload.cjs')
}

async function loadRendererWindow(window: InstanceType<typeof BrowserWindow>, query: Record<string, string> = {}) {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  if (devServerUrl) {
    const url = new URL(devServerUrl)

    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }

    await window.loadURL(url.toString())
    return
  }

  await window.loadFile(path.join(__dirname, '../../dist/index.html'), { query })
}

app.whenReady().then(async () => {
  ipcMain.handle('app:get-version', (event) => {
    assertTrustedIpcSender(event)
    return app.getVersion()
  })
  ipcMain.handle('quotation:save-file', (event, options: unknown) => {
    assertTrustedIpcSender(event)
    return saveQuotationFile(parseSaveFileOptions(options, ['.json']))
  })
  ipcMain.handle('line-items:save-csv-file', (event, options: unknown) => {
    assertTrustedIpcSender(event)
    return saveLineItemsCsvFile(parseSaveFileOptions(options, ['.csv']))
  })
  ipcMain.handle('line-items:save-csv-template-file', (event, options: unknown) => {
    assertTrustedIpcSender(event)
    return saveLineItemsCsvTemplateFile(parseSaveFileOptions(options, ['.csv']))
  })
  ipcMain.handle('line-items:save-excel-template-file', (event) => {
    assertTrustedIpcSender(event)
    return saveLineItemsExcelTemplateFile()
  })
  ipcMain.handle('quotation:open-file', (event) => {
    assertTrustedIpcSender(event)
    return openTextFile(
      'Import quotation',
      [{ name: 'Quotation JSON', extensions: ['json'] }],
      ['.json'],
      AUTOMATION_LIMITS.quotationJsonBytes,
    )
  })
  ipcMain.handle('quotation:open-file-path', (event, filePath: unknown) => {
    assertTrustedIpcSender(event)
    return openTextFileAtPath(filePath, ['.json'], AUTOMATION_LIMITS.quotationJsonBytes)
  })
  ipcMain.handle('quotation:open-dev-auto-import-file', (event) => {
    assertTrustedIpcSender(event)
    return openDevAutoImportQuotationFile()
  })
  ipcMain.handle('line-items:open-csv-file', (event) => {
    assertTrustedIpcSender(event)
    return openTextFile(
      'Import line items CSV',
      [{ name: 'CSV files', extensions: ['csv'] }],
      ['.csv'],
      AUTOMATION_LIMITS.lineItemsCsvBytes,
    )
  })
  ipcMain.handle('line-items:open-csv-file-path', (event, filePath: unknown) => {
    assertTrustedIpcSender(event)
    return openTextFileAtPath(filePath, ['.csv'], AUTOMATION_LIMITS.lineItemsCsvBytes)
  })
  ipcMain.handle('line-items:open-xlsx-file', (event) => {
    assertTrustedIpcSender(event)
    return openBinaryFile('Import line items Excel workbook', [{ name: 'Excel Workbook', extensions: ['xlsx'] }])
  })
  ipcMain.handle('line-items:open-xlsx-file-path', (event, filePath: unknown) => {
    assertTrustedIpcSender(event)
    return openBinaryFileAtPath(filePath)
  })
  ipcMain.handle('library:save-file', (event, options: unknown) => {
    assertTrustedIpcSender(event)
    return saveLibraryFile(parseSaveFileOptions(options, ['.json']))
  })
  ipcMain.handle('library:open-file', (event) => {
    assertTrustedIpcSender(event)
    return openTextFile('Open quotation library', [{ name: 'Quotation Library JSON', extensions: ['json'] }], ['.json'])
  })
  ipcMain.handle('quotation:export-pdf', (event, options: unknown) => {
    assertTrustedIpcSender(event)
    return exportPdfForSender(event, parseQuotationPdfOptions(options), 'quotation-print')
  })
  ipcMain.handle('goods-receipt:export-pdf', (event, options: unknown) => {
    assertTrustedIpcSender(event)
    return exportPdfForSender(event, parseGoodsReceiptPdfOptions(options), 'goods-receipt-print')
  })
  ipcMain.handle('quotation:get-pdf-payload', (event, jobId: unknown) => {
    assertTrustedIpcSender(event)
    return getQuotationPdfPayload(parsePdfJobId(jobId))
  })
  ipcMain.handle('quotation:pdf-render-ready', (event, jobId: unknown) => {
    assertTrustedIpcSender(event)
    return markQuotationPdfReady(parsePdfJobId(jobId))
  })
  ipcMain.handle('goods-receipt:get-pdf-payload', (event, jobId: unknown) => {
    assertTrustedIpcSender(event)
    return getGoodsReceiptPdfPayload(parsePdfJobId(jobId))
  })
  ipcMain.handle('goods-receipt:pdf-render-ready', (event, jobId: unknown) => {
    assertTrustedIpcSender(event)
    return markQuotationPdfReady(parsePdfJobId(jobId))
  })
  let automationInvocation: AutomationCliInvocation | null

  try {
    automationInvocation = parseAutomationCliArguments(process.argv)
  } catch (error) {
    writeAutomationCliOutput({
      ok: false,
      command: 'validate',
      requestId: randomUUID(),
      exitCode: AUTOMATION_CLI_EXIT_CODES.usage,
      warnings: [],
      errors: [{ code: 'usage_error', message: getErrorMessage(error) }],
      outputs: [],
      timingMs: { total: 0 },
    })
    app.exit(AUTOMATION_CLI_EXIT_CODES.usage)
    return
  }

  if (automationInvocation) {
    automationCliRunning = true
    const exitCode = await runAutomationCli(automationInvocation)
    automationCliRunning = false
    app.exit(exitCode)
    return
  }

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

async function runAutomationCli(invocation: AutomationCliInvocation): Promise<AutomationCliExitCode> {
  if (invocation.kind === 'help') {
    process.stdout.write(`${getAutomationCliHelp()}\n`)
    return AUTOMATION_CLI_EXIT_CODES.success
  }
  if (invocation.kind === 'version') {
    process.stdout.write(`${app.getVersion()}\n`)
    return AUTOMATION_CLI_EXIT_CODES.success
  }
  if (invocation.kind === 'api-info') {
    const apiInfo = {
      apiVersion: QUOTATION_AUTOMATION_API_VERSION,
      appVersion: app.getVersion(),
      quotationSchemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
      commands: ['validate', 'render', 'batch'],
      exitCodes: AUTOMATION_CLI_EXIT_CODES,
    }
    if (invocation.resultJson) {
      try {
        const resultJsonPath = resolveAllowedFilePath(invocation.resultJson, ['.json'])
        await writeTextFileAtomically(resultJsonPath, `${JSON.stringify(apiInfo, null, 2)}\n`)
      } catch (error) {
        process.stderr.write(`${JSON.stringify({
          level: 'error',
          exitCode: AUTOMATION_CLI_EXIT_CODES.filesystem,
          errors: [{ code: 'api_info_write_failed', message: getErrorMessage(error) }],
        })}\n`)
        return AUTOMATION_CLI_EXIT_CODES.filesystem
      }
    }
    process.stdout.write(`${JSON.stringify(apiInfo)}\n`)
    return AUTOMATION_CLI_EXIT_CODES.success
  }

  if (invocation.kind === 'batch') {
    const { report, resultJsonPath } = await runAutomationBatch(invocation.options)
    return finishAutomationExecution(report, resultJsonPath, Boolean(invocation.options.force))
  }

  const { report, resultJsonPath } = await runAutomationJob(invocation.options)
  return finishAutomationExecution(report, resultJsonPath, Boolean(invocation.options.force))
}

async function runAutomationJob(
  options: AutomationJobOptions,
  jobId?: string,
  parentControl?: AutomationProgressControl,
): Promise<{ report: AutomationJobReport; resultJsonPath?: string }> {
  const startedAt = performance.now()
  const requestId = randomUUID()
  const timingMs: Record<string, number> = {}
  const warnings: AutomationIssue[] = []
  const outputs: AutomationOutputReport[] = []
  let resolvedOptions: AutomationJobOptions | undefined
  let apiInfo: QuotationAutomationApiInfo | undefined
  let snapshot: QuotationAutomationSnapshot | undefined
  let exchangeRateData: ExchangeRateRefreshResult | undefined
  let exportWindow: InstanceType<typeof BrowserWindow> | undefined
  let progressControl: AutomationProgressControl | undefined
  let progressReady = false
  const cancelRendererWork = () => {
    if (exportWindow && !exportWindow.isDestroyed()) exportWindow.destroy()
  }

  try {
    resolvedOptions = resolveAutomationJobOptions(options)
    assertDistinctAutomationPaths(resolvedOptions)
    await assertOutputFilesAvailable(getAutomationOutputPaths(resolvedOptions), Boolean(resolvedOptions.force))
    progressControl = parentControl
      ? { ...parentControl, jobRequestId: requestId, ...(jobId ? { jobId } : {}) }
      : {
          requestId,
          command: resolvedOptions.command,
          ...(resolvedOptions.progressJson ? { progressJsonPath: resolvedOptions.progressJson } : {}),
          ...(resolvedOptions.cancelFile ? { cancelFilePath: resolvedOptions.cancelFile } : {}),
          ...(jobId ? { jobId } : {}),
        }
    progressReady = true
    await writeAutomationProgress(progressControl, 'starting', 'preflight')
    await assertAutomationNotCanceled(progressControl, 'loadRenderer')

    exportWindow = createHeadlessExportWindow()
    await runControlledAutomationPhase(progressControl, timingMs, 'loadRenderer', resolvedOptions.timeoutMs, async () => {
      await loadRendererWindow(exportWindow!, { mode: 'automation' })
      apiInfo = await waitForQuotationAgentV2(exportWindow!, resolvedOptions!.timeoutMs)
    })

    const importResult = await runControlledAutomationPhase(progressControl, timingMs, 'import', resolvedOptions.timeoutMs, () =>
      invokeQuotationAgentV2<QuotationAutomationSnapshot>(exportWindow!, 'importQuotationFile', resolvedOptions!.inputFile))
    snapshot = assertAgentActionSucceeded(importResult, AUTOMATION_CLI_EXIT_CODES.input)
    warnings.push(...importResult.meta.warnings)

    if (resolvedOptions.refreshExchangeRates) {
      const exchangeRateResult = await runControlledAutomationPhase(progressControl, timingMs, 'refreshExchangeRates', resolvedOptions.timeoutMs, () =>
        invokeQuotationAgentV2<ExchangeRateRefreshResult>(exportWindow!, 'refreshExchangeRates'))
      exchangeRateData = assertAgentActionSucceeded(exchangeRateResult, AUTOMATION_CLI_EXIT_CODES.network)
      warnings.push(...exchangeRateResult.meta.warnings)
    }

    const validationResult = await runControlledAutomationPhase(progressControl, timingMs, 'validate', resolvedOptions.timeoutMs, () =>
      invokeQuotationAgentV2<QuotationValidationReport>(exportWindow!, 'validateQuotation'))
    const validation = assertAgentActionSucceeded(validationResult, AUTOMATION_CLI_EXIT_CODES.input)
    warnings.push(...validationResult.meta.warnings, ...validation.issues.filter(issue => issue.severity === 'warning'))
    const validationErrors = validation.issues.filter(issue => issue.severity === 'error')
    if (!validation.valid || validationErrors.length > 0) {
      const firstError = validationErrors[0]
      throw new AutomationCliError(
        firstError?.code ?? 'validation_failed',
        firstError?.message ?? 'The quotation is invalid.',
        AUTOMATION_CLI_EXIT_CODES.input,
        firstError?.fieldPath,
        { issues: validationErrors },
      )
    }

    if (resolvedOptions.command === 'render' && resolvedOptions.quotationPdf) {
      const result = await runControlledAutomationPhase(
        progressControl,
        timingMs,
        'quotationPdf',
        resolvedOptions.timeoutMs,
        () => invokeQuotationAgentV2(exportWindow!, 'exportPdfToFile', resolvedOptions!.quotationPdf!),
        cancelRendererWork,
      )
      assertAgentActionSucceeded(result, AUTOMATION_CLI_EXIT_CODES.render)
      warnings.push(...result.meta.warnings)
    }

    if (resolvedOptions.command === 'render' && resolvedOptions.goodsReceiptPdf) {
      const result = await runControlledAutomationPhase(
        progressControl,
        timingMs,
        'goodsReceiptPdf',
        resolvedOptions.timeoutMs,
        () => invokeQuotationAgentV2(exportWindow!, 'exportGoodsReceiptPdfToFile', resolvedOptions!.goodsReceiptPdf!),
        cancelRendererWork,
      )
      assertAgentActionSucceeded(result, AUTOMATION_CLI_EXIT_CODES.render)
      warnings.push(...result.meta.warnings)
    }

    if (resolvedOptions.outputJson) {
      const serializationResult = await runControlledAutomationPhase(progressControl, timingMs, 'serialize', resolvedOptions.timeoutMs, () =>
        invokeQuotationAgentV2<SerializedQuotation>(exportWindow!, 'serializeQuotation'))
      const serialized = assertAgentActionSucceeded(serializationResult, AUTOMATION_CLI_EXIT_CODES.internal)
      warnings.push(...serializationResult.meta.warnings)
      await runControlledAutomationPhase(progressControl, timingMs, 'writeQuotationJson', resolvedOptions.timeoutMs, () =>
        writeTextFileAtomically(resolvedOptions!.outputJson!, serialized.content))
    }

    const snapshotResult = await runControlledAutomationPhase(progressControl, timingMs, 'snapshot', resolvedOptions.timeoutMs, () =>
      invokeQuotationAgentV2<QuotationAutomationSnapshot>(exportWindow!, 'getQuotationSnapshot'))
    snapshot = assertAgentActionSucceeded(snapshotResult, AUTOMATION_CLI_EXIT_CODES.internal)
    warnings.push(...snapshotResult.meta.warnings)

    for (const output of getRenderedOutputEntries(resolvedOptions)) {
      outputs.push(await runControlledAutomationPhase(
        progressControl,
        timingMs,
        `inspect-${output.kind}`,
        resolvedOptions.timeoutMs,
        () => createAutomationOutputReport(output.kind, output.filePath),
      ))
    }

    timingMs.total = roundElapsed(startedAt)
    await writeAutomationProgress(progressControl, 'completed', 'complete')
    return {
      report: createAutomationJobReport({
        ok: true,
        command: resolvedOptions.command,
        requestId,
        jobId,
        exitCode: AUTOMATION_CLI_EXIT_CODES.success,
        apiInfo,
        inputFile: resolvedOptions.inputFile,
        snapshot,
        exchangeRateData,
        warnings,
        errors: [],
        outputs,
        timingMs,
      }),
      ...(resolvedOptions.resultJson ? { resultJsonPath: resolvedOptions.resultJson } : {}),
    }
  } catch (error) {
    const automationError = toAutomationCliError(error)
    timingMs.total = roundElapsed(startedAt)
    if (progressReady && progressControl) {
      const errorPhase = typeof automationError.details?.phase === 'string'
        ? automationError.details.phase
        : 'failed'
      await writeAutomationProgressSafely(
        progressControl,
        automationError.code === 'automation_canceled' ? 'canceled' : 'failed',
        errorPhase,
        automationError,
      )
    }
    return {
      report: createAutomationJobReport({
        ok: false,
        command: options.command,
        requestId,
        jobId,
        exitCode: automationError.exitCode,
        apiInfo,
        inputFile: resolvedOptions?.inputFile ?? options.inputFile,
        snapshot,
        exchangeRateData,
        warnings,
        errors: [toAutomationErrorReport(automationError)],
        outputs,
        timingMs,
      }),
      ...(resolvedOptions?.resultJson ? { resultJsonPath: resolvedOptions.resultJson } : {}),
    }
  } finally {
    if (exportWindow && !exportWindow.isDestroyed()) exportWindow.destroy()
  }
}

async function runAutomationBatch(
  options: AutomationBatchOptions,
): Promise<{ report: AutomationBatchReport; resultJsonPath?: string }> {
  const startedAt = performance.now()
  const requestId = randomUUID()
  const timingMs: Record<string, number> = {}
  let manifestFile = options.manifestFile
  let resultJsonPath: string | undefined
  let progressJsonPath: string | undefined
  let cancelFilePath: string | undefined
  let progressControl: AutomationProgressControl | undefined
  let progressReady = false
  let totalJobs = 0
  const jobReports: AutomationJobReport[] = []

  try {
    manifestFile = resolveAllowedFilePath(options.manifestFile, ['.json'])
    resultJsonPath = options.resultJson
      ? resolveAllowedFilePath(options.resultJson, ['.json'])
      : undefined
    progressJsonPath = options.progressJson
      ? resolveAllowedFilePath(options.progressJson, ['.json'])
      : undefined
    cancelFilePath = options.cancelFile
      ? resolveAllowedFilePath(options.cancelFile, ['.cancel', '.json', '.txt'])
      : undefined
    assertDistinctFilePaths([
      { label: 'manifest', filePath: manifestFile },
      ...(resultJsonPath ? [{ label: 'result JSON', filePath: resultJsonPath }] : []),
      ...(progressJsonPath ? [{ label: 'progress JSON', filePath: progressJsonPath }] : []),
      ...(cancelFilePath ? [{ label: 'cancel file', filePath: cancelFilePath }] : []),
    ])
    progressControl = {
      requestId,
      command: 'batch',
      ...(progressJsonPath ? { progressJsonPath } : {}),
      ...(cancelFilePath ? { cancelFilePath } : {}),
    }
    const jobs = await runTimedAutomationPhase(
      timingMs,
      'readManifest',
      options.timeoutMs,
      () => readAutomationManifest(manifestFile, options),
    )
    totalJobs = jobs.length
    const pathConflict = findAutomationBatchPathConflict({
      manifestFile,
      ...(resultJsonPath ? { resultJson: resultJsonPath } : {}),
      ...(progressJsonPath ? { progressJson: progressJsonPath } : {}),
      ...(cancelFilePath ? { cancelFile: cancelFilePath } : {}),
    }, jobs)
    if (pathConflict) {
      throw new AutomationCliError(
        'duplicate_output_path',
        `${pathConflict.label} and ${pathConflict.previousLabel} must use different paths: ${pathConflict.filePath}`,
        AUTOMATION_CLI_EXIT_CODES.usage,
      )
    }
    await assertOutputFilesAvailable(
      [resultJsonPath, progressJsonPath].filter((filePath): filePath is string => Boolean(filePath)),
      Boolean(options.force),
    )
    for (const job of jobs) {
      await assertOutputFilesAvailable(getAutomationOutputPaths(job.options), Boolean(job.options.force))
    }
    progressReady = true
    await writeAutomationProgress(progressControl, 'starting', 'readManifest:complete', {
      completedJobs: 0,
      totalJobs,
    })

    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index]!
      const jobControl: AutomationProgressControl = {
        ...progressControl,
        jobId: job.id,
        jobIndex: index,
        totalJobs,
      }
      await assertAutomationNotCanceled(jobControl, `job-${index + 1}`)
      await writeAutomationProgress(jobControl, 'running', 'job-start', {
        completedJobs: jobReports.length,
        totalJobs,
      })
      const execution = await runAutomationJob(job.options, job.id, jobControl)
      jobReports.push(execution.report)
      await writeAutomationProgress(jobControl, 'running', 'job-complete', {
        completedJobs: jobReports.length,
        totalJobs,
      })
      const canceledError = execution.report.errors.find(error => error.code === 'automation_canceled')
      if (canceledError) {
        throw new AutomationCliError(
          canceledError.code,
          canceledError.message,
          AUTOMATION_CLI_EXIT_CODES.render,
          canceledError.fieldPath,
          canceledError.details,
        )
      }
    }

    const failedJobs = jobReports.filter(report => !report.ok)
    const canceledJobs = jobReports.filter(report => report.errors.some(error => error.code === 'automation_canceled'))
    const exitCode = failedJobs.length
      ? failedJobs.reduce<AutomationCliExitCode>((code, report) => Math.max(code, report.exitCode) as AutomationCliExitCode, AUTOMATION_CLI_EXIT_CODES.input)
      : AUTOMATION_CLI_EXIT_CODES.success
    timingMs.total = roundElapsed(startedAt)
    await writeAutomationProgress(
      progressControl,
      failedJobs.length ? 'failed' : 'completed',
      'complete',
      { completedJobs: jobReports.length, totalJobs },
    )
    return {
      report: {
        ok: failedJobs.length === 0,
        command: 'batch',
        requestId,
        exitCode,
        apiVersion: QUOTATION_AUTOMATION_API_VERSION,
        appVersion: app.getVersion(),
        quotationSchemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
        manifestFile,
        jobs: jobReports,
        summary: {
          total: totalJobs,
          completed: jobReports.length,
          succeeded: jobReports.length - failedJobs.length,
          failed: failedJobs.length,
          canceled: canceledJobs.length,
        },
        errors: failedJobs.flatMap(report => report.errors),
        timingMs,
      },
      ...(resultJsonPath ? { resultJsonPath } : {}),
    }
  } catch (error) {
    const automationError = toAutomationCliError(error, AUTOMATION_CLI_EXIT_CODES.input)
    timingMs.total = roundElapsed(startedAt)
    const failedJobs = jobReports.filter(report => !report.ok)
    const canceledJobs = jobReports.filter(report => report.errors.some(reportError => reportError.code === 'automation_canceled'))
    if (progressReady && progressControl) {
      const errorPhase = typeof automationError.details?.phase === 'string'
        ? automationError.details.phase
        : 'failed'
      await writeAutomationProgressSafely(
        progressControl,
        automationError.code === 'automation_canceled' ? 'canceled' : 'failed',
        errorPhase,
        automationError,
        { completedJobs: jobReports.length, totalJobs },
      )
    }
    const jobErrors = jobReports.flatMap(report => report.errors)
    const automationErrorReport = toAutomationErrorReport(automationError)
    const errors = jobErrors.some(reportError => (
      reportError.code === automationErrorReport.code
      && reportError.message === automationErrorReport.message
    ))
      ? jobErrors
      : [...jobErrors, automationErrorReport]
    return {
      report: {
        ok: false,
        command: 'batch',
        requestId,
        exitCode: automationError.exitCode,
        apiVersion: QUOTATION_AUTOMATION_API_VERSION,
        appVersion: app.getVersion(),
        quotationSchemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
        manifestFile,
        jobs: jobReports,
        summary: {
          total: totalJobs,
          completed: jobReports.length,
          succeeded: jobReports.length - failedJobs.length,
          failed: failedJobs.length,
          canceled: canceledJobs.length,
        },
        errors,
        timingMs,
      },
      ...(resultJsonPath ? { resultJsonPath } : {}),
    }
  }
}

async function finishAutomationExecution(
  report: AutomationExecutionReport,
  resultJsonPath: string | undefined,
  force: boolean,
): Promise<AutomationCliExitCode> {
  let finalReport = report
  if (resultJsonPath) {
    try {
      if (!force && await fileExists(resultJsonPath)) {
        throw new AutomationCliError(
          'output_exists',
          `Output already exists: ${resultJsonPath}`,
          AUTOMATION_CLI_EXIT_CODES.filesystem,
        )
      }
      await writeTextFileAtomically(resultJsonPath, `${JSON.stringify(finalReport, null, 2)}\n`)
    } catch (error) {
      const automationError = toAutomationCliError(error, AUTOMATION_CLI_EXIT_CODES.filesystem)
      finalReport = {
        ...finalReport,
        ok: false,
        exitCode: automationError.exitCode,
        errors: [...finalReport.errors, toAutomationErrorReport(automationError)],
      }
    }
  }

  if (!finalReport.ok) {
    process.stderr.write(`${JSON.stringify({
      level: 'error',
      requestId: finalReport.requestId,
      exitCode: finalReport.exitCode,
      errors: finalReport.errors,
    })}\n`)
  }
  writeAutomationCliOutput(finalReport)
  return finalReport.exitCode
}

function writeAutomationCliOutput(report: AutomationExecutionReport) {
  process.stdout.write(`${JSON.stringify(report)}\n`)
}

function resolveAutomationJobOptions(options: AutomationJobOptions): AutomationJobOptions {
  try {
    return {
      ...options,
      inputFile: resolveAllowedFilePath(options.inputFile, ['.json']),
      ...(options.quotationPdf ? { quotationPdf: resolveAllowedFilePath(options.quotationPdf, ['.pdf']) } : {}),
      ...(options.goodsReceiptPdf ? { goodsReceiptPdf: resolveAllowedFilePath(options.goodsReceiptPdf, ['.pdf']) } : {}),
      ...(options.outputJson ? { outputJson: resolveAllowedFilePath(options.outputJson, ['.json']) } : {}),
      ...(options.resultJson ? { resultJson: resolveAllowedFilePath(options.resultJson, ['.json']) } : {}),
      ...(options.progressJson ? { progressJson: resolveAllowedFilePath(options.progressJson, ['.json']) } : {}),
      ...(options.cancelFile
        ? { cancelFile: resolveAllowedFilePath(options.cancelFile, ['.cancel', '.json', '.txt']) }
        : {}),
    }
  } catch (error) {
    throw new AutomationCliError('invalid_path', getErrorMessage(error), AUTOMATION_CLI_EXIT_CODES.usage)
  }
}

function assertDistinctAutomationPaths(options: AutomationJobOptions) {
  assertDistinctFilePaths([
    { label: 'input JSON', filePath: options.inputFile },
    ...(options.quotationPdf ? [{ label: 'quotation PDF', filePath: options.quotationPdf }] : []),
    ...(options.goodsReceiptPdf ? [{ label: 'goods-receipt PDF', filePath: options.goodsReceiptPdf }] : []),
    ...(options.outputJson ? [{ label: 'output JSON', filePath: options.outputJson }] : []),
    ...(options.resultJson ? [{ label: 'result JSON', filePath: options.resultJson }] : []),
    ...(options.progressJson ? [{ label: 'progress JSON', filePath: options.progressJson }] : []),
    ...(options.cancelFile ? [{ label: 'cancel file', filePath: options.cancelFile }] : []),
  ])
}

function assertDistinctFilePaths(entries: Array<{ label: string; filePath: string }>) {
  const observedPaths = new Map<string, string>()
  for (const entry of entries) {
    const normalizedPath = entry.filePath.toLocaleLowerCase()
    const previousLabel = observedPaths.get(normalizedPath)
    if (previousLabel) {
      throw new AutomationCliError(
        'duplicate_output_path',
        `${entry.label} and ${previousLabel} must use different paths.`,
        AUTOMATION_CLI_EXIT_CODES.usage,
      )
    }
    observedPaths.set(normalizedPath, entry.label)
  }
}

function getAutomationOutputPaths(options: AutomationJobOptions) {
  return [options.quotationPdf, options.goodsReceiptPdf, options.outputJson, options.resultJson, options.progressJson]
    .filter((filePath): filePath is string => Boolean(filePath))
}

async function assertOutputFilesAvailable(filePaths: string[], force: boolean) {
  if (force) return
  for (const filePath of filePaths) {
    if (await fileExists(filePath)) {
      throw new AutomationCliError(
        'output_exists',
        `Output already exists: ${filePath}`,
        AUTOMATION_CLI_EXIT_CODES.filesystem,
      )
    }
  }
}

function getRenderedOutputEntries(options: AutomationJobOptions) {
  return [
    ...(options.quotationPdf ? [{ kind: 'quotation-pdf' as const, filePath: options.quotationPdf }] : []),
    ...(options.goodsReceiptPdf ? [{ kind: 'goods-receipt-pdf' as const, filePath: options.goodsReceiptPdf }] : []),
    ...(options.outputJson ? [{ kind: 'quotation-json' as const, filePath: options.outputJson }] : []),
  ]
}

async function createAutomationOutputReport(
  kind: AutomationOutputReport['kind'],
  filePath: string,
): Promise<AutomationOutputReport> {
  try {
    const [fileStats, content] = await Promise.all([stat(filePath), readFile(filePath)])
    return {
      kind,
      filePath,
      sizeBytes: fileStats.size,
      sha256: createHash('sha256').update(content).digest('hex'),
    }
  } catch (error) {
    throw new AutomationCliError('filesystem_error', getErrorMessage(error), AUTOMATION_CLI_EXIT_CODES.filesystem)
  }
}

function createAutomationJobReport(options: {
  ok: boolean
  command: AutomationJobReport['command']
  requestId: string
  jobId?: string
  exitCode: AutomationCliExitCode
  apiInfo?: QuotationAutomationApiInfo
  inputFile: string
  snapshot?: QuotationAutomationSnapshot
  exchangeRateData?: ExchangeRateRefreshResult
  warnings: AutomationIssue[]
  errors: AutomationErrorReport[]
  outputs: AutomationOutputReport[]
  timingMs: Record<string, number>
}): AutomationJobReport {
  return {
    ok: options.ok,
    command: options.command,
    requestId: options.requestId,
    ...(options.jobId ? { jobId: options.jobId } : {}),
    exitCode: options.exitCode,
    ...(options.apiInfo
      ? {
          apiVersion: options.apiInfo.apiVersion,
          appVersion: options.apiInfo.appVersion,
          quotationSchemaVersion: options.apiInfo.quotationSchemaVersion,
        }
      : {}),
    inputFile: options.inputFile,
    ...(options.snapshot
      ? {
          quotationId: options.snapshot.quotation.id,
          quotationNumber: options.snapshot.quotation.header.quotationNumber,
          currency: options.snapshot.quotation.header.currency,
          totals: options.snapshot.totals,
        }
      : {}),
    ...(options.exchangeRateData?.date ? { exchangeRateDate: options.exchangeRateData.date } : {}),
    ...(options.exchangeRateData ? { exchangeRates: options.exchangeRateData.rates } : {}),
    warnings: options.warnings,
    errors: options.errors,
    outputs: options.outputs,
    timingMs: options.timingMs,
  }
}

async function readAutomationManifest(
  manifestFile: string,
  batchOptions: AutomationBatchOptions,
): Promise<Array<{ id: string; options: AutomationJobOptions }>> {
  let value: unknown
  try {
    const manifestStats = await stat(manifestFile)
    if (manifestStats.size > AUTOMATION_LIMITS.batchManifestBytes) {
      throw new AutomationCliError(
        'input_too_large',
        `Batch manifest exceeds the ${AUTOMATION_LIMITS.batchManifestBytes} byte limit.`,
        AUTOMATION_CLI_EXIT_CODES.input,
      )
    }
    const manifestContent = await readFile(manifestFile, 'utf8')
    value = JSON.parse(manifestContent.replace(/^\uFEFF/, ''))
  } catch (error) {
    if (error instanceof AutomationCliError) throw error
    throw new AutomationCliError(
      'manifest_read_failed',
      `Could not read the batch manifest: ${getErrorMessage(error)}`,
      AUTOMATION_CLI_EXIT_CODES.input,
    )
  }

  if (!isPlainRecord(value)) {
    throw createManifestError('Batch manifest must be a JSON object.')
  }
  assertManifestFields(value, ['schemaVersion', 'jobs'], 'manifest')
  if (value.schemaVersion !== 1) throw createManifestError('Batch manifest schemaVersion must be 1.', 'schemaVersion')
  if (!Array.isArray(value.jobs) || value.jobs.length === 0) {
    throw createManifestError('Batch manifest jobs must be a non-empty array.', 'jobs')
  }
  if (value.jobs.length > AUTOMATION_LIMITS.batchJobCount) {
    throw new AutomationCliError(
      'input_too_large',
      `Batch manifest exceeds the ${AUTOMATION_LIMITS.batchJobCount} job limit.`,
      AUTOMATION_CLI_EXIT_CODES.input,
      'jobs',
    )
  }

  const manifestDirectory = path.dirname(manifestFile)
  const observedIds = new Set<string>()
  return value.jobs.map((job, index) => {
    if (!isPlainRecord(job)) throw createManifestError('Each batch job must be an object.', `jobs[${index}]`)
    assertManifestFields(job, [
      'id', 'command', 'input', 'quotationPdf', 'goodsReceiptPdf', 'outputJson',
      'refreshExchangeRates', 'noNetwork', 'force', 'timeoutMs',
    ], `jobs[${index}]`)

    const id = readManifestOptionalString(job.id, `jobs[${index}].id`) ?? `job-${index + 1}`
    if (observedIds.has(id)) throw createManifestError(`Duplicate batch job ID: ${id}.`, `jobs[${index}].id`)
    observedIds.add(id)

    const command = job.command
    if (command !== 'validate' && command !== 'render') {
      throw createManifestError('Batch job command must be validate or render.', `jobs[${index}].command`)
    }
    const input = readManifestRequiredString(job.input, `jobs[${index}].input`)
    const quotationPdf = readManifestOptionalString(job.quotationPdf, `jobs[${index}].quotationPdf`)
    const goodsReceiptPdf = readManifestOptionalString(job.goodsReceiptPdf, `jobs[${index}].goodsReceiptPdf`)
    const outputJson = readManifestOptionalString(job.outputJson, `jobs[${index}].outputJson`)
    const refreshExchangeRates = readManifestOptionalBoolean(job.refreshExchangeRates, `jobs[${index}].refreshExchangeRates`)
    const noNetwork = batchOptions.noNetwork
      ? true
      : readManifestOptionalBoolean(job.noNetwork, `jobs[${index}].noNetwork`)
    const force = batchOptions.force
      ? true
      : readManifestOptionalBoolean(job.force, `jobs[${index}].force`)
    const timeoutMs = job.timeoutMs === undefined
      ? batchOptions.timeoutMs
      : readManifestTimeout(job.timeoutMs, `jobs[${index}].timeoutMs`)

    if (refreshExchangeRates && noNetwork) {
      throw createManifestError('refreshExchangeRates cannot be used when noNetwork is true.', `jobs[${index}]`)
    }
    if (command === 'validate' && (quotationPdf || goodsReceiptPdf || refreshExchangeRates)) {
      throw createManifestError('Validate jobs cannot render PDFs or refresh exchange rates.', `jobs[${index}]`)
    }
    if (command === 'render' && !quotationPdf && !goodsReceiptPdf && !outputJson) {
      throw createManifestError('Render jobs require at least one output.', `jobs[${index}]`)
    }

    return {
      id,
      options: {
        command,
        inputFile: resolveManifestPath(manifestDirectory, input),
        ...(quotationPdf ? { quotationPdf: resolveManifestPath(manifestDirectory, quotationPdf) } : {}),
        ...(goodsReceiptPdf ? { goodsReceiptPdf: resolveManifestPath(manifestDirectory, goodsReceiptPdf) } : {}),
        ...(outputJson ? { outputJson: resolveManifestPath(manifestDirectory, outputJson) } : {}),
        ...(refreshExchangeRates ? { refreshExchangeRates: true as const } : {}),
        ...(noNetwork ? { noNetwork: true as const } : {}),
        ...(force ? { force: true as const } : {}),
        timeoutMs,
      },
    }
  })
}

function assertManifestFields(
  value: Record<string, unknown>,
  allowedFields: readonly string[],
  fieldPath: string,
) {
  const unknownField = Object.keys(value).find(field => !allowedFields.includes(field))
  if (unknownField) throw createManifestError(`Unknown manifest field: ${unknownField}.`, `${fieldPath}.${unknownField}`)
}

function readManifestRequiredString(value: unknown, fieldPath: string) {
  const parsed = readManifestOptionalString(value, fieldPath)
  if (!parsed) throw createManifestError('Manifest path must be a non-empty string.', fieldPath)
  return parsed
}

function readManifestOptionalString(value: unknown, fieldPath: string) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createManifestError('Manifest value must be a non-empty string.', fieldPath)
  }
  return value.trim()
}

function readManifestOptionalBoolean(value: unknown, fieldPath: string) {
  if (value === undefined) return false
  if (typeof value !== 'boolean') throw createManifestError('Manifest value must be a boolean.', fieldPath)
  return value
}

function readManifestTimeout(value: unknown, fieldPath: string) {
  if (!Number.isInteger(value) || Number(value) <= 0 || Number(value) > 600_000) {
    throw createManifestError('Manifest timeoutMs must be an integer from 1 to 600000.', fieldPath)
  }
  return Number(value)
}

function createManifestError(message: string, fieldPath?: string) {
  return new AutomationCliError(
    'manifest_invalid',
    message,
    AUTOMATION_CLI_EXIT_CODES.input,
    fieldPath,
  )
}

function resolveManifestPath(directory: string, filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.join(directory, filePath)
}

async function runControlledAutomationPhase<T>(
  control: AutomationProgressControl,
  timingMs: Record<string, number>,
  phase: string,
  timeoutMs: number,
  operation: () => Promise<T>,
  onTimeout?: () => void,
) {
  await assertAutomationNotCanceled(control, phase)
  await writeAutomationProgress(control, 'running', `${phase}:start`)
  const result = await runTimedAutomationPhase(timingMs, phase, timeoutMs, operation, onTimeout)
  await assertAutomationNotCanceled(control, phase)
  await writeAutomationProgress(control, 'running', `${phase}:complete`)
  return result
}

async function assertAutomationNotCanceled(control: AutomationProgressControl, phase: string) {
  if (!control.cancelFilePath || !await fileExists(control.cancelFilePath)) return
  throw new AutomationCliError(
    'automation_canceled',
    `Automation was canceled before the next phase: ${phase}.`,
    AUTOMATION_CLI_EXIT_CODES.render,
    undefined,
    { phase, cancelFile: control.cancelFilePath },
  )
}

async function writeAutomationProgress(
  control: AutomationProgressControl,
  status: AutomationProgressStatus,
  phase: string,
  counts: { completedJobs?: number; totalJobs?: number } = {},
  error?: AutomationCliError,
) {
  if (!control.progressJsonPath) return
  const completedJobs = counts.completedJobs
  const totalJobs = counts.totalJobs ?? control.totalJobs
  const progress = {
    schemaVersion: 1,
    requestId: control.requestId,
    ...(control.jobRequestId ? { jobRequestId: control.jobRequestId } : {}),
    command: control.command,
    status,
    phase,
    ...(control.jobId ? { jobId: control.jobId } : {}),
    ...(control.jobIndex !== undefined ? { jobIndex: control.jobIndex + 1 } : {}),
    ...(completedJobs !== undefined ? { completedJobs } : {}),
    ...(totalJobs !== undefined ? { totalJobs } : {}),
    ...(error ? { error: toAutomationErrorReport(error) } : {}),
    updatedAt: new Date().toISOString(),
  }
  await writeTextFileAtomically(control.progressJsonPath, `${JSON.stringify(progress, null, 2)}\n`)
  process.stderr.write(`${JSON.stringify({ level: 'info', event: 'automation_progress', ...progress })}\n`)
}

async function writeAutomationProgressSafely(
  control: AutomationProgressControl,
  status: AutomationProgressStatus,
  phase: string,
  error: AutomationCliError,
  counts: { completedJobs?: number; totalJobs?: number } = {},
) {
  try {
    await writeAutomationProgress(control, status, phase, counts, error)
  } catch (progressError) {
    process.stderr.write(`${JSON.stringify({
      level: 'error',
      event: 'automation_progress_write_failed',
      requestId: control.requestId,
      error: getErrorMessage(progressError),
    })}\n`)
  }
}

async function runTimedAutomationPhase<T>(
  timingMs: Record<string, number>,
  phase: string,
  timeoutMs: number,
  operation: () => Promise<T>,
  onTimeout?: () => void,
) {
  const startedAt = performance.now()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          onTimeout?.()
          reject(new AutomationCliError(
            'automation_timeout',
            `Automation phase timed out: ${phase}.`,
            AUTOMATION_CLI_EXIT_CODES.render,
            undefined,
            { phase, timeoutMs },
          ))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
    timingMs[phase] = roundElapsed(startedAt)
  }
}

function roundElapsed(startedAt: number) {
  return Math.round((performance.now() - startedAt) * 100) / 100
}

function toAutomationCliError(
  error: unknown,
  fallbackExitCode: AutomationCliExitCode = AUTOMATION_CLI_EXIT_CODES.internal,
) {
  if (error instanceof AutomationCliError) return error
  if (isFileSystemError(error)) {
    return new AutomationCliError(
      'filesystem_error',
      getErrorMessage(error),
      AUTOMATION_CLI_EXIT_CODES.filesystem,
      undefined,
      { causeCode: error.code },
    )
  }
  return new AutomationCliError('internal_error', getErrorMessage(error), fallbackExitCode)
}

function toAutomationErrorReport(error: AutomationCliError): AutomationErrorReport {
  return {
    code: error.code,
    message: error.message,
    ...(error.fieldPath ? { fieldPath: error.fieldPath } : {}),
    ...(error.details ? { details: error.details } : {}),
  }
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath)
    return true
  } catch (error) {
    if (isFileSystemError(error) && error.code === 'ENOENT') return false
    throw error
  }
}

function isFileSystemError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function waitForQuotationAgentV2(
  window: InstanceType<typeof BrowserWindow>,
  timeoutMs: number,
): Promise<QuotationAutomationApiInfo> {
  return window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const ready = window.quotationAgentReady
      if (!ready) {
        reject(new Error('The quotation automation readiness promise was not installed.'))
        return
      }

      const timeout = window.setTimeout(() => {
        const bodyText = document.body?.innerText?.slice(0, 240) || '(empty document)'
        reject(new Error('Timed out waiting for quotationAgentV2 at ' + window.location.href + ': ' + bodyText))
      }, ${timeoutMs})

      ready.then((info) => {
        window.clearTimeout(timeout)
        if (!window.quotationAgentV2) {
          reject(new Error('quotationAgentV2 was not registered after readiness resolved.'))
          return
        }
        resolve(info)
      }, reject)
    })
  `, true) as Promise<QuotationAutomationApiInfo>
}

async function invokeQuotationAgentV2<T = unknown>(
  window: InstanceType<typeof BrowserWindow>,
  method:
    | 'importQuotationFile'
    | 'refreshExchangeRates'
    | 'validateQuotation'
    | 'exportPdfToFile'
    | 'exportGoodsReceiptPdfToFile'
    | 'serializeQuotation'
    | 'getQuotationSnapshot',
  ...args: string[]
) {
  const serializedArguments = args.map(argument => JSON.stringify(argument)).join(', ')
  return window.webContents.executeJavaScript(`
    window.quotationAgentV2[${JSON.stringify(method)}](${serializedArguments})
  `, true) as Promise<AutomationResult<T>>
}

function assertAgentActionSucceeded<T>(
  result: AutomationResult<T>,
  exitCode: AutomationCliExitCode,
): T {
  if (!result.ok) {
    throw new AutomationCliError(
      result.error.code,
      result.error.message,
      exitCode,
      result.error.fieldPath,
      result.error.details,
    )
  }

  return result.data
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function exportPdf(
  options: ExportQuotationPdfOptions | ExportGoodsReceiptPdfOptions,
  renderMode: 'quotation-print' | 'goods-receipt-print',
  signal?: AbortSignal,
) {
  const filePath = options.filePath
    ? resolveAllowedFilePath(options.filePath, ['.pdf'])
    : await chooseQuotationPdfExportPath(options.defaultFileName)

  if (!filePath) {
    return { canceled: true as const }
  }

  const { filePath: _filePath, ...payload } = options
  const jobId = createPendingQuotationPdfJob(payload)
  const orientation = renderMode === 'quotation-print'
    ? getQuotationDocumentOrientation((options as ExportQuotationPdfOptions).quotation)
    : 'portrait'
  const pdfWindow = createQuotationPdfWindow(orientation)
  const closePdfWindow = () => {
    if (!pdfWindow.isDestroyed()) pdfWindow.destroy()
  }
  signal?.addEventListener('abort', closePdfWindow, { once: true })

  try {
    await raceWithAbort(loadRendererWindow(pdfWindow, {
      mode: renderMode,
      jobId,
    }), signal)
    await raceWithAbort(waitForQuotationPdfReady(jobId), signal)

    const pdfBuffer = await raceWithAbort(pdfWindow.webContents.printToPDF({
      pageSize: 'A4',
      landscape: orientation === 'landscape',
      printBackground: true,
      preferCSSPageSize: false,
    }), signal)

    await writeBufferFileAtomically(filePath, pdfBuffer, { signal })
    signal?.throwIfAborted()

    return {
      canceled: false as const,
      filePath,
    }
  } finally {
    signal?.removeEventListener('abort', closePdfWindow)
    cleanupPendingQuotationPdfJob(jobId)

    closePdfWindow()
  }
}

async function exportPdfForSender(
  event: IpcMainInvokeEvent,
  options: ExportQuotationPdfOptions | ExportGoodsReceiptPdfOptions,
  renderMode: 'quotation-print' | 'goods-receipt-print',
) {
  const abortController = new AbortController()
  const abort = () => abortController.abort()
  event.sender.once('destroyed', abort)

  try {
    return await exportPdf(options, renderMode, abortController.signal)
  } finally {
    event.sender.removeListener('destroyed', abort)
  }
}

function raceWithAbort<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation
  signal.throwIfAborted()

  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    operation.then(
      (value) => {
        signal.removeEventListener('abort', abort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort)
        reject(error)
      },
    )
  })
}

async function chooseQuotationPdfExportPath(defaultPath: string) {
  const result = await dialog.showSaveDialog({
    title: 'Export PDF',
    defaultPath,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  })

  return result.canceled || !result.filePath
    ? null
    : resolveAllowedFilePath(result.filePath, ['.pdf'])
}

async function saveQuotationFile(options: SaveQuotationFileOptions) {
  let filePath = options.filePath

  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title: 'Save quotation',
      defaultPath: options.defaultPath,
      filters: [{ name: 'Quotation JSON', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true as const }
    }

    filePath = resolveAllowedFilePath(result.filePath, ['.json'])
  }

  await writeTextFileAtomically(filePath, options.content)
  return { canceled: false as const, filePath }
}

async function saveLineItemsCsvFile(options: SaveQuotationFileOptions) {
  return saveCsvFile(options, 'Export line items CSV')
}

async function saveLineItemsCsvTemplateFile(options: SaveQuotationFileOptions) {
  return saveCsvFile(options, 'Export CSV template')
}

async function saveLineItemsExcelTemplateFile() {
  const result = await dialog.showSaveDialog({
    title: 'Export Excel template',
    defaultPath: 'quotation-line-items-template.xlsx',
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  })

  if (result.canceled || !result.filePath) {
    return { canceled: true as const }
  }

  const filePath = resolveAllowedFilePath(result.filePath, ['.xlsx'])
  const templatePath = path.join(app.getAppPath(), 'file', 'templates', 'quotation-line-items-template.xlsx')

  await writeFile(filePath, await readFile(templatePath))
  return { canceled: false as const, filePath }
}

async function openTextFile(
  title: string,
  filters: Array<{ name: string; extensions: string[] }>,
  allowedExtensions: readonly string[],
  byteLimit = MAX_TEXT_FILE_BYTES,
) {
  const result = await dialog.showOpenDialog({
    title,
    properties: ['openFile'],
    filters,
  })

  const filePath = result.filePaths[0]

  if (result.canceled || !filePath) {
    return { canceled: true as const }
  }

  const resolvedPath = resolveAllowedFilePath(filePath, allowedExtensions)

  return {
    canceled: false as const,
    filePath: resolvedPath,
    content: await readTextFile(resolvedPath, byteLimit),
  }
}

async function openTextFileAtPath(
  filePath: unknown,
  allowedExtensions: readonly string[],
  byteLimit = MAX_TEXT_FILE_BYTES,
) {
  const resolvedPath = resolveAllowedFilePath(filePath, allowedExtensions)

  return {
    canceled: false as const,
    filePath: resolvedPath,
    content: await readTextFile(resolvedPath, byteLimit),
  }
}

async function openBinaryFile(
  title: string,
  filters: Array<{ name: string; extensions: string[] }>,
) {
  const result = await dialog.showOpenDialog({
    title,
    properties: ['openFile'],
    filters,
  })
  const filePath = result.filePaths[0]

  if (result.canceled || !filePath) {
    return { canceled: true as const }
  }

  return openBinaryFileAtPath(filePath)
}

async function openBinaryFileAtPath(filePath: unknown) {
  const resolvedPath = resolveAllowedFilePath(filePath, ['.xlsx'])
  const metadata = await stat(resolvedPath)
  if (metadata.size > AUTOMATION_LIMITS.lineItemsXlsxBytes) {
    throw new Error(`input_too_large: XLSX file exceeds the ${AUTOMATION_LIMITS.lineItemsXlsxBytes} byte limit.`)
  }

  return {
    canceled: false as const,
    filePath: resolvedPath,
    content: await readFile(resolvedPath),
  }
}

async function openDevAutoImportQuotationFile() {
  if (!process.env.VITE_DEV_SERVER_URL) {
    return { canceled: true as const }
  }

  const filePath = await findDevAutoImportQuotationFile()

  if (!filePath) {
    return { canceled: true as const }
  }

  return {
    canceled: false as const,
    filePath,
    content: await readTextFile(filePath, AUTOMATION_LIMITS.quotationJsonBytes),
  }
}

async function findDevAutoImportQuotationFile() {
  const devFileDirectory = path.resolve(__dirname, '../..', 'file')

  try {
    const entries = await readdir(devFileDirectory, { withFileTypes: true })
    const fileName = entries
      .filter((entry) => entry.isFile() && isDevAutoImportQuotationFileName(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right))
      .at(0)

    return fileName ? path.join(devFileDirectory, fileName) : null
  } catch {
    return null
  }
}

async function saveLibraryFile(options: SaveQuotationFileOptions) {
  let filePath = options.filePath

  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title: 'Save quotation library',
      defaultPath: options.defaultPath,
      filters: [{ name: 'Quotation Library JSON', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true as const }
    }

    filePath = resolveAllowedFilePath(result.filePath, ['.json'])
  }

  await writeTextFileAtomically(filePath, options.content)
  return { canceled: false as const, filePath }
}

async function saveCsvFile(options: SaveQuotationFileOptions, title: string) {
  let filePath = options.filePath

  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title,
      defaultPath: options.defaultPath,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true as const }
    }

    filePath = resolveAllowedFilePath(result.filePath, ['.csv'])
  }

  await writeFile(filePath, options.content, 'utf8')
  return { canceled: false as const, filePath }
}

function createPendingQuotationPdfJob(payload: PdfRenderPayload) {
  const jobId = randomUUID()
  let resolveReady = () => {}

  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve
  })

  pendingQuotationPdfJobs.set(jobId, {
    payload,
    readyPromise,
    resolveReady,
  })

  return jobId
}

function getQuotationPdfPayload(jobId: string) {
  const pendingJob = pendingQuotationPdfJobs.get(jobId)

  if (!pendingJob) {
    throw new Error(`Unknown quotation PDF job: ${jobId}`)
  }

  return pendingJob.payload as QuotationPdfRenderPayload
}

function getGoodsReceiptPdfPayload(jobId: string) {
  const pendingJob = pendingQuotationPdfJobs.get(jobId)

  if (!pendingJob) {
    throw new Error(`Unknown goods receipt PDF job: ${jobId}`)
  }

  return pendingJob.payload as GoodsReceiptPdfRenderPayload
}

function markQuotationPdfReady(jobId: string) {
  const pendingJob = pendingQuotationPdfJobs.get(jobId)

  if (!pendingJob) {
    throw new Error(`Unknown quotation PDF job: ${jobId}`)
  }

  pendingJob.resolveReady()
}

async function waitForQuotationPdfReady(jobId: string) {
  const pendingJob = pendingQuotationPdfJobs.get(jobId)

  if (!pendingJob) {
    throw new Error(`Unknown quotation PDF job: ${jobId}`)
  }

  let timeoutHandle: NodeJS.Timeout | undefined

  try {
    await Promise.race([
      pendingJob.readyPromise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Timed out waiting for quotation PDF render readiness: ${jobId}`))
        }, PDF_RENDER_READY_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

function cleanupPendingQuotationPdfJob(jobId: string) {
  const pendingJob = pendingQuotationPdfJobs.get(jobId)
  pendingQuotationPdfJobs.delete(jobId)
  pendingJob?.resolveReady()
}

app.on('window-all-closed', () => {
  if (!automationCliRunning && process.platform !== 'darwin') {
    app.quit()
  }
})

function decodeFileBuffer(buffer: Buffer): string {
  const bytes = new Uint8Array(buffer)

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buffer)
  }

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer)
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer)
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('gbk').decode(buffer)
  }
}

async function readTextFile(filePath: string, byteLimit = MAX_TEXT_FILE_BYTES) {
  const metadata = await stat(filePath)
  if (metadata.size > byteLimit) {
    throw new Error(`input_too_large: File exceeds the ${byteLimit} byte limit.`)
  }

  return decodeFileBuffer(await readFile(filePath))
}

function secureRendererWindow(window: InstanceType<typeof BrowserWindow>) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })
}

function assertTrustedIpcSender(event: IpcMainInvokeEvent) {
  const senderUrl = event.senderFrame?.url ?? event.sender.getURL()
  if (!isTrustedRendererUrl(senderUrl, {
    devServerUrl: process.env.VITE_DEV_SERVER_URL,
    packagedEntryPath: path.resolve(__dirname, '../../dist/index.html'),
  })) {
    throw new Error('Blocked IPC request from an untrusted renderer.')
  }
}
