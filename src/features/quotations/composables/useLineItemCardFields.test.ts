import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PricingMethod, QuotationItem, QuotationItemField } from '../types'
import { useLineItemCardFields } from './useLineItemCardFields'

describe('useLineItemCardFields', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('normalizes and buffers edited field values', () => {
    const updates: Array<[string, QuotationItemField, unknown]> = []
    const fields = useLineItemCardFields({
      updateItemField: (itemId, field, value) => updates.push([itemId, field, value]),
      setItemPricingMethod: vi.fn(),
    })
    const item = createItem({ id: 'item-1', quantity: 2, markupRate: 12 })

    fields.setText('item-1', 'name', null)
    fields.setNumber('item-1', 'quantity', Number.NaN)
    fields.setOptionalNumber('item-1', 'markupRate', Number.NaN)

    expect(fields.getTextFieldValue(item, 'name')).toBe('')
    expect(fields.getNumberFieldValue(item, 'quantity')).toBe(0)
    expect(fields.getOptionalNumberFieldValue(item, 'markupRate')).toBeUndefined()
    expect(updates).toEqual([])

    vi.advanceTimersByTime(160)

    expect(updates).toEqual([
      ['item-1', 'name', ''],
      ['item-1', 'quantity', 0],
      ['item-1', 'markupRate', undefined],
    ])
  })

  it('flushes buffered fields before changing pricing method', () => {
    const updates: Array<[string, QuotationItemField, unknown]> = []
    const pricingMethods: Array<[string, PricingMethod]> = []
    const fields = useLineItemCardFields({
      updateItemField: (itemId, field, value) => updates.push([itemId, field, value]),
      setItemPricingMethod: (itemId, pricingMethod) => pricingMethods.push([itemId, pricingMethod]),
    })

    fields.setText('item-1', 'description', 'Pending')
    fields.setPricingMethod('item-1', 'manual_price')
    fields.setPricingMethod('item-1', 'not-valid')

    expect(updates).toEqual([
      ['item-1', 'description', 'Pending'],
    ])
    expect(pricingMethods).toEqual([
      ['item-1', 'manual_price'],
    ])
  })

  it('updates currency and tax class immediately', () => {
    const updates: Array<[string, QuotationItemField, unknown]> = []
    const fields = useLineItemCardFields({
      updateItemField: (itemId, field, value) => updates.push([itemId, field, value]),
      setItemPricingMethod: vi.fn(),
    })

    fields.setCurrency('item-1', 'EUR')
    fields.setTaxClass('item-1', 'vat')
    fields.setTaxClass('item-1', '')

    expect(updates).toEqual([
      ['item-1', 'costCurrency', 'EUR'],
      ['item-1', 'taxClassId', 'vat'],
      ['item-1', 'taxClassId', undefined],
    ])
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
