// @vitest-environment jsdom

import { shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { createQuotationFileContent, parseQuotationDocumentContent } from '../utils/quotationFile'
import { proposeQuotationRevision } from '../utils/quotationRevisions'
import { cloneSerializable } from '@/shared/utils/clone'
import { loadSavedQuotations } from '@/shared/services/localQuotationStorage'
import { useQuotationEditor } from './useQuotationEditor'
import { useQuotationFileActions } from './useQuotationFileActions'
import { useGoodsReceiptExport } from '@/features/goods-receipts/composables/useGoodsReceiptExport'
import { createGoodsReceiptDraft } from '@/features/goods-receipts/utils/goodsReceipt'

describe('quotation revision file transactions', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('saves a portable history and exports the selected snapshot without changing the editor', async () => {
    const { editor, actions, save, exportPdf } = createHarness()
    const firstLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
    const secondLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAAB'
    editor.updateHeaderField('projectName', 'First offer')
    editor.setLogoDataUrl(firstLogo)
    const itemId = editor.quotation.value.majorItems[0]!.id
    editor.setItemPricingMethod(itemId, 'manual_price')
    editor.updateItemField(itemId, 'manualUnitPrice', 125.5)
    editor.updateItemField(itemId, 'quantity', 3)
    editor.addExtraCharge({ id: 'delivery', label: 'Delivery', amount: 12.34 })
    const issuedTotals = cloneSerializable(editor.totals.value)
    await actions.createQuotationRevision({ filePath: 'C:/test/quote.json', note: 'Issued offer' })
    const firstRevision = cloneSerializable(editor.quotationRevisions.value[0]!)
    editor.updateHeaderField('projectName', 'Second offer')
    editor.setLogoDataUrl(secondLogo)
    editor.updateItemField(itemId, 'manualUnitPrice', 999)
    await actions.createQuotationRevision()
    editor.updateHeaderField('projectName', 'Working draft')
    await actions.saveDraftAs()
    const content = save.mock.calls.at(-1)![0].content
    const envelope = JSON.parse(content)
    expect(envelope.schemaVersion).toBe(4)
    expect(envelope.images).toEqual({ 'image-1': secondLogo, 'image-2': firstLogo })
    expect(envelope.quotation.branding.logoImageId).toBe('image-1')
    const reopened = createHarness()
    await reopened.actions.importJsonContentForAutomation(content)

    expect(reopened.editor.quotationRevisions.value).toHaveLength(2)
    expect(reopened.editor.quotationRevisions.value[0]).toEqual(firstRevision)
    expect(reopened.editor.quotation.value.header.projectName).toBe('Working draft')
    expect(reopened.editor.quotation.value.branding.logoDataUrl).toBe(secondLogo)
    expect(reopened.editor.quotationRevisions.value.map(entry => entry.quotation.branding.logoDataUrl)).toEqual([firstLogo, secondLogo])
    expect(parseQuotationDocumentContent(content).quotation.header.revisionNumber).toBe(3)

    const before = actions.serializeQuotationDocument()
    await actions.exportPdfToPath('C:/test/old.pdf', firstRevision.id)
    expect(exportPdf.mock.calls[0]![0].quotation.header.projectName).toBe('First offer')
    expect(exportPdf.mock.calls[0]![0].quotation.header.revisionNumber).toBe(1)
    expect(exportPdf.mock.calls[0]![0].quotation.branding.logoDataUrl).toBe(firstLogo)
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

  it('deletes only the selected archive while preserving working edits, revision numbers, and undo', async () => {
    const { editor, actions, save } = createHarness()
    editor.updateHeaderField('projectName', 'First offer')
    await actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })
    const firstId = editor.quotationRevisions.value[0]!.id
    editor.updateHeaderField('projectName', 'Second offer')
    await actions.createQuotationRevision()
    const retainedRevision = cloneSerializable(editor.quotationRevisions.value[1]!)
    editor.updateHeaderField('projectName', 'Unsaved working edits')
    editor.commitQuotationChangeHistory()
    const workingDraft = editor.quotation.value
    const before = cloneSerializable(workingDraft)

    const result = await actions.deleteQuotationRevision(firstId)

    expect(result).toMatchObject({ filePath: 'C:/test/quote.json', savedAt: expect.any(String) })
    expect(editor.quotation.value).toBe(workingDraft)
    expect(editor.quotation.value).toEqual({ ...before, metadata: editor.quotation.value.metadata })
    expect(editor.quotationRevisions.value).toEqual([retainedRevision])
    const persisted = parseQuotationDocumentContent(save.mock.calls.at(-1)![0].content)
    expect(persisted.quotation).toEqual(editor.quotation.value)
    expect(persisted.revisions).toEqual([retainedRevision])
    expect(actions.statusMessage.value).toBe('quotations.revisions.deleted')
    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(editor.quotation.value.header.projectName).toBe('Second offer')
    expect(editor.quotation.value.header.revisionNumber).toBe(3)
    expect(editor.quotationRevisions.value).toEqual([retainedRevision])
  })

  it('keeps numbering monotonic after deleting the last archive', async () => {
    const { editor, actions, save } = createHarness()
    await actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })
    const archivedId = editor.quotationRevisions.value[0]!.id
    await actions.deleteQuotationRevision(archivedId)
    expect(editor.quotationRevisions.value).toEqual([])
    expect(editor.quotation.value.header.revisionNumber).toBe(2)
    expect(parseQuotationDocumentContent(save.mock.calls.at(-1)![0].content).revisions).toEqual([])
    expect(() => editor.updateHeaderField('revisionNumber', 1)).toThrow('invalid_argument')

    await actions.createQuotationRevision()
    expect(editor.quotation.value.header.revisionNumber).toBe(3)
    expect(editor.quotationRevisions.value.map(entry => entry.revisionNumber)).toEqual([2])
    expect(editor.quotationRevisions.value[0]!.id).not.toBe(archivedId)
  })

  it('blocks revision writes with a blank active quotation number before any disk or document mutation', async () => {
    const { editor, actions, save } = createHarness()
    await actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })
    const archivedId = editor.quotationRevisions.value[0]!.id
    editor.quotation.value.header.quotationNumber = ' '
    const before = cloneSerializable({ quotation: editor.quotation.value, revisions: editor.quotationRevisions.value })
    save.mockClear()

    for (const operation of [
      actions.createQuotationRevision({ filePath: 'C:/test/quote.json' }),
      actions.restoreQuotationRevision(archivedId, { filePath: 'C:/test/quote.json' }),
      actions.deleteQuotationRevision(archivedId, { filePath: 'C:/test/quote.json' }),
    ]) {
      await expect(operation).rejects.toMatchObject({
        code: 'quotation_number_required',
        fieldPath: 'quotation.header.quotationNumber',
      })
    }

    expect(save).not.toHaveBeenCalled()
    expect({ quotation: editor.quotation.value, revisions: editor.quotationRevisions.value }).toEqual(before)
  })

  it('rejects restoring an archived quotation that has no number before writing or replacing the live draft', async () => {
    const { editor, actions, save } = createHarness()
    await actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })
    const archivedId = editor.quotationRevisions.value[0]!.id
    editor.quotationRevisions.value[0]!.quotation.header.quotationNumber = ' '
    const before = cloneSerializable({ quotation: editor.quotation.value, revisions: editor.quotationRevisions.value })
    save.mockClear()

    await expect(actions.restoreQuotationRevision(archivedId, { filePath: 'C:/test/quote.json' })).rejects.toMatchObject({
      code: 'quotation_number_required',
      fieldPath: 'quotation.header.quotationNumber',
    })

    expect(save).not.toHaveBeenCalled()
    expect({ quotation: editor.quotation.value, revisions: editor.quotationRevisions.value }).toEqual(before)
  })

  it.each(['cancel', 'fail'] as const)('leaves working edits, history, path, and undo unchanged when deletion saves %s', async outcome => {
    const { editor, actions, save } = createHarness()
    await actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })
    editor.updateHeaderField('projectName', 'Working edits')
    editor.commitQuotationChangeHistory()
    const before = cloneSerializable({ quotation: editor.quotation.value, revisions: editor.quotationRevisions.value })
    const archivedId = editor.quotationRevisions.value[0]!.id
    if (outcome === 'cancel') save.mockResolvedValueOnce({ canceled: true })
    else save.mockRejectedValueOnce(new Error('Disk full'))
    const operation = actions.deleteQuotationRevision(archivedId, { filePath: 'C:/test/different.json' })
    if (outcome === 'cancel') await expect(operation).resolves.toBeNull()
    else await expect(operation).rejects.toMatchObject({ code: 'file_write_failed' })
    expect({ quotation: editor.quotation.value, revisions: editor.quotationRevisions.value }).toEqual(before)
    expect(actions.currentFilePath.value).toBe('C:/test/quote.json')
    expect(editor.isQuotationRevisionBusy.value).toBe(false)
    expect(editor.undoLastQuotationChange().ok).toBe(true)
  })

  it('commits deletion to the open document after disk save even if its recovery cache fails', async () => {
    const { editor, actions, save } = createHarness()
    await actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })
    const archivedId = editor.quotationRevisions.value[0]!.id
    editor.updateHeaderField('projectName', 'Keep working edits')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded') })

    expect(await actions.deleteQuotationRevision(archivedId)).toMatchObject({ cacheWarning: true })
    expect(editor.quotationRevisions.value).toEqual([])
    const persisted = parseQuotationDocumentContent(save.mock.calls.at(-1)![0].content)
    expect(persisted.quotation).toEqual(editor.quotation.value)
    expect(persisted.quotation.header).toMatchObject({ projectName: 'Keep working edits', revisionNumber: 2 })
    expect(persisted.revisions).toEqual([])
    expect(actions.statusMessage.value).toBe('quotations.revisions.cacheWarning')
  })

  it('blocks edits during deletion and publishes the reduced history only after the save finishes', async () => {
    const { editor, actions, save } = createHarness()
    await actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })
    const archivedId = editor.quotationRevisions.value[0]!.id
    let finish!: (value: { canceled: false; filePath: string; mode: 'native' }) => void
    save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const deleting = actions.deleteQuotationRevision(archivedId)
    expect(editor.isQuotationRevisionBusy.value).toBe(true)
    expect(editor.quotationRevisions.value).toHaveLength(1)
    expect(() => editor.updateHeaderField('projectName', 'Race')).toThrow('operation_in_progress')
    await expect(actions.deleteQuotationRevision(archivedId)).rejects.toMatchObject({ code: 'operation_in_progress' })
    finish({ canceled: false, filePath: 'C:/test/quote.json', mode: 'native' })
    await deleting
    expect(editor.quotationRevisions.value).toEqual([])
    expect(editor.isQuotationRevisionBusy.value).toBe(false)
  })

  it('rejects deletion with invalid identifiers, unavailable history, or an oversized resulting file before writing', async () => {
    const { editor, actions, save } = createHarness()
    await actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })
    const archivedId = editor.quotationRevisions.value[0]!.id
    save.mockClear()
    await expect(actions.deleteQuotationRevision('')).rejects.toMatchObject({ code: 'invalid_argument' })
    await expect(actions.deleteQuotationRevision(editor.quotation.value.id)).rejects.toMatchObject({ code: 'revision_not_found' })
    await expect(actions.deleteQuotationRevision(archivedId, { filePath: ' ' })).rejects.toMatchObject({ code: 'invalid_argument' })
    editor.revisionHistoryUnavailable.value = true
    await expect(actions.deleteQuotationRevision(archivedId)).rejects.toMatchObject({ code: 'history_unavailable' })
    editor.revisionHistoryUnavailable.value = false
    editor.quotation.value.header.notes = '界'.repeat(3_600_000)
    await expect(actions.deleteQuotationRevision(archivedId)).rejects.toMatchObject({ code: 'input_too_large' })
    expect(editor.quotationRevisions.value).toHaveLength(1)
    expect(save).not.toHaveBeenCalled()
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

  it.each(['indexed', 'legacy'] as const)('invalidates stale %s recovery after the first revision saves but cache writes fail', async (storageKind) => {
    const { editor, actions, save } = createHarness()
    const quotationId = editor.quotation.value.id
    if (storageKind === 'indexed') {
      editor.saveCurrentQuotation()
      editor.saveCurrentQuotation()
    } else {
      localStorage.setItem('quotation-software:quotation-drafts', JSON.stringify([editor.quotation.value]))
    }
    const failedCache = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded') })
    await expect(actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })).resolves.toMatchObject({ cacheWarning: true })
    const persisted = parseQuotationDocumentContent(save.mock.calls[0]![0].content)
    expect(persisted.revisions).toHaveLength(1)
    expect(editor.quotationRevisions.value).toHaveLength(1)
    failedCache.mockRestore()

    expect(loadSavedQuotations().some(draft => draft.id === quotationId)).toBe(false)
    expect(localStorage.getItem(`quotation-software:quotation-draft:${quotationId}:backup`)).toBeNull()
    const reopened = createHarness()
    expect(reopened.editor.savedDrafts.value).toEqual([])
    await reopened.actions.importJsonContentForAutomation(save.mock.calls[0]![0].content)
    expect(reopened.editor.quotationRevisions.value).toHaveLength(1)
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

  it('invalidates old recovery when reopening a file with history cannot update the cache', async () => {
    const { editor, actions, runtime } = createHarness()
    editor.saveCurrentQuotation()
    const document = proposeQuotationRevision({ quotation: editor.quotation.value, revisions: [] })
    runtime.openQuotationFileFromPath = vi.fn().mockResolvedValue({
      canceled: false, filePath: 'C:/test/quote.json',
      content: createQuotationFileContent(document.quotation, document.revisions),
    })
    const failedCache = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded') })
    await expect(actions.importJsonFromPathForAutomation('C:/test/quote.json')).resolves.toBe(true)
    expect(actions.statusMessage.value).toBe('quotations.revisions.cacheOpenedWarning')
    expect(editor.quotationRevisions.value).toHaveLength(1)
    failedCache.mockRestore()
    expect(loadSavedQuotations()).toEqual([])
  })

  it('keeps prior recovery for content-only imports until a durable file has been saved', async () => {
    const { editor, actions, save } = createHarness()
    editor.saveCurrentQuotation()
    const id = editor.quotation.value.id
    const document = proposeQuotationRevision({ quotation: editor.quotation.value, revisions: [] })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded') })
    expect(() => actions.importJsonContentForAutomation(createQuotationFileContent(document.quotation, document.revisions))).toThrow()
    expect(localStorage.getItem(`quotation-software:quotation-draft:${id}`)).not.toBeNull()

    await expect(actions.saveQuotationToPath('C:/test/recovered.json')).resolves.toMatchObject({ filePath: 'C:/test/quote.json' })
    expect(parseQuotationDocumentContent(save.mock.calls[0]![0].content).revisions).toHaveLength(1)
    expect(localStorage.getItem(`quotation-software:quotation-draft:${id}`)).toBeNull()
    expect(actions.statusMessage.value).toBe('quotations.revisions.cacheWarning')
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

  it('preserves history in browser saves but disallows creating, restoring, or deleting revisions', async () => {
    const desktop = createHarness()
    await desktop.actions.createQuotationRevision({ filePath: 'C:/test/quote.json' })
    const browser = createHarness(false)
    await browser.actions.importJsonContentForAutomation(desktop.actions.serializeQuotationDocument())
    await browser.actions.saveDraftAs()
    expect(parseQuotationDocumentContent(browser.save.mock.calls[0]![0].content).revisions).toHaveLength(1)
    await expect(browser.actions.createQuotationRevision({}, true)).rejects.toMatchObject({ code: 'unsupported_operation' })
    await expect(browser.actions.restoreQuotationRevision(browser.editor.quotationRevisions.value[0]!.id, {}, true)).rejects.toMatchObject({ code: 'unsupported_operation' })
    await expect(browser.actions.deleteQuotationRevision(browser.editor.quotationRevisions.value[0]!.id, {}, true)).rejects.toMatchObject({ code: 'unsupported_operation' })
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
