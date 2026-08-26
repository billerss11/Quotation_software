import type { Ref } from 'vue'

import type { QuotationDraft } from '@/features/quotations/types'
import type { QuotationRuntime, RuntimeSaveFileResult } from '@/shared/runtime/quotationRuntime'
import { cloneSerializable } from '@/shared/utils/clone'

import type { GoodsReceiptDraft } from '../utils/goodsReceipt'
import {
  createGoodsReceiptFileName,
  createGoodsReceiptRecord,
  parseGoodsReceiptDraft,
  validateGoodsReceiptDraft,
} from '../utils/goodsReceipt'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

interface UseGoodsReceiptExportOptions {
  quotation: Ref<QuotationDraft>
  runtime: QuotationRuntime
  statusMessage: Ref<string>
  saveCurrentQuotation: () => void
  t: TranslateFn
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

export function useGoodsReceiptExport(options: UseGoodsReceiptExportOptions) {
  async function exportGoodsReceiptPdf(
    draft: GoodsReceiptDraft,
    filePath?: string,
  ): Promise<RuntimeSaveFileResult | null> {
    const validation = validateGoodsReceiptDraft(draft)
    const firstError = validation.errors[0]

    if (firstError) {
      options.statusMessage.value = options.t(`goodsReceipts.errors.${firstError.code}`)
      return null
    }

    if (
      filePath !== undefined
      && (!options.runtime.capabilities.supportsDirectPdfExport || filePath.trim().length === 0)
    ) {
      options.statusMessage.value = options.t('quotations.statuses.fileOperationFailed')
      return null
    }

    try {
      return await performGoodsReceiptPdfExport(draft, filePath)
    } catch (error) {
      options.statusMessage.value = error instanceof Error
        ? error.message
        : options.t('quotations.statuses.fileOperationFailed')
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
      throw new GoodsReceiptExportError('goods_receipt_missing')
    }

    const validation = validateGoodsReceiptDraft(pendingDraft)
    const firstError = validation.errors[0]
    if (firstError) {
      throw new GoodsReceiptExportError('goods_receipt_invalid', firstError.code)
    }
    if (!options.runtime.capabilities.supportsDirectPdfExport || filePath.trim().length === 0) {
      throw new GoodsReceiptExportError('invalid_argument')
    }

    return performGoodsReceiptPdfExport(pendingDraft, filePath)
  }

  async function performGoodsReceiptPdfExport(
    draft: GoodsReceiptDraft,
    filePath?: string,
  ): Promise<RuntimeSaveFileResult> {
    const result = await options.runtime.exportGoodsReceiptDocument({
      draft: cloneSerializable(draft),
      branding: cloneSerializable(options.quotation.value.branding),
      defaultFileName: createGoodsReceiptFileName(draft.grNumber),
      ...(filePath ? { filePath } : {}),
    })

    if (result.canceled) {
      return result
    }

    if (result.mode !== 'browser-print') {
      options.quotation.value.goodsReceiptHistory = [
        ...(options.quotation.value.goodsReceiptHistory ?? []),
        createGoodsReceiptRecord(draft, result.filePath),
      ]
      delete options.quotation.value.pendingGoodsReceiptDraft
      options.saveCurrentQuotation()
    }

    options.statusMessage.value = result.mode === 'browser-print'
      ? options.t('goodsReceipts.statuses.printOpened', { name: getFileName(result.filePath) })
      : options.t('goodsReceipts.statuses.exportedPdf', { name: getFileName(result.filePath) })

    return result
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
