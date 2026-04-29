import { describe, expect, it } from 'vitest'

import { normalizeQuotationItems } from './quotationItems'

describe('normalizeQuotationItems', () => {
  it('preserves supported dynamic cost currencies', () => {
    const items = normalizeQuotationItems([
      {
        id: 'item-1',
        name: 'Valve body',
        quantity: 2,
        quantityUnit: 'ea',
        unitCost: 60,
        costCurrency: 'JPY',
        children: [],
      },
    ], 'USD', 'en-US')

    expect(items[0]?.costCurrency).toBe('JPY')
  })

  it('falls back invalid cost currencies to the provided fallback currency', () => {
    const items = normalizeQuotationItems([
      {
        id: 'item-1',
        name: 'Valve body',
        quantity: 2,
        quantityUnit: 'ea',
        unitCost: 60,
        costCurrency: 'ZZZ',
        children: [],
      },
    ], 'USD', 'en-US')

    expect(items[0]?.costCurrency).toBe('USD')
  })
})
