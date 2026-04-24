import { describe, expect, it } from 'vitest'

import type { MajorItemSummary, QuotationItem } from '../types'
import { getMajorItemPricingDisplay } from './majorItemPricingDisplay'

describe('major item pricing display', () => {
  const itemWithSubItems = createItem({
    id: 'major-1',
    name: 'Surface Equipment Supply',
    children: [
      createItem({
        id: 'sub-1',
        name: 'Valve set',
        quantity: 2,
        unitCost: 100,
        costCurrency: 'USD',
      }),
    ],
  })

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
        { label: 'Sub-items cost', amount: 200, emphasis: false },
        { label: 'Markup', amount: 20, emphasis: false },
        { label: 'Selling subtotal', amount: 220, emphasis: true },
      ],
      mismatch: null,
    })
  })

  it('uses manual pricing inputs when a major item has no sub-items', () => {
    expect(
      getMajorItemPricingDisplay(
        {
          ...itemWithSubItems,
          children: [],
        },
        summary,
      ),
    ).toEqual({
      isRolledUp: false,
      rows: [],
      mismatch: null,
    })
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
