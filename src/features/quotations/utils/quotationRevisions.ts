import type { QuotationDocument } from '../types'
import { cloneSerializable } from '@/shared/utils/clone'

export class QuotationRevisionProposalError extends Error {
  constructor(public readonly code: 'revision_not_found' | 'revision_overflow' | 'invalid_revision_number' | 'invalid_timestamp') {
    super(code)
    this.name = 'QuotationRevisionProposalError'
  }
}

/** Build a detached proposal. The caller publishes it only after a successful file save. */
export function proposeQuotationRevision(
  document: QuotationDocument,
  options: { note?: string; restoreRevisionId?: string } = {},
  now = new Date().toISOString(),
): QuotationDocument {
  const current = document.quotation
  const currentNumber = current.header.revisionNumber ?? 1
  if (!Number.isSafeInteger(currentNumber) || currentNumber < 1) {
    throw new QuotationRevisionProposalError('invalid_revision_number')
  }
  if (currentNumber === Number.MAX_SAFE_INTEGER) {
    throw new QuotationRevisionProposalError('revision_overflow')
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(now)
    || Number.isNaN(Date.parse(now)) || new Date(now).toISOString() !== now) {
    throw new QuotationRevisionProposalError('invalid_timestamp')
  }

  const restored = options.restoreRevisionId === undefined
    ? undefined
    : document.revisions.find((revision) => revision.id === options.restoreRevisionId)
  if (options.restoreRevisionId !== undefined && !restored) {
    throw new QuotationRevisionProposalError('revision_not_found')
  }

  const snapshot = cloneSerializable(current)
  snapshot.header.revisionNumber = currentNumber
  const quotation = cloneSerializable(restored?.quotation ?? current)
  quotation.id = current.id
  quotation.header.revisionNumber = currentNumber + 1
  quotation.metadata = {
    createdAt: current.metadata?.createdAt ?? now,
    updatedAt: now,
  }
  // Completed receipts belong to this quotation family, even when restoring older content.
  quotation.goodsReceiptHistory = cloneSerializable(current.goodsReceiptHistory ?? [])
  if (restored) delete quotation.pendingGoodsReceiptDraft

  const note = options.note?.trim()
  return {
    quotation,
    revisions: [
      ...cloneSerializable(document.revisions),
      {
        id: crypto.randomUUID(),
        revisionNumber: currentNumber,
        createdAt: now,
        ...(note ? { note } : {}),
        quotation: snapshot,
      },
    ],
  }
}
