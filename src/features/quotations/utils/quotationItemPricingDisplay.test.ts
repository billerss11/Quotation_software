import { describe, expect, it } from 'vitest'

import type { ExchangeRateTable, QuotationItem, TotalsConfig } from '../types'
import { createInheritedMarkupContext, getQuotationItemPricingDisplay } from './quotationItemPricingDisplay'

describe('quotation item pricing display', () => {
  const exchangeRates: ExchangeRateTable = {
    USD: 1,
    CNY: 0.14,
    EUR: 1.08,
    GBP: 1.25,
  }
  const totalsConfig = {
    globalMarkupRate: 10,
    discountMode: 'percentage',
    discountValue: 0,
    taxClasses: [
      { id: 'tax-0', label: '0%', rate: 0 },
      { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
      { id: 'tax-service', label: 'Service 6%', rate: 6 },
    ],
    defaultTaxClassId: 'tax-0',
  } satisfies TotalsConfig

  it('uses global markup when no override exists', () => {
    const item = createItem({
      quantity: 2,
      unitCost: 100,
      costCurrency: 'USD',
      taxClassId: 'tax-goods',
    })

    expect(getQuotationItemPricingDisplay(item, 10, exchangeRates, totalsConfig)).toEqual({
      effectiveMarkupRate: 10,
      markupSource: 'global',
      markupSourceLabel: 'Global',
      baseAmount: 200,
      markupAmount: 20,
      subtotal: 220,
      unitSellingPrice: 110,
      taxClassId: 'tax-goods',
      taxClassLabel: 'Goods 13%',
      taxRate: 13,
      effectiveTaxRate: 13,
      hasMixedTaxClasses: false,
      taxAmount: 28.6,
      totalWithTax: 248.6,
      unitPriceWithTax: 124.3,
    })
  })

  it('shows inherited source when the nearest parent override wins', () => {
    const parent = createItem({
      markupRate: 25,
    })
    const child = createItem({
      quantity: 3,
      unitCost: 20,
      costCurrency: 'USD',
    })
    const inheritedMarkupContext = createInheritedMarkupContext(parent, '1.1')

    expect(
      getQuotationItemPricingDisplay(child, 10, exchangeRates, totalsConfig, inheritedMarkupContext, 'tax-service'),
    ).toEqual({
      effectiveMarkupRate: 25,
      markupSource: 'inherited',
      markupSourceLabel: '1.1',
      baseAmount: 60,
      markupAmount: 15,
      subtotal: 75,
      unitSellingPrice: 25,
      taxClassId: 'tax-service',
      taxClassLabel: 'Service 6%',
      taxRate: 6,
      effectiveTaxRate: 6,
      hasMixedTaxClasses: false,
      taxAmount: 4.5,
      totalWithTax: 79.5,
      unitPriceWithTax: 26.5,
    })
  })

  it('prefers the row override over inherited and global markup', () => {
    const item = createItem({
      quantity: 5,
      unitCost: 10,
      costCurrency: 'USD',
      markupRate: 40,
    })

    expect(
      getQuotationItemPricingDisplay(item, 10, exchangeRates, {
        globalMarkupRate: 10,
        discountMode: 'percentage',
        discountValue: 0,
        taxClasses: totalsConfig.taxClasses,
        defaultTaxClassId: 'tax-goods',
      },
      {
        rate: 25,
        sourceLabel: '1.1',
      }),
    ).toEqual({
      effectiveMarkupRate: 40,
      markupSource: 'self',
      markupSourceLabel: 'This item',
      baseAmount: 50,
      markupAmount: 20,
      subtotal: 70,
      unitSellingPrice: 14,
      taxClassId: 'tax-goods',
      taxClassLabel: 'Goods 13%',
      taxRate: 13,
      effectiveTaxRate: 13,
      hasMixedTaxClasses: false,
      taxAmount: 9.1,
      totalWithTax: 79.1,
      unitPriceWithTax: 15.82,
    })
  })

  it('calculates an effective tax rate for grouped rows with mixed child tax classes', () => {
    const item = createItem({
      id: 'major-1',
      children: [
        createItem({
          id: 'sub-goods',
          quantity: 1,
          unitCost: 100,
          costCurrency: 'USD',
          taxClassId: 'tax-goods',
        }),
        createItem({
          id: 'sub-service',
          quantity: 1,
          unitCost: 100,
          costCurrency: 'USD',
          taxClassId: 'tax-service',
        }),
      ],
    })

    expect(getQuotationItemPricingDisplay(item, 10, exchangeRates, totalsConfig)).toEqual({
      effectiveMarkupRate: 10,
      markupSource: 'global',
      markupSourceLabel: 'Global',
      baseAmount: 200,
      markupAmount: 20,
      subtotal: 220,
      unitSellingPrice: 220,
      taxClassId: null,
      taxClassLabel: null,
      taxRate: null,
      effectiveTaxRate: 9.5,
      hasMixedTaxClasses: true,
      taxAmount: 20.9,
      totalWithTax: 240.9,
      unitPriceWithTax: 240.9,
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
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}
