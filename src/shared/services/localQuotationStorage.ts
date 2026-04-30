import type { QuotationDraft } from '@/features/quotations/types'
import { normalizeQuotationDraft } from '@/features/quotations/utils/quotationDraft'
import { cloneSerializable } from '@/shared/utils/clone'

const LEGACY_STORAGE_KEY = 'quotation-software:quotation-drafts'
const INDEX_STORAGE_KEY = 'quotation-software:quotation-draft-ids'
const DRAFT_KEY_PREFIX = 'quotation-software:quotation-draft:'

export class QuotationStorageError extends Error {
  code: 'quota_exceeded' | 'write_failed'

  constructor(code: 'quota_exceeded' | 'write_failed', message: string) {
    super(message)
    this.name = 'QuotationStorageError'
    this.code = code
  }
}

export function loadSavedQuotations() {
  if (!hasLocalStorage()) {
    return []
  }

  return loadIndexedSavedQuotations() ?? loadLegacySavedQuotations()
}

export function loadLatestQuotationDraft() {
  if (!hasLocalStorage()) {
    return null
  }

  const indexedDraftIds = loadDraftIds()

  if (indexedDraftIds && indexedDraftIds.length > 0) {
    const latestDraftId = indexedDraftIds.at(-1)
    return latestDraftId ? loadDraftById(latestDraftId) : null
  }

  return loadLegacySavedQuotations().at(-1) ?? null
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

function loadIndexedSavedQuotations() {
  const draftIds = loadDraftIds()

  if (draftIds === null) {
    return null
  }

  return draftIds
    .map((draftId) => loadDraftById(draftId))
    .filter((draft): draft is QuotationDraft => draft !== null)
}

function loadLegacySavedQuotations() {
  const rawValue = window.localStorage.getItem(LEGACY_STORAGE_KEY)

  if (!rawValue) {
    return []
  }

  try {
    return (JSON.parse(rawValue) as QuotationDraft[]).map((draft) =>
      normalizeQuotationDraft(cloneSerializable(draft), { ensureAtLeastOneItem: false }),
    )
  } catch {
    return []
  }
}

function loadDraftIds() {
  const rawValue = window.localStorage.getItem(INDEX_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function loadDraftById(draftId: string) {
  const rawValue = window.localStorage.getItem(createDraftStorageKey(draftId))

  if (!rawValue) {
    return null
  }

  try {
    return normalizeQuotationDraft(cloneSerializable(JSON.parse(rawValue) as QuotationDraft), {
      ensureAtLeastOneItem: false,
    })
  } catch {
    return null
  }
}

function persistDrafts(drafts: QuotationDraft[]) {
  const nextDrafts = drafts.map((draft) => cloneSerializable(draft))
  const draftIds = nextDrafts.map((draft) => draft.id)

  nextDrafts.forEach((draft) => {
    window.localStorage.setItem(createDraftStorageKey(draft.id), JSON.stringify(draft))
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
  window.localStorage.setItem(createDraftStorageKey(draft.id), JSON.stringify(draft))
  window.localStorage.setItem(INDEX_STORAGE_KEY, JSON.stringify(appendDraftIdIfMissing(draftIds, draft.id)))
  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
}

function upsertQuotationDraft(drafts: QuotationDraft[], quotation: QuotationDraft) {
  const index = drafts.findIndex((draft) => draft.id === quotation.id)
  const nextDraft = cloneSerializable(quotation)

  if (index === -1) {
    return [...drafts, nextDraft]
  }

  return drafts.map((draft, draftIndex) => (draftIndex === index ? nextDraft : draft))
}

function appendDraftIdIfMissing(draftIds: string[], nextDraftId: string) {
  return draftIds.includes(nextDraftId) ? draftIds : [...draftIds, nextDraftId]
}

function createDraftStorageKey(draftId: string) {
  return `${DRAFT_KEY_PREFIX}${draftId}`
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
