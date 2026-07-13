import { describe, expect, it } from 'vitest'

import { createQuotationItem, createQuotationSectionHeader } from '@/features/quotations/utils/quotationItems'
import type { QuotationDraft } from '@/features/quotations/types'
import { createInitialQuotation } from '@/features/quotations/utils/quotationDraft'

import {
  createGoodsReceiptDraft,
  createGoodsReceiptFileName,
  createGoodsReceiptNumber,
  createGoodsReceiptPdfRows,
  getGoodsReceiptTotalQuantity,
  normalizeGoodsReceiptTemplateId,
  validateGoodsReceiptDraft,
} from './goodsReceipt'

describe('goods receipt utilities', () => {
  it('creates a GR draft from quote leaf items only', () => {
    const quotation = createQuotation({
      majorItems: [
        createQuotationSectionHeader('en-US', { id: 'section-a', title: 'Group A' }),
        createQuotationItem('USD', {
          id: 'parent-a',
          name: 'Parent assembly',
          quantity: 1,
          children: [
            createQuotationItem('USD', {
              id: 'leaf-a',
              name: 'Valve',
              description: 'Stainless steel',
              quantity: 2,
              quantityUnit: 'EA',
            }),
            createQuotationItem('USD', {
              id: 'nested-parent',
              name: 'Nested parent',
              quantity: 1,
              children: [
                createQuotationItem('USD', {
                  id: 'leaf-b',
                  name: 'Pipe',
                  description: 'DN50',
                  quantity: 3,
                  quantityUnit: 'M',
                }),
              ],
            }),
          ],
        }),
      ],
    })

    const draft = createGoodsReceiptDraft(quotation, {
      documentDate: '2026-07-10',
      templateId: 'compact',
    })

    expect(draft.grNumber).toBe('GR-20260710')
    expect(draft.templateId).toBe('compact')
    expect(draft.lines.map((line) => line.sourceItemId)).toEqual(['leaf-a', 'leaf-b'])
    expect(draft.lines[0]).toMatchObject({
      selected: true,
      description: 'Valve, Stainless steel',
      quantity: 2,
      quotedQuantity: 2,
      unit: 'EA',
      remarks: '',
    })
  })

  it('keeps zero quantity leaf items visible but unselected by default', () => {
    const quotation = createQuotation({
      majorItems: [
        createQuotationItem('USD', {
          id: 'zero-line',
          name: 'Spare label',
          quantity: 0,
          quantityUnit: 'EA',
        }),
      ],
    })

    const draft = createGoodsReceiptDraft(quotation, {
      documentDate: '2026-07-10',
    })

    expect(draft.lines).toHaveLength(1)
    expect(draft.lines[0]).toMatchObject({
      selected: false,
      quantity: 0,
      quotedQuantity: 0,
    })
  })

  it('warns when selected quantity exceeds the quoted quantity but allows export rows', () => {
    const quotation = createQuotation({
      majorItems: [
        createQuotationItem('USD', {
          id: 'leaf-a',
          name: 'Valve',
          quantity: 2,
          quantityUnit: 'EA',
        }),
      ],
    })
    const draft = createGoodsReceiptDraft(quotation, {
      documentDate: '2026-07-10',
    })
    draft.lines[0].quantity = 4

    expect(validateGoodsReceiptDraft(draft)).toEqual({
      errors: [],
      warnings: [
        {
          lineId: 'leaf-a',
          code: 'quantity_exceeds_quote',
        },
      ],
    })
    expect(createGoodsReceiptPdfRows(draft)).toEqual([
      expect.objectContaining({
        no: 1,
        description: 'Valve',
        quantity: 4,
        unit: 'EA',
      }),
    ])
  })

  it('requires at least one selected line with positive quantity for export', () => {
    const quotation = createQuotation({
      majorItems: [
        createQuotationItem('USD', {
          id: 'leaf-a',
          name: 'Valve',
          quantity: 2,
          quantityUnit: 'EA',
        }),
      ],
    })
    const draft = createGoodsReceiptDraft(quotation, {
      documentDate: '2026-07-10',
    })
    draft.lines[0].quantity = 0

    expect(validateGoodsReceiptDraft(draft).errors).toEqual([
      { code: 'no_exportable_lines' },
    ])
    expect(createGoodsReceiptPdfRows(draft)).toEqual([])
  })

  it('returns total quantity only when exported rows share one unit', () => {
    const sameUnitTotal = getGoodsReceiptTotalQuantity([
      { no: 1, lineId: 'a', description: 'A', quantity: 2, unit: 'EA', remarks: '' },
      { no: 2, lineId: 'b', description: 'B', quantity: 3, unit: 'EA', remarks: '' },
    ])
    const mixedUnitTotal = getGoodsReceiptTotalQuantity([
      { no: 1, lineId: 'a', description: 'A', quantity: 2, unit: 'EA', remarks: '' },
      { no: 2, lineId: 'b', description: 'B', quantity: 3, unit: 'SET', remarks: '' },
    ])

    expect(sameUnitTotal).toEqual({ quantity: 5, unit: 'EA' })
    expect(mixedUnitTotal).toBeNull()
  })

  it('creates editable GR numbers and safe PDF file names', () => {
    expect(createGoodsReceiptNumber('2026-07-10')).toBe('GR-20260710')
    expect(createGoodsReceiptFileName('GR:2026/07/10*客户')).toBe('GR-2026-07-10-客户.pdf')
    expect(createGoodsReceiptFileName('')).toBe('goods-receipt.pdf')
  })

  it('normalizes template ids to the standard template by default', () => {
    expect(normalizeGoodsReceiptTemplateId('compact')).toBe('compact')
    expect(normalizeGoodsReceiptTemplateId('unknown')).toBe('standard')
  })
})

function createQuotation(overrides: Partial<QuotationDraft>) {
  return {
    ...createInitialQuotation([], 'en-US'),
    ...overrides,
  }
}
