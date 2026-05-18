import { shallowRef } from 'vue'
import { describe, expect, it } from 'vitest'

import type { ExchangeRateTable, QuotationItem, TotalsConfig } from '../types'
import { createCalculationTotalsConfig } from '../utils/quotationTaxes'
import { useLineItemCardPricing } from './useLineItemCardPricing'

describe('useLineItemCardPricing', () => {
  const exchangeRates: ExchangeRateTable = {
    USD: 1,
    EUR: 1.08,
    CNY: 0.14,
    GBP: 1.25,
  }
  const totalsConfig: TotalsConfig = createCalculationTotalsConfig({
    globalMarkupRate: 10,
    discountMode: 'percentage',
    discountValue: 0,
    taxMode: 'single',
    taxRate: 0,
  })

  it('keeps child pricing map lazy until the card is expanded', () => {
    const item = shallowRef(createItem({
      id: 'root',
      markupRate: 20,
      children: [
        createItem({
          id: 'child',
          quantity: 2,
          unitCost: 50,
        }),
      ],
    }))
    const expanded = shallowRef(false)
    const pricing = useLineItemCardPricing({
      item: () => item.value,
      expanded: () => expanded.value,
      rootItemNumber: () => '1',
      globalMarkupRate: () => 10,
      exchangeRates: () => exchangeRates,
      totalsConfig: () => totalsConfig,
    })

    expect(pricing.rootPricingDisplay.value.subtotal).toBe(120)
    expect(pricing.pricingDisplayByItemId.value.size).toBe(0)

    expanded.value = true

    expect(pricing.pricingDisplayByItemId.value.get('child')?.subtotal).toBe(120)
    expect(pricing.getPricing('root')?.subtotal).toBe(120)
  })

  it('collects expected-total mismatches for nested items', () => {
    const item = shallowRef(createItem({
      id: 'root',
      expectedTotal: 90,
      children: [
        createItem({
          id: 'child',
          quantity: 2,
          unitCost: 50,
        }),
      ],
    }))
    const pricing = useLineItemCardPricing({
      item: () => item.value,
      expanded: () => true,
      rootItemNumber: () => '1',
      globalMarkupRate: () => 10,
      exchangeRates: () => exchangeRates,
      totalsConfig: () => totalsConfig,
    })

    expect(pricing.amountMismatchByItemId.value.get('root')).toEqual({
      expectedTotal: 90,
      actualTotal: 110,
      difference: 20,
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
    pricingMethod: overrides.pricingMethod,
    manualUnitPrice: overrides.manualUnitPrice,
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? 'USD',
    markupRate: overrides.markupRate,
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}
