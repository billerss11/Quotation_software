// @vitest-environment jsdom

import { shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { createQuotationFileContent, parseQuotationDocumentContent } from '../utils/quotationFile'
import { cloneSerializable } from '@/shared/utils/clone'
import { useQuotationEditor } from './useQuotationEditor'
import { useQuotationFileActions } from './useQuotationFileActions'
import { useGoodsReceiptExport } from '@/features/goods-receipts/composables/useGoodsReceiptExport'
import { createGoodsReceiptDraft } from '@/features/goods-receipts/utils/goodsReceipt'

describe('quotation revision file transactions', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('saves a portable history and exports the selected snapshot without changing the editor', async () => {
    const { editor, actions, save, exportPdf } = createHarness()
    editor.updateHeaderField('projectName', 'First offer')
    const itemId = editor.quotation.value.majorItems[0]!.id
    editor.setItemPricingMethod(itemId, 'manual_price')
    editor.updateItemField(itemId, 'manualUnitPrice', 125.5)
    editor.updateItemField(itemId, 'quantity', 3)
    editor.addExtraCharge({ id: 'delivery', label: 'Delivery', amount: 12.34 })
    const issuedTotals = cloneSerializable(editor.totals.value)
    await actions.createQuotationRevision({ filePath: 'C:/test/quote.json', note: 'Issued offer' })
    const firstRevision = cloneSerializable(editor.quotationRevisions.value[0]!)
    editor.updateHeaderField('projectName', 'Second offer')
    editor.updateItemField(itemId, 'manualUnitPrice', 999)
    await actions.createQuotationRevision()
    editor.updateHeaderField('projectName', 'Working draft')
    await actions.saveDraftAs()
    const content = save.mock.calls.at(-1)![0].content
    const reopened = createHarness()
    await reopened.actions.importJsonContentForAutomation(content)

    expect(reopened.editor.quotationRevisions.value).toHaveLength(2)
    expect(reopened.editor.quotationRevisions.value[0]).toEqual(firstRevision)
    expect(reopened.editor.quotation.value.header.projectName).toBe('Working draft')
    expect(parseQuotationDocumentContent(content).quotation.header.revisionNumber).toBe(3)

    const before = actions.serializeQuotationDocument()
    await actions.exportPdfToPath('C:/test/old.pdf', firstRevision.id)
    expect(exportPdf.mock.calls[0]![0].quotation.header.projectName).toBe('First offer')
    expect(exportPdf.mock.calls[0]![0].quotation.header.revisionNumber).toBe(1)
    expect(exportPdf.mock.calls[0]![0].totals).toEqual(issuedTotals)
    expect(exportPdf.mock.calls[0]![0].totals.grandTotal).not.toBe(editor.totals.value.grandTotal)
    expect(JSON.parse(actions.serializeQuotationDocument()).quotation).toEqual(JSON.parse(before).quotation)
    expect(editor.quotationRevisions.value[0]).toEqual(firstRevision)
  })

  it('preserves current work before restoring and resets undo at document boundaries', async () => {
    const { editor, actions } = createHarness()
    editor.updateHeaderField('projectName', 'First offer')
    await actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })
    const firstId = editor.quotationRevisions.value[0]!.id
    expect(editor.canUndoQuotationChange.value).toBe(false)
    editor.updateHeaderField('projectName', 'Before restore')
    await actions.restoreQuotationRevision(firstId)
    expect(editor.quotationRevisions.value.map(entry => entry.quotation.header.projectName)).toEqual(['First offer', 'Before restore'])
    expect(editor.quotation.value.header).toMatchObject({ projectName: 'First offer', revisionNumber: 3 })
    expect(editor.canUndoQuotationChange.value).toBe(false)
    expect(() => editor.updateHeaderField('revisionNumber', 1)).toThrow('invalid_argument')
    editor.createNewQuotation()
    expect(editor.quotationRevisions.value).toEqual([])
    expect(editor.canUndoQuotationChange.value).toBe(false)
  })

  it.each(['cancel', 'fail'] as const)('leaves the draft, history, path, and undo unchanged after %s', async (outcome) => {
    const { editor, actions, save } = createHarness()
    editor.updateHeaderField('projectName', 'Unsaved work')
    editor.commitQuotationChangeHistory()
    const before = cloneSerializable(editor.quotation.value)
    if (outcome === 'cancel') save.mockResolvedValueOnce({ canceled: true })
    else save.mockRejectedValueOnce(new Error('Disk full'))
    const operation = actions.createQuotationRevision({}, true)
    if (outcome === 'cancel') await expect(operation).resolves.toBeNull()
    else await expect(operation).rejects.toMatchObject({ code: 'file_write_failed' })
    expect(editor.quotation.value).toEqual(before)
    expect(editor.quotationRevisions.value).toEqual([])
    expect(editor.canUndoQuotationChange.value).toBe(true)
    expect(actions.currentFilePath.value).toBe('')
    expect(editor.isQuotationRevisionBusy.value).toBe(false)
  })

  it('blocks editor mutations, duplicate operations, and imports while saving a revision', async () => {
    const { editor, actions, save } = createHarness()
    let finish!: (value: { canceled: false; filePath: string; mode: 'native' }) => void
    save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const before = cloneSerializable(editor.quotation.value)
    const operation = actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })
    expect(editor.isQuotationRevisionBusy.value).toBe(true)
    expect(editor.quotationRevisions.value).toEqual([])
    expect(editor.quotation.value).toEqual(before)
    expect(() => editor.updateHeaderField('projectName', 'Race')).toThrow('operation_in_progress')
    expect(() => editor.createNewQuotation()).toThrow('operation_in_progress')
    expect(() => actions.importJsonContentForAutomation(createQuotationFileContent(before))).toThrow('operation_in_progress')
    await expect(actions.createQuotationRevision({ filePath: 'C:/test/other.json' })).rejects.toMatchObject({ code: 'operation_in_progress' })
    finish({ canceled: false, filePath: 'C:/test/quote.json', mode: 'native' })
    await operation
    expect(editor.quotation.value.header.revisionNumber).toBe(2)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('retains the saved document when the recovery cache fails', async () => {
    const { editor, actions, save } = createHarness()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded') })
    await expect(actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })).resolves.toMatchObject({ cacheWarning: true })
    expect(save).toHaveBeenCalledTimes(1)
    expect(editor.quotation.value.header.revisionNumber).toBe(2)
    expect(editor.quotationRevisions.value).toHaveLength(1)
    expect(actions.statusMessage.value).toBe('quotations.revisions.cacheWarning')
  })

  it('waits for receipt bookkeeping before allowing a revision snapshot', async () => {
    const { editor, actions, runtime } = createHarness()
    editor.quotation.value.pendingGoodsReceiptDraft = createGoodsReceiptDraft(editor.quotation.value, { documentDate: '2026-10-12' })
    let finish!: (value: { canceled: false; filePath: string; mode: 'native' }) => void
    runtime.exportGoodsReceiptDocument = vi.fn<QuotationRuntime['exportGoodsReceiptDocument']>(() => new Promise(resolve => { finish = resolve }))
    const receipts = useGoodsReceiptExport({
      quotation: editor.quotation,
      isQuotationRevisionBusy: editor.isQuotationRevisionBusy,
      runtime,
      statusMessage: actions.statusMessage,
      saveCurrentQuotation: editor.saveCurrentQuotation,
      t: key => key,
    })
    const operation = receipts.exportPendingGoodsReceiptPdfToFileForAutomation('C:/test/receipt.pdf')
    await expect(actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })).rejects.toMatchObject({ code: 'operation_in_progress' })
    finish({ canceled: false, filePath: 'C:/test/receipt.pdf', mode: 'native' })
    await operation
    await actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })
    expect(editor.quotation.value.goodsReceiptHistory).toHaveLength(1)
    expect(editor.quotationRevisions.value[0]!.quotation.goodsReceiptHistory).toHaveLength(1)
    expect(editor.quotation.value.pendingGoodsReceiptDraft).toBeUndefined()
  })

  it('rejects a prospective file over 10 MiB before any write or document mutation', async () => {
    const { editor, actions, save } = createHarness()
    editor.quotation.value.header.notes = '界'.repeat(1_900_000)
    const beforeNumber = editor.quotation.value.header.revisionNumber
    await expect(actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })).rejects.toMatchObject({ code: 'input_too_large' })
    expect(save).not.toHaveBeenCalled()
    expect(editor.quotation.value.header.revisionNumber).toBe(beforeNumber)
    expect(editor.quotationRevisions.value).toEqual([])
  })

  it('marks both current and backup recovery drafts as missing history until the file is reopened', async () => {
    const { editor, actions } = createHarness()
    editor.saveCurrentQuotation()
    await actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })
    const content = actions.serializeQuotationDocument()
    const key = `quotation-software:quotation-draft:${editor.quotation.value.id}`
    expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ _recoveryHasRevisionHistory: true })
    expect(localStorage.getItem(key)).not.toContain('"revisions"')

    localStorage.setItem(key, '{ damaged')
    const recovered = createHarness()
    recovered.editor.loadLatestQuotation()
    expect(recovered.editor.revisionHistoryUnavailable.value).toBe(true)
    expect(recovered.editor.quotationRevisions.value).toEqual([])
    expect(() => recovered.actions.serializeQuotationDocument()).toThrow('history_unavailable')
    await expect(recovered.actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })).rejects.toMatchObject({ code: 'history_unavailable' })
    await recovered.actions.saveDraft()
    expect(recovered.save).not.toHaveBeenCalled()
    await recovered.actions.importJsonContentForAutomation(content)
    expect(recovered.editor.revisionHistoryUnavailable.value).toBe(false)
    expect(recovered.editor.quotationRevisions.value).toHaveLength(1)
    expect(recovered.editor.quotation.value).not.toHaveProperty('_recoveryHasRevisionHistory')
  })

  it('preserves history in browser saves but disallows creating or restoring revisions', async () => {
    const desktop = createHarness()
    await desktop.actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })
    const browser = createHarness(false)
    await browser.actions.importJsonContentForAutomation(desktop.actions.serializeQuotationDocument())
    await browser.actions.saveDraftAs()
    expect(parseQuotationDocumentContent(browser.save.mock.calls[0]![0].content).revisions).toHaveLength(1)
    await expect(browser.actions.createQuotationRevision({}, true)).rejects.toMatchObject({ code: 'unsupported_operation' })
    await expect(browser.actions.restoreQuotationRevision(browser.editor.quotationRevisions.value[0]!.id, {}, true)).rejects.toMatchObject({ code: 'unsupported_operation' })
  })
})

function createHarness(isDesktop = true) {
  const editor = useQuotationEditor(shallowRef('en-US'))
  const save = vi.fn<QuotationRuntime['saveQuotationFile']>().mockResolvedValue({ canceled: false, filePath: 'C:/test/quote.json', mode: isDesktop ? 'native' : 'download' })
  const exportPdf = vi.fn<QuotationRuntime['exportQuotationDocument']>().mockResolvedValue({ canceled: false, filePath: 'C:/test/old.pdf', mode: 'native' })
  const runtime = {
    capabilities: { isDesktop, hasNativeFileDialogs: isDesktop, supportsFileSystemAccess: isDesktop, supportsDirectPdfExport: isDesktop, supportsBrowserPrint: !isDesktop },
    saveQuotationFile: save,
    exportQuotationDocument: exportPdf,
  } as unknown as QuotationRuntime
  const actions = useQuotationFileActions({
    quotation: editor.quotation,
    quotationRevisions: editor.quotationRevisions,
    revisionHistoryUnavailable: editor.revisionHistoryUnavailable,
    isQuotationRevisionBusy: editor.isQuotationRevisionBusy,
    replaceQuotationDocument: editor.replaceQuotationDocument,
    itemSummaries: editor.itemSummaries,
    totals: editor.totals,
    runtime,
    saveCurrentQuotation: editor.saveCurrentQuotation,
    replaceQuotationDraft: editor.replaceQuotationDraft,
    replaceLineItems: editor.replaceLineItems,
    setLogoDataUrl: editor.setLogoDataUrl,
    t: key => key,
  })
  return { editor, actions, save, exportPdf, runtime }
}
