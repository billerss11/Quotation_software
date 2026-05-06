import { shallowRef } from 'vue'
import type { Ref } from 'vue'

import { cloneSerializable } from '@/shared/utils/clone'
import type { CompanyProfile } from '@/shared/services/localCompanyProfileStorage'
import { QuotationStorageError } from '@/shared/services/localQuotationStorage'
import type {
  ExportQuotationPdfOptions,
} from '@/shared/contracts/quotationApp'
import type { QuotationRuntime, RuntimeSaveFileResult } from '@/shared/runtime/quotationRuntime'

import type { MajorItemSummary, QuotationDraft, QuotationItem, QuotationTotals, TaxClass } from '../types'
import {
  createLineItemsCsvContent,
  createLineItemsCsvTemplateContent,
  formatCsvImportError,
  parseLineItemsCsvContent,
} from '../utils/lineItemsCsv'
import { createQuotationDocumentFileName } from '../utils/quotationDocumentFileName'
import {
  createQuotationFileContent,
  parseQuotationFileContent,
  QuotationFileError,
} from '../utils/quotationFile'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

interface UseQuotationFileActionsOptions {
  quotation: Ref<QuotationDraft>
  itemSummaries: Ref<MajorItemSummary[]>
  totals: Ref<QuotationTotals>
  companyProfile: Ref<CompanyProfile>
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
      const result = await options.runtime.openQuotationFile()

      if (result.canceled) {
        return
      }

      options.replaceQuotationDraft(parseQuotationFileContent(result.content))
      currentFilePath.value = result.filePath
      options.saveCurrentQuotation()
      statusMessage.value = options.t('quotations.statuses.imported', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getQuotationFileOperationError(error, options.t)
    }
  }

  async function importCsv() {
    try {
      const result = await options.runtime.openLineItemsCsvFile()

      if (result.canceled) {
        return
      }

      options.replaceLineItems(parseCsvLineItems(result.content, options.quotation.value.header.currency, getTaxClasses(options.quotation.value)))
      options.saveCurrentQuotation()
      statusMessage.value = options.t('quotations.statuses.importedCsv', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = formatCsvImportError(error, options.t)
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
    try {
      options.flushPendingEdits?.()
      const result = await options.runtime.exportQuotationDocument(createQuotationPdfExportOptions(
        options.quotation.value,
        options.itemSummaries.value,
        options.totals.value,
        options.companyProfile.value,
      ))

      if (result.canceled) {
        return
      }

      statusMessage.value = result.mode === 'browser-print'
        ? options.t('quotations.statuses.printOpened', { name: getFileName(result.filePath) })
        : options.t('quotations.statuses.exportedPdf', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
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
    hasNativeFileDialogs,
    saveDraft,
    saveDraftAs,
    exportJson,
    importJson,
    importCsv,
    exportCsvTemplate,
    exportCsv,
    exportQuotationPdf,
    handleLogoSelected,
  }
}

function getTaxClasses(quotation: QuotationDraft) {
  return quotation.totalsConfig.taxClasses ?? []
}

function parseCsvLineItems(content: string, currency: string, taxClasses: TaxClass[]) {
  return parseLineItemsCsvContent(content, currency, taxClasses)
}

function createDefaultFileName(quotation: QuotationDraft) {
  return createQuotationDocumentFileName(quotation, 'json')
}

function createQuotationPdfExportOptions(
  quotation: QuotationDraft,
  itemSummaries: MajorItemSummary[],
  totals: QuotationTotals,
  companyProfile: CompanyProfile,
): ExportQuotationPdfOptions {
  return {
    ...cloneSerializable({
      quotation,
      summaries: itemSummaries,
      totals,
      globalMarkupRate: quotation.totalsConfig.globalMarkupRate,
      exchangeRates: quotation.exchangeRates,
      companyProfile,
    }),
    defaultFileName: createQuotationDocumentFileName(quotation, 'pdf'),
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
      case 'missing_quotation':
        return t('quotations.fileErrors.missingQuotation')
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
