import { describe, expect, it } from 'vitest'

import { createCalculationExplanationTree } from './quotationCalculationExplanation'
import type { QuotationItem, TotalsConfig } from '../types'

describe('quotation calculation explanation', () => {
  it('explains a cost-plus leaf with exchange rate, markup, and tax', () => {
    const explanation = createCalculationExplanationTree({
      item: createItem({
        id: 'leaf',
        name: 'Imported motor',
        quantity: 3,
        unitCost: 100,
        costCurrency: 'EUR',
        markupRate: 25,
      }),
      itemNumber: '1',
      globalMarkupRate: 10,
      exchangeRates: { USD: 1, EUR: 1.2 },
      totalsConfig: createTaxConfig(),
    })

    expect(explanation).toMatchObject({
      itemId: 'leaf',
      itemNumber: '1',
      depth: 1,
      isGroup: false,
      pricingMethod: 'cost_plus',
      totals: {
        baseAmount: 360,
        markupAmount: 90,
        subtotal: 450,
        taxAmount: 45,
        totalWithTax: 495,
        unitSellingPrice: 150,
        unitPriceWithTax: 165,
        effectiveMarkupRate: 25,
        markupSource: 'self',
        taxClassLabel: 'VAT',
        taxRate: 10,
        taxSource: { kind: 'default' },
      },
    })
    expect(explanation.steps.map((step) => step.id)).toEqual([
      'convertedUnitCost',
      'unitMarkup',
      'unitSellingPrice',
      'subtotal',
      'taxAmount',
      'unitTaxAmount',
      'totalWithTax',
      'leafUnitPriceWithTax',
    ])
    expect(explanation.steps[0]).toMatchObject({
      id: 'convertedUnitCost',
      values: { unitCost: 100, exchangeRate: 1.2, result: 120 },
    })
    expect(explanation.steps.find((step) => step.id === 'unitTaxAmount')).toMatchObject({
      values: { unitSellingPrice: 150, taxRate: 10, result: 15 },
    })
    expect(explanation.steps.find((step) => step.id === 'leafUnitPriceWithTax')).toMatchObject({
      values: { unitSellingPrice: 150, unitTaxAmount: 15, result: 165 },
    })
  })

  it('explains a manual-price leaf using manual price and computed markup', () => {
    const explanation = createCalculationExplanationTree({
      item: createItem({
        id: 'manual',
        pricingMethod: 'manual_price',
        quantity: 2,
        unitCost: 100,
        manualUnitPrice: 300,
      }),
      itemNumber: '1',
      globalMarkupRate: 10,
      exchangeRates: { USD: 1 },
      totalsConfig: createTaxConfig({ rate: 5 }),
    })

    expect(explanation).toMatchObject({
      pricingMethod: 'manual_price',
      totals: {
        baseAmount: 200,
        markupAmount: 400,
        subtotal: 600,
        taxAmount: 30,
        totalWithTax: 630,
        unitSellingPrice: 300,
      },
    })
    expect(explanation.steps.map((step) => step.id)).toEqual([
      'manualUnitPrice',
      'manualSubtotal',
      'convertedTotalCost',
      'manualMarkupAmount',
      'taxAmount',
      'unitTaxAmount',
      'totalWithTax',
      'leafUnitPriceWithTax',
    ])
    expect(explanation.steps.find((step) => step.id === 'manualMarkupAmount')).toMatchObject({
      values: { subtotal: 600, baseAmount: 200, result: 400 },
    })
    expect(explanation.steps.find((step) => step.id === 'unitTaxAmount')).toMatchObject({
      values: { unitSellingPrice: 300, taxRate: 5, result: 15 },
    })
  })

  it('explains a group by rolling child calculations up through quantity', () => {
    const explanation = createCalculationExplanationTree({
      item: createItem({
        id: 'root',
        quantity: 2,
        children: [
          createItem({ id: 'child-a', quantity: 1, unitCost: 100, markupRate: 10 }),
          createItem({
            id: 'child-b',
            quantity: 1,
            children: [
              createItem({ id: 'grandchild-b', quantity: 2, unitCost: 50, markupRate: 20 }),
            ],
          }),
        ],
      }),
      itemNumber: '1',
      globalMarkupRate: 0,
      exchangeRates: { USD: 1 },
      totalsConfig: createTaxConfig({ rate: 0 }),
    })

    expect(explanation).toMatchObject({
      itemId: 'root',
      isGroup: true,
      totals: {
        baseAmount: 400,
        markupAmount: 60,
        subtotal: 460,
        taxAmount: 0,
        totalWithTax: 460,
        effectiveMarkupRate: 15,
      },
    })
    expect(explanation.children.map((child) => child.itemNumber)).toEqual(['1.1', '1.2'])
    expect(explanation.children[1]).toMatchObject({
      itemId: 'child-b',
      isGroup: true,
      children: [{ itemId: 'grandchild-b', itemNumber: '1.2.1', depth: 3 }],
    })
    expect(explanation.steps.map((step) => step.id)).toEqual([
      'groupBaseRollup',
      'groupSubtotalRollup',
      'groupMarkupRollup',
      'groupEffectiveMarkupRate',
      'groupTaxRollup',
      'totalWithTax',
      'groupUnitPriceWithTax',
    ])
    expect(explanation.steps[0]).toMatchObject({
      values: { childTotal: 200, quantity: 2, result: 400 },
    })
  })

  it('records inherited markup and inherited tax class sources', () => {
    const explanation = createCalculationExplanationTree({
      item: createItem({
        id: 'root',
        markupRate: 30,
        taxClassId: 'service',
        children: [
          createItem({
            id: 'child',
            quantity: 2,
            unitCost: 100,
          }),
        ],
      }),
      itemNumber: '1',
      globalMarkupRate: 10,
      exchangeRates: { USD: 1 },
      totalsConfig: createTaxConfig({
        defaultTaxClassId: 'parts',
        taxClasses: [
          { id: 'parts', label: 'Parts', rate: 13 },
          { id: 'service', label: 'Service', rate: 6 },
        ],
      }),
    })

    expect(explanation.children[0]).toMatchObject({
      itemId: 'child',
      totals: {
        effectiveMarkupRate: 30,
        markupSource: 'inherited',
        markupSourceLabel: '1',
        taxClassLabel: 'Service',
        taxRate: 6,
        taxSource: { kind: 'inherited', sourceLabel: '1' },
      },
    })
  })

  it('marks group tax as mixed when child tax classes differ', () => {
    const explanation = createCalculationExplanationTree({
      item: createItem({
        id: 'root',
        children: [
          createItem({ id: 'parts-line', taxClassId: 'parts', unitCost: 100 }),
          createItem({ id: 'service-line', taxClassId: 'service', unitCost: 100 }),
        ],
      }),
      itemNumber: '1',
      globalMarkupRate: 0,
      exchangeRates: { USD: 1 },
      totalsConfig: createTaxConfig({
        defaultTaxClassId: 'parts',
        taxClasses: [
          { id: 'parts', label: 'Parts', rate: 13 },
          { id: 'service', label: 'Service', rate: 6 },
        ],
      }),
    })

    expect(explanation.totals).toMatchObject({
      hasMixedTaxClasses: true,
      taxClassLabel: null,
      taxRate: null,
      effectiveTaxRate: 9.5,
      taxAmount: 19,
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

function createTaxConfig(overrides: Partial<TotalsConfig> & { rate?: number } = {}): TotalsConfig {
  const rate = overrides.rate ?? 10

  return {
    globalMarkupRate: 10,
    discountMode: 'percentage',
    discountValue: 0,
    taxMode: 'mixed',
    defaultTaxClassId: 'vat',
    taxClasses: [{ id: 'vat', label: 'VAT', rate }],
    ...overrides,
  }
}
