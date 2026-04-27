import { describe, expect, it } from 'vitest'

import type { ExchangeRateTable, QuotationItem } from '../types'
import { getQuotationPreviewRowPricing } from './quotationPreviewPricing'

describe('quotation preview pricing', () => {
  const exchangeRates: ExchangeRateTable = {
    USD: 1,
    CNY: 0.14,
    EUR: 1.08,
    GBP: 1.25,
  }

  it('returns nested leaf row pricing with inherited markup', () => {
    const majorItems = [
      createItem({
        id: 'major-1',
        markupRate: 25,
        children: [
          createItem({
            id: 'sub-1',
            quantity: 3,
            unitCost: 20,
            costCurrency: 'USD',
          }),
        ],
      }),
    ]

    expect(getQuotationPreviewRowPricing(majorItems, 'sub-1-sub', 10, exchangeRates)).toEqual({
      unitPrice: 25,
      amount: 75,
      isGroup: false,
    })
  })

  it('returns grouped major row pricing from rolled-up child amounts', () => {
    const majorItems = [
      createItem({
        id: 'major-1',
        quantity: 2,
        children: [
          createItem({
            id: 'sub-1',
            quantity: 1,
            unitCost: 100,
            costCurrency: 'USD',
          }),
          createItem({
            id: 'sub-2',
            quantity: 2,
            unitCost: 50,
            costCurrency: 'USD',
          }),
        ],
      }),
    ]

    expect(getQuotationPreviewRowPricing(majorItems, 'major-1-major', 10, exchangeRates)).toEqual({
      unitPrice: 220,
      amount: 440,
      isGroup: true,
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
