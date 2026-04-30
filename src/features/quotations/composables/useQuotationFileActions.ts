import { shallowRef } from 'vue'
import type { Ref, ShallowRef } from 'vue'

import { cloneSerializable } from '@/shared/utils/clone'
import { decodeTextBuffer } from '@/shared/utils/textEncoding'
import type { CompanyProfile } from '@/shared/services/localCompanyProfileStorage'
import { QuotationStorageError } from '@/shared/services/localQuotationStorage'
import type {
  ExportQuotationPdfOptions,
  QuotationAppApi,
} from '@/shared/contracts/quotationApp'

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
  quotationApp?: Partial<QuotationAppApi>
  saveCurrentQuotation: () => void
  replaceQuotationDraft: (draft: QuotationDraft) => void
  replaceLineItems: (items: QuotationItem[]) => void
  setLogoDataUrl: (logoDataUrl: string) => void
  jsonImportInput: ShallowRef<HTMLInputElement | null>
  csvImportInput: ShallowRef<HTMLInputElement | null>
  t: TranslateFn
}

export function useQuotationFileActions(options: UseQuotationFileActionsOptions) {
  const statusMessage = shallowRef('')
  const currentFilePath = shallowRef('')
  const hasNativeFileDialogs = Boolean(options.quotationApp?.saveQuotationFile && options.quotationApp?.openQuotationFile)

  async function saveQuotationToFile(filePath: string, defaultPath = createDefaultFileName(options.quotation.value)) {
    return saveQuotationToFileCore(
      filePath,
      defaultPath,
      options.quotation.value,
      options.quotationApp,
    )
  }

  async function saveDraft() {
    try {
      const result = await saveQuotationToFile(currentFilePath.value)

      if (!result) {
        return
      }

      currentFilePath.value = result.filePath
      options.saveCurrentQuotation()
      statusMessage.value = result.usedDownload
        ? options.t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : options.t('quotations.statuses.saved', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
    }
  }

  async function saveDraftAs() {
    try {
      const result = await saveQuotationToFile('')

      if (!result) {
        return
      }

      currentFilePath.value = result.filePath
      options.saveCurrentQuotation()
      statusMessage.value = result.usedDownload
        ? options.t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : options.t('quotations.statuses.savedAs', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
    }
  }

  async function exportJson() {
    try {
      const result = await saveQuotationToFile('', createDefaultFileName(options.quotation.value))

      if (!result) {
        return
      }

      statusMessage.value = result.usedDownload
        ? options.t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : options.t('quotations.statuses.exported', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
    }
  }

  async function importJson() {
    try {
      const api = getQuotationOpenApi(options.quotationApp)

      if (!api) {
        options.jsonImportInput.value?.click()
        statusMessage.value = options.t('quotations.statuses.chooseJson')
        return
      }

      const result = await api.openQuotationFile()

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
      const api = getCsvFileApi(options.quotationApp)

      if (!api) {
        options.csvImportInput.value?.click()
        statusMessage.value = options.t('quotations.statuses.chooseCsv')
        return
      }

      const result = await api.openLineItemsCsvFile()

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
      const api = getCsvTemplateFileApi(options.quotationApp)

      if (!api) {
        downloadFile(fileName, content, 'text/csv;charset=utf-8')
        statusMessage.value = options.t('quotations.statuses.downloaded', { name: fileName })
        return
      }

      const result = await api.saveLineItemsCsvTemplateFile({
        defaultPath: fileName,
        content,
      })

      if (result.canceled) {
        return
      }

      statusMessage.value = options.t('quotations.statuses.exported', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
    }
  }

  async function exportCsv() {
    const fileName = createQuotationDocumentFileName(options.quotation.value, 'csv')
    const content = createLineItemsCsvContent(options.quotation.value.majorItems, getTaxClasses(options.quotation.value))

    try {
      const api = getCsvFileSaveApi(options.quotationApp)

      if (!api) {
        downloadFile(fileName, content, 'text/csv;charset=utf-8')
        statusMessage.value = options.t('quotations.statuses.downloaded', { name: fileName })
        return
      }

      const result = await api.saveLineItemsCsvFile({
        defaultPath: fileName,
        content,
      })

      if (result.canceled) {
        return
      }

      statusMessage.value = options.t('quotations.statuses.exported', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
    }
  }

  async function exportQuotationPdf() {
    try {
      if (!options.quotationApp?.exportQuotationPdf) {
        throw new Error(options.t('quotations.statuses.fileOperationFailed'))
      }

      const result = await options.quotationApp.exportQuotationPdf(createQuotationPdfExportOptions(
        options.quotation.value,
        options.itemSummaries.value,
        options.totals.value,
        options.companyProfile.value,
      ))

      if (result.canceled) {
        return
      }

      statusMessage.value = options.t('quotations.statuses.exportedPdf', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getFileOperationError(error, options.t)
    }
  }

  async function handleJsonImportFileSelected(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]

    if (!file) {
      return
    }

    try {
      options.replaceQuotationDraft(parseQuotationFileContent(await file.text()))
      currentFilePath.value = file.name
      options.saveCurrentQuotation()
      statusMessage.value = options.t('quotations.statuses.imported', { name: file.name })
    } catch (error) {
      statusMessage.value = getQuotationFileOperationError(error, options.t)
    } finally {
      input.value = ''
    }
  }

  async function handleCsvImportFileSelected(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]

    if (!file) {
      return
    }

    try {
      options.replaceLineItems(parseCsvLineItems(
        decodeTextBuffer(await file.arrayBuffer()),
        options.quotation.value.header.currency,
        getTaxClasses(options.quotation.value),
      ))
      options.saveCurrentQuotation()
      statusMessage.value = options.t('quotations.statuses.importedCsv', { name: file.name })
    } catch (error) {
      statusMessage.value = formatCsvImportError(error, options.t)
    } finally {
      input.value = ''
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
    handleJsonImportFileSelected,
    handleCsvImportFileSelected,
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
  quotationApp?: Partial<QuotationAppApi>,
) {
  const content = createQuotationFileContent(quotation)
  const api = getQuotationSaveApi(quotationApp)

  if (!api) {
    downloadQuotationFile(defaultPath, content)
    return {
      canceled: false as const,
      filePath: defaultPath,
      usedDownload: true,
    }
  }

  const result = await api.saveQuotationFile({
    filePath: filePath || undefined,
    defaultPath,
    content,
  })

  if (result.canceled) {
    return null
  }

  return {
    ...result,
    usedDownload: false,
  }
}

function getFileName(filePath: string) {
  return filePath.split(/[\\/]/).at(-1) || filePath
}

function getQuotationSaveApi(quotationApp?: Partial<QuotationAppApi>) {
  if (!quotationApp?.saveQuotationFile) {
    return null
  }

  return quotationApp as Pick<QuotationAppApi, 'saveQuotationFile'>
}

function getQuotationOpenApi(quotationApp?: Partial<QuotationAppApi>) {
  if (!quotationApp?.openQuotationFile) {
    return null
  }

  return quotationApp as Pick<QuotationAppApi, 'openQuotationFile'>
}

function getCsvFileApi(quotationApp?: Partial<QuotationAppApi>) {
  if (!quotationApp?.openLineItemsCsvFile) {
    return null
  }

  return quotationApp as Pick<QuotationAppApi, 'openLineItemsCsvFile'>
}

function getCsvTemplateFileApi(quotationApp?: Partial<QuotationAppApi>) {
  if (!quotationApp?.saveLineItemsCsvTemplateFile) {
    return null
  }

  return quotationApp as Pick<QuotationAppApi, 'saveLineItemsCsvTemplateFile'>
}

function getCsvFileSaveApi(quotationApp?: Partial<QuotationAppApi>) {
  if (!quotationApp?.saveLineItemsCsvFile) {
    return null
  }

  return quotationApp as Pick<QuotationAppApi, 'saveLineItemsCsvFile'>
}

function downloadQuotationFile(fileName: string, content: string) {
  downloadFile(fileName, content, 'application/json')
}

function downloadFile(fileName: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
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
