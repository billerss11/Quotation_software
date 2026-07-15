import { shallowRef } from 'vue'
import type { Ref } from 'vue'

import { cloneSerializable } from '@/shared/utils/clone'
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
import type { CsvImportIssue, CsvImportWarning } from '../utils/lineItemsCsv'
import { createQuotationDocumentFileName } from '../utils/quotationDocumentFileName'
import {
  createQuotationFileContent,
  parseQuotationFileContent,
  QuotationFileError,
} from '../utils/quotationFile'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string
type OpenQuotationFileResult = Awaited<ReturnType<QuotationRuntime['openQuotationFile']>>
type OpenLineItemsCsvFileResult = Awaited<ReturnType<QuotationRuntime['openLineItemsCsvFile']>>
type ExportQuotationPdfResult = Awaited<ReturnType<QuotationRuntime['exportQuotationDocument']>>
type ApplyQuotationFileResultOptions = {
  rememberFilePath?: boolean
}

export interface LineItemsCsvImportResult {
  ok: boolean
  warnings: string[]
}

export interface CsvImportReportEntry {
  severity: 'error' | 'warning'
  row: number
  column?: string
  message: string
}

export interface CsvImportReport {
  fileName: string
  ok: boolean
  entries: CsvImportReportEntry[]
  agentMessages: string[]
}

interface UseQuotationFileActionsOptions {
  quotation: Ref<QuotationDraft>
  itemSummaries: Ref<MajorItemSummary[]>
  totals: Ref<QuotationTotals>
  flushPendingEdits?: () => void
  runtime: QuotationRuntime
  saveCurrentQuotation: () => void
  replaceQuotationDraft: (draft: QuotationDraft) => void
  replaceLineItems: (items: QuotationItem[]) => void
  setLogoDataUrl: (logoDataUrl: string) => void
  t: TranslateFn
}

export function useQuotationFileActions(options: UseQuotationFileActionsOptions) {
  const statusMessage = shallowRef('')
  const currentFilePath = shallowRef('')
  const csvImportReport = shallowRef<CsvImportReport | null>(null)
  const hasNativeFileDialogs = options.runtime.capabilities.hasNativeFileDialogs

  async function saveQuotationToFile(filePath: string, defaultPath = createDefaultFileName(options.quotation.value)) {
    return saveQuotationToFileCore(filePath, defaultPath, options.quotation.value, options.runtime)
  }

  async function saveDraft() {
    try {
      options.flushPendingEdits?.()
      const result = await saveQuotationToFile(currentFilePath.value)

      if (!result) {
        return
      }

      currentFilePath.value = result.filePath
      options.saveCurrentQuotation()
      statusMessage.value = result.mode === 'download'
        ? options.t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : options.t('quotations.statuses.saved', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
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
      options.saveCurrentQuotation()
      statusMessage.value = result.mode === 'download'
        ? options.t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : options.t('quotations.statuses.savedAs', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
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
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
    }
  }

  async function importJson() {
    try {
      applyQuotationFileResult(await options.runtime.openQuotationFile())
    } catch (error) {
      statusMessage.value = getQuotationFileOperationError(error, options.t)
    }
  }

  async function importJsonFromPath(filePath: string) {
    try {
      return applyQuotationFileResult(await options.runtime.openQuotationFileFromPath(filePath))
    } catch (error) {
      statusMessage.value = getQuotationFileOperationError(error, options.t)
      return false
    }
  }

  async function importJsonContent(content: string, filePath = 'agent-import.json') {
    try {
      return applyQuotationFileResult({ canceled: false, filePath, content }, { rememberFilePath: false })
    } catch (error) {
      statusMessage.value = getQuotationFileOperationError(error, options.t)
      return false
    }
  }

  async function autoImportDevQuotation() {
    try {
      applyQuotationFileResult(await options.runtime.openDevAutoImportQuotationFile())
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
    return true
  }

  async function importCsv() {
    try {
      applyCsvFileResult(await options.runtime.openLineItemsCsvFile())
    } catch (error) {
      handleCsvImportError(error, 'line-items.csv')
    }
  }

  async function importCsvFromPath(filePath: string) {
    try {
      return applyCsvFileResult(await options.runtime.openLineItemsCsvFileFromPath(filePath))
    } catch (error) {
      return handleCsvImportError(error, filePath)
    }
  }

  async function importCsvContent(content: string, filePath = 'agent-import.csv') {
    try {
      return applyCsvFileResult({ canceled: false, filePath, content })
    } catch (error) {
      return handleCsvImportError(error, filePath)
    }
  }

  function applyCsvFileResult(result: OpenLineItemsCsvFileResult): LineItemsCsvImportResult {
    if (result.canceled) {
      return {
        ok: false,
        warnings: [],
      }
    }

    const imported = parseLineItemsCsvImport(result.content, options.quotation.value.header.currency, getTaxClasses(options.quotation.value))
    const fileName = getFileName(result.filePath)
    const report = createCsvImportReport({
      fileName,
      ok: true,
      issues: [],
      warnings: imported.warnings,
    })

    options.replaceLineItems(imported.items)
    options.saveCurrentQuotation()
    csvImportReport.value = report
    statusMessage.value = imported.warnings.length > 0
      ? options.t('quotations.statuses.importedCsvWithWarnings', { name: fileName, count: imported.warnings.length })
      : options.t('quotations.statuses.importedCsv', { name: fileName })

    return {
      ok: true,
      warnings: report.agentMessages,
    }
  }

  function handleCsvImportError(error: unknown, filePath: string): LineItemsCsvImportResult {
    statusMessage.value = formatCsvImportError(error, options.t)

    if (!(error instanceof CsvImportError)) {
      csvImportReport.value = {
        fileName: getFileName(filePath),
        ok: false,
        entries: [{
          severity: 'error',
          row: 1,
          message: statusMessage.value,
        }],
        agentMessages: [statusMessage.value],
      }

      return {
        ok: false,
        warnings: [statusMessage.value],
      }
    }

    const report = createCsvImportReport({
      fileName: getFileName(filePath),
      ok: false,
      issues: error.issues,
      warnings: error.warnings,
    })
    csvImportReport.value = report

    return {
      ok: false,
      warnings: report.agentMessages,
    }
  }

  function createCsvImportReport(optionsForReport: {
    fileName: string
    ok: boolean
    issues: CsvImportIssue[]
    warnings: CsvImportWarning[]
  }): CsvImportReport {
    return {
      fileName: optionsForReport.fileName,
      ok: optionsForReport.ok,
      entries: [
        ...optionsForReport.issues.map((issue): CsvImportReportEntry => ({
          severity: 'error',
          row: issue.row,
          column: issue.column,
          message: formatCsvImportIssue(issue, options.t),
        })),
        ...optionsForReport.warnings.map((warning): CsvImportReportEntry => ({
          severity: 'warning',
          row: warning.row,
          column: warning.column,
          message: formatCsvImportWarning(warning, options.t),
        })),
      ].sort(compareCsvImportReportEntries),
      agentMessages: [
        ...optionsForReport.issues.map(formatCsvImportIssueForAgent),
        ...optionsForReport.warnings.map(formatCsvImportWarningForAgent),
      ],
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
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
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

  async function exportQuotationPdfCore(filePath?: string): Promise<ExportQuotationPdfResult | null> {
    try {
      options.flushPendingEdits?.()
      const result = await options.runtime.exportQuotationDocument(createQuotationPdfExportOptions(
        options.quotation.value,
        options.itemSummaries.value,
        options.totals.value,
        filePath,
      ))

      if (result.canceled) {
        return result
      }

      statusMessage.value = result.mode === 'browser-print'
        ? options.t('quotations.statuses.printOpened', { name: getFileName(result.filePath) })
        : options.t('quotations.statuses.exportedPdf', { name: getFileName(result.filePath) })
      return result
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
      return null
    }
  }

  async function handleLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]

    if (!file) {
      return
    }

    options.setLogoDataUrl(await readFileAsDataUrl(file))
    statusMessage.value = options.t('quotations.statuses.logoAdded')
  }

  return {
    statusMessage,
    currentFilePath,
    csvImportReport,
    hasNativeFileDialogs,
    saveDraft,
    saveDraftAs,
    exportJson,
    importJson,
    importJsonFromPath,
    importJsonContent,
    autoImportDevQuotation,
    importCsv,
    importCsvFromPath,
    importCsvContent,
    exportCsvTemplate,
    exportCsv,
    exportQuotationPdf,
    exportQuotationPdfToFile,
    handleLogoSelected,
  }
}

function getTaxClasses(quotation: QuotationDraft) {
  return quotation.totalsConfig.taxClasses ?? []
}

function compareCsvImportReportEntries(left: CsvImportReportEntry, right: CsvImportReportEntry) {
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
