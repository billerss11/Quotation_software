import type { Ref } from 'vue'

import type { QuotationDraft } from '@/features/quotations/types'
import { QuotationRevisionError } from '@/features/quotations/composables/useQuotationRevisions'
import {
  QuotationOutputError,
  assertQuotationReadyForOutput,
} from '@/features/quotations/utils/quotationOutputValidation'
import type { QuotationRuntime, RuntimeSaveFileResult } from '@/shared/runtime/quotationRuntime'
import { cloneSerializable } from '@/shared/utils/clone'

import type { GoodsReceiptDraft } from '../utils/goodsReceipt'
import {
  completeGoodsReceiptExport,
  createGoodsReceiptFileName,
  parseGoodsReceiptDraft,
  validateGoodsReceiptDraft,
} from '../utils/goodsReceipt'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

interface UseGoodsReceiptExportOptions {
  quotation: Ref<QuotationDraft>
  isQuotationRevisionBusy?: Ref<boolean>
  runtime: QuotationRuntime
  statusMessage: Ref<string>
  saveCurrentQuotation: () => void
  t: TranslateFn
  recordActivity?: (messageKey: string, params?: Record<string, string | number>) => void
}

export class GoodsReceiptExportError extends Error {
  constructor(
    public readonly code: 'goods_receipt_missing' | 'goods_receipt_invalid' | 'invalid_argument',
    public readonly validationCode?: string,
  ) {
    super(code)
    this.name = 'GoodsReceiptExportError'
  }
}

export type GoodsReceiptExportResult = RuntimeSaveFileResult & {
  cacheWarning?: true
}

export function useGoodsReceiptExport(options: UseGoodsReceiptExportOptions) {
  async function exportGoodsReceiptPdf(
    draft: GoodsReceiptDraft,
    filePath?: string,
  ): Promise<GoodsReceiptExportResult | null> {
    const validation = validateGoodsReceiptDraft(draft)
    const firstError = validation.errors[0]

    if (firstError) {
      options.statusMessage.value = options.t(`goodsReceipts.errors.${firstError.code}`)
      recordExportFailure(draft, filePath)
      return null
    }

    if (
      filePath !== undefined
      && (!options.runtime.capabilities.supportsDirectPdfExport || filePath.trim().length === 0)
    ) {
      options.statusMessage.value = options.t('quotations.statuses.fileOperationFailed')
      recordExportFailure(draft, filePath)
      return null
    }

    try {
      return await performGoodsReceiptPdfExport(draft, filePath)
    } catch (error) {
      options.statusMessage.value = error instanceof QuotationRevisionError
        ? options.t('quotations.revisions.operationInProgress')
        : error instanceof QuotationOutputError
        ? options.t('quotations.statuses.quotationNumberRequired')
        : error instanceof Error
        ? error.message
        : options.t('quotations.statuses.fileOperationFailed')
      recordExportFailure(draft, filePath)
      return null
    }
  }

  async function exportPendingGoodsReceiptPdfToFile(filePath: string) {
    const pendingDraft = parseGoodsReceiptDraft(options.quotation.value.pendingGoodsReceiptDraft)

    if (!pendingDraft) {
      options.statusMessage.value = options.t('goodsReceipts.errors.noPendingDraft')
      return null
    }

    return exportGoodsReceiptPdf(pendingDraft, filePath)
  }

  async function exportPendingGoodsReceiptPdfToFileForAutomation(filePath: string) {
    const pendingDraft = parseGoodsReceiptDraft(options.quotation.value.pendingGoodsReceiptDraft)
    if (!pendingDraft) {
      recordActivity('quotations.activityHistory.log.fileOperationFailed', {
        operation: 'Export goods-receipt PDF',
        name: getFileName(filePath),
      })
      throw new GoodsReceiptExportError('goods_receipt_missing')
    }

    const validation = validateGoodsReceiptDraft(pendingDraft)
    const firstError = validation.errors[0]
    if (firstError) {
      recordExportFailure(pendingDraft, filePath)
      throw new GoodsReceiptExportError('goods_receipt_invalid', firstError.code)
    }
    if (!options.runtime.capabilities.supportsDirectPdfExport || filePath.trim().length === 0) {
      recordExportFailure(pendingDraft, filePath)
      throw new GoodsReceiptExportError('invalid_argument')
    }

    return performGoodsReceiptPdfExport(pendingDraft, filePath)
  }

  async function performGoodsReceiptPdfExport(
    draft: GoodsReceiptDraft,
    filePath?: string,
  ): Promise<GoodsReceiptExportResult> {
    const busy = options.isQuotationRevisionBusy
    if (busy?.value) throw new QuotationRevisionError('operation_in_progress')
    assertQuotationReadyForOutput(options.quotation.value)
    const exportDraft = cloneSerializable(draft)
    if (exportDraft.quotationId === options.quotation.value.id && !exportDraft.quotationNumber.trim()) {
      exportDraft.quotationNumber = options.quotation.value.header.quotationNumber
    }
    if (busy) busy.value = true
    try {
      return await writeGoodsReceiptPdf(exportDraft, filePath)
    } finally {
      if (busy) busy.value = false
    }
  }

  async function writeGoodsReceiptPdf(draft: GoodsReceiptDraft, filePath?: string): Promise<GoodsReceiptExportResult> {
    const result = await options.runtime.exportGoodsReceiptDocument({
      draft: cloneSerializable(draft),
      branding: cloneSerializable(options.quotation.value.branding),
      defaultFileName: createGoodsReceiptFileName(draft.grNumber),
      ...(filePath ? { filePath } : {}),
    })

    if (result.canceled) {
      return result
    }

    let cacheWarning = false

    if (result.mode !== 'browser-print') {
      completeGoodsReceiptExport(options.quotation.value, draft, result.filePath)
      try {
        options.saveCurrentQuotation()
      } catch (error) {
        cacheWarning = true
        console.warn('Goods receipt PDF was exported, but the local quotation draft could not be saved.', error)
      }
    }

    options.statusMessage.value = cacheWarning
      ? options.t('goodsReceipts.statuses.exportedPdfCacheWarning', { name: getFileName(result.filePath) })
      : result.mode === 'browser-print'
      ? options.t('goodsReceipts.statuses.printOpened', { name: getFileName(result.filePath) })
      : options.t('goodsReceipts.statuses.exportedPdf', { name: getFileName(result.filePath) })
    recordActivity('goodsReceipts.activityHistory.exportedPdf', {
      number: draft.grNumber,
      name: getFileName(result.filePath),
    })

    return cacheWarning ? { ...result, cacheWarning: true } : result
  }

  function recordExportFailure(draft: GoodsReceiptDraft, filePath?: string) {
    recordActivity('quotations.activityHistory.log.fileOperationFailed', {
      operation: 'Export goods-receipt PDF',
      name: filePath ? getFileName(filePath) : createGoodsReceiptFileName(draft.grNumber),
    })
  }

  function recordActivity(messageKey: string, params?: Record<string, string | number>) {
    try {
      options.recordActivity?.(messageKey, params)
    } catch (error) {
      console.warn('Could not write activity history.', error)
    }
  }

  return {
    exportGoodsReceiptPdf,
    exportPendingGoodsReceiptPdfToFile,
    exportPendingGoodsReceiptPdfToFileForAutomation,
  }
}

function getFileName(filePath: string) {
  return filePath.split(/[\\/]/).at(-1) || filePath
}
