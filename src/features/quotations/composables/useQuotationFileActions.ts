import { shallowRef } from 'vue'
import type { Ref } from 'vue'

import { cloneSerializable } from '@/shared/utils/clone'
import { AUTOMATION_LIMITS } from '@/shared/contracts/automationLimits'
import { validateLogoDataUrl } from '@/shared/utils/logoDataUrl'
import { discardQuotationDraftRecovery, QuotationStorageError } from '@/shared/services/localQuotationStorage'
import type {
  ExportQuotationPdfOptions,
} from '@/shared/contracts/quotationApp'
import type { QuotationRuntime, RuntimeSaveFileResult } from '@/shared/runtime/quotationRuntime'

import type { MajorItemSummary, QuotationDocument, QuotationDraft, QuotationItem, QuotationRevision, QuotationTotals } from '../types'
import { QuotationRevisionError } from './useQuotationRevisions'
import { proposeQuotationRevision, QuotationRevisionProposalError } from '../utils/quotationRevisions'
import { createQuotationSnapshotPayload } from '../utils/quotationSnapshotPayload'
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
import { resizeLogoDataUrl } from '../utils/logoImage'
import { createQuotationDocumentFileName } from '../utils/quotationDocumentFileName'
import type { QuotationExcelExportMode } from '../utils/quotationExcelExport'
import { updateQuotationMetadata } from '../utils/quotationDraft'
import {
  QuotationOutputError,
  assertQuotationReadyForOutput,
  assertQuotationInformationalTotalsReadyForOutput,
} from '../utils/quotationOutputValidation'
import {
  createQuotationFileContent,
  parseQuotationDocumentContent,
  QuotationFileError,
} from '../utils/quotationFile'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string
type OpenQuotationFileResult = Awaited<ReturnType<QuotationRuntime['openQuotationFile']>>
type OpenLineItemsCsvFileResult = Awaited<ReturnType<QuotationRuntime['openLineItemsCsvFile']>>
type OpenLineItemsXlsxFileResult = Awaited<ReturnType<QuotationRuntime['openLineItemsXlsxFile']>>
type ExportQuotationPdfResult = Awaited<ReturnType<QuotationRuntime['exportQuotationDocument']>>
type SavedQuotationFileResult = Exclude<RuntimeSaveFileResult, { canceled: true }> & { savedAt: string }
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
  quotationRevisions?: Ref<QuotationRevision[]>
  revisionHistoryUnavailable?: Ref<boolean>
  isQuotationRevisionBusy?: Ref<boolean>
  replaceQuotationDocument?: (document: QuotationDocument) => void
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
  const quotationRevisions = options.quotationRevisions ?? shallowRef<QuotationRevision[]>([])
  const revisionHistoryUnavailable = options.revisionHistoryUnavailable ?? shallowRef(false)
  const isQuotationRevisionBusy = options.isQuotationRevisionBusy ?? shallowRef(false)

  function assertNotBusy() {
    if (isQuotationRevisionBusy.value) throw new QuotationRevisionError('operation_in_progress')
  }

  function assertHistoryAvailable() {
    if (revisionHistoryUnavailable.value) throw new QuotationRevisionError('history_unavailable')
  }

  function serializeQuotationDocument() {
    assertNotBusy()
    assertHistoryAvailable()
    return createQuotationFileContent(options.quotation.value, quotationRevisions.value)
  }

  function getQuotationRevision(id: string) {
    assertHistoryAvailable()
    const revision = quotationRevisions.value.find((entry) => entry.id === id)
    if (!revision) throw new QuotationRevisionError('revision_not_found')
    return cloneSerializable(revision)
  }

  function cachePersistedQuotation(savedAt?: string, hasDurableSource = true) {
    try {
      options.saveCurrentQuotation(savedAt)
      return false
    } catch (cacheError) {
      if (!hasDurableSource) throw cacheError
      try {
        discardQuotationDraftRecovery(options.quotation.value.id)
      } catch (error) {
        console.warn('Could not clear stale quotation recovery after saving the file.', error)
      }
      return true
    }
  }

  function replaceDocument(document: QuotationDocument) {
    if (options.replaceQuotationDocument) {
      options.replaceQuotationDocument(document)
    } else {
      const revisions = cloneSerializable(document.revisions)
      options.replaceQuotationDraft(document.quotation)
      quotationRevisions.value = revisions
      revisionHistoryUnavailable.value = false
    }
  }

  async function saveQuotationToFile(filePath: string, defaultPath = createDefaultFileName(options.quotation.value)) {
    assertNotBusy()
    assertHistoryAvailable()
    assertQuotationReadyForOutput(options.quotation.value)
    const savedAt = new Date().toISOString()
    const quotationSnapshot = cloneSerializable(options.quotation.value)
    updateQuotationMetadata(quotationSnapshot, savedAt)
    isQuotationRevisionBusy.value = true
    try {
      const result = await saveQuotationToFileCore(filePath, defaultPath, quotationSnapshot, options.runtime, quotationRevisions.value)
      return result ? { ...result, savedAt } : null
    } finally {
      isQuotationRevisionBusy.value = false
    }
  }

  async function createQuotationRevision(input: { note?: string; filePath?: string } = {}, allowDialog = false) {
    return persistQuotationRevision(input, undefined, allowDialog)
  }

  async function restoreQuotationRevision(id: string, input: { filePath?: string } = {}, allowDialog = false) {
    return persistQuotationRevision(input, id, allowDialog)
  }

  async function deleteQuotationRevision(id: string, input: { filePath?: string } = {}, allowDialog = false) {
    assertNotBusy()
    assertHistoryAvailable()
    if (!options.runtime.capabilities.isDesktop) throw new QuotationRevisionError('unsupported_operation')
    if (typeof id !== 'string' || !id.trim()
      || (input.filePath !== undefined && (typeof input.filePath !== 'string' || !input.filePath.trim()))) {
      throw new QuotationRevisionError('invalid_argument')
    }
    const deletedRevision = getQuotationRevision(id)
    const filePath = input.filePath ?? currentFilePath.value
    if (!filePath && !allowDialog) throw new QuotationRevisionError('invalid_argument')
    options.flushPendingEdits?.()
    assertQuotationReadyForOutput(options.quotation.value)
    const savedAt = new Date().toISOString()
    const quotationSnapshot = cloneSerializable(options.quotation.value)
    updateQuotationMetadata(quotationSnapshot, savedAt)
    const remainingRevisions = quotationRevisions.value.filter(entry => entry.id !== id)
    const content = createQuotationFileContent(quotationSnapshot, remainingRevisions)
    parseQuotationDocumentContent(content)

    isQuotationRevisionBusy.value = true
    try {
      let result
      try {
        result = await options.runtime.saveQuotationFile({
          filePath: filePath || undefined,
          defaultPath: createDefaultFileName(options.quotation.value),
          content,
        })
      } catch {
        throw new QuotationRevisionError('file_write_failed')
      }
      if (result.canceled) return null
      quotationRevisions.value = remainingRevisions
      currentFilePath.value = result.filePath
      updateQuotationMetadata(options.quotation.value, savedAt)
      const cacheWarning = cachePersistedQuotation(savedAt)
      statusMessage.value = options.t(cacheWarning
        ? 'quotations.revisions.cacheWarning'
        : 'quotations.revisions.deleted', { number: deletedRevision.revisionNumber })
      return { filePath: result.filePath, savedAt, ...(cacheWarning ? { cacheWarning: true } : {}) }
    } finally {
      isQuotationRevisionBusy.value = false
    }
  }

  async function persistQuotationRevision(
    input: { note?: string; filePath?: string },
    restoreRevisionId: string | undefined,
    allowDialog: boolean,
  ) {
    assertNotBusy()
    assertHistoryAvailable()
    if (!options.runtime.capabilities.isDesktop) throw new QuotationRevisionError('unsupported_operation')
    if ((input.filePath !== undefined && (typeof input.filePath !== 'string' || !input.filePath.trim()))
      || (input.note !== undefined && typeof input.note !== 'string')) {
      throw new QuotationRevisionError('invalid_argument')
    }
    if (restoreRevisionId !== undefined) getQuotationRevision(restoreRevisionId)
    const filePath = input.filePath ?? currentFilePath.value
    if (!filePath && !allowDialog) throw new QuotationRevisionError('invalid_argument')
    options.flushPendingEdits?.()
    assertQuotationReadyForOutput(options.quotation.value)
    const savedAt = new Date().toISOString()
    let staged: QuotationDocument
    try {
      staged = proposeQuotationRevision(
        { quotation: options.quotation.value, revisions: quotationRevisions.value },
        { note: input.note, restoreRevisionId },
        savedAt,
      )
    } catch (error) {
      if (error instanceof QuotationRevisionProposalError) throw new QuotationRevisionError('invalid_argument')
      throw error
    }
    assertQuotationReadyForOutput(staged.quotation)
    // Build and size-check the entire immutable file before starting any side effects.
    const content = createQuotationFileContent(staged.quotation, staged.revisions)
    parseQuotationDocumentContent(content)
    isQuotationRevisionBusy.value = true
    try {
      let result
      try {
        result = await options.runtime.saveQuotationFile({
          filePath: filePath || undefined,
          defaultPath: createDefaultFileName(options.quotation.value),
          content,
        })
      } catch {
        throw new QuotationRevisionError('file_write_failed')
      }
      if (result.canceled) return null
      replaceDocument(staged)
      currentFilePath.value = result.filePath
      const cacheWarning = cachePersistedQuotation(savedAt)
      statusMessage.value = options.t(cacheWarning
        ? 'quotations.revisions.cacheWarning'
        : restoreRevisionId ? 'quotations.revisions.restored' : 'quotations.revisions.created',
      { number: staged.quotation.header.revisionNumber ?? 1 })
      return { filePath: result.filePath, savedAt, ...(cacheWarning ? { cacheWarning: true } : {}) }
    } finally {
      isQuotationRevisionBusy.value = false
    }
  }

  function showRevisionError(error: unknown) {
    statusMessage.value = getQuotationFileOperationError(error, options.t)
  }

  function completeRegularQuotationSave(
    result: SavedQuotationFileResult,
    completion: {
      rememberFilePath: boolean
      successStatusKey: string
      activityKey: string
      showDownloadStatus: boolean
    },
  ) {
    if (completion.rememberFilePath) {
      currentFilePath.value = result.filePath
    }
    updateQuotationMetadata(options.quotation.value, result.savedAt)
    const cacheWarning = cachePersistedQuotation(
      result.savedAt,
      result.mode === 'native' || result.mode === 'file-system-access',
    )
    statusMessage.value = cacheWarning
      ? options.t('quotations.revisions.cacheWarning')
      : completion.showDownloadStatus && result.mode === 'download'
        ? options.t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : options.t(completion.successStatusKey, { name: getFileName(result.filePath) })
    recordActivity(completion.activityKey, { name: getFileName(result.filePath) })
  }

  async function saveDraft() {
    try {
      options.flushPendingEdits?.()
      const result = await saveQuotationToFile(currentFilePath.value)

      if (!result) {
        return
      }

      completeRegularQuotationSave(result, {
        rememberFilePath: true,
        successStatusKey: 'quotations.statuses.saved',
        activityKey: 'quotations.activityHistory.log.saved',
        showDownloadStatus: true,
      })
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

      completeRegularQuotationSave(result, {
        rememberFilePath: true,
        successStatusKey: 'quotations.statuses.savedAs',
        activityKey: 'quotations.activityHistory.log.savedAs',
        showDownloadStatus: true,
      })
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

    assertNotBusy()
    const document = parseQuotationDocumentContent(result.content)
    replaceDocument(document)
    currentFilePath.value = applyOptions.rememberFilePath === false ? '' : result.filePath
    const cacheWarning = cachePersistedQuotation(undefined,
      options.runtime.capabilities.isDesktop && applyOptions.rememberFilePath !== false)
    statusMessage.value = cacheWarning
      ? options.t('quotations.revisions.cacheOpenedWarning')
      : options.t('quotations.statuses.imported', { name: getFileName(result.filePath) })
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

  async function exportQuotationExcel(mode: QuotationExcelExportMode = 'customer', quotationRevisionId?: string) {
    try {
      assertNotBusy()
      if (!quotationRevisionId) options.flushPendingEdits?.()
      const quotation = cloneSerializable(quotationRevisionId
        ? getQuotationRevision(quotationRevisionId).quotation
        : options.quotation.value)
      assertQuotationReadyForOutput(quotation)
      const { createQuotationExcelWorkbook } = await import('../utils/quotationExcelExport')
      const defaultPath = createQuotationDocumentFileName(quotation, 'xlsx')
        .replace(/\.xlsx$/, `-${mode === 'internal' ? 'Internal' : 'Customer'}.xlsx`)
      const result = await options.runtime.saveQuotationExcelFile({
        defaultPath,
        locale: quotation.header.documentLocale,
        content: createQuotationExcelWorkbook(quotation, mode, quotation.header.documentLocale),
      })
      if (!result.canceled) {
        statusMessage.value = options.t('quotations.excel.exported', { name: getFileName(result.filePath) })
        recordActivity('quotations.excel.exported', { name: getFileName(result.filePath) })
      }
      return result
    } catch (error) {
      statusMessage.value = error instanceof QuotationOutputError || error instanceof QuotationRevisionError
        ? getFileOperationError(error, options.t)
        : options.t('quotations.excel.failed')
      recordFileFailure('Export quotation Excel')
      return null
    }
  }

  async function exportQuotationPdfToFile(filePath: string) {
    if (!options.runtime.capabilities.supportsDirectPdfExport || filePath.trim().length === 0) {
      statusMessage.value = options.t('quotations.statuses.fileOperationFailed')
      return null
    }

    return exportQuotationPdfCore(filePath)
  }

  async function exportQuotationPdfToFileForAutomation(filePath: string, quotationRevisionId?: string) {
    if (!options.runtime.capabilities.supportsDirectPdfExport || filePath.trim().length === 0) {
      recordFileFailure('Export quotation PDF', filePath)
      throw new Error('Direct quotation PDF export is not available for this path.')
    }

    try {
      return await performQuotationPdfExport(filePath, quotationRevisionId)
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

  async function exportRevisionPdf(id: string) {
    try {
      return await performQuotationPdfExport(undefined, id)
    } catch (error) {
      showRevisionError(error)
      return null
    }
  }

  async function performQuotationPdfExport(filePath?: string, quotationRevisionId?: string): Promise<ExportQuotationPdfResult> {
    assertNotBusy()
    if (!quotationRevisionId) {
      options.flushPendingEdits?.()
      assertQuotationReadyForOutput(options.quotation.value)
    }
    const payload = quotationRevisionId
      ? { ...createQuotationSnapshotPayload(getQuotationRevision(quotationRevisionId).quotation), ...(filePath ? { filePath } : {}) }
      : createQuotationPdfExportOptions(options.quotation.value, options.itemSummaries.value, options.totals.value, filePath)
    assertQuotationInformationalTotalsReadyForOutput(payload.quotation)
    const result = await options.runtime.exportQuotationDocument(payload)

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

      completeRegularQuotationSave(result, {
        rememberFilePath,
        successStatusKey: 'quotations.statuses.saved',
        activityKey: 'quotations.activityHistory.log.saved',
        showDownloadStatus: false,
      })
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

    let logoDataUrl = await readFileAsDataUrl(file)
    let validation = validateLogoDataUrl(logoDataUrl)
    let resizedLogo: Awaited<ReturnType<typeof resizeLogoDataUrl>> | null = null

    if (!validation.ok && validation.code === 'image_dimensions_too_large') {
      try {
        resizedLogo = await resizeLogoDataUrl(logoDataUrl, AUTOMATION_LIMITS.logoDimensionPixels)
        logoDataUrl = resizedLogo.dataUrl
        validation = validateLogoDataUrl(logoDataUrl)
      } catch {
        // Keep the original validation error when the browser cannot resize the image.
      }
    }

    if (!validation.ok) {
      statusMessage.value = options.t(validation.code === 'image_dimensions_too_large'
        ? 'quotations.statuses.logoDimensionsTooLarge'
        : validation.code === 'input_too_large'
          ? 'quotations.statuses.logoTooLarge'
          : 'quotations.statuses.logoInvalid')
      return
    }

    options.setLogoDataUrl(logoDataUrl)
    statusMessage.value = resizedLogo
      ? options.t('quotations.statuses.logoResized', {
          originalWidth: resizedLogo.originalWidth,
          originalHeight: resizedLogo.originalHeight,
          width: resizedLogo.width,
          height: resizedLogo.height,
        })
      : options.t('quotations.statuses.logoAdded')
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
    serializeQuotationDocument,
    createQuotationRevision,
    restoreQuotationRevision,
    deleteQuotationRevision,
    getQuotationRevision,
    exportRevisionPdf,
    exportPdfToPath: exportQuotationPdfToFileForAutomation,
    showRevisionError,
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
    exportQuotationExcel,
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
  revisions: readonly QuotationRevision[] = [],
) {
  const content = createQuotationFileContent(quotation, revisions)
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
  if (error instanceof QuotationOutputError) {
    return error.messageKey ? t(error.messageKey, error.params) : t('quotations.statuses.quotationNumberRequired')
  }
  if (error instanceof QuotationRevisionError || error instanceof QuotationFileError || error instanceof QuotationRevisionProposalError) {
    return getQuotationFileOperationError(error, t)
  }
  if (error instanceof QuotationStorageError) {
    return getStorageOperationError(error, t)
  }

  return error instanceof Error ? error.message : t('quotations.statuses.fileOperationFailed')
}

function getQuotationFileOperationError(error: unknown, t: TranslateFn) {
  if (error instanceof QuotationOutputError) return error.messageKey ? t(error.messageKey, error.params) : t('quotations.statuses.quotationNumberRequired')
  if (error instanceof QuotationRevisionProposalError) return t('quotations.revisions.invalidArgument')
  if (error instanceof QuotationRevisionError) {
    const keys = {
      history_unavailable: 'historyUnavailable',
      operation_in_progress: 'operationInProgress',
      revision_not_found: 'revisionNotFound',
      invalid_argument: 'invalidArgument',
      unsupported_operation: 'desktopOnly',
      file_write_failed: 'saveFailed',
    } as const
    return t(`quotations.revisions.${keys[error.code]}`)
  }
  if (error instanceof QuotationFileError) {
    switch (error.code) {
      case 'invalid_revisions':
        return t('quotations.revisions.invalidHistory')
      case 'input_too_large':
        return t('quotations.revisions.inputTooLarge')
      case 'invalid_envelope':
        return t('quotations.fileErrors.invalidEnvelope')
      case 'unsupported_schema':
        return t('quotations.fileErrors.unsupportedSchema')
      case 'missing_quotation':
        return t('quotations.fileErrors.missingQuotation')
      case 'invalid_quotation':
        return t('quotations.fileErrors.invalidQuotation')
      case 'duplicate_id':
        return t('quotations.fileErrors.duplicateItemId')
      case 'duplicate_currency':
        return t('quotations.fileErrors.duplicateCurrency')
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
