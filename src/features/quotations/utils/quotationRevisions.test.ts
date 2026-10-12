import { describe, expect, it } from 'vitest'

import { createGoodsReceiptDraft, createGoodsReceiptRecord } from '@/features/goods-receipts/utils/goodsReceipt'
import { cloneSerializable } from '@/shared/utils/clone'
import { createInitialQuotation } from './quotationDraft'
import { createQuotationFileContent, parseQuotationDocumentContent } from './quotationFile'
import { proposeQuotationRevision, QuotationRevisionProposalError } from './quotationRevisions'

const timestamp = '2026-10-12T09:00:00.000Z'

describe('quotation revision proposals', () => {
  it('archives a detached current snapshot and advances the working revision without mutating input', () => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.pendingGoodsReceiptDraft = createGoodsReceiptDraft(quotation, { documentDate: '2026-10-12' })
    const document = { quotation, revisions: [] }
    const before = cloneSerializable(document)
    const proposed = proposeQuotationRevision(document, { note: '  Sent to customer  ' }, timestamp)

    expect(document).toEqual(before)
    expect(proposed.quotation.id).toBe(quotation.id)
    expect(proposed.quotation.header.revisionNumber).toBe(2)
    expect(proposed.quotation.metadata).toEqual({ createdAt: quotation.metadata!.createdAt, updatedAt: timestamp })
    expect(proposed.quotation.pendingGoodsReceiptDraft).toEqual(quotation.pendingGoodsReceiptDraft)
    expect(proposed.revisions).toEqual([{
      id: expect.any(String),
      revisionNumber: 1,
      createdAt: timestamp,
      note: 'Sent to customer',
      quotation: before.quotation,
    }])

    proposed.quotation.majorItems[0]!.id = 'edited-current-item'
    quotation.header.projectName = 'later source edit'
    expect(proposed.revisions[0]!.quotation).toEqual(before.quotation)
    expect(proposed.revisions[0]!.quotation).not.toHaveProperty('revisions')
  })

  it('restores old content as the next revision and preserves current completed receipt history', () => {
    const original = createInitialQuotation([], 'en-US')
    original.header.projectName = 'Original scope'
    original.pendingGoodsReceiptDraft = createGoodsReceiptDraft(original, { documentDate: '2026-10-10' })
    const current = proposeQuotationRevision({ quotation: original, revisions: [] }, {}, timestamp)
    current.quotation.header.projectName = 'Changed scope'
    current.quotation.pendingGoodsReceiptDraft = createGoodsReceiptDraft(current.quotation, { documentDate: '2026-10-12' })
    current.quotation.goodsReceiptHistory = [createGoodsReceiptRecord(current.quotation.pendingGoodsReceiptDraft, 'receipt.pdf', timestamp)]
    const before = cloneSerializable(current)

    const restored = proposeQuotationRevision(current, { restoreRevisionId: current.revisions[0]!.id }, timestamp)

    expect(current).toEqual(before)
    expect(restored.quotation.header).toMatchObject({ projectName: 'Original scope', revisionNumber: 3 })
    expect(restored.quotation.id).toBe(current.quotation.id)
    expect(restored.quotation.metadata!.createdAt).toBe(current.quotation.metadata!.createdAt)
    expect(restored.quotation.goodsReceiptHistory).toEqual(before.quotation.goodsReceiptHistory)
    expect(restored.quotation.goodsReceiptHistory).not.toBe(current.quotation.goodsReceiptHistory)
    expect(restored.quotation).not.toHaveProperty('pendingGoodsReceiptDraft')
    expect(restored.revisions.map((revision) => revision.revisionNumber)).toEqual([1, 2])
    expect(restored.revisions[1]!.quotation).toEqual(before.quotation)
    expect(restored.revisions[0]).not.toBe(current.revisions[0])
    expect(restored.revisions[1]).not.toHaveProperty('note')
    expect(parseQuotationDocumentContent(createQuotationFileContent(restored.quotation, restored.revisions))).toEqual(restored)
  })

  it('rejects a missing restore target without changing the document', () => {
    const document = { quotation: createInitialQuotation([], 'en-US'), revisions: [] }
    const before = cloneSerializable(document)

    expect(() => proposeQuotationRevision(document, { restoreRevisionId: 'missing' }, timestamp)).toThrowError('revision_not_found')
    expect(document).toEqual(before)
  })

  it.each([
    [Number.MAX_SAFE_INTEGER, 'revision_overflow'],
    [Number.MAX_SAFE_INTEGER + 1, 'invalid_revision_number'],
    [0, 'invalid_revision_number'],
  ])('rejects unsafe revision number %s', (revisionNumber, code) => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.header.revisionNumber = revisionNumber as number

    expect(() => proposeQuotationRevision({ quotation, revisions: [] }, {}, timestamp)).toThrowError(new QuotationRevisionProposalError(code as 'revision_overflow' | 'invalid_revision_number'))
  })

  it('rejects an invalid archive timestamp', () => {
    const document = { quotation: createInitialQuotation([], 'en-US'), revisions: [] }
    expect(() => proposeQuotationRevision(document, {}, '2026-02-30T00:00:00.000Z')).toThrowError('invalid_timestamp')
  })
})
