import { describe, expect, it } from 'vitest'

import type { CalculationSheetRow } from './quotationCalculationSheetRows'
import { createCalculationSheetCsvContent } from './quotationCalculationSheetCsv'

describe('quotationCalculationSheetCsv', () => {
  it('exports calculation rows with flattened merged-header names', () => {
    const content = createCalculationSheetCsvContent({
      rows: [createRow({ name: 'Pump, package' })],
      currency: 'USD',
      includeTaxClass: true,
      labels: createLabels(),
    })
    const lines = content.replace(/^\uFEFF/, '').split('\n')

    expect(lines[0]).toBe([
      'Item - #',
      'Item - Name',
      'Inputs - Qty',
      'Inputs - Unit',
      'Inputs - Cost currency',
      'Inputs - Markup rate',
      'Inputs - Tax class',
      'Inputs - Tax rate',
      'Unit - Cost (USD)',
      'Unit - Markup (USD)',
      'Unit - Price (USD)',
      'Unit - Tax (USD)',
      'Unit - Total (USD)',
      'Total - Cost (USD)',
      'Total - Markup (USD)',
      'Total - Subtotal excl. tax (USD)',
      'Total - Tax (USD)',
      'Total - Total (USD)',
    ].join(','))
    expect(lines[1]).toContain('1,"Pump, package",2,EA,USD,Global 10%,Parts,13%')
    expect(lines[1]).toContain('120.00,12.00,132.00,17.16,149.16')
    expect(lines[1]).toContain('240.00,24.00,264.00,34.32,298.32')
  })

  it('omits the tax class column in single tax mode', () => {
    const content = createCalculationSheetCsvContent({
      rows: [createRow()],
      currency: 'USD',
      includeTaxClass: false,
      labels: createLabels(),
    })
    const header = content.replace(/^\uFEFF/, '').split('\n')[0] ?? ''

    expect(header).not.toContain('Inputs - Tax class')
    expect(header).toContain('Inputs - Tax rate')
  })
})

function createLabels() {
  return {
    groups: {
      item: 'Item',
      inputs: 'Inputs',
      unit: 'Unit',
      total: 'Total',
    },
    columns: {
      number: '#',
      name: 'Name',
      quantity: 'Qty',
      unit: 'Unit',
      costCurrency: 'Cost currency',
      markupRate: 'Markup rate',
      taxClass: 'Tax class',
      taxRate: 'Tax rate',
      cost: 'Cost',
      markup: 'Markup',
      price: 'Price',
      tax: 'Tax',
      total: 'Total',
      subtotalExcludingTax: 'Subtotal excl. tax',
    },
    rollup: 'Rollup',
    taxClassMixed: 'Mixed',
    costCurrencyMixed: 'Mix',
    globalRate: (rate: string) => `Global ${rate}`,
    inheritedRate: (rate: string, source: string) => `Inherited ${rate} from ${source}`,
    manualPrice: 'Manual price',
  }
}

function createRow(overrides: Partial<CalculationSheetRow> = {}): CalculationSheetRow {
  return {
    itemId: 'item-1',
    itemNumber: '1',
    depth: 1,
    name: 'Pump package',
    quantity: 2,
    quantityUnit: 'EA',
    isGroup: false,
    pricingMethod: 'cost_plus',
    costCurrency: 'USD',
    hasMixedCostCurrencies: false,
    exchangeRate: 1,
    unitCost: 120,
    totalCost: 240,
    markupRate: 10,
    markupSource: 'global',
    markupSourceLabel: null,
    unitMarkupAmount: 12,
    totalMarkupAmount: 24,
    unitPrice: 132,
    subtotal: 264,
    taxClassLabel: 'Parts',
    taxRate: 13,
    effectiveTaxRate: 13,
    hasMixedTaxClasses: false,
    unitTaxAmount: 17.16,
    totalTaxAmount: 34.32,
    unitTotalWithTax: 149.16,
    totalWithTax: 298.32,
    ...overrides,
  }
}
