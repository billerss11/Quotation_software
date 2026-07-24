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
      'unitTaxAmount',
      'leafUnitPriceWithTax',
      'subtotal',
      'taxBucketAmount:vat',
      'taxAmount',
      'totalWithTax',
      'costSalesPercentage',
    ])
    expect(explanation.steps[0]).toMatchObject({
      id: 'convertedUnitCost',
      values: { unitCost: 100, exchangeRate: 1.2, result: 120 },
    })
    expect(explanation.steps.find((step) => step.id === 'unitTaxAmount')).toMatchObject({
      values: { taxAmount: 45, quantity: 3, result: 15 },
    })
    expect(explanation.steps.find((step) => step.id === 'leafUnitPriceWithTax')).toMatchObject({
      values: { totalWithTax: 495, quantity: 3, result: 165 },
    })
    expect(explanation.steps.find((step) => step.id === 'taxBucketAmount:vat')).toMatchObject({
      kind: 'taxBucketAmount',
      values: { taxClass: 'VAT', taxableSubtotal: 450, taxRate: 10, result: 45 },
    })
    expect(explanation.steps.at(-1)).toMatchObject({
      id: 'costSalesPercentage',
      values: { baseAmount: 360, subtotal: 450, result: 80 },
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
      'unitTaxAmount',
      'leafUnitPriceWithTax',
      'manualSubtotal',
      'convertedTotalCost',
      'manualMarkupAmount',
      'taxBucketAmount:vat',
      'taxAmount',
      'totalWithTax',
      'costSalesPercentage',
    ])
    expect(explanation.steps.find((step) => step.id === 'manualMarkupAmount')).toMatchObject({
      values: { subtotal: 600, baseAmount: 200, result: 400 },
    })
    expect(explanation.steps.find((step) => step.id === 'unitTaxAmount')).toMatchObject({
      values: { taxAmount: 30, quantity: 2, result: 15 },
    })
    const costSalesStep = explanation.steps.at(-1)
    expect(costSalesStep?.id).toBe('costSalesPercentage')
    expect(costSalesStep?.values).toMatchObject({ baseAmount: 200, subtotal: 600 })
    expect(costSalesStep?.values.result).toBeCloseTo(33.3333333333)
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
      'groupUnitPriceWithTax',
      'groupBaseRollup',
      'groupSubtotalRollup',
      'groupMarkupRollup',
      'groupEffectiveMarkupRate',
      'taxBucketAmount:vat',
      'taxAmount',
      'totalWithTax',
      'costSalesPercentage',
    ])
    expect(explanation.steps[1]).toMatchObject({
      values: { childTotal: 200, quantity: 2, result: 400 },
    })
    const costSalesStep = explanation.steps.at(-1)
    expect(costSalesStep?.id).toBe('costSalesPercentage')
    expect(costSalesStep?.values).toMatchObject({ baseAmount: 400, subtotal: 460 })
    expect(costSalesStep?.values.result).toBeCloseTo(86.9565217391)
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
    expect(explanation.steps.filter((step) => step.kind === 'taxBucketAmount')).toEqual([
      expect.objectContaining({
        id: 'taxBucketAmount:parts',
        values: expect.objectContaining({ taxableSubtotal: 100, taxRate: 13, result: 13 }),
      }),
      expect.objectContaining({
        id: 'taxBucketAmount:service',
        values: expect.objectContaining({ taxableSubtotal: 100, taxRate: 6, result: 6 }),
      }),
    ])
  })

  it('shows raw converted cost operands before rounded markup and selling price', () => {
    const explanation = createCalculationExplanationTree({
      item: createItem({
        id: 'precise-cost',
        quantity: 1,
        unitCost: 1.049,
        markupRate: 50,
      }),
      itemNumber: '1',
      globalMarkupRate: 0,
      exchangeRates: { USD: 1 },
      totalsConfig: createTaxConfig({ rate: 0 }),
    })

    expect(explanation.steps.find((step) => step.id === 'convertedUnitCost')).toMatchObject({
      values: { unitCost: 1.049, exchangeRate: 1, result: 1.05 },
    })
    expect(explanation.steps.find((step) => step.id === 'unitMarkup')).toMatchObject({
      values: { rawConvertedUnitCost: 1.049, markupRate: 50, result: 0.52 },
    })
    expect(explanation.steps.find((step) => step.id === 'unitSellingPrice')).toMatchObject({
      values: { convertedUnitCost: 1.05, unitMarkup: 0.52, result: 1.57 },
    })
  })

  it('reports negative markup for manual prices below cost', () => {
    const explanation = createCalculationExplanationTree({
      item: createItem({
        id: 'discounted-manual',
        pricingMethod: 'manual_price',
        quantity: 2,
        unitCost: 100,
        manualUnitPrice: 80,
      }),
      itemNumber: '1',
      globalMarkupRate: 0,
      exchangeRates: { USD: 1 },
      totalsConfig: createTaxConfig({ rate: 0 }),
    })

    expect(explanation.totals.markupAmount).toBe(-40)
    expect(explanation.steps.find((step) => step.id === 'manualMarkupAmount')).toMatchObject({
      values: { subtotal: 160, baseAmount: 200, result: -40 },
    })
  })

  it('uses a policy-specific markup step for manual prices without positive total cost', () => {
    const explanation = createCalculationExplanationTree({
      item: createItem({
        id: 'uncosted-manual',
        pricingMethod: 'manual_price',
        quantity: 2,
        unitCost: 0,
        manualUnitPrice: 80,
      }),
      itemNumber: '1',
      globalMarkupRate: 0,
      exchangeRates: { USD: 1 },
      totalsConfig: createTaxConfig({ rate: 0 }),
    })

    expect(explanation.steps.find((step) => step.id === 'manualMarkupAmount')).toBeUndefined()
    expect(explanation.steps.find((step) => step.id === 'manualMarkupUnavailable')).toMatchObject({
      values: { result: 0 },
    })
  })

  it('shows quotation allocation adjustments and derives unit amounts by division', () => {
    const explanation = createCalculationExplanationTree({
      item: createItem({
        id: 'allocated',
        quantity: 1,
        unitCost: 0.05,
        taxClassId: 'vat',
      }),
      itemNumber: '1',
      globalMarkupRate: 0,
      exchangeRates: { USD: 1 },
      totalsConfig: createTaxConfig({ rate: 10 }),
      allocatedTaxBuckets: [{
        taxClassId: 'vat',
        label: 'VAT',
        rate: 10,
        taxableSubtotal: 0.05,
        taxAmount: 0,
      }],
    })

    expect(explanation.steps.find((step) => step.id === 'taxBucketAmount:vat')).toMatchObject({
      values: { taxableSubtotal: 0.05, taxRate: 10, result: 0.01 },
    })
    expect(explanation.steps.find((step) => step.id === 'taxRoundingAllocation:vat')).toMatchObject({
      kind: 'taxRoundingAllocation',
      values: { calculatedTaxAmount: 0.01, adjustment: -0.01, result: 0 },
    })
    expect(explanation.steps.find((step) => step.id === 'unitTaxAmount')).toMatchObject({
      values: { taxAmount: 0, quantity: 1, result: 0 },
    })
    expect(explanation.steps.find((step) => step.id === 'leafUnitPriceWithTax')).toMatchObject({
      values: { totalWithTax: 0.05, quantity: 1, result: 0.05 },
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
    taxMode: 'mixed',
    defaultTaxClassId: 'vat',
    taxClasses: [{ id: 'vat', label: 'VAT', rate }],
    ...overrides,
  }
}
