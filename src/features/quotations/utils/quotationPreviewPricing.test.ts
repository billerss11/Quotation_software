import { describe, expect, it } from 'vitest'

import type { ExchangeRateTable, QuotationItem, TotalsConfig } from '../types'
import { getQuotationPreviewRowPricing } from './quotationPreviewPricing'

describe('quotation preview pricing', () => {
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

  it('returns nested leaf row pricing with inherited markup', () => {
    const majorItems = [
      createItem({
        id: 'major-1',
        markupRate: 25,
        taxClassId: 'tax-service',
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

    expect(getQuotationPreviewRowPricing(majorItems, 'sub-1-sub', 10, exchangeRates, totalsConfig)).toEqual({
      unitPrice: 25,
      amount: 75,
      isGroup: false,
      taxClassId: 'tax-service',
      taxClassLabel: 'Service 6%',
      taxRate: 6,
      hasMixedTaxClasses: false,
      unitPriceWithTax: 26.5,
      amountWithTax: 79.5,
    })
  })

  it('returns grouped major row pricing from rolled-up child amounts', () => {
    const majorItems = [
      createItem({
        id: 'major-1',
        quantity: 2,
        taxClassId: 'tax-goods',
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

    expect(getQuotationPreviewRowPricing(majorItems, 'major-1-major', 10, exchangeRates, totalsConfig)).toEqual({
      unitPrice: 220,
      amount: 440,
      isGroup: true,
      taxClassId: 'tax-goods',
      taxClassLabel: 'Goods 13%',
      taxRate: 13,
      hasMixedTaxClasses: false,
      unitPriceWithTax: 248.6,
      amountWithTax: 497.2,
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
