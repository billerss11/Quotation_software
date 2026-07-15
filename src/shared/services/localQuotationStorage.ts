import type { QuotationDraft } from '@/features/quotations/types'
import { normalizeQuotationDraft } from '@/features/quotations/utils/quotationDraft'
import { cloneSerializable } from '@/shared/utils/clone'

const LEGACY_STORAGE_KEY = 'quotation-software:quotation-drafts'
const INDEX_STORAGE_KEY = 'quotation-software:quotation-draft-ids'
const DRAFT_KEY_PREFIX = 'quotation-software:quotation-draft:'
const DRAFT_BACKUP_SUFFIX = ':backup'

export interface QuotationStorageRecoveryReport {
  recoveredDraftCount: number
  discardedDraftCount: number
  indexRebuilt: boolean
}

export interface LoadedQuotations {
  drafts: QuotationDraft[]
  recovery: QuotationStorageRecoveryReport
}

export class QuotationStorageError extends Error {
  code: 'quota_exceeded' | 'write_failed'

  constructor(code: 'quota_exceeded' | 'write_failed', message: string) {
    super(message)
    this.name = 'QuotationStorageError'
    this.code = code
  }
}

export function loadSavedQuotations() {
  return loadSavedQuotationsWithRecovery().drafts
}

export function loadSavedQuotationsWithRecovery(): LoadedQuotations {
  if (!hasLocalStorage()) {
    return {
      drafts: [],
      recovery: createEmptyRecoveryReport(),
    }
  }

  const index = loadDraftIndex()
  const discoveredDraftIds = discoverStoredDraftIds()

  if (index.ids === null && discoveredDraftIds.length === 0) {
    return loadLegacySavedQuotationsWithRecovery()
  }

  const indexedDraftIds = index.ids ?? []
  const unindexedDraftIds = discoveredDraftIds.filter((draftId) => !indexedDraftIds.includes(draftId))
  const orderedDraftIds = [...indexedDraftIds, ...unindexedDraftIds]
  const recoveredDraftIds = new Set<string>()
  let discardedDraftCount = 0
  const storedDrafts = orderedDraftIds.flatMap((draftId) => {
    const loaded = loadDraftByIdWithRecovery(draftId)

    if (!loaded.draft) {
      discardedDraftCount += 1
      discardDamagedDraft(draftId)
      return []
    }

    if (loaded.recoveredFromBackup || unindexedDraftIds.includes(draftId)) {
      recoveredDraftIds.add(draftId)
    }

    return [loaded.draft]
  })
  const legacyResult = index.ids === null || index.corrupt
    ? loadLegacySavedQuotationsWithRecovery()
    : null
  const drafts = legacyResult
    ? mergeQuotationDrafts(legacyResult.drafts, storedDrafts)
    : storedDrafts
  discardedDraftCount += legacyResult?.recovery.discardedDraftCount ?? 0
  const shouldRebuildIndex = index.corrupt || unindexedDraftIds.length > 0 || discardedDraftCount > 0
  const indexRebuilt = shouldRebuildIndex ? rebuildDraftIndex(drafts) : false

  return {
    drafts,
    recovery: {
      recoveredDraftCount: recoveredDraftIds.size,
      discardedDraftCount,
      indexRebuilt,
    },
  }
}

export function loadLatestQuotationDraft() {
  return loadSavedQuotationsWithRecovery().drafts.at(-1) ?? null
}

export function saveQuotationDraft(quotation: QuotationDraft) {
  if (!hasLocalStorage()) {
    return
  }

  try {
    persistDraft(quotation)
  } catch (error) {
    throw createQuotationStorageError(error)
  }
}

function loadLegacySavedQuotations() {
  return loadLegacySavedQuotationsWithRecovery().drafts
}

function loadLegacySavedQuotationsWithRecovery(): LoadedQuotations {
  const rawValue = window.localStorage.getItem(LEGACY_STORAGE_KEY)

  if (!rawValue) {
    return {
      drafts: [],
      recovery: createEmptyRecoveryReport(),
    }
  }

  try {
    const parsed: unknown = JSON.parse(rawValue)
    if (!Array.isArray(parsed)) {
      return createDiscardedLegacyResult()
    }

    let discardedDraftCount = 0
    const drafts = parsed.flatMap((value) => {
      const draft = parseStoredDraft(value)
      if (!draft) {
        discardedDraftCount += 1
        return []
      }

      return [draft]
    })

    return {
      drafts,
      recovery: {
        recoveredDraftCount: 0,
        discardedDraftCount,
        indexRebuilt: false,
      },
    }
  } catch {
    return createDiscardedLegacyResult()
  }
}

function loadDraftIndex(): { ids: string[] | null; corrupt: boolean } {
  const rawValue = window.localStorage.getItem(INDEX_STORAGE_KEY)

  if (!rawValue) {
    return { ids: null, corrupt: false }
  }

  try {
    const parsed: unknown = JSON.parse(rawValue)
    if (!Array.isArray(parsed)) {
      return { ids: [], corrupt: true }
    }

    return {
      ids: [...new Set(parsed.filter((value): value is string => typeof value === 'string' && value.length > 0))],
      corrupt: false,
    }
  } catch {
    return { ids: [], corrupt: true }
  }
}

function loadDraftIds() {
  return loadDraftIndex().ids
}

function loadDraftByIdWithRecovery(draftId: string) {
  const currentDraft = parseStoredDraftText(window.localStorage.getItem(createDraftStorageKey(draftId)))

  if (currentDraft) {
    return { draft: currentDraft, recoveredFromBackup: false }
  }

  const backupDraft = parseStoredDraftText(window.localStorage.getItem(createDraftBackupStorageKey(draftId)))

  if (backupDraft) {
    try {
      window.localStorage.setItem(createDraftStorageKey(draftId), JSON.stringify(backupDraft))
    } catch {
      // The recovered in-memory draft is still usable even if storage remains full.
    }
  }

  return {
    draft: backupDraft,
    recoveredFromBackup: backupDraft !== null,
  }
}

function discardDamagedDraft(draftId: string) {
  window.localStorage.removeItem(createDraftStorageKey(draftId))
  window.localStorage.removeItem(createDraftBackupStorageKey(draftId))
}

function parseStoredDraftText(rawValue: string | null) {

  if (!rawValue) {
    return null
  }

  try {
    return parseStoredDraft(JSON.parse(rawValue))
  } catch {
    return null
  }
}

function parseStoredDraft(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  try {
    return normalizeQuotationDraft(cloneSerializable(value as QuotationDraft), { ensureAtLeastOneItem: false })
  } catch {
    return null
  }
}

function persistDrafts(drafts: QuotationDraft[]) {
  const nextDrafts = drafts.map((draft) => cloneSerializable(draft))
  const draftIds = nextDrafts.map((draft) => draft.id)

  nextDrafts.forEach((draft) => {
    persistDraftValue(draft)
  })
  window.localStorage.setItem(INDEX_STORAGE_KEY, JSON.stringify(draftIds))
  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
}

function persistDraft(quotation: QuotationDraft) {
  const indexedDraftIds = loadDraftIds()

  if (indexedDraftIds !== null) {
    persistIndexedDraft(cloneSerializable(quotation), indexedDraftIds)
    return
  }

  const legacyDrafts = loadLegacySavedQuotations()

  if (legacyDrafts.length === 0) {
    persistIndexedDraft(cloneSerializable(quotation), [])
    return
  }

  persistDrafts(upsertQuotationDraft(legacyDrafts, quotation))
}

function persistIndexedDraft(draft: QuotationDraft, draftIds: string[]) {
  persistDraftValue(draft)
  window.localStorage.setItem(INDEX_STORAGE_KEY, JSON.stringify(moveDraftIdToEnd(draftIds, draft.id)))
  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
}

function persistDraftValue(draft: QuotationDraft) {
  const storageKey = createDraftStorageKey(draft.id)
  const previousValue = window.localStorage.getItem(storageKey)

  if (previousValue) {
    window.localStorage.setItem(createDraftBackupStorageKey(draft.id), previousValue)
  }

  window.localStorage.setItem(storageKey, JSON.stringify(draft))
}

function upsertQuotationDraft(drafts: QuotationDraft[], quotation: QuotationDraft) {
  const index = drafts.findIndex((draft) => draft.id === quotation.id)
  const nextDraft = cloneSerializable(quotation)

  if (index === -1) {
    return [...drafts, nextDraft]
  }

  return drafts.map((draft, draftIndex) => (draftIndex === index ? nextDraft : draft))
}

function mergeQuotationDrafts(legacyDrafts: QuotationDraft[], storedDrafts: QuotationDraft[]) {
  const storedDraftById = new Map(storedDrafts.map((draft) => [draft.id, draft]))
  const legacyDraftIds = new Set(legacyDrafts.map((draft) => draft.id))

  return [
    ...legacyDrafts.map((draft) => storedDraftById.get(draft.id) ?? draft),
    ...storedDrafts.filter((draft) => !legacyDraftIds.has(draft.id)),
  ]
}

function moveDraftIdToEnd(draftIds: string[], nextDraftId: string) {
  return [...draftIds.filter((draftId) => draftId !== nextDraftId), nextDraftId]
}

function createDraftStorageKey(draftId: string) {
  return `${DRAFT_KEY_PREFIX}${draftId}`
}

function createDraftBackupStorageKey(draftId: string) {
  return `${createDraftStorageKey(draftId)}${DRAFT_BACKUP_SUFFIX}`
}

function discoverStoredDraftIds() {
  const draftIds: string[] = []

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith(DRAFT_KEY_PREFIX) || key.endsWith(DRAFT_BACKUP_SUFFIX)) {
      continue
    }

    const draftId = key.slice(DRAFT_KEY_PREFIX.length)
    if (draftId) {
      draftIds.push(draftId)
    }
  }

  return draftIds
}

function rebuildDraftIndex(drafts: QuotationDraft[]) {
  try {
    window.localStorage.setItem(INDEX_STORAGE_KEY, JSON.stringify(drafts.map((draft) => draft.id)))
    return true
  } catch {
    return false
  }
}

function createEmptyRecoveryReport(): QuotationStorageRecoveryReport {
  return {
    recoveredDraftCount: 0,
    discardedDraftCount: 0,
    indexRebuilt: false,
  }
}

function createDiscardedLegacyResult(): LoadedQuotations {
  return {
    drafts: [],
    recovery: {
      recoveredDraftCount: 0,
      discardedDraftCount: 1,
      indexRebuilt: false,
    },
  }
}

function createQuotationStorageError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const name = error instanceof Error ? error.name : ''
  const isQuotaError = /quota/i.test(message) || /quota/i.test(name)

  if (isQuotaError) {
    return new QuotationStorageError(
      'quota_exceeded',
      'Local draft storage is full. Remove old drafts or save the quotation to a file.',
    )
  }

  return new QuotationStorageError(
    'write_failed',
    'Could not save the local quotation draft.',
  )
}

export function hasLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}
