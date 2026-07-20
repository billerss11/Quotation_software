import { describe, expect, it } from 'vitest'

import { createQuotationItem, createQuotationSectionHeader } from '@/features/quotations/utils/quotationItems'
import type { QuotationDraft } from '@/features/quotations/types'
import { createInitialQuotation } from '@/features/quotations/utils/quotationDraft'

import {
  createGoodsReceiptDraft,
  createGoodsReceiptFileName,
  createGoodsReceiptNumber,
  createGoodsReceiptPdfRows,
  getGoodsReceiptPresetLineIds,
  getGoodsReceiptSelectionAfterToggle,
  getGoodsReceiptTotalQuantity,
  isGoodsReceiptLineCustomized,
  normalizeGoodsReceiptTemplateId,
  resetGoodsReceiptLineCustomization,
  validateGoodsReceiptDraft,
} from './goodsReceipt'

describe('goods receipt utilities', () => {
  it('creates candidates for every quotation item and selects positive leaves by default', () => {
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
    expect(draft.lines.map((line) => line.sourceItemId)).toEqual([
      'parent-a',
      'leaf-a',
      'nested-parent',
      'leaf-b',
    ])
    expect(draft.lines[0]).toMatchObject({
      sourceItemNumber: '1',
      sourceGroupPath: [],
      sourceDepth: 0,
      sourceHasChildren: true,
      selected: false,
      quantity: 1,
    })
    expect(draft.lines[1]).toMatchObject({
      sourceItemNumber: '1.1',
      sourceGroupPath: [
        {
          id: 'parent-a',
          itemNumber: '1',
          label: 'Parent assembly',
          depth: 0,
        },
      ],
      sourceDepth: 1,
      sourceHasChildren: false,
      selected: true,
      description: 'Valve, Stainless steel',
      quotedDescription: 'Valve, Stainless steel',
      quantity: 2,
      quotedQuantity: 2,
      unit: 'EA',
      quotedUnit: 'EA',
      remarks: '',
    })
    expect(draft.lines[3]).toMatchObject({
      sourceItemNumber: '1.2.1',
      sourceGroupPath: [
        expect.objectContaining({ id: 'parent-a', itemNumber: '1', depth: 0 }),
        expect.objectContaining({ id: 'nested-parent', itemNumber: '1.2', depth: 1 }),
      ],
      sourceDepth: 2,
      sourceHasChildren: false,
    })

    expect([...getGoodsReceiptPresetLineIds(draft.lines, 'summary')]).toEqual(['parent-a'])
    expect([...getGoodsReceiptPresetLineIds(draft.lines, 'grouped')]).toEqual(['leaf-a', 'nested-parent'])
    expect([...getGoodsReceiptPresetLineIds(draft.lines, 'detailed')]).toEqual(['leaf-a', 'leaf-b'])

    draft.lines.find((line) => line.id === 'parent-a')!.selected = true
    expect([...getGoodsReceiptSelectionAfterToggle(draft.lines, 'leaf-b', true)]).toEqual([
      'leaf-a',
      'leaf-b',
    ])
    expect([...getGoodsReceiptSelectionAfterToggle(draft.lines, 'nested-parent', true)]).toEqual([
      'leaf-a',
      'nested-parent',
    ])
  })

  it('detects and resets receipt line customizations without changing selection', () => {
    const quotation = createQuotation({
      majorItems: [
        createQuotationItem('USD', {
          id: 'line-a',
          name: 'Valve',
          description: 'Stainless steel',
          quantity: 2,
          quantityUnit: 'EA',
        }),
      ],
    })
    const draft = createGoodsReceiptDraft(quotation, { documentDate: '2026-07-10' })
    const line = draft.lines[0]!

    expect(isGoodsReceiptLineCustomized(line)).toBe(false)

    line.description = 'Received valve'
    line.quantity = 1
    line.unit = 'PC'
    line.remarks = 'Box damaged'

    expect(isGoodsReceiptLineCustomized(line)).toBe(true)

    resetGoodsReceiptLineCustomization(line)

    expect(line).toMatchObject({
      selected: true,
      description: 'Valve, Stainless steel',
      quantity: 2,
      unit: 'EA',
      remarks: '',
    })
    expect(isGoodsReceiptLineCustomized(line)).toBe(false)
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
        kind: 'line',
        itemNumber: '1',
        description: 'Valve',
        quantity: 4,
        unit: 'EA',
      }),
    ])
  })

  it('groups selected lines under their original quotation ancestors', () => {
    const quotation = createQuotation({
      majorItems: [
        createQuotationItem('USD', {
          id: 'group-a',
          name: 'Electrolyzer package',
          children: [
            createQuotationItem('USD', {
              id: 'leaf-a',
              name: 'Frame',
              quantity: 1,
              quantityUnit: 'EA',
            }),
            createQuotationItem('USD', {
              id: 'group-b',
              name: 'Piping',
              children: [
                createQuotationItem('USD', {
                  id: 'leaf-b',
                  name: 'Pipe spool',
                  quantity: 2,
                  quantityUnit: 'EA',
                }),
              ],
            }),
          ],
        }),
        createQuotationItem('USD', {
          id: 'empty-group',
          name: 'Excluded package',
          children: [
            createQuotationItem('USD', {
              id: 'excluded-leaf',
              name: 'Excluded item',
              quantity: 1,
              quantityUnit: 'EA',
            }),
          ],
        }),
      ],
    })
    const draft = createGoodsReceiptDraft(quotation, { documentDate: '2026-07-10' })

    draft.lines.find((line) => line.id === 'leaf-a')!.selected = false
    draft.lines.find((line) => line.id === 'excluded-leaf')!.selected = false

    expect(createGoodsReceiptPdfRows(draft)).toEqual([
      {
        kind: 'group',
        key: 'group:group-a',
        itemNumber: '1',
        description: 'Electrolyzer package',
        depth: 0,
      },
      {
        kind: 'group',
        key: 'group:group-b',
        itemNumber: '1.2',
        description: 'Piping',
        depth: 1,
      },
      {
        kind: 'line',
        lineId: 'leaf-b',
        itemNumber: '1.2.1',
        description: 'Pipe spool',
        quantity: 2,
        unit: 'EA',
        remarks: '',
      },
    ])
  })

  it('prints mixed hierarchy levels and prevents parent-child double-counting', () => {
    const quotation = createQuotation({
      majorItems: [
        createQuotationItem('USD', {
          id: 'engineering',
          name: 'Engineering package',
          quantity: 1,
          quantityUnit: 'LOT',
          children: [
            createQuotationItem('USD', {
              id: 'engineering-detail',
              name: 'Design documents',
              quantity: 5,
              quantityUnit: 'DOC',
            }),
          ],
        }),
        createQuotationItem('USD', {
          id: 'equipment',
          name: 'Equipment package',
          quantity: 1,
          quantityUnit: 'LOT',
          children: [
            createQuotationItem('USD', {
              id: 'pump',
              name: 'Cooling pump',
              quantity: 2,
              quantityUnit: 'EA',
            }),
          ],
        }),
      ],
    })
    const draft = createGoodsReceiptDraft(quotation, { documentDate: '2026-07-10' })

    draft.lines.find((line) => line.id === 'engineering')!.selected = true

    expect(createGoodsReceiptPdfRows(draft)).toEqual([
      {
        kind: 'line',
        lineId: 'engineering',
        itemNumber: '1',
        description: 'Engineering package',
        quantity: 1,
        unit: 'LOT',
        remarks: '',
      },
      {
        kind: 'group',
        key: 'group:equipment',
        itemNumber: '2',
        description: 'Equipment package',
        depth: 0,
      },
      {
        kind: 'line',
        lineId: 'pump',
        itemNumber: '2.1',
        description: 'Cooling pump',
        quantity: 2,
        unit: 'EA',
        remarks: '',
      },
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
      { kind: 'group', key: 'group:a', itemNumber: '1', description: 'Group A', depth: 0 },
      { kind: 'line', lineId: 'a', itemNumber: '1.1', description: 'A', quantity: 2, unit: 'EA', remarks: '' },
      { kind: 'line', lineId: 'b', itemNumber: '1.2', description: 'B', quantity: 3, unit: 'EA', remarks: '' },
    ])
    const mixedUnitTotal = getGoodsReceiptTotalQuantity([
      { kind: 'line', lineId: 'a', itemNumber: '1', description: 'A', quantity: 2, unit: 'EA', remarks: '' },
      { kind: 'line', lineId: 'b', itemNumber: '2', description: 'B', quantity: 3, unit: 'SET', remarks: '' },
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
