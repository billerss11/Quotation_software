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
    expect(pricing.getPricing('child')).toBeUndefined()

    expanded.value = true

    expect(pricing.getPricing('child')?.subtotal).toBe(120)
    expect(pricing.getPricing('root')?.subtotal).toBe(120)
  })

  it('returns cached descendant pricing instead of recalculating each lookup', () => {
    const item = createItem({
      id: 'root',
      children: [createItem({ id: 'child', unitCost: 50 })],
    })
    const pricing = useLineItemCardPricing({
      item: () => item,
      expanded: () => true,
      rootItemNumber: () => '1',
      globalMarkupRate: () => 10,
      exchangeRates: () => exchangeRates,
      totalsConfig: () => totalsConfig,
    })
    const cachedChildPricing = pricing.getPricing('child')

    expect(cachedChildPricing).toBeDefined()
    expect(pricing.getPricing('child')).toBe(cachedChildPricing)
    expect(pricing.getPricing('child')).toBe(cachedChildPricing)
  })

  it('uses allocated tax for the root card and local tax for descendants', () => {
    const item = createItem({
      id: 'root',
      taxClassId: 'tax-10',
      children: [
        createItem({ id: 'child', unitCost: 0.05, taxClassId: 'tax-10' }),
      ],
    })
    const taxConfig: TotalsConfig = {
      globalMarkupRate: 0,
      taxClasses: [{ id: 'tax-10', label: '10%', rate: 10 }],
      defaultTaxClassId: 'tax-10',
    }
    const pricing = useLineItemCardPricing({
      item: () => item,
      expanded: () => true,
      rootItemNumber: () => '1',
      globalMarkupRate: () => 0,
      exchangeRates: () => exchangeRates,
      totalsConfig: () => taxConfig,
      allocatedTaxBuckets: () => [{
        taxClassId: 'tax-10',
        label: '10%',
        rate: 10,
        taxableSubtotal: 0.05,
        taxAmount: 0,
      }],
    })

    expect(pricing.rootPricingDisplay.value).toMatchObject({
      taxAmount: 0,
      totalWithTax: 0.05,
    })
    expect(pricing.getPricing('child')).toMatchObject({
      taxAmount: 0.01,
      totalWithTax: 0.06,
    })
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

  it('keeps descendant mismatch checks lazy until the card is expanded', () => {
    const item = shallowRef(createItem({
      id: 'root',
      expectedTotal: 90,
      children: [
        createItem({
          id: 'child',
          expectedTotal: 40,
          children: [
            createItem({
              id: 'grandchild',
              quantity: 2,
              unitCost: 50,
            }),
          ],
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

    expect(pricing.amountMismatchByItemId.value.has('root')).toBe(true)
    expect(pricing.amountMismatchByItemId.value.has('child')).toBe(false)

    expanded.value = true

    expect(pricing.amountMismatchByItemId.value.get('child')).toEqual({
      expectedTotal: 40,
      actualTotal: 110,
      difference: 70,
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
