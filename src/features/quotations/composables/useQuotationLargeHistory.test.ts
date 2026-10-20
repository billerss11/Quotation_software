// @vitest-environment jsdom

import { effectScope, shallowRef } from 'vue'
import type { EffectScope } from 'vue'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGoodsReceiptExport } from '@/features/goods-receipts/composables/useGoodsReceiptExport'
import { AUTOMATION_LIMITS, getMaximumBase64Length, getUtf8ByteLength } from '@/shared/contracts/automationLimits'
import type { AutomationResult } from '@/shared/contracts/quotationAutomation'
import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { validateLogoDataUrl } from '@/shared/utils/logoDataUrl'
import type { QuotationDocument, QuotationDraft, QuotationRevision } from '../types'
import { createInitialQuotation } from '../utils/quotationDraft'
import { createQuotationFileContent, parseQuotationDocumentContent, QUOTATION_FILE_SCHEMA_VERSION } from '../utils/quotationFile'
import { createQuotationItem } from '../utils/quotationItems'
import { useQuotationAutomationApis } from './useQuotationAutomationApis'
import { useQuotationEditor } from './useQuotationEditor'
import { useQuotationFileActions } from './useQuotationFileActions'

const FILE_PATH = 'C:/test/large-history.json'
const ARCHIVE_COUNT = 77
const scopes: EffectScope[] = []
let fixture: ReturnType<typeof createLargeHistoryFixture>

beforeAll(() => {
  fixture = createLargeHistoryFixture()
})
beforeEach(() => window.localStorage.clear())
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.restoreAllMocks()
})

describe('quotation history larger than one expanded JSON string', () => {
  it('preserves every snapshot through import, ordinary save, reopen, create, restore, and delete', async () => {
    expect(validateLogoDataUrl(fixture.logo)).toMatchObject({ ok: true, byteLength: AUTOMATION_LIMITS.logoBytes })
    expect(getUtf8ByteLength(fixture.content)).toBeLessThan(AUTOMATION_LIMITS.quotationJsonBytes)
    // Prove the original failure boundary without allocating the expanded JSON string.
    expect(fixture.logo.length * (ARCHIVE_COUNT + 1)).toBeGreaterThan(512 * 1024 * 1024)
    const first = createIntegratedHarness(new Map([[FILE_PATH, fixture.content]]))

    const imported = successful(await first.api.importQuotationFile(FILE_PATH))
    expect(imported.quotation.branding.logoDataUrl === fixture.logo).toBe(true)
    expectQuotationEqual(imported.quotation, { ...fixture.document.quotation, metadata: imported.quotation.metadata })
    expectOriginalArchives(first.editor.quotationRevisions.value)

    await first.fileActions.saveDraft()
    expect(first.runtime.saveQuotationFile).toHaveBeenCalledTimes(1)
    expect(first.fileActions.currentFilePath.value).toBe(FILE_PATH)
    // The durable file remains usable when the large current logo exceeds jsdom's recovery-cache quota.
    expect(first.fileActions.statusMessage.value).toBe('quotations.revisions.cacheWarning')
    expectStoredHistory(first.files.get(FILE_PATH)!, ARCHIVE_COUNT)

    const reopened = createIntegratedHarness(first.files)
    successful(await reopened.api.importQuotationFile(FILE_PATH))
    expectOriginalArchives(reopened.editor.quotationRevisions.value)
    const snapshot = successful(await reopened.api.getQuotationSnapshot())
    expect(snapshot.quotation.header.revisionNumber).toBe(78)
    expect(snapshot.quotation.branding.logoDataUrl === fixture.logo).toBe(true)
    snapshot.quotation.header.projectName = 'Mutating an API snapshot must be isolated'
    expect(reopened.editor.quotation.value.header.projectName).toBe('Scope 78')

    const serialization = successful(await reopened.api.serializeQuotation())
    expectOriginalArchives(serialization.revisions)
    expectStoredHistory(serialization.content, ARCHIVE_COUNT)
    serialization.revisions[0]!.quotation.header.projectName = 'Mutating serialized history must be isolated'
    expectOriginalArchives(reopened.editor.quotationRevisions.value)

    successful(await reopened.api.updateHeader({ projectName: 'Working scope before create' }))
    successful(await reopened.api.createQuotationRevision({ note: 'Large history still saves' }))
    expectOriginalArchives(reopened.editor.quotationRevisions.value)
    expect(reopened.editor.quotationRevisions.value.length).toBe(78)
    const createdArchive = reopened.editor.quotationRevisions.value[77]!
    expect(createdArchive.quotation.header.projectName).toBe('Working scope before create')
    expect(createdArchive.quotation.branding.logoDataUrl === fixture.logo).toBe(true)
    expect(reopened.editor.quotation.value.header.revisionNumber).toBe(79)

    successful(await reopened.api.updateHeader({ projectName: 'Keep this work before restore' }))
    const restoredArchive = fixture.document.revisions[16]!
    successful(await reopened.api.restoreQuotationRevision(restoredArchive.id))
    expectOriginalArchives(reopened.editor.quotationRevisions.value)
    expect(reopened.editor.quotationRevisions.value.length).toBe(79)
    expect(reopened.editor.quotation.value.header).toMatchObject({ projectName: 'Scope 17', revisionNumber: 80 })
    expect(reopened.editor.quotation.value.branding.logoDataUrl === fixture.logo).toBe(true)
    const preservedWorkingCopy = reopened.editor.quotationRevisions.value[78]!
    expect(preservedWorkingCopy.quotation.header.projectName).toBe('Keep this work before restore')
    expect(preservedWorkingCopy.quotation.branding.logoDataUrl === fixture.logo).toBe(true)

    successful(await reopened.api.deleteQuotationRevision(createdArchive.id))
    expect(reopened.editor.quotationRevisions.value.length).toBe(78)
    expectOriginalArchives(reopened.editor.quotationRevisions.value)
    expect(reopened.editor.quotationRevisions.value[77]!.id).toBe(preservedWorkingCopy.id)
    expect(reopened.editor.quotation.value.header.revisionNumber).toBe(80)
    expectStoredHistory(first.files.get(FILE_PATH)!, 78)
    const finalDocument = parseQuotationDocumentContent(first.files.get(FILE_PATH)!)
    expectQuotationEqual(finalDocument.quotation, reopened.editor.quotation.value)
    expectRevisionEqual(finalDocument.revisions[77]!, preservedWorkingCopy)
    expect(reopened.runtime.saveQuotationFile).toHaveBeenCalledTimes(3)
  }, 60000)

  it('detects current and archived logo changes and enforces expectedRevision for queued edits', async () => {
    const { api, editor } = createIntegratedHarness(new Map([[FILE_PATH, fixture.content]]))
    successful(await api.importQuotationFile(FILE_PATH))
    const initial = successful(await api.getQuotationSnapshot()).revision
    expect(successful(await api.getQuotationSnapshot()).revision).toBe(initial)
    const unchangedLogo = await api.setBranding({ logoDataUrl: fixture.logo })
    successful(unchangedLogo)
    expect(unchangedLogo.meta.revision).toBe(initial)

    // Equal-length image content must still affect the document revision.
    const changedLogo = await api.setBranding({ logoDataUrl: fixture.alternateLogo })
    successful(changedLogo)
    expect(changedLogo.meta.revision).toBe(initial + 1)
    expect(await api.applyOperations({
      expectedRevision: initial,
      operations: [{ type: 'updateHeader', patch: { projectName: 'Stale edit' } }],
    })).toMatchObject({ ok: false, error: { code: 'revision_conflict' } })
    expect(editor.quotation.value.header.projectName).toBe('Scope 78')

    const [accepted, rejected] = await Promise.all([
      api.applyOperations({
        expectedRevision: changedLogo.meta.revision,
        operations: [{ type: 'updateHeader', patch: { projectName: 'Accepted queued edit' } }],
      }),
      api.applyOperations({
        expectedRevision: changedLogo.meta.revision,
        operations: [{ type: 'updateHeader', patch: { projectName: 'Conflicting queued edit' } }],
      }),
    ])
    successful(accepted)
    expect(rejected).toMatchObject({ ok: false, error: { code: 'revision_conflict' } })
    expect(editor.quotation.value.header.projectName).toBe('Accepted queued edit')
    expectOriginalArchives(editor.quotationRevisions.value)

    editor.quotationRevisions.value[0]!.quotation.branding.logoDataUrl = fixture.alternateLogo
    const archiveChanged = successful(await api.getQuotationSnapshot())
    expect(archiveChanged.revision).toBe(accepted.meta.revision + 1)
    expect(successful(await api.getQuotationSnapshot()).revision).toBe(archiveChanged.revision)
    expect(await api.applyOperations({
      expectedRevision: accepted.meta.revision,
      operations: [{ type: 'updateHeader', patch: { projectName: 'Stale after archive change' } }],
    })).toMatchObject({ ok: false, error: { code: 'revision_conflict' } })
    expect(editor.quotation.value.header.projectName).toBe('Accepted queued edit')
    expect(fixture.document.revisions[0]!.quotation.branding.logoDataUrl === fixture.logo).toBe(true)
  }, 30000)

  it('keeps the current document, history, availability, and undo when archive preparation fails', () => {
    const { editor } = createIntegratedHarness()
    const existing = createInitialQuotation([], 'en-US')
    const archived = {
      id: 'existing-archive', revisionNumber: 1, createdAt: '2026-10-01T00:00:00.000Z', quotation: existing,
    }
    editor.replaceQuotationDocument({
      quotation: { ...existing, header: { ...existing.header, revisionNumber: 2 } },
      revisions: [archived],
    }, true)
    editor.updateHeaderField('projectName', 'Keep these unsaved edits')
    editor.commitQuotationChangeHistory()
    const current = editor.quotation.value
    const history = editor.quotationRevisions.value
    const incoming = createInitialQuotation([], 'en-US')
    const brokenArchive = { ...archived }
    Object.defineProperty(brokenArchive, 'quotation', {
      enumerable: true,
      get() { throw new Error('Cannot clone incoming archive') },
    })

    expect(() => editor.replaceQuotationDocument({ quotation: incoming, revisions: [brokenArchive] }))
      .toThrow('Cannot clone incoming archive')
    expect(editor.quotation.value === current).toBe(true)
    expect(editor.quotationRevisions.value === history).toBe(true)
    expect(editor.revisionHistoryUnavailable.value).toBe(true)
    expect(editor.canUndoQuotationChange.value).toBe(true)
    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(editor.quotation.value.header.projectName).toBe(existing.header.projectName)
    expect(editor.quotationRevisions.value === history).toBe(true)
  })
})

function successful<T>(result: AutomationResult<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.data
}

function expectQuotationEqual(actual: QuotationDraft, expected: QuotationDraft) {
  // Compare images as booleans so a failure cannot dump megabytes of base64.
  expect(actual.branding.logoDataUrl === expected.branding.logoDataUrl).toBe(true)
  const withoutLogo = (quotation: QuotationDraft) => ({
    ...quotation, branding: { ...quotation.branding, logoDataUrl: '' },
  })
  expect(withoutLogo(actual)).toEqual(withoutLogo(expected))
}

function expectRevisionEqual(actual: QuotationRevision, expected: QuotationRevision) {
  expect({ ...actual, quotation: undefined }).toEqual({ ...expected, quotation: undefined })
  expectQuotationEqual(actual.quotation, expected.quotation)
}

function expectOriginalArchives(revisions: QuotationRevision[]) {
  expect(revisions.length).toBeGreaterThanOrEqual(ARCHIVE_COUNT)
  fixture.document.revisions.forEach((expected, index) => expectRevisionEqual(revisions[index]!, expected))
}

function expectStoredHistory(content: string, count: number) {
  const stored = JSON.parse(content)
  expect(stored.schemaVersion).toBe(QUOTATION_FILE_SCHEMA_VERSION)
  expect(Object.keys(stored.images)).toEqual(['image-1'])
  expect(stored.images['image-1'] === fixture.logo).toBe(true)
  expect(stored.quotation.branding.logoImageId).toBe('image-1')
  expect(stored.revisions.length).toBe(count)
  expect(stored.revisions.every((revision: { quotation: { branding: { logoImageId: string } } }) =>
    revision.quotation.branding.logoImageId === 'image-1')).toBe(true)
  expect(getUtf8ByteLength(content)).toBeLessThan(AUTOMATION_LIMITS.quotationJsonBytes)
  expectOriginalArchives(parseQuotationDocumentContent(content).revisions)
}

function createLargeHistoryFixture() {
  const png = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=')
  // Align the PNG prefix to base64 groups, then pad to exactly 5 MiB with zero bytes.
  const prefix = btoa(png + '\0'.repeat((3 - png.length % 3) % 3))
  const paddingLength = getMaximumBase64Length(AUTOMATION_LIMITS.logoBytes) - prefix.length - 1
  const logo = `data:image/png;base64,${prefix}${'A'.repeat(paddingLength)}=`
  const alternateLogo = `${logo.slice(0, -8)}B${logo.slice(-7)}`
  const makeQuotation = (number: number): QuotationDraft => {
    const quotation = createInitialQuotation([], 'en-US', { quotationNumber: 'LARGE-HISTORY-001' })
    quotation.id = 'large-history-family'
    quotation.header.revisionNumber = number
    quotation.header.projectName = `Scope ${number}`
    quotation.header.notes = `Preserve the complete content of snapshot ${number}`
    quotation.branding.logoDataUrl = logo
    quotation.majorItems = [createQuotationItem('USD', { name: `Product ${number}`, unitCost: number * 10, quantity: 2 })]
    return quotation
  }
  const document: QuotationDocument = {
    quotation: makeQuotation(ARCHIVE_COUNT + 1),
    revisions: Array.from({ length: ARCHIVE_COUNT }, (_, index) => ({
      id: `large-history-${index + 1}`,
      revisionNumber: index + 1,
      createdAt: '2026-10-01T00:00:00.000Z',
      note: `Issued scope ${index + 1}`,
      quotation: makeQuotation(index + 1),
    })),
  }
  return { document, logo, alternateLogo, content: createQuotationFileContent(document.quotation, document.revisions) }
}

function createIntegratedHarness(files = new Map<string, string>()) {
  const save = vi.fn<QuotationRuntime['saveQuotationFile']>().mockImplementation(async ({ filePath, content }) => {
    const path = filePath || FILE_PATH
    files.set(path, content)
    return { canceled: false, filePath: path, mode: 'native' }
  })
  const runtime = {
    capabilities: {
      isDesktop: true, hasNativeFileDialogs: true, supportsFileSystemAccess: false,
      supportsDirectPdfExport: true, supportsBrowserPrint: false,
    },
    getAppVersion: vi.fn().mockResolvedValue('test'),
    saveQuotationFile: save,
    openQuotationFileFromPath: vi.fn<QuotationRuntime['openQuotationFileFromPath']>().mockImplementation(async filePath => {
      const content = files.get(filePath)
      if (content === undefined) throw new Error('The in-memory quotation file does not exist')
      return { canceled: false, filePath, content }
    }),
  } as unknown as QuotationRuntime
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => {
    const editor = useQuotationEditor(shallowRef('en-US'))
    const fileActions = useQuotationFileActions({
      ...editor, runtime, flushPendingEdits: editor.commitQuotationChangeHistory, t: key => key,
    })
    const goodsReceiptExport = useGoodsReceiptExport({
      ...editor, runtime, statusMessage: fileActions.statusMessage, t: key => key,
    })
    const { apiV2: api } = useQuotationAutomationApis({
      editor, fileActions, goodsReceiptExport, runtime, t: key => key,
    })
    return { editor, fileActions, api, runtime, files }
  })!
}
