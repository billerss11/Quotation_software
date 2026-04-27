import { describe, expect, it } from 'vitest'

import type { ExchangeRateTable, QuotationItem } from '../types'
import { getQuotationItemAmountMismatch } from './quotationItemValidation'

describe('quotation item amount validation', () => {
  const exchangeRates: ExchangeRateTable = {
    USD: 1,
    EUR: 1.08,
    CNY: 0.14,
    GBP: 1.25,
  }

  it('returns null when a grouped item has no expected total', () => {
    const item = createItem({
      name: 'Supply',
      children: [
        createItem({
          name: 'Valve',
          quantity: 2,
          unitCost: 50,
          costCurrency: 'USD',
        }),
      ],
    })

    expect(getQuotationItemAmountMismatch(item, 10, exchangeRates)).toBeNull()
  })

  it('returns null when the expected total matches the computed child sum within tolerance', () => {
    const item = createItem({
      name: 'Supply',
      expectedTotal: 110.01,
      children: [
        createItem({
          name: 'Valve',
          quantity: 2,
          unitCost: 50,
          costCurrency: 'USD',
        }),
      ],
    })

    expect(getQuotationItemAmountMismatch(item, 10, exchangeRates)).toBeNull()
  })

  it('returns mismatch details when the expected total differs from the computed child sum', () => {
    const item = createItem({
      name: 'Supply',
      expectedTotal: 90,
      children: [
        createItem({
          name: 'Valve',
          quantity: 2,
          unitCost: 50,
          costCurrency: 'USD',
        }),
      ],
    })

    expect(getQuotationItemAmountMismatch(item, 10, exchangeRates)).toEqual({
      expectedTotal: 90,
      actualTotal: 110,
      difference: 20,
    })
  })

  it('compares the override against the child sum even when the override is the active total', () => {
    const item = createItem({
      name: 'Supply',
      quantity: 2,
      expectedTotal: 180,
      children: [
        createItem({
          name: 'Valve',
          quantity: 2,
          unitCost: 50,
          costCurrency: 'USD',
        }),
      ],
    })

    expect(getQuotationItemAmountMismatch(item, 10, exchangeRates)).toEqual({
      expectedTotal: 180,
      actualTotal: 220,
      difference: 40,
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
