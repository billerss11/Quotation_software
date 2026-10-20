import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'
import type { QuotationRevision } from '../types'
import { createInitialQuotation } from '../utils/quotationDraft'
import { createQuotationExcelWorkbook } from '../utils/quotationExcelExport'
import { calculateQuotationTotals } from '../utils/quotationCalculations'
import { useQuotationFileActions } from './useQuotationFileActions'

vi.mock('../utils/quotationExcelExport', () => ({
  createQuotationExcelWorkbook: vi.fn(() => new Uint8Array([80, 75, 3, 4])),
}))

beforeEach(() => vi.clearAllMocks())

describe('quotation Excel export workflow', () => {
  it('defaults to customer, commits pending edits and exports a detached snapshot in the document language', async () => {
    const harness = createHarness()
    harness.quotation.value.header.documentLocale = 'zh-CN'
    harness.flushPendingEdits.mockImplementation(() => {
      harness.quotation.value.header.quotationNumber = 'Q/edited'
    })

    await harness.actions.exportQuotationExcel()

    expect(harness.flushPendingEdits).toHaveBeenCalledOnce()
    const [snapshot, mode, locale] = vi.mocked(createQuotationExcelWorkbook).mock.calls[0]!
    expect(snapshot.header.quotationNumber).toBe('Q/edited')
    expect(snapshot).not.toBe(harness.quotation.value)
    expect(mode).toBe('customer')
    expect(locale).toBe('zh-CN')
    expect(harness.saveQuotationExcelFile).toHaveBeenCalledWith({
      defaultPath: 'Q-edited-Customer.xlsx',
      locale: 'zh-CN',
      content: new Uint8Array([80, 75, 3, 4]),
    })
    expect(harness.actions.currentFilePath.value).toBe('original.json')
    expect(harness.saveCurrentQuotation).not.toHaveBeenCalled()
  })

  it('exports the selected saved revision without flushing or changing the working quotation', async () => {
    const harness = createHarness()
    const saved = createInitialQuotation([], 'en-US')
    saved.header.quotationNumber = 'Q-issued'
    saved.header.revisionNumber = 2
    harness.revisions.value = [{ id: 'issued', revisionNumber: 2, createdAt: '2026-10-01T00:00:00Z', quotation: saved }]

    await harness.actions.exportQuotationExcel('internal', 'issued')

    expect(harness.flushPendingEdits).not.toHaveBeenCalled()
    expect(createQuotationExcelWorkbook).toHaveBeenCalledWith(saved, 'internal', 'en-US')
    expect(harness.saveQuotationExcelFile.mock.calls[0]![0].defaultPath).toBe('Q-issued-Rev-2-Internal.xlsx')
    expect(harness.quotation.value.header.quotationNumber).toBe('Q-working')
    expect(harness.revisions.value[0]!.quotation).toEqual(saved)
  })

  it('keeps cancellation quiet and reports a localized save failure', async () => {
    const harness = createHarness()
    harness.saveQuotationExcelFile.mockResolvedValueOnce({ canceled: true })
    await expect(harness.actions.exportQuotationExcel()).resolves.toEqual({ canceled: true })
    expect(harness.actions.statusMessage.value).toBe('')
    harness.saveQuotationExcelFile.mockRejectedValueOnce(new Error('Access denied'))
    await expect(harness.actions.exportQuotationExcel()).resolves.toBeNull()
    expect(harness.actions.statusMessage.value).toBe('quotations.excel.failed')
  })

  it('exports to an explicit automation path and propagates failures', async () => {
    const harness = createHarness()
    const original = JSON.stringify(harness.quotation.value)
    await harness.actions.exportExcelToPath('C:/Exports/customer.xlsx')
    expect(harness.saveQuotationExcelFile).toHaveBeenCalledWith(expect.objectContaining({
      filePath: 'C:/Exports/customer.xlsx', defaultPath: 'Q-working-Customer.xlsx',
    }))
    expect(JSON.stringify(harness.quotation.value)).toBe(original)
    harness.saveQuotationExcelFile.mockRejectedValueOnce(new Error('Access denied'))
    await expect(harness.actions.exportExcelToPath('C:/Exports/internal.xlsx', 'internal')).rejects.toThrow('Access denied')
    await expect(harness.actions.exportExcelToPath('C:/Exports/wrong.pdf')).rejects.toThrow()
  })

  it('exports archived Excel to a path without upgrading its legacy calculation policy', async () => {
    const harness = createHarness()
    const archived = createInitialQuotation([], 'en-US')
    archived.header.quotationNumber = 'Q-legacy'
    delete archived.totalsConfig.taxAllocationVersion
    harness.revisions.value = [{ id: 'legacy', revisionNumber: 1, createdAt: '2026-10-01T00:00:00Z', quotation: archived }]
    await harness.actions.exportExcelToPath('C:/Exports/issued.xlsx', 'internal', 'legacy')
    expect(harness.flushPendingEdits).not.toHaveBeenCalled()
    expect(createQuotationExcelWorkbook).toHaveBeenCalledWith(archived, 'internal', 'en-US')
    expect(harness.revisions.value[0]!.quotation.totalsConfig.taxAllocationVersion).toBeUndefined()
    expect(harness.quotation.value.totalsConfig.taxAllocationVersion).toBe(2)
  })

  it.each(['customer', 'internal'] as const)('ignores PDF-only breakdown selections in %s export without changing PDF validation', async (mode) => {
    const harness = createHarness()
    harness.quotation.value.outputSettings = {
      itemDetailLevel: 3,
      showInformationalTotals: true,
      informationalTotals: [{ id: 'stale-total', label: 'Equipment', sectionIds: ['removed-section'], visible: true }],
    }
    const originalSettings = JSON.stringify(harness.quotation.value.outputSettings)

    await expect(harness.actions.exportQuotationExcel(mode)).resolves.toMatchObject({ canceled: false })

    expect(harness.saveQuotationExcelFile).toHaveBeenCalledOnce()
    expect(createQuotationExcelWorkbook).toHaveBeenCalledWith(expect.objectContaining({
      outputSettings: harness.quotation.value.outputSettings,
    }), mode, 'en-US')
    expect(JSON.stringify(harness.quotation.value.outputSettings)).toBe(originalSettings)

    await harness.actions.exportQuotationPdf()

    expect(harness.exportQuotationDocument).not.toHaveBeenCalled()
    expect(harness.actions.statusMessage.value).toBe('quotations.summaryDisplay.sectionsMissing')
    expect(JSON.stringify(harness.quotation.value.outputSettings)).toBe(originalSettings)
  })

  it('does not export a missing revision, an unnamed quotation, or during a revision operation', async () => {
    const harness = createHarness()
    await expect(harness.actions.exportQuotationExcel('customer', 'missing')).resolves.toBeNull()
    harness.quotation.value.header.quotationNumber = ''
    await expect(harness.actions.exportQuotationExcel()).resolves.toBeNull()
    expect(harness.actions.statusMessage.value).toBe('quotations.statuses.quotationNumberRequired')
    harness.quotation.value.header.quotationNumber = 'Q-working'
    harness.busy.value = true
    await expect(harness.actions.exportQuotationExcel()).resolves.toBeNull()
    expect(createQuotationExcelWorkbook).not.toHaveBeenCalled()
    expect(harness.saveQuotationExcelFile).not.toHaveBeenCalled()
  })
})

function createHarness() {
  const quotation = ref(createInitialQuotation([], 'en-US'))
  quotation.value.header.quotationNumber = 'Q-working'
  quotation.value.header.customerCompany = ''
  quotation.value.header.contactPerson = ''
  const revisions = ref<QuotationRevision[]>([])
  const busy = ref(false)
  const saveQuotationExcelFile = vi.fn<(options: { defaultPath: string; content: Uint8Array }) => ReturnType<QuotationRuntime['saveQuotationExcelFile']>>()
    .mockResolvedValue({ canceled: false, filePath: 'quote.xlsx', mode: 'native' })
  const flushPendingEdits = vi.fn()
  const saveCurrentQuotation = vi.fn()
  const exportQuotationDocument = vi.fn()
  const actions = useQuotationFileActions({
    quotation,
    quotationRevisions: revisions,
    isQuotationRevisionBusy: busy,
    itemSummaries: ref([]),
    totals: ref(calculateQuotationTotals(quotation.value.majorItems, quotation.value.totalsConfig, quotation.value.exchangeRates)),
    flushPendingEdits,
    runtime: { capabilities: { isDesktop: true, hasNativeFileDialogs: true }, saveQuotationExcelFile, exportQuotationDocument } as unknown as QuotationRuntime,
    saveCurrentQuotation,
    replaceQuotationDraft: vi.fn(),
    replaceLineItems: vi.fn(),
    setLogoDataUrl: vi.fn(),
    t: (key) => key,
  })
  actions.currentFilePath.value = 'original.json'
  return { actions, quotation, revisions, busy, saveQuotationExcelFile, exportQuotationDocument, flushPendingEdits, saveCurrentQuotation }
}
