import { computed, shallowRef } from 'vue'
import type { Ref } from 'vue'

import { cloneSerializable } from '@/shared/utils/clone'
import type { QuotationDocument, QuotationDraft, QuotationRevision } from '../types'

export type QuotationRevisionErrorCode =
  | 'history_unavailable'
  | 'operation_in_progress'
  | 'revision_not_found'
  | 'invalid_argument'
  | 'unsupported_operation'
  | 'file_write_failed'

export class QuotationRevisionError extends Error {
  constructor(public readonly code: QuotationRevisionErrorCode) {
    super(code)
    this.name = 'QuotationRevisionError'
  }
}

/** History belongs to the open document, not to the mutable or cached draft. */
export function useQuotationRevisions(quotation: Ref<QuotationDraft>) {
  const quotationRevisions = shallowRef<QuotationRevision[]>([])
  const revisionHistoryUnavailable = shallowRef(false)
  const isQuotationRevisionBusy = shallowRef(false)
  const isRevisionNumberManaged = computed(() =>
    quotationRevisions.value.length > 0 || revisionHistoryUnavailable.value
      || (quotation.value.header.revisionNumber ?? 1) > 1,
  )

  function assertEditable() {
    if (isQuotationRevisionBusy.value) throw new QuotationRevisionError('operation_in_progress')
  }

  function assertHistoryAvailable() {
    if (revisionHistoryUnavailable.value) throw new QuotationRevisionError('history_unavailable')
  }

  function replaceHistory(document: QuotationDocument, historyUnavailable = false) {
    quotationRevisions.value = cloneSerializable(document.revisions)
    revisionHistoryUnavailable.value = historyUnavailable
  }

  function getQuotationRevision(id: string) {
    assertHistoryAvailable()
    const revision = quotationRevisions.value.find((entry) => entry.id === id)
    if (!revision) throw new QuotationRevisionError('revision_not_found')
    return cloneSerializable(revision)
  }

  return {
    quotationRevisions,
    revisionHistoryUnavailable,
    isQuotationRevisionBusy,
    isRevisionNumberManaged,
    assertEditable,
    assertHistoryAvailable,
    replaceHistory,
    getQuotationRevision,
  }
}
