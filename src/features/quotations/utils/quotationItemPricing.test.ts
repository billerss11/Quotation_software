import { describe, expect, it } from 'vitest'

import type { ExchangeRateTable, QuotationItem, TotalsConfig } from '../types'
import { calculateQuotationItemSectionUnitCost, getQuotationItemPricingDisplay } from './quotationItemPricing'

describe('quotation item pricing', () => {
  const exchangeRates: ExchangeRateTable = {
    USD: 1,
    CNY: 0.14,
    EUR: 1.08,
    GBP: 1.25,
  }

  it('calculates the grouped section unit cost from direct child totals only', () => {
    const item = createItem({
      quantity: 4,
      children: [
        createItem({
          quantity: 2,
          unitCost: 100,
          costCurrency: 'USD',
        }),
        createItem({
          quantity: 3,
          unitCost: 50,
          costCurrency: 'USD',
        }),
      ],
    })

    expect(calculateQuotationItemSectionUnitCost(item, exchangeRates)).toBe(350)
  })

  it('shows the weighted effective markup rate for groups with child overrides', () => {
    const item = createItem({
      children: [
        createItem({
          id: 'child-1',
          unitCost: 100,
          costCurrency: 'USD',
          markupRate: 10,
        }),
        createItem({
          id: 'child-2',
          unitCost: 100,
          costCurrency: 'USD',
          markupRate: 40,
        }),
      ],
    })
    const totalsConfig: TotalsConfig = {
      globalMarkupRate: 0,
      taxMode: 'single',
      taxRate: 0,
    }

    const pricing = getQuotationItemPricingDisplay(item, 0, exchangeRates, totalsConfig)

    expect(pricing.baseAmount).toBe(200)
    expect(pricing.markupAmount).toBe(50)
    expect(pricing.effectiveMarkupRate).toBe(25)
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
