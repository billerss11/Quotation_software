import { shallowRef } from 'vue'
import type { Ref } from 'vue'

import { cloneSerializable } from '@/shared/utils/clone'
import { AUTOMATION_LIMITS } from '@/shared/contracts/automationLimits'
import { validateLogoDataUrl } from '@/shared/utils/logoDataUrl'
import { QuotationStorageError } from '@/shared/services/localQuotationStorage'
import type {
  ExportQuotationPdfOptions,
} from '@/shared/contracts/quotationApp'
import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'

import type { MajorItemSummary, QuotationDraft, QuotationItem, QuotationTotals } from '../types'
import {
  createLineItemsCsvContent,
  createLineItemsCsvTemplateContent,
  CsvImportError,
  formatCsvImportIssue,
  formatCsvImportIssueForAgent,
  formatCsvImportError,
  formatCsvImportWarning,
  formatCsvImportWarningForAgent,
  parseLineItemsCsvImport,
} from '../utils/lineItemsCsv'
import {
  formatXlsxImportError,
  parseLineItemsXlsxImport,
  XlsxImportError,
} from '../utils/lineItemsXlsx'
import type {
  CsvImportIssue,
  CsvImportMetadata,
  CsvImportWarning,
  ParsedLineItemsCsv,
} from '../utils/lineItemsCsv'
import { createQuotationDocumentFileName } from '../utils/quotationDocumentFileName'
import { updateQuotationMetadata } from '../utils/quotationDraft'
import {
  createQuotationFileContent,
  parseQuotationFileContent,
  QuotationFileError,
} from '../utils/quotationFile'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string
type OpenQuotationFileResult = Awaited<ReturnType<QuotationRuntime['openQuotationFile']>>
type OpenLineItemsCsvFileResult = Awaited<ReturnType<QuotationRuntime['openLineItemsCsvFile']>>
type OpenLineItemsXlsxFileResult = Awaited<ReturnType<QuotationRuntime['openLineItemsXlsxFile']>>
type ExportQuotationPdfResult = Awaited<ReturnType<QuotationRuntime['exportQuotationDocument']>>
type ApplyQuotationFileResultOptions = {
  rememberFilePath?: boolean
  recordActivity?: boolean
}

export interface LineItemsImportResult {
  ok: boolean
  warnings: string[]
}

interface LineItemsImportReportEntry {
  severity: 'error' | 'warning'
  row: number
  column?: string
  code?: CsvImportIssue['code'] | CsvImportWarning['code']
  message: string
}

export interface LineItemsImportReport {
  fileName: string
  ok: boolean
  status: 'ready' | 'imported' | 'failed' | 'canceled'
  entries: LineItemsImportReportEntry[]
  agentMessages: string[]
  rowCount: number
  recognizedColumns: string[]
  ignoredColumns: string[]
}

interface PendingLineItemsImport extends CsvImportMetadata {
  fileName: string
  items: QuotationItem[]
  warnings: CsvImportWarning[]
}

interface UseQuotationFileActionsOptions {
  quotation: Ref<QuotationDraft>
  itemSummaries: Ref<MajorItemSummary[]>
  totals: Ref<QuotationTotals>
  flushPendingEdits?: () => void
  runtime: QuotationRuntime
  saveCurrentQuotation: (updatedAt?: string) => void
  replaceQuotationDraft: (draft: QuotationDraft) => void
  replaceLineItems: (items: QuotationItem[]) => void
  setLogoDataUrl: (logoDataUrl: string) => void
  t: TranslateFn
  recordActivity?: (messageKey: string, params?: Record<string, string | number>) => void
}

export function useQuotationFileActions(options: UseQuotationFileActionsOptions) {
  const statusMessage = shallowRef('')
  const currentFilePath = shallowRef('')
  const lineItemsImportReport = shallowRef<LineItemsImportReport | null>(null)
  const pendingLineItemsImport = shallowRef<PendingLineItemsImport | null>(null)
  const hasNativeFileDialogs = options.runtime.capabilities.hasNativeFileDialogs

  async function saveQuotationToFile(filePath: string, defaultPath = createDefaultFileName(options.quotation.value)) {
    const savedAt = new Date().toISOString()
    const quotationSnapshot = cloneSerializable(options.quotation.value)
    updateQuotationMetadata(quotationSnapshot, savedAt)
    const result = await saveQuotationToFileCore(filePath, defaultPath, quotationSnapshot, options.runtime)

    return result ? { ...result, savedAt } : null
  }

  async function saveDraft() {
    try {
      options.flushPendingEdits?.()
      const result = await saveQuotationToFile(currentFilePath.value)

      if (!result) {
        return
      }

      currentFilePath.value = result.filePath
      updateQuotationMetadata(options.quotation.value, result.savedAt)
      options.saveCurrentQuotation(result.savedAt)
      statusMessage.value = result.mode === 'download'
        ? options.t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : options.t('quotations.statuses.saved', { name: getFileName(result.filePath) })
      recordActivity('quotations.activityHistory.log.saved', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
      recordFileFailure('Save quotation', currentFilePath.value)
    }
  }

  async function saveDraftAs() {
    try {
      options.flushPendingEdits?.()
      const result = await saveQuotationToFile('')

      if (!result) {
        return
      }

      currentFilePath.value = result.filePath
      updateQuotationMetadata(options.quotation.value, result.savedAt)
      options.saveCurrentQuotation(result.savedAt)
      statusMessage.value = result.mode === 'download'
        ? options.t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : options.t('quotations.statuses.savedAs', { name: getFileName(result.filePath) })
      recordActivity('quotations.activityHistory.log.savedAs', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
      recordFileFailure('Save quotation as')
    }
  }

  async function exportJson() {
    try {
      options.flushPendingEdits?.()
      const result = await saveQuotationToFile('', createDefaultFileName(options.quotation.value))

      if (!result) {
        return
      }

      statusMessage.value = result.mode === 'download'
        ? options.t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : options.t('quotations.statuses.exported', { name: getFileName(result.filePath) })
      recordActivity('quotations.activityHistory.log.exportedJson', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
      recordFileFailure('Export quotation JSON')
    }
  }

  async function importJson() {
    try {
      applyQuotationFileResult(await options.runtime.openQuotationFile())
    } catch (error) {
      statusMessage.value = getQuotationFileOperationError(error, options.t)
      recordFileFailure('Import quotation JSON')
    }
  }

  async function importJsonFromPath(filePath: string) {
    try {
      return await importJsonFromPathForAutomation(filePath)
    } catch (error) {
      statusMessage.value = getQuotationFileOperationError(error, options.t)
      return false
    }
  }

  async function importJsonContent(content: string, filePath = 'agent-import.json') {
    try {
      return importJsonContentForAutomation(content, filePath)
    } catch (error) {
      statusMessage.value = getQuotationFileOperationError(error, options.t)
      return false
    }
  }

  async function importJsonFromPathForAutomation(filePath: string) {
    try {
      return applyQuotationFileResult(await options.runtime.openQuotationFileFromPath(filePath))
    } catch (error) {
      recordFileFailure('Import quotation JSON', filePath)
      throw error
    }
  }

  function importJsonContentForAutomation(content: string, filePath = 'agent-import.json') {
    try {
      return applyQuotationFileResult({ canceled: false, filePath, content }, { rememberFilePath: false })
    } catch (error) {
      recordFileFailure('Import quotation JSON', filePath)
      throw error
    }
  }

  async function autoImportDevQuotation() {
    try {
      applyQuotationFileResult(await options.runtime.openDevAutoImportQuotationFile(), { recordActivity: false })
    } catch (error) {
      statusMessage.value = getQuotationFileOperationError(error, options.t)
    }
  }

  function applyQuotationFileResult(
    result: OpenQuotationFileResult,
    applyOptions: ApplyQuotationFileResultOptions = {},
  ) {
    if (result.canceled) {
      return false
    }

    options.replaceQuotationDraft(parseQuotationFileContent(result.content))
    currentFilePath.value = applyOptions.rememberFilePath === false ? '' : result.filePath
    options.saveCurrentQuotation()
    statusMessage.value = options.t('quotations.statuses.imported', { name: getFileName(result.filePath) })
    if (applyOptions.recordActivity !== false) {
      recordActivity('quotations.activityHistory.log.importedJson', { name: getFileName(result.filePath) })
    }
    return true
  }

  async function importCsv() {
    let filePath = 'line-items.csv'
    try {
      const result = await options.runtime.openLineItemsCsvFile()
      if (!result.canceled) {
        filePath = result.filePath
      }
      return prepareCsvFileResult(result)
    } catch (error) {
      handleLineItemsImportError(error, filePath)
      return false
    }
  }

  async function importXlsx() {
    let filePath = 'line-items.xlsx'
    try {
      const result = await options.runtime.openLineItemsXlsxFile()
      if (!result.canceled) {
        filePath = result.filePath
      }
      return await prepareXlsxFileResult(result)
    } catch (error) {
      handleLineItemsImportError(error, filePath)
      return false
    }
  }

  async function importCsvFromPath(filePath: string) {
    try {
      return await importCsvFromPathForAutomation(filePath)
    } catch (error) {
      return handleLineItemsImportError(error, filePath, false)
    }
  }

  async function importCsvContent(content: string, filePath = 'agent-import.csv') {
    try {
      return importCsvContentForAutomation(content, filePath)
    } catch (error) {
      return handleLineItemsImportError(error, filePath, false)
    }
  }

  async function importXlsxFromPath(filePath: string) {
    try {
      return await importXlsxFromPathForAutomation(filePath)
    } catch (error) {
      return handleLineItemsImportError(error, filePath, false)
    }
  }

  async function importXlsxContent(content: Uint8Array, filePath = 'agent-import.xlsx') {
    try {
      return await importXlsxContentForAutomation(content, filePath)
    } catch (error) {
      return handleLineItemsImportError(error, filePath, false)
    }
  }

  async function importCsvFromPathForAutomation(filePath: string) {
    try {
      return applyCsvFileResultImmediately(await options.runtime.openLineItemsCsvFileFromPath(filePath))
    } catch (error) {
      recordFileFailure('Import line items', filePath)
      throw error
    }
  }

  function importCsvContentForAutomation(content: string, filePath = 'agent-import.csv') {
    try {
      return applyCsvFileResultImmediately({ canceled: false, filePath, content })
    } catch (error) {
      recordFileFailure('Import line items', filePath)
      throw error
    }
  }

  async function importXlsxFromPathForAutomation(filePath: string) {
    try {
      return await applyXlsxFileResultImmediately(
        await options.runtime.openLineItemsXlsxFileFromPath(filePath),
      )
    } catch (error) {
      recordFileFailure('Import line items', filePath)
      throw error
    }
  }

  async function importXlsxContentForAutomation(content: Uint8Array, filePath = 'agent-import.xlsx') {
    try {
      return await applyXlsxFileResultImmediately({ canceled: false, filePath, content })
    } catch (error) {
      recordFileFailure('Import line items', filePath)
      throw error
    }
  }

  function prepareCsvFileResult(result: OpenLineItemsCsvFileResult) {
    if (result.canceled) {
      return false
    }

    return prepareLineItemsImport(result.filePath, parseCsvContent(result.content))
  }

  async function prepareXlsxFileResult(result: OpenLineItemsXlsxFileResult) {
    if (result.canceled) {
      return false
    }

    return prepareLineItemsImport(result.filePath, await parseXlsxContent(result.content))
  }

  function prepareLineItemsImport(filePath: string, imported: ParsedLineItemsCsv) {
    const fileName = getFileName(filePath)
    pendingLineItemsImport.value = {
      fileName,
      items: imported.items,
      warnings: imported.warnings,
      rowCount: imported.rowCount,
      recognizedColumns: imported.recognizedColumns,
      ignoredColumns: imported.ignoredColumns,
    }
    lineItemsImportReport.value = createLineItemsImportReport({
      fileName,
      status: 'ready',
      issues: [],
      warnings: imported.warnings,
      metadata: imported,
    })
    statusMessage.value = options.t('quotations.statuses.lineItemsReadyToImport', {
      name: fileName,
      count: imported.rowCount,
    })
    return true
  }

  function confirmLineItemsImport() {
    const pending = pendingLineItemsImport.value
    if (!pending) {
      return false
    }

    options.flushPendingEdits?.()
    applyParsedLineItemsImport(pending)
    pendingLineItemsImport.value = null
    return true
  }

  function cancelLineItemsImport() {
    const hadPendingImport = pendingLineItemsImport.value !== null
    pendingLineItemsImport.value = null
    if (hadPendingImport) {
      if (lineItemsImportReport.value?.status === 'ready') {
        lineItemsImportReport.value = {
          ...lineItemsImportReport.value,
          status: 'canceled',
        }
      }
      statusMessage.value = options.t('quotations.statuses.lineItemsImportCanceled')
    }
  }

  function applyCsvFileResultImmediately(result: OpenLineItemsCsvFileResult): LineItemsImportResult {
    if (result.canceled) {
      return {
        ok: false,
        warnings: [],
      }
    }

    const imported = {
      fileName: getFileName(result.filePath),
      ...parseCsvContent(result.content),
    }
    pendingLineItemsImport.value = null
    return applyParsedLineItemsImport(imported)
  }

  async function applyXlsxFileResultImmediately(
    result: OpenLineItemsXlsxFileResult,
  ): Promise<LineItemsImportResult> {
    if (result.canceled) {
      return {
        ok: false,
        warnings: [],
      }
    }

    const imported = {
      fileName: getFileName(result.filePath),
      ...await parseXlsxContent(result.content),
    }
    pendingLineItemsImport.value = null
    return applyParsedLineItemsImport(imported)
  }

  function parseCsvContent(content: string) {
    return parseLineItemsCsvImport(
      content,
      options.quotation.value.header.currency,
      getTaxClasses(options.quotation.value),
    )
  }

  function parseXlsxContent(content: Uint8Array) {
    return parseLineItemsXlsxImport(
      content,
      options.quotation.value.header.currency,
      getTaxClasses(options.quotation.value),
    )
  }

  function applyParsedLineItemsImport(
    imported: PendingLineItemsImport | (ParsedLineItemsCsv & { fileName: string }),
  ): LineItemsImportResult {
    const report = createLineItemsImportReport({
      fileName: imported.fileName,
      status: 'imported',
      issues: [],
      warnings: imported.warnings,
      metadata: imported,
    })

    options.replaceLineItems(imported.items)
    options.saveCurrentQuotation()
    lineItemsImportReport.value = report
    statusMessage.value = imported.warnings.length > 0
      ? options.t('quotations.statuses.importedLineItemsWithWarnings', {
          name: imported.fileName,
          count: imported.warnings.length,
        })
      : options.t('quotations.statuses.importedLineItems', { name: imported.fileName })
    recordActivity('quotations.activityHistory.log.importedLineItems', {
      name: imported.fileName,
      count: imported.items.length,
    })

    return {
      ok: true,
      warnings: report.agentMessages,
    }
  }

  function handleLineItemsImportError(
    error: unknown,
    filePath: string,
    recordFailure = true,
  ): LineItemsImportResult {
    pendingLineItemsImport.value = null
    statusMessage.value = error instanceof XlsxImportError
      ? formatXlsxImportError(error, options.t)
      : formatCsvImportError(error, options.t)
    if (recordFailure) recordFileFailure('Import line items', filePath)

    if (!(error instanceof CsvImportError)) {
      lineItemsImportReport.value = {
        fileName: getFileName(filePath),
        ok: false,
        status: 'failed',
        entries: [{
          severity: 'error',
          row: error instanceof XlsxImportError ? error.row : 1,
          column: error instanceof XlsxImportError ? error.column : undefined,
          message: statusMessage.value,
        }],
        agentMessages: [statusMessage.value],
        rowCount: 0,
        recognizedColumns: [],
        ignoredColumns: [],
      }

      return {
        ok: false,
        warnings: [statusMessage.value],
      }
    }

    const report = createLineItemsImportReport({
      fileName: getFileName(filePath),
      status: 'failed',
      issues: error.issues,
      warnings: error.warnings,
      metadata: error.metadata,
    })
    lineItemsImportReport.value = report

    return {
      ok: false,
      warnings: report.agentMessages,
    }
  }

  function createLineItemsImportReport(optionsForReport: {
    fileName: string
    status: LineItemsImportReport['status']
    issues: CsvImportIssue[]
    warnings: CsvImportWarning[]
    metadata: CsvImportMetadata
  }): LineItemsImportReport {
    return {
      fileName: optionsForReport.fileName,
      ok: optionsForReport.issues.length === 0,
      status: optionsForReport.status,
      entries: [
        ...optionsForReport.issues.map((issue): LineItemsImportReportEntry => ({
          severity: 'error',
          row: issue.row,
          column: issue.column,
          code: issue.code,
          message: formatCsvImportIssue(issue, options.t),
        })),
        ...optionsForReport.warnings.map((warning): LineItemsImportReportEntry => ({
          severity: 'warning',
          row: warning.row,
          column: warning.column,
          code: warning.code,
          message: formatCsvImportWarning(warning, options.t),
        })),
      ].sort(compareLineItemsImportReportEntries),
      agentMessages: [
        ...optionsForReport.issues.map(formatCsvImportIssueForAgent),
        ...optionsForReport.warnings.map(formatCsvImportWarningForAgent),
      ],
      rowCount: optionsForReport.metadata.rowCount,
      recognizedColumns: optionsForReport.metadata.recognizedColumns,
      ignoredColumns: optionsForReport.metadata.ignoredColumns,
    }
  }

  async function exportCsvTemplate() {
    const fileName = 'quotation-line-items-template.csv'
    const content = createLineItemsCsvTemplateContent()

    try {
      const result = await options.runtime.saveLineItemsCsvTemplateFile({
        defaultPath: fileName,
        content,
      })

      if (result.canceled) {
        return
      }

      statusMessage.value = result.mode === 'download'
        ? options.t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : options.t('quotations.statuses.exported', { name: getFileName(result.filePath) })
      recordActivity('quotations.activityHistory.log.exportedCsv', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
      recordFileFailure('Export quotation CSV', fileName)
    }
  }

  async function exportExcelTemplate() {
    try {
      const result = await options.runtime.saveLineItemsExcelTemplateFile()

      if (result.canceled) {
        statusMessage.value = options.t('quotations.statuses.excelTemplateDownloadCanceled')
        return
      }

      statusMessage.value = result.mode === 'download'
        ? options.t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : options.t('quotations.statuses.exported', { name: getFileName(result.filePath) })
    } catch {
      statusMessage.value = options.t('quotations.statuses.excelTemplateDownloadFailed')
    }
  }

  async function exportCsv() {
    const fileName = createQuotationDocumentFileName(options.quotation.value, 'csv')
    options.flushPendingEdits?.()
    const content = createLineItemsCsvContent(options.quotation.value.majorItems, getTaxClasses(options.quotation.value))

    try {
      const result = await options.runtime.saveLineItemsCsvFile({
        defaultPath: fileName,
        content,
      })

      if (result.canceled) {
        return
      }

      statusMessage.value = result.mode === 'download'
        ? options.t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : options.t('quotations.statuses.exported', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
    }
  }

  async function exportQuotationPdf() {
    await exportQuotationPdfCore()
  }

  async function exportQuotationPdfToFile(filePath: string) {
    if (!options.runtime.capabilities.supportsDirectPdfExport || filePath.trim().length === 0) {
      statusMessage.value = options.t('quotations.statuses.fileOperationFailed')
      return null
    }

    return exportQuotationPdfCore(filePath)
  }

  async function exportQuotationPdfToFileForAutomation(filePath: string) {
    if (!options.runtime.capabilities.supportsDirectPdfExport || filePath.trim().length === 0) {
      recordFileFailure('Export quotation PDF', filePath)
      throw new Error('Direct quotation PDF export is not available for this path.')
    }

    try {
      return await performQuotationPdfExport(filePath)
    } catch (error) {
      recordFileFailure('Export quotation PDF', filePath)
      throw error
    }
  }

  async function exportQuotationPdfCore(filePath?: string): Promise<ExportQuotationPdfResult | null> {
    try {
      return await performQuotationPdfExport(filePath)
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
      recordFileFailure('Export quotation PDF', filePath)
      return null
    }
  }

  async function performQuotationPdfExport(filePath?: string): Promise<ExportQuotationPdfResult> {
    options.flushPendingEdits?.()
    const result = await options.runtime.exportQuotationDocument(createQuotationPdfExportOptions(
      options.quotation.value,
      options.itemSummaries.value,
      options.totals.value,
      filePath,
    ))

    if (!result.canceled) {
      statusMessage.value = result.mode === 'browser-print'
        ? options.t('quotations.statuses.printOpened', { name: getFileName(result.filePath) })
        : options.t('quotations.statuses.exportedPdf', { name: getFileName(result.filePath) })
      recordActivity('quotations.activityHistory.log.exportedPdf', { name: getFileName(result.filePath) })
    }

    return result
  }

  async function saveQuotationToPath(filePath: string, rememberFilePath = true) {
    try {
      options.flushPendingEdits?.()
      const result = await saveQuotationToFile(filePath)
      if (!result) return null

      if (rememberFilePath) {
        currentFilePath.value = result.filePath
      }
      updateQuotationMetadata(options.quotation.value, result.savedAt)
      options.saveCurrentQuotation(result.savedAt)
      statusMessage.value = options.t('quotations.statuses.saved', { name: getFileName(result.filePath) })
      recordActivity('quotations.activityHistory.log.saved', { name: getFileName(result.filePath) })
      return result
    } catch (error) {
      recordFileFailure('Save quotation', filePath)
      throw error
    }
  }

  async function handleLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]

    if (!file) {
      return
    }

    if (file.size > AUTOMATION_LIMITS.logoBytes) {
      statusMessage.value = options.t('quotations.statuses.logoTooLarge')
      return
    }

    const logoDataUrl = await readFileAsDataUrl(file)
    const validation = validateLogoDataUrl(logoDataUrl)
    if (!validation.ok) {
      statusMessage.value = options.t(validation.code === 'image_dimensions_too_large'
        ? 'quotations.statuses.logoDimensionsTooLarge'
        : validation.code === 'input_too_large'
          ? 'quotations.statuses.logoTooLarge'
          : 'quotations.statuses.logoInvalid')
      return
    }

    options.setLogoDataUrl(logoDataUrl)
    statusMessage.value = options.t('quotations.statuses.logoAdded')
  }

  function recordActivity(messageKey: string, params?: Record<string, string | number>) {
    try {
      options.recordActivity?.(messageKey, params)
    } catch (error) {
      console.warn('Could not write activity history.', error)
    }
  }

  function recordFileFailure(operation: string, filePath = '') {
    recordActivity('quotations.activityHistory.log.fileOperationFailed', {
      operation,
      name: getFileName(filePath) || 'unknown file',
    })
  }

  return {
    statusMessage,
    currentFilePath,
    lineItemsImportReport,
    pendingLineItemsImport,
    hasNativeFileDialogs,
    saveDraft,
    saveDraftAs,
    exportJson,
    importJson,
    importJsonFromPath,
    importJsonContent,
    importJsonFromPathForAutomation,
    importJsonContentForAutomation,
    autoImportDevQuotation,
    importCsv,
    importXlsx,
    confirmLineItemsImport,
    cancelLineItemsImport,
    importCsvFromPath,
    importCsvContent,
    importXlsxFromPath,
    importXlsxContent,
    importCsvFromPathForAutomation,
    importCsvContentForAutomation,
    importXlsxFromPathForAutomation,
    importXlsxContentForAutomation,
    exportCsvTemplate,
    exportExcelTemplate,
    exportCsv,
    exportQuotationPdf,
    exportQuotationPdfToFile,
    exportQuotationPdfToFileForAutomation,
    saveQuotationToPath,
    handleLogoSelected,
  }
}

function getTaxClasses(quotation: QuotationDraft) {
  return quotation.totalsConfig.taxClasses ?? []
}

function compareLineItemsImportReportEntries(
  left: LineItemsImportReportEntry,
  right: LineItemsImportReportEntry,
) {
  if (left.row !== right.row) {
    return left.row - right.row
  }

  if (left.severity !== right.severity) {
    return left.severity === 'error' ? -1 : 1
  }

  return (left.column ?? '').localeCompare(right.column ?? '')
}

function createDefaultFileName(quotation: QuotationDraft) {
  return createQuotationDocumentFileName(quotation, 'json')
}

function createQuotationPdfExportOptions(
  quotation: QuotationDraft,
  itemSummaries: MajorItemSummary[],
  totals: QuotationTotals,
  filePath?: string,
): ExportQuotationPdfOptions {
  return {
    ...cloneSerializable({
      quotation,
      summaries: itemSummaries,
      totals,
      globalMarkupRate: quotation.totalsConfig.globalMarkupRate,
      exchangeRates: quotation.exchangeRates,
      companyProfile: quotation.companyProfileSnapshot,
    }),
    defaultFileName: createQuotationDocumentFileName(quotation, 'pdf'),
    ...(filePath ? { filePath } : {}),
  }
}

async function saveQuotationToFileCore(
  filePath: string,
  defaultPath: string,
  quotation: QuotationDraft,
  runtime: QuotationRuntime,
) {
  const content = createQuotationFileContent(quotation)
  const result = await runtime.saveQuotationFile({
    filePath: filePath || undefined,
    defaultPath,
    content,
  })

  if (result.canceled) {
    return null
  }

  return result
}

function getFileName(filePath: string) {
  return filePath.split(/[\\/]/).at(-1) || filePath
}

function getFileOperationError(error: unknown, t: TranslateFn) {
  if (error instanceof QuotationStorageError) {
    return getStorageOperationError(error, t)
  }

  return error instanceof Error ? error.message : t('quotations.statuses.fileOperationFailed')
}

function getQuotationFileOperationError(error: unknown, t: TranslateFn) {
  if (error instanceof QuotationFileError) {
    switch (error.code) {
      case 'invalid_envelope':
        return t('quotations.fileErrors.invalidEnvelope')
      case 'unsupported_schema':
        return t('quotations.fileErrors.unsupportedSchema')
      case 'missing_quotation':
        return t('quotations.fileErrors.missingQuotation')
      case 'invalid_quotation':
        return t('quotations.fileErrors.invalidQuotation')
      case 'unsupported_currency':
        return t('quotations.fileErrors.unsupportedCurrency')
      case 'invalid_json':
        return t('quotations.fileErrors.invalidJson')
      case 'not_object':
        return t('quotations.fileErrors.notObject')
    }
  }

  return error instanceof Error ? error.message : t('quotations.statuses.importQuotationFailed')
}

function getStorageOperationError(error: unknown, t: TranslateFn) {
  if (error instanceof QuotationStorageError) {
    return error.code === 'quota_exceeded'
      ? t('quotations.statuses.draftStorageQuotaExceeded')
      : t('quotations.statuses.draftStorageFailed')
  }

  return t('quotations.statuses.draftStorageFailed')
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsDataURL(file)
  })
}
