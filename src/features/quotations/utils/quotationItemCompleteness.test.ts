import { describe, expect, it } from 'vitest'

import type { QuotationItem } from '../types'
import { isQuotationItemIncomplete } from './quotationItemCompleteness'

describe('quotation item completeness', () => {
  it('checks cost-plus rows from the item pricing method, not the global entry mode', () => {
    expect(isQuotationItemIncomplete(createItem({
      pricingMethod: 'cost_plus',
      unitCost: 100,
      manualUnitPrice: undefined,
    }))).toBe(false)
  })
})

function createItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'New item',
    description: overrides.description ?? '',
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? 'pc',
    pricingMethod: overrides.pricingMethod ?? 'cost_plus',
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
