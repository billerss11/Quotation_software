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
    const recordActivity = vi.fn()
    const statusMessage = shallowRef('')
    const { exportPendingGoodsReceiptPdfToFile } = useGoodsReceiptExport({
      quotation,
      runtime: createRuntime(exportGoodsReceiptDocument),
      statusMessage,
      saveCurrentQuotation,
      t: translate,
      recordActivity,
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
    expect(recordActivity).toHaveBeenCalledWith(
      'goodsReceipts.activityHistory.exportedPdf',
      expect.objectContaining({ name: 'GR-20260820.pdf' }),
    )
  })

  it('keeps a successful native PDF export successful when local draft persistence fails', async () => {
    const quotation = ref(createInitialQuotation([], 'en-US'))
    quotation.value.header.quotationNumber = 'Q-2026-001'
    const pendingDraft = createGoodsReceiptDraft(quotation.value, {
      documentDate: '2026-08-20',
    })
    quotation.value.pendingGoodsReceiptDraft = pendingDraft
    const exportGoodsReceiptDocument = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/exports/GR-20260820.pdf',
      mode: 'native',
    })
    const recordActivity = vi.fn()
    const statusMessage = shallowRef('')
    const { exportPendingGoodsReceiptPdfToFile } = useGoodsReceiptExport({
      quotation,
      runtime: createRuntime(exportGoodsReceiptDocument),
      statusMessage,
      saveCurrentQuotation: () => { throw new Error('quota exceeded') },
      t: translate,
      recordActivity,
    })

    await expect(exportPendingGoodsReceiptPdfToFile('C:/exports/GR-20260820.pdf')).resolves.toMatchObject({
      canceled: false,
      cacheWarning: true,
    })
    expect(quotation.value.pendingGoodsReceiptDraft).toBeUndefined()
    expect(quotation.value.goodsReceiptHistory).toHaveLength(1)
    expect(statusMessage.value).toContain('goodsReceipts.statuses.exportedPdfCacheWarning')
    expect(recordActivity).toHaveBeenCalledWith(
      'goodsReceipts.activityHistory.exportedPdf',
      expect.objectContaining({ name: 'GR-20260820.pdf' }),
    )
    expect(recordActivity).not.toHaveBeenCalledWith(
      'quotations.activityHistory.log.fileOperationFailed',
      expect.anything(),
    )
  })

  it('uses a manually entered active quotation number for a pending receipt that was created without one', async () => {
    const quotation = ref(createInitialQuotation([], 'en-US'))
    quotation.value.header.quotationNumber = ''
    const pendingDraft = createGoodsReceiptDraft(quotation.value, {
      documentDate: '2026-08-20',
    })
    quotation.value.pendingGoodsReceiptDraft = pendingDraft
    quotation.value.header.quotationNumber = 'Q-MANUAL-001'
    const exportGoodsReceiptDocument = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/exports/GR-20260820.pdf',
      mode: 'native',
    })
    const { exportPendingGoodsReceiptPdfToFile } = useGoodsReceiptExport({
      quotation,
      runtime: createRuntime(exportGoodsReceiptDocument),
      statusMessage: shallowRef(''),
      saveCurrentQuotation: vi.fn(),
      t: translate,
    })

    await expect(exportPendingGoodsReceiptPdfToFile('C:/exports/GR-20260820.pdf')).resolves.toMatchObject({
      canceled: false,
    })

    expect(exportGoodsReceiptDocument).toHaveBeenCalledWith(expect.objectContaining({
      draft: expect.objectContaining({ quotationNumber: 'Q-MANUAL-001' }),
    }))
    expect(quotation.value.goodsReceiptHistory).toEqual([
      expect.objectContaining({
        draft: expect.objectContaining({ quotationNumber: 'Q-MANUAL-001' }),
      }),
    ])
  })

  it('preserves a pending receipt quotation reference that is already nonblank', async () => {
    const quotation = ref(createInitialQuotation([], 'en-US'))
    const pendingDraft = createGoodsReceiptDraft(quotation.value, {
      documentDate: '2026-08-20',
    })
    pendingDraft.quotationNumber = 'Q-ISSUED-001'
    quotation.value.pendingGoodsReceiptDraft = pendingDraft
    quotation.value.header.quotationNumber = 'Q-MANUAL-002'
    const exportGoodsReceiptDocument = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/exports/GR-20260820.pdf',
      mode: 'native',
    })
    const { exportPendingGoodsReceiptPdfToFile } = useGoodsReceiptExport({
      quotation,
      runtime: createRuntime(exportGoodsReceiptDocument),
      statusMessage: shallowRef(''),
      saveCurrentQuotation: vi.fn(),
      t: translate,
    })

    await exportPendingGoodsReceiptPdfToFile('C:/exports/GR-20260820.pdf')

    expect(exportGoodsReceiptDocument).toHaveBeenCalledWith(expect.objectContaining({
      draft: expect.objectContaining({ quotationNumber: 'Q-ISSUED-001' }),
    }))
    expect(quotation.value.goodsReceiptHistory?.[0]?.draft.quotationNumber).toBe('Q-ISSUED-001')
  })

  it.each(['canceled', 'failed'] as const)('keeps the pending receipt unchanged when native export %s', async outcome => {
    const quotation = ref(createInitialQuotation([], 'en-US'))
    quotation.value.header.quotationNumber = ''
    const pendingDraft = createGoodsReceiptDraft(quotation.value, {
      documentDate: '2026-08-20',
    })
    quotation.value.pendingGoodsReceiptDraft = pendingDraft
    quotation.value.header.quotationNumber = 'Q-MANUAL-001'
    const exportGoodsReceiptDocument = outcome === 'canceled'
      ? vi.fn().mockResolvedValue({ canceled: true })
      : vi.fn().mockRejectedValue(new Error('PDF renderer failed'))
    const { exportPendingGoodsReceiptPdfToFile } = useGoodsReceiptExport({
      quotation,
      runtime: createRuntime(exportGoodsReceiptDocument),
      statusMessage: shallowRef(''),
      saveCurrentQuotation: vi.fn(),
      t: translate,
    })

    await exportPendingGoodsReceiptPdfToFile('C:/exports/GR-20260820.pdf')

    expect(quotation.value.pendingGoodsReceiptDraft).toEqual(pendingDraft)
    expect(quotation.value.goodsReceiptHistory).toEqual([])
  })

  it('does not export or mutate a receipt for a blank quotation number', async () => {
    const quotation = ref(createInitialQuotation([], 'en-US'))
    quotation.value.header.quotationNumber = '  '
    const pendingDraft = createGoodsReceiptDraft(quotation.value, {
      documentDate: '2026-08-20',
    })
    quotation.value.pendingGoodsReceiptDraft = pendingDraft
    const exportGoodsReceiptDocument = vi.fn()
    const statusMessage = shallowRef('')
    const { exportPendingGoodsReceiptPdfToFile } = useGoodsReceiptExport({
      quotation,
      runtime: createRuntime(exportGoodsReceiptDocument),
      statusMessage,
      saveCurrentQuotation: vi.fn(),
      t: translate,
    })

    await expect(exportPendingGoodsReceiptPdfToFile('C:/exports/GR-20260820.pdf')).resolves.toBeNull()
    expect(exportGoodsReceiptDocument).not.toHaveBeenCalled()
    expect(quotation.value.pendingGoodsReceiptDraft).toEqual(pendingDraft)
    expect(quotation.value.goodsReceiptHistory).toEqual([])
    expect(statusMessage.value).toBe('quotations.statuses.quotationNumberRequired')
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
