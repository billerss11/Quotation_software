import { describe, expect, it } from 'vitest'

import type { MajorItemSummary, QuotationMajorItem } from '../types'
import { getMajorItemPricingDisplay } from './majorItemPricingDisplay'

describe('major item pricing display', () => {
  const itemWithSubItems: QuotationMajorItem = {
    id: 'major-1',
    type: 'major',
    title: 'Surface Equipment Supply',
    description: '',
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
      },
    ],
  }

  const summary: MajorItemSummary = {
    itemId: 'major-1',
    baseSubtotal: 200,
    markupAmount: 20,
    subtotal: 220,
  }

  it('uses roll-up display rows when a major item has sub-items', () => {
    expect(getMajorItemPricingDisplay(itemWithSubItems, summary)).toEqual({
      isRolledUp: true,
      rows: [
        { label: 'Sub-items total', amount: 200, emphasis: false },
        { label: 'Markup', amount: 20, emphasis: false },
        { label: 'Parent subtotal', amount: 220, emphasis: true },
      ],
    })
  })

  it('uses manual pricing inputs when a major item has no sub-items', () => {
    expect(
      getMajorItemPricingDisplay(
        {
          ...itemWithSubItems,
          subItems: [],
        },
        summary,
      ),
    ).toEqual({
      isRolledUp: false,
      rows: [],
    })
  })
})
