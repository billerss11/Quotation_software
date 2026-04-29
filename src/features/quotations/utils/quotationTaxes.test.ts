import { describe, expect, it } from 'vitest'

import type { QuotationItem, TotalsConfig } from '../types'
import {
  applyTaxClassToQuotationItems,
  canUseSingleTaxMode,
  collectEffectiveTaxClassIds,
  resolveQuotationTaxMode,
} from './quotationTaxes'

describe('quotation tax helpers', () => {
  const totalsConfig: TotalsConfig = {
    globalMarkupRate: 10,
    discountMode: 'percentage',
    discountValue: 0,
    taxMode: 'single',
    taxClasses: [
      { id: 'tax-0', label: '0%', rate: 0 },
      { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
      { id: 'tax-service', label: 'Service 6%', rate: 6 },
    ],
    defaultTaxClassId: 'tax-0',
  } as TotalsConfig

  it('collects one effective tax class when rows inherit the same tax path', () => {
    const items = [
      createItem({
        id: 'major-1',
        taxClassId: 'tax-goods',
        children: [
          createItem({
            id: 'leaf-1',
            quantity: 1,
            unitCost: 100,
            costCurrency: 'USD',
          }),
        ],
      }),
    ]

    expect(collectEffectiveTaxClassIds(items, totalsConfig)).toEqual(['tax-goods'])
    expect(canUseSingleTaxMode(items, totalsConfig)).toBe(true)
    expect(resolveQuotationTaxMode(items, totalsConfig, 'mixed')).toBe('mixed')
  })

  it('detects mixed mode when leaf rows resolve to multiple effective tax classes', () => {
    const items = [
      createItem({
        id: 'major-1',
        taxClassId: 'tax-goods',
        children: [
          createItem({
            id: 'leaf-1',
            quantity: 1,
            unitCost: 100,
            costCurrency: 'USD',
          }),
          createItem({
            id: 'leaf-2',
            quantity: 1,
            unitCost: 100,
            costCurrency: 'USD',
            taxClassId: 'tax-service',
          }),
        ],
      }),
    ]

    expect(collectEffectiveTaxClassIds(items, totalsConfig)).toEqual(['tax-goods', 'tax-service'])
    expect(canUseSingleTaxMode(items, totalsConfig)).toBe(false)
    expect(resolveQuotationTaxMode(items, totalsConfig, 'single')).toBe('mixed')
  })

  it('rewrites all items to one tax class for single-tax consolidation', () => {
    const items = [
      createItem({
        id: 'major-1',
        taxClassId: 'tax-goods',
        children: [
          createItem({
            id: 'leaf-1',
            quantity: 1,
            unitCost: 100,
            costCurrency: 'USD',
            taxClassId: 'tax-service',
          }),
        ],
      }),
    ]

    expect(applyTaxClassToQuotationItems(items, 'tax-goods')).toEqual([
      createItem({
        id: 'major-1',
        taxClassId: 'tax-goods',
        children: [
          createItem({
            id: 'leaf-1',
            quantity: 1,
            unitCost: 100,
            costCurrency: 'USD',
            taxClassId: 'tax-goods',
          }),
        ],
      }),
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
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? 'USD',
    markupRate: overrides.markupRate,
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}
