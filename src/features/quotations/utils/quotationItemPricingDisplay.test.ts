import { describe, expect, it } from 'vitest'

import type { ExchangeRateTable, QuotationItem } from '../types'
import { createInheritedMarkupContext, getQuotationItemPricingDisplay } from './quotationItemPricingDisplay'

describe('quotation item pricing display', () => {
  const exchangeRates: ExchangeRateTable = {
    USD: 1,
    CNY: 0.14,
    EUR: 1.08,
    GBP: 1.25,
  }

  it('uses global markup when no override exists', () => {
    const item = createItem({
      quantity: 2,
      unitCost: 100,
      costCurrency: 'USD',
    })

    expect(getQuotationItemPricingDisplay(item, 10, exchangeRates)).toEqual({
      effectiveMarkupRate: 10,
      markupSource: 'global',
      markupSourceLabel: 'Global',
      baseAmount: 200,
      markupAmount: 20,
      subtotal: 220,
      unitSellingPrice: 110,
    })
  })

  it('shows inherited source when the nearest parent override wins', () => {
    const parent = createItem({
      markupRate: 25,
    })
    const child = createItem({
      quantity: 3,
      unitCost: 20,
      costCurrency: 'USD',
    })
    const inheritedMarkupContext = createInheritedMarkupContext(parent, '1.1')

    expect(getQuotationItemPricingDisplay(child, 10, exchangeRates, inheritedMarkupContext)).toEqual({
      effectiveMarkupRate: 25,
      markupSource: 'inherited',
      markupSourceLabel: '1.1',
      baseAmount: 60,
      markupAmount: 15,
      subtotal: 75,
      unitSellingPrice: 25,
    })
  })

  it('prefers the row override over inherited and global markup', () => {
    const item = createItem({
      quantity: 5,
      unitCost: 10,
      costCurrency: 'USD',
      markupRate: 40,
    })

    expect(
      getQuotationItemPricingDisplay(item, 10, exchangeRates, {
        rate: 25,
        sourceLabel: '1.1',
      }),
    ).toEqual({
      effectiveMarkupRate: 40,
      markupSource: 'self',
      markupSourceLabel: 'This item',
      baseAmount: 50,
      markupAmount: 20,
      subtotal: 70,
      unitSellingPrice: 14,
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
