import { ref, shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { createInitialQuotation } from '@/features/quotations/utils/quotationDraft'
import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'

import { createGoodsReceiptDraft } from '../utils/goodsReceipt'
import { useGoodsReceiptExport } from './useGoodsReceiptExport'

describe('useGoodsReceiptExport', () => {
  it('exports the pending draft, records history, and clears the pending draft', async () => {
    const quotation = ref(createInitialQuotation([], 'en-US'))
    const pendingDraft = createGoodsReceiptDraft(quotation.value, {
      documentDate: '2026-08-20',
    })
    quotation.value.pendingGoodsReceiptDraft = pendingDraft

    const exportGoodsReceiptDocument = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/exports/GR-20260820.pdf',
      mode: 'native',
    })
    const saveCurrentQuotation = vi.fn()
    const statusMessage = shallowRef('')
    const { exportPendingGoodsReceiptPdfToFile } = useGoodsReceiptExport({
      quotation,
      runtime: createRuntime(exportGoodsReceiptDocument),
      statusMessage,
      saveCurrentQuotation,
      t: translate,
    })

    const result = await exportPendingGoodsReceiptPdfToFile('C:/exports/GR-20260820.pdf')

    expect(result).toMatchObject({
      canceled: false,
      filePath: 'C:/exports/GR-20260820.pdf',
    })
    expect(exportGoodsReceiptDocument).toHaveBeenCalledWith(expect.objectContaining({
      filePath: 'C:/exports/GR-20260820.pdf',
      draft: pendingDraft,
    }))
    expect(quotation.value.pendingGoodsReceiptDraft).toBeUndefined()
    expect(quotation.value.goodsReceiptHistory).toEqual([
      expect.objectContaining({
        filePath: 'C:/exports/GR-20260820.pdf',
        draft: pendingDraft,
      }),
    ])
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
    expect(statusMessage.value).toContain('goodsReceipts.statuses.exportedPdf')
  })

  it('does not export when the quotation has no pending draft', async () => {
    const quotation = ref(createInitialQuotation([], 'en-US'))
    const exportGoodsReceiptDocument = vi.fn()
    const statusMessage = shallowRef('')
    const { exportPendingGoodsReceiptPdfToFile } = useGoodsReceiptExport({
      quotation,
      runtime: createRuntime(exportGoodsReceiptDocument),
      statusMessage,
      saveCurrentQuotation: vi.fn(),
      t: translate,
    })

    await expect(exportPendingGoodsReceiptPdfToFile('C:/exports/receipt.pdf')).resolves.toBeNull()
    expect(exportGoodsReceiptDocument).not.toHaveBeenCalled()
    expect(statusMessage.value).toBe('goodsReceipts.errors.noPendingDraft')
  })
})

function createRuntime(exportGoodsReceiptDocument: ReturnType<typeof vi.fn>) {
  return {
    capabilities: {
      isDesktop: true,
      hasNativeFileDialogs: true,
      supportsFileSystemAccess: false,
      supportsDirectPdfExport: true,
      supportsBrowserPrint: false,
    },
    exportGoodsReceiptDocument,
  } as unknown as QuotationRuntime
}

function translate(key: string, params?: Record<string, string | number>) {
  return params ? `${key}:${JSON.stringify(params)}` : key
}
