// @vitest-environment jsdom

import { effectScope, shallowRef } from 'vue'
import type { EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { cloneSerializable } from '@/shared/utils/clone'
import { createQuotationFileContent, parseQuotationDocumentContent } from '../utils/quotationFile'
import { createQuotationItem } from '../utils/quotationItems'
import { useQuotationAutomationApis } from './useQuotationAutomationApis'
import { useQuotationEditor } from './useQuotationEditor'
import { useQuotationFileActions } from './useQuotationFileActions'

const FIRST_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
const SECOND_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAAB'

const scopes: EffectScope[] = []
const temporaryDirectories: string[] = []

beforeEach(() => window.localStorage.clear())
afterEach(async () => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.restoreAllMocks()
  for (const directory of temporaryDirectories.splice(0)) {
    const target = resolve(directory)
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('quotation-revision-api-')) {
      throw new Error('Unexpected temporary directory; refusing cleanup')
    }
    await rm(target, { recursive: true, force: true })
  }
})

describe('quotation revision API with editor and file actions', () => {
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects revision number %s before any API mutation', async revisionNumber => {
    const { api, editor } = await createIntegratedHarness()
    const before = cloneSerializable(editor.quotation.value)

    expect(await api.updateHeader({ revisionNumber })).toMatchObject({ ok: false, error: { code: 'invalid_argument' } })
    expect(await api.createQuotation({ header: { revisionNumber } })).toMatchObject({ ok: false, error: { code: 'invalid_argument' } })
    expect(await api.applyOperations({ operations: [{ type: 'updateHeader', patch: { revisionNumber } }] }))
      .toMatchObject({ ok: false, error: { code: 'invalid_argument' } })
    expect(editor.quotation.value).toEqual(before)

    const serialized = await api.serializeQuotation()
    expect(serialized.ok).toBe(true)
    if (serialized.ok) {
      expect(parseQuotationDocumentContent(serialized.data.content).quotation.header.revisionNumber).toBe(1)
    }
  })

  it.each([1, Number.MAX_SAFE_INTEGER])('round-trips a valid boundary revision number %s through API save', async revisionNumber => {
    const { api, directory } = await createIntegratedHarness()
    expect(await api.createQuotation({ header: { revisionNumber } })).toMatchObject({ ok: true })

    const serialized = await api.serializeQuotation()
    expect(serialized.ok).toBe(true)
    if (serialized.ok) {
      expect(parseQuotationDocumentContent(serialized.data.content).quotation.header.revisionNumber).toBe(revisionNumber)
    }
    const filePath = join(directory, 'valid-revision-number.json')
    expect(await api.saveQuotationToFile(filePath)).toMatchObject({ ok: true })
    expect(parseQuotationDocumentContent(await readFile(filePath, 'utf8')).quotation.header.revisionNumber).toBe(revisionNumber)
  })

  it('creates, saves, reopens, restores, and exports history through the complete automation wiring', async () => {
    const { api, editor, directory, runtime } = await createIntegratedHarness()
    const filePath = join(directory, 'revision-test.json')
    const pdfPath = join(directory, 'archived-test.pdf')
    const original = cloneSerializable(editor.quotation.value)
    original.header.projectName = 'Original scope'
    original.majorItems = [createQuotationItem('USD', { unitCost: 100, quantity: 2 })]
    expect(await api.importQuotationContent(createQuotationFileContent(original))).toMatchObject({ ok: true })

    expect(await api.createQuotationRevision({ filePath, note: 'Initial issue' })).toMatchObject({ ok: true })
    const archivedId = editor.quotationRevisions.value[0]!.id
    expect(editor.quotation.value.header.revisionNumber).toBe(2)
    expect(editor.quotationRevisions.value[0]!.quotation.header.projectName).toBe('Original scope')
    expect(editor.undoLastQuotationChange().ok).toBe(false)

    expect(await api.updateHeader({ projectName: 'Current scope' })).toMatchObject({ ok: true })
    expect(await api.saveQuotationToFile(filePath)).toMatchObject({ ok: true })
    const saved = JSON.parse(await readFile(filePath, 'utf8'))
    expect(saved.schemaVersion).toBe(4)
    expect(saved.revisions).toHaveLength(1)
    expect(saved.quotation.header.projectName).toBe('Current scope')

    await api.createQuotation({ header: { projectName: 'Unrelated quotation' } })
    expect(editor.quotationRevisions.value).toEqual([])
    expect(await api.createQuotationRevision()).toMatchObject({ ok: false, error: { code: 'invalid_argument' } })
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual(saved)
    expect(await api.importQuotationFile(filePath)).toMatchObject({ ok: true })
    expect(editor.quotationRevisions.value).toEqual(parseQuotationDocumentContent(JSON.stringify(saved)).revisions)
    expect(await api.restoreQuotationRevision(archivedId)).toMatchObject({ ok: true })
    const restored = parseQuotationDocumentContent(await readFile(filePath, 'utf8'))
    expect(restored.quotation.header).toMatchObject({ revisionNumber: 3, projectName: 'Original scope' })
    expect(restored.revisions.map(entry => entry.revisionNumber)).toEqual([1, 2])
    expect(restored.revisions[1]!.quotation.header.projectName).toBe('Current scope')
    expect(editor.undoLastQuotationChange().ok).toBe(false)

    await api.updateHeader({ projectName: 'Working after restore' })
    const beforeExport = cloneSerializable({ quotation: editor.quotation.value, revisions: editor.quotationRevisions.value })
    const exported = await api.exportPdfToFile(pdfPath, { quotationRevisionId: archivedId })
    expect(exported).toMatchObject({ ok: true, data: { filePath: pdfPath } })
    expect(runtime.exportQuotationDocument).toHaveBeenCalledWith(expect.objectContaining({
      quotation: expect.objectContaining({ header: expect.objectContaining({ revisionNumber: 1, projectName: 'Original scope' }) }),
      totals: expect.objectContaining({ baseSubtotal: 200 }),
    }))
    expect({ quotation: editor.quotation.value, revisions: editor.quotationRevisions.value }).toEqual(beforeExport)
    const serialization = await api.serializeQuotation()
    expect(serialization).toMatchObject({ ok: true, data: { revisions: beforeExport.revisions } })
    if (serialization.ok) expect(JSON.parse(serialization.data.content).schemaVersion).toBe(4)
  })

  it('upgrades legacy history with multiple logos and preserves snapshots through reopen, restore, and deletion', async () => {
    const { api, editor, directory } = await createIntegratedHarness()
    const filePath = join(directory, 'legacy-images.json')
    const first = cloneSerializable(editor.quotation.value)
    first.header.projectName = 'First issued scope'
    first.branding.logoDataUrl = FIRST_LOGO
    const second = cloneSerializable(first)
    second.header.revisionNumber = 2
    second.header.projectName = 'Second issued scope'
    second.branding.logoDataUrl = SECOND_LOGO
    const active = cloneSerializable(second)
    active.header.revisionNumber = 3
    active.header.projectName = 'Current scope'
    active.branding.logoDataUrl = FIRST_LOGO
    const revisions = [first, second].map((quotation, index) => ({
      id: `legacy-revision-${index + 1}`,
      revisionNumber: index + 1,
      createdAt: '2026-10-12T00:00:00.000Z',
      note: `Issued offer ${index + 1}`,
      quotation,
    }))
    const legacyContent = JSON.stringify({
      schemaVersion: 3, app: 'quotation-software', exportedAt: '2026-10-12T00:00:00.000Z',
      quotation: active, revisions,
    })

    expect(await api.importQuotationContent(legacyContent)).toMatchObject({
      ok: true, data: { quotation: { branding: { logoDataUrl: FIRST_LOGO } } },
    })
    expect(editor.quotationRevisions.value).toEqual(revisions)
    const serialized = await api.serializeQuotation()
    expect(serialized).toMatchObject({
      ok: true, data: { quotation: { branding: { logoDataUrl: FIRST_LOGO } }, revisions },
    })
    if (!serialized.ok) return
    const optimized = JSON.parse(serialized.data.content)
    expect(optimized.schemaVersion).toBe(4)
    expect(optimized.images).toEqual({ 'image-1': FIRST_LOGO, 'image-2': SECOND_LOGO })
    expect(optimized.quotation.branding.logoImageId).toBe('image-1')
    expect(optimized.revisions.map((entry: { quotation: { branding: { logoImageId: string } } }) => entry.quotation.branding.logoImageId))
      .toEqual(['image-1', 'image-2'])

    expect(await api.saveQuotationToFile(filePath)).toMatchObject({ ok: true })
    expect(editor.quotationRevisions.value).toEqual(revisions)
    await api.createQuotation()
    expect(await api.importQuotationFile(filePath)).toMatchObject({ ok: true })
    expect(editor.quotationRevisions.value).toEqual(revisions)
    expect(editor.quotation.value.branding.logoDataUrl).toBe(FIRST_LOGO)

    expect(await api.restoreQuotationRevision(revisions[1]!.id)).toMatchObject({ ok: true })
    expect(editor.quotation.value.header).toMatchObject({ projectName: 'Second issued scope', revisionNumber: 4 })
    expect(editor.quotation.value.branding.logoDataUrl).toBe(SECOND_LOGO)
    expect(editor.quotationRevisions.value.slice(0, 2)).toEqual(revisions)
    const preservedWorkingCopy = cloneSerializable(editor.quotationRevisions.value[2]!)
    expect(preservedWorkingCopy.quotation.branding.logoDataUrl).toBe(FIRST_LOGO)
    expect(preservedWorkingCopy.quotation.header.projectName).toBe('Current scope')
    expect(parseQuotationDocumentContent(await readFile(filePath, 'utf8')).revisions).toEqual(editor.quotationRevisions.value)

    expect(await api.deleteQuotationRevision(revisions[0]!.id)).toMatchObject({ ok: true })
    expect(await api.deleteQuotationRevision(preservedWorkingCopy.id)).toMatchObject({ ok: true })
    const savedContent = await readFile(filePath, 'utf8')
    expect(JSON.parse(savedContent).images).toEqual({ 'image-1': SECOND_LOGO })
    expect(parseQuotationDocumentContent(savedContent).revisions).toEqual([revisions[1]])
    expect(editor.quotationRevisions.value).toEqual([revisions[1]])
    expect(await api.importQuotationFile(filePath)).toMatchObject({ ok: true })
    expect(editor.quotation.value.branding.logoDataUrl).toBe(SECOND_LOGO)
    expect(editor.quotationRevisions.value).toEqual([revisions[1]])
  })

  it('leaves the editor, path, history, and undo state unchanged after a rejected revision write', async () => {
    const { api, editor, fileActions, directory, runtime } = await createIntegratedHarness()
    await api.updateHeader({ projectName: 'Unsaved customer work' })
    const before = cloneSerializable(editor.quotation.value)
    vi.mocked(runtime.saveQuotationFile).mockRejectedValueOnce(new Error('Simulated disk failure'))

    expect(await api.createQuotationRevision({ filePath: join(directory, 'failed-revision.json') })).toMatchObject({ ok: false, error: { code: 'file_write_failed' } })
    expect(editor.quotation.value).toEqual(before)
    expect(editor.quotationRevisions.value).toEqual([])
    expect(fileActions.currentFilePath.value).toBe('')
    expect(editor.isQuotationRevisionBusy.value).toBe(false)
    expect(editor.undoLastQuotationChange().ok).toBe(true)
  })

  it('persists deletion of the last archive without discarding working edits or undo', async () => {
    const { api, editor, directory } = await createIntegratedHarness()
    const filePath = join(directory, 'deleted-revision-test.json')
    await api.createQuotationRevision({ filePath })
    const archivedId = editor.quotationRevisions.value[0]!.id
    const originalProjectName = editor.quotation.value.header.projectName
    await api.updateHeader({ projectName: 'Keep these edits' })
    const draftReference = editor.quotation.value

    expect(await api.deleteQuotationRevision(archivedId)).toMatchObject({ ok: true, data: { filePath, savedAt: expect.any(String) } })
    const saved = parseQuotationDocumentContent(await readFile(filePath, 'utf8'))
    expect(saved.quotation.header).toMatchObject({ projectName: 'Keep these edits', revisionNumber: 2 })
    expect(saved.revisions).toEqual([])
    expect(editor.quotation.value).toBe(draftReference)
    expect(await api.listQuotationRevisions()).toMatchObject({ ok: true, data: [] })
    expect(await api.getQuotationRevision(archivedId)).toMatchObject({ ok: false, error: { code: 'revision_not_found' } })
    expect(await api.deleteQuotationRevision(archivedId)).toMatchObject({ ok: false, error: { code: 'revision_not_found' } })
    expect(await api.updateHeader({ revisionNumber: 1 })).toMatchObject({ ok: false, error: { code: 'invalid_argument' } })
    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(editor.quotation.value.header.projectName).toBe(originalProjectName)
    expect(editor.quotationRevisions.value).toEqual([])

    expect(await api.createQuotationRevision()).toMatchObject({ ok: true })
    expect(editor.quotation.value.header.revisionNumber).toBe(3)
    expect(editor.quotationRevisions.value.map(entry => entry.revisionNumber)).toEqual([2])
  })
})

async function createIntegratedHarness() {
  const directory = await mkdtemp(join(tmpdir(), 'quotation-revision-api-'))
  temporaryDirectories.push(directory)
  const runtime = {
    capabilities: {
      isDesktop: true,
      hasNativeFileDialogs: true,
      supportsFileSystemAccess: false,
      supportsDirectPdfExport: true,
      supportsBrowserPrint: false,
    },
    getAppVersion: vi.fn().mockResolvedValue('test'),
    saveQuotationFile: vi.fn(async ({ filePath, content }) => {
      if (!filePath) throw new Error('The API must supply a path without opening a dialog')
      await writeFile(filePath, content, 'utf8')
      return { canceled: false, filePath, mode: 'native' }
    }),
    openQuotationFileFromPath: vi.fn(async filePath => ({ canceled: false, filePath, content: await readFile(filePath, 'utf8') })),
    exportQuotationDocument: vi.fn(async ({ filePath }) => ({ canceled: false, filePath, mode: 'native' })),
  } as unknown as QuotationRuntime
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => {
    const editor = useQuotationEditor(shallowRef('en-US'))
    const fileActions = useQuotationFileActions({
      ...editor,
      runtime,
      flushPendingEdits: editor.commitQuotationChangeHistory,
      t: key => key,
    })
    const { apiV2: api } = useQuotationAutomationApis({
      editor,
      fileActions,
      runtime,
      t: key => key,
      goodsReceiptExport: {
        exportPendingGoodsReceiptPdfToFile: vi.fn(),
        exportPendingGoodsReceiptPdfToFileForAutomation: vi.fn(),
      } as unknown as Parameters<typeof useQuotationAutomationApis>[0]['goodsReceiptExport'],
    })
    return { api, editor, fileActions, directory, runtime }
  })!
}
