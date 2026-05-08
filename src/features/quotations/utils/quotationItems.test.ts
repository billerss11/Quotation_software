import { describe, expect, it } from 'vitest'

import { isQuotationItem, normalizeQuotationItems } from './quotationItems'

describe('normalizeQuotationItems', () => {
  it('preserves root-level section headers alongside priced items', () => {
    const items = normalizeQuotationItems([
      {
        id: 'section-1',
        kind: 'section_header',
        title: 'Valve',
      },
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

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      id: 'section-1',
      kind: 'section_header',
      title: 'Valve',
    })
    expect(items[1]).toMatchObject({
      id: 'item-1',
      name: 'Valve body',
      costCurrency: 'JPY',
    })
  })

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

    expect(isQuotationItem(items[0]) ? items[0].costCurrency : undefined).toBe('JPY')
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

    expect(isQuotationItem(items[0]) ? items[0].costCurrency : undefined).toBe('USD')
  })
})
