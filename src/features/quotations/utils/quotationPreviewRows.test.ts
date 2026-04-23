import { describe, expect, it } from 'vitest'

import type { MajorItemSummary, QuotationMajorItem } from '../types'
import { createQuotationPreviewRows } from './quotationPreviewRows'

describe('quotation preview rows', () => {
  it('builds major, sub-item, and subtotal rows for the quotation table', () => {
    const majorItems: QuotationMajorItem[] = [
      {
        id: 'major-1',
        type: 'major',
        title: 'Surface Equipment Supply',
        description: 'Supply scope',
        quantity: 1,
        unitCost: 0,
        costCurrency: 'USD',
        subItems: [
          {
            id: 'sub-1',
            type: 'sub',
            description: 'Valve set',
            quantity: 2,
            unitCost: 100,
            costCurrency: 'USD',
            children: [
              {
                id: 'detail-1',
                type: 'sub',
                description: 'Valve body',
                quantity: 2,
                unitCost: 60,
                costCurrency: 'USD',
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'major-2',
        type: 'major',
        title: 'Installation',
        description: '',
        quantity: 3,
        unitCost: 200,
        costCurrency: 'USD',
        subItems: [],
      },
    ]

    const summaries: MajorItemSummary[] = [
      { itemId: 'major-1', baseSubtotal: 200, markupAmount: 20, subtotal: 220 },
      { itemId: 'major-2', baseSubtotal: 600, markupAmount: 60, subtotal: 660 },
    ]

    expect(createQuotationPreviewRows(majorItems, summaries)).toEqual([
      {
        key: 'major-1-major',
        type: 'major',
        itemNumber: '1',
        description: 'Surface Equipment Supply',
        detail: 'Supply scope',
        quantity: null,
        unitPrice: null,
        amount: 220,
      },
      {
        key: 'sub-1-sub',
        type: 'sub',
        itemNumber: '1.1',
        description: 'Valve set',
        detail: '',
        quantity: null,
        unitPrice: null,
        amount: null,
      },
      {
        key: 'detail-1-sub',
        type: 'sub',
        itemNumber: '1.1.1',
        description: 'Valve body',
        detail: '',
        quantity: 2,
        unitPrice: null,
        amount: null,
      },
      {
        key: 'major-2-major',
        type: 'major',
        itemNumber: '2',
        description: 'Installation',
        detail: '',
        quantity: 3,
        unitPrice: null,
        amount: 660,
      },
    ])
  })
})
