import { describe, expect, it } from 'vitest'

import { createCalculationSheetRows } from './quotationCalculationSheetRows'
import type { QuotationItem, TotalsConfig } from '../types'

describe('quotation calculation sheet rows', () => {
  it('builds root and child rows with unit and total calculation values', () => {
    const rows = createCalculationSheetRows({
      item: createItem({
        id: 'root',
        name: 'Control cabinet assembly',
        quantity: 2,
        quantityUnit: 'set',
        markupRate: 20,
        taxClassId: 'service',
        children: [
          createItem({
            id: 'cabinet',
            name: 'Cabinet body',
            quantity: 2,
            quantityUnit: 'pc',
            unitCost: 2250,
            taxClassId: 'service',
          }),
          createItem({
            id: 'plc',
            name: 'PLC module',
            quantity: 4,
            quantityUnit: 'pc',
            unitCost: 460,
            taxClassId: 'parts',
          }),
          createItem({
            id: 'labor',
            name: 'Assembly labor',
            quantity: 28,
            quantityUnit: 'hour',
            pricingMethod: 'manual_price',
            manualUnitPrice: 60,
            unitCost: 50,
            taxClassId: 'service',
          }),
        ],
      }),
      itemNumber: '1',
      globalMarkupRate: 10,
      exchangeRates: { USD: 1 },
      totalsConfig: createMixedTaxConfig(),
    })

    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({
      itemId: 'root',
      itemNumber: '1',
      depth: 1,
      isGroup: true,
      quantity: 2,
      quantityUnit: 'set',
      unitCost: 7740,
      totalCost: 15480,
      markupRate: 20,
      markupSource: 'self',
      unitMarkupAmount: 1548,
      totalMarkupAmount: 3096,
      unitPrice: 9288,
      subtotal: 18576,
      taxClassLabel: null,
      taxRate: null,
      effectiveTaxRate: 7.66,
      unitTaxAmount: 711.84,
      totalTaxAmount: 1423.68,
      unitTotalWithTax: 9999.84,
      totalWithTax: 19999.68,
    })

    expect(rows[1]).toMatchObject({
      itemId: 'cabinet',
      itemNumber: '1.1',
      depth: 2,
      isGroup: false,
      unitCost: 2250,
      totalCost: 4500,
      markupRate: 20,
      markupSource: 'inherited',
      markupSourceLabel: '1',
      unitMarkupAmount: 450,
      totalMarkupAmount: 900,
      unitPrice: 2700,
      subtotal: 5400,
      taxClassLabel: 'Service',
      taxRate: 6,
      effectiveTaxRate: 6,
      unitTaxAmount: 162,
      totalTaxAmount: 324,
      unitTotalWithTax: 2862,
      totalWithTax: 5724,
    })

    expect(rows[2]).toMatchObject({
      itemId: 'plc',
      itemNumber: '1.2',
      taxClassLabel: 'Parts',
      taxRate: 13,
      unitTaxAmount: 71.76,
      totalTaxAmount: 287.04,
    })
  })

  it('marks group rows with mixed descendant cost currencies', () => {
    const rows = createCalculationSheetRows({
      item: createItem({
        id: 'root',
        children: [
          createItem({
            id: 'same-currency-group',
            children: [
              createItem({ id: 'same-1', costCurrency: 'USD', unitCost: 100 }),
              createItem({ id: 'same-2', costCurrency: 'USD', unitCost: 200 }),
            ],
          }),
          createItem({
            id: 'mixed-currency-group',
            children: [
              createItem({ id: 'mixed-1', costCurrency: 'USD', unitCost: 100 }),
              createItem({ id: 'mixed-2', costCurrency: 'CNY', unitCost: 200 }),
            ],
          }),
        ],
      }),
      itemNumber: '1',
      globalMarkupRate: 10,
      exchangeRates: { USD: 1, CNY: 0.14 },
      totalsConfig: createMixedTaxConfig(),
    })

    expect(rows.find((row) => row.itemId === 'root')).toMatchObject({
      costCurrency: null,
      hasMixedCostCurrencies: true,
    })
    expect(rows.find((row) => row.itemId === 'same-currency-group')).toMatchObject({
      costCurrency: 'USD',
      hasMixedCostCurrencies: false,
    })
    expect(rows.find((row) => row.itemId === 'mixed-currency-group')).toMatchObject({
      costCurrency: null,
      hasMixedCostCurrencies: true,
    })
  })
})

function createItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: 'item',
    name: 'Item',
    description: '',
    quantity: 1,
    quantityUnit: 'pc',
    pricingMethod: 'cost_plus',
    unitCost: 0,
    costCurrency: 'USD',
    children: [],
    ...overrides,
  }
}

function createMixedTaxConfig(): TotalsConfig {
  return {
    globalMarkupRate: 10,
    discountMode: 'percentage',
    discountValue: 0,
    taxMode: 'mixed',
    defaultTaxClassId: 'service',
    taxClasses: [
      { id: 'service', label: 'Service', rate: 6 },
      { id: 'parts', label: 'Parts', rate: 13 },
    ],
  }
}
