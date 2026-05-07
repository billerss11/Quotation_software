import { shallowRef } from 'vue'

import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'
import {
  createDefaultReusableLibraryData,
  loadReusableLibraryData,
  replaceReusableLibraryData,
} from '@/shared/services/reusableLibraryStore'
import {
  createQuotationLibraryFileContent,
  parseQuotationLibraryFileContent,
  QuotationLibraryFileError,
} from '@/shared/services/quotationLibraryFile'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export function useQuotationLibraryFileActions(options: {
  runtime: QuotationRuntime
  t: TranslateFn
}) {
  const currentLibraryFilePath = shallowRef('')
  const statusMessage = shallowRef('')

  async function openLibrary() {
    try {
      const result = await options.runtime.openLibraryFile()

      if (result.canceled) {
        return
      }

      replaceReusableLibraryData(parseQuotationLibraryFileContent(result.content))
      currentLibraryFilePath.value = result.filePath
      statusMessage.value = options.t('settings.library.statuses.opened', {
        name: getFileName(result.filePath),
      })
    } catch (error) {
      statusMessage.value = getLibraryFileOperationError(error, options.t)
    }
  }

  async function saveLibrary() {
    try {
      const result = await options.runtime.saveLibraryFile({
        filePath: currentLibraryFilePath.value || undefined,
        defaultPath: 'quotation-library.json',
        content: createQuotationLibraryFileContent(loadReusableLibraryData()),
      })

      if (result.canceled) {
        return
      }

      currentLibraryFilePath.value = result.filePath
      statusMessage.value = result.mode === 'download'
        ? options.t('settings.library.statuses.downloaded', { name: getFileName(result.filePath) })
        : options.t('settings.library.statuses.saved', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getLibraryFileOperationError(error, options.t)
    }
  }

  async function saveLibraryAs() {
    try {
      const result = await options.runtime.saveLibraryFile({
        defaultPath: 'quotation-library.json',
        content: createQuotationLibraryFileContent(loadReusableLibraryData()),
      })

      if (result.canceled) {
        return
      }

      currentLibraryFilePath.value = result.filePath
      statusMessage.value = result.mode === 'download'
        ? options.t('settings.library.statuses.downloaded', { name: getFileName(result.filePath) })
        : options.t('settings.library.statuses.savedAs', { name: getFileName(result.filePath) })
    } catch (error) {
      statusMessage.value = getLibraryFileOperationError(error, options.t)
    }
  }

  function createLibrary() {
    replaceReusableLibraryData(createDefaultReusableLibraryData())
    currentLibraryFilePath.value = ''
    statusMessage.value = options.t('settings.library.statuses.newReady')
  }

  return {
    currentLibraryFilePath,
    statusMessage,
    openLibrary,
    saveLibrary,
    saveLibraryAs,
    createLibrary,
  }
}

function getFileName(filePath: string) {
  return filePath.split(/[\\/]/).at(-1) || filePath
}

function getLibraryFileOperationError(error: unknown, t: TranslateFn) {
  if (error instanceof QuotationLibraryFileError) {
    switch (error.code) {
      case 'invalid_envelope':
        return t('settings.library.fileErrors.invalidEnvelope')
      case 'missing_library':
        return t('settings.library.fileErrors.missingLibrary')
      case 'invalid_company_profile':
        return t('settings.library.fileErrors.invalidCompanyProfile')
      case 'invalid_customer':
        return t('settings.library.fileErrors.invalidCustomer')
      case 'invalid_numbering':
        return t('settings.library.fileErrors.invalidNumbering')
      case 'invalid_json':
        return t('settings.library.fileErrors.invalidJson')
      case 'not_object':
        return t('settings.library.fileErrors.notObject')
    }
  }

  return error instanceof Error ? error.message : t('settings.library.statuses.fileOperationFailed')
}
