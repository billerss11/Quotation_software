import { describe, expect, it } from 'vitest'

import type { MajorItemSummary, QuotationItem } from '../types'
import { createQuotationPreviewRows } from './quotationPreviewRows'

describe('quotation preview rows', () => {
  it('builds preview rows from a unified three-level item tree', () => {
    const majorItems: QuotationItem[] = [
      createItem({
        id: 'major-1',
        name: 'Surface Equipment Supply',
        description: 'Supply scope',
        children: [
          createItem({
            id: 'sub-1',
            name: 'Valve set',
            description: 'Valve assembly',
            quantity: 2,
            quantityUnit: 'set',
            unitCost: 100,
            costCurrency: 'USD',
            children: [
              createItem({
                id: 'detail-1',
                name: 'Valve body',
                description: 'Stainless steel',
                quantity: 2,
                quantityUnit: 'ea',
                unitCost: 60,
                costCurrency: 'USD',
              }),
            ],
          }),
        ],
      }),
      createItem({
        id: 'major-2',
        name: 'Installation',
        quantity: 3,
        quantityUnit: 'days',
        unitCost: 200,
        costCurrency: 'USD',
      }),
    ]

    const summaries: MajorItemSummary[] = [
      { itemId: 'major-1', baseSubtotal: 200, markupAmount: 20, subtotal: 220 },
      { itemId: 'major-2', baseSubtotal: 600, markupAmount: 60, subtotal: 660 },
    ]

    expect(createQuotationPreviewRows(majorItems, summaries)).toEqual([
      {
        key: 'major-1-major',
        type: 'major',
        level: 1,
        itemNumber: '1',
        description: 'Surface Equipment Supply',
        detail: 'Supply scope',
        quantity: 1,
        quantityUnit: '',
        unitPrice: null,
        amount: 220,
      },
      {
        key: 'sub-1-sub',
        type: 'sub',
        level: 2,
        itemNumber: '1.1',
        description: 'Valve set',
        detail: 'Valve assembly',
        quantity: 2,
        quantityUnit: 'set',
        unitPrice: null,
        amount: null,
      },
      {
        key: 'detail-1-sub',
        type: 'sub',
        level: 3,
        itemNumber: '1.1.1',
        description: 'Valve body',
        detail: 'Stainless steel',
        quantity: 2,
        quantityUnit: 'ea',
        unitPrice: null,
        amount: null,
      },
      {
        key: 'major-2-major',
        type: 'major',
        level: 1,
        itemNumber: '2',
        description: 'Installation',
        detail: '',
        quantity: 3,
        quantityUnit: 'days',
        unitPrice: null,
        amount: 660,
      },
    ])
  })
})

function createItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'New item',
    description: overrides.description ?? '',
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? '',
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? 'USD',
    markupRate: overrides.markupRate,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}
