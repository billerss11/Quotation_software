import type { QuotationDraft } from '@/features/quotations/types'
import { normalizeQuotationDraft } from '@/features/quotations/utils/quotationDraft'
import { cloneSerializable } from '@/shared/utils/clone'

const STORAGE_KEY = 'quotation-software:quotation-drafts'

export function loadSavedQuotations() {
  if (!hasLocalStorage()) {
    return []
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY)

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

export function loadLatestQuotationDraft() {
  return loadSavedQuotations().at(-1) ?? null
}

export function saveQuotationDraft(quotation: QuotationDraft) {
  if (!hasLocalStorage()) {
    return
  }

  const existingDrafts = loadSavedQuotations()
  const nextDrafts = upsertQuotationDraft(existingDrafts, quotation)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDrafts))
}

function upsertQuotationDraft(drafts: QuotationDraft[], quotation: QuotationDraft) {
  const index = drafts.findIndex((draft) => draft.id === quotation.id)
  const nextDraft = cloneSerializable(quotation)

  if (index === -1) {
    return [...drafts, nextDraft]
  }

  return drafts.map((draft, draftIndex) => (draftIndex === index ? nextDraft : draft))
}

export function hasLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}
