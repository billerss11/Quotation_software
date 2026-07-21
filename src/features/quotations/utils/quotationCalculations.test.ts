import { describe, expect, it } from 'vitest'

import type { ExchangeRateTable, QuotationItem, TotalsConfig } from '../types'
import {
  calculateCostSalesPercentage,
  calculateLineCost,
  calculateLineSellingAmount,
  calculateMajorItemSummary,
  calculateQuotationItemBaseSubtotal,
  calculateQuotationItemTaxBucketSubtotals,
  calculateQuotationItemUnitSellingPrice,
  calculateQuotationTotals,
  calculateQuotationTotalsFromSummaries,
  calculateUnitSellingPrice,
  getEffectiveMarkupRate,
} from './quotationCalculations'

describe('quotation calculations', () => {
  const globalTotalsConfig: TotalsConfig = {
    globalMarkupRate: 10,
    taxRate: 13,
  }
  const usdQuoteRates: ExchangeRateTable = {
    USD: 1,
    CNY: 0.14,
    EUR: 1.08,
    GBP: 1.25,
  }

  it('calculates unit selling price from unit cost and markup', () => {
    expect(calculateUnitSellingPrice({ unitCost: 125.555, costCurrency: 'USD' }, 20, usdQuoteRates)).toBe(150.67)
  })

  it('converts unit cost into quotation currency before markup', () => {
    expect(calculateUnitSellingPrice({ unitCost: 100, costCurrency: 'CNY' }, 20, usdQuoteRates)).toBe(16.8)
  })

  it('calculates internal line cost and customer-facing line amount separately', () => {
    const line = { quantity: 3, unitCost: 125.555, costCurrency: 'USD' as const }

    expect(calculateLineCost(line, usdQuoteRates)).toBe(376.67)
    expect(calculateLineSellingAmount(line, 20, usdQuoteRates)).toBe(452.01)
  })

  it('calculates cost over sales percentage from pre-tax amounts', () => {
    expect(calculateCostSalesPercentage(100, 110)).toBeCloseTo(90.909, 3)
    expect(calculateCostSalesPercentage(100, 0)).toBeNull()
  })

  it('uses an entered final unit price directly for manual-price rows', () => {
    const line = {
      quantity: 3,
      unitCost: 125.555,
      costCurrency: 'USD' as const,
      pricingMethod: 'manual_price' as const,
      manualUnitPrice: 180,
    }

    expect(calculateUnitSellingPrice(line, 20, usdQuoteRates)).toBe(180)
    expect(calculateLineSellingAmount(line, 20, usdQuoteRates)).toBe(540)
  })

  it('rolls sub-items into a locked parent subtotal', () => {
    const item = createItem({
      id: 'major-1',
      name: 'Surface Equipment Supply',
      description: 'Parent text only',
      quantity: 1,
      unitCost: 9999,
      costCurrency: 'USD',
      children: [
        createItem({
          id: 'sub-1',
          name: 'Valve set',
          quantity: 2,
          unitCost: 100,
          costCurrency: 'USD',
        }),
        createItem({
          id: 'sub-2',
          name: 'Fittings',
          quantity: 3,
          unitCost: 50,
          costCurrency: 'USD',
        }),
      ],
    })

    expect(calculateMajorItemSummary(item, globalTotalsConfig, usdQuoteRates)).toEqual({
      itemId: 'major-1',
      baseSubtotal: 350,
      markupAmount: 35,
      subtotal: 385,
    })
  })

  it('uses per-item markup when a parent override exists', () => {
    const item = createItem({
      id: 'major-2',
      name: 'Installation',
      description: 'Labor and commissioning',
      quantity: 4,
      unitCost: 500,
      costCurrency: 'USD',
      markupRate: 20,
    })

    expect(calculateMajorItemSummary(item, globalTotalsConfig, usdQuoteRates)).toEqual({
      itemId: 'major-2',
      baseSubtotal: 2000,
      markupAmount: 400,
      subtotal: 2400,
    })
  })

  it('ignores the imported parent total in selling math', () => {
    const item = createItem({
      id: 'major-override',
      name: 'Package',
      quantity: 2,
      expectedTotal: 300,
      children: [
        createItem({
          id: 'sub-1',
          name: 'Valve',
          quantity: 2,
          unitCost: 50,
          costCurrency: 'USD',
        }),
        createItem({
          id: 'sub-2',
          name: 'Labor',
          quantity: 1,
          unitCost: 20,
          costCurrency: 'USD',
        }),
      ],
    })

    expect(calculateQuotationItemUnitSellingPrice(item, globalTotalsConfig.globalMarkupRate, usdQuoteRates)).toBe(132)
    expect(calculateMajorItemSummary(item, globalTotalsConfig, usdQuoteRates)).toEqual({
      itemId: 'major-override',
      baseSubtotal: 240,
      markupAmount: 24,
      subtotal: 264,
    })
  })

  it('calculates quotation totals with markup and tax', () => {
    const items: QuotationItem[] = [
      createItem({
        id: 'major-1',
        name: 'Equipment',
        quantity: 1,
        unitCost: 1000,
        costCurrency: 'USD',
      }),
      createItem({
        id: 'major-2',
        name: 'Services',
        quantity: 2,
        unitCost: 500,
        costCurrency: 'USD',
        markupRate: 20,
      }),
    ]

    expect(calculateQuotationTotals(items, globalTotalsConfig, usdQuoteRates)).toEqual({
      baseSubtotal: 2000,
      markupAmount: 300,
      subtotalAfterMarkup: 2300,
      taxableSubtotal: 2300,
      taxAmount: 299,
      grandTotal: 2599,
      taxBuckets: [
        {
          taxClassId: 'default-tax-class',
          label: '13%',
          rate: 13,
          taxableSubtotal: 2300,
          taxAmount: 299,
        },
      ],
    })
  })

  it('includes manual-price rows in selling totals without inventing markup from missing cost data', () => {
    const items: QuotationItem[] = [
      createItem({
        id: 'manual-1',
        name: 'Quick quote item',
        quantity: 4,
        quantityUnit: 'ea',
        pricingMethod: 'manual_price',
        manualUnitPrice: 250,
      }),
    ]

    expect(calculateQuotationTotals(items, globalTotalsConfig, usdQuoteRates)).toEqual({
      baseSubtotal: 0,
      markupAmount: 0,
      subtotalAfterMarkup: 1000,
      taxableSubtotal: 1000,
      taxAmount: 130,
      grandTotal: 1130,
      taxBuckets: [
        {
          taxClassId: 'default-tax-class',
          label: '13%',
          rate: 13,
          taxableSubtotal: 1000,
          taxAmount: 130,
        },
      ],
    })
  })

  it('reports negative markup when a manual-price row is below stored cost', () => {
    const items: QuotationItem[] = [
      createItem({
        id: 'manual-loss',
        name: 'Manual loss item',
        quantity: 2,
        pricingMethod: 'manual_price',
        manualUnitPrice: 80,
        unitCost: 100,
        costCurrency: 'USD',
      }),
    ]

    expect(calculateMajorItemSummary(items[0], globalTotalsConfig, usdQuoteRates)).toEqual({
      itemId: 'manual-loss',
      baseSubtotal: 200,
      markupAmount: -40,
      subtotal: 160,
    })
    expect(
      calculateQuotationTotals(
        items,
        {
          globalMarkupRate: 10,
          taxRate: 0,
        },
        usdQuoteRates,
      ),
    ).toMatchObject({
      baseSubtotal: 200,
      markupAmount: -40,
      subtotalAfterMarkup: 160,
      taxableSubtotal: 160,
      grandTotal: 160,
    })
  })

  it('ignores section headers when calculating quotation totals', () => {
    const result = calculateQuotationTotals(
      [
        {
          id: 'section-1',
          kind: 'section_header',
          title: 'Valve',
        } as never,
        createItem({
          id: 'major-1',
          name: 'Valve body',
          quantity: 1,
          unitCost: 100,
          costCurrency: 'USD',
        }),
      ] as unknown as QuotationItem[],
      {
        globalMarkupRate: 0,
        taxRate: 0,
      },
      usdQuoteRates,
    )

    expect(result).toMatchObject({
      baseSubtotal: 100,
      markupAmount: 0,
      subtotalAfterMarkup: 100,
      grandTotal: 100,
    })
  })

  it('applies tax on top of the taxable subtotal', () => {
    const items: QuotationItem[] = [
      createItem({
        id: 'major-1',
        name: 'Equipment',
        quantity: 1,
        unitCost: 100,
        costCurrency: 'USD',
      }),
    ]

    expect(
      calculateQuotationTotals(
        items,
        {
          globalMarkupRate: 0,
          taxRate: 13,
        },
        usdQuoteRates,
      ),
    ).toEqual({
      baseSubtotal: 100,
      markupAmount: 0,
      subtotalAfterMarkup: 100,
      taxableSubtotal: 100,
      taxAmount: 13,
      grandTotal: 113,
      taxBuckets: [
        {
          taxClassId: 'default-tax-class',
          label: '13%',
          rate: 13,
          taxableSubtotal: 100,
          taxAmount: 13,
        },
      ],
    })
  })

  it('totals mixed-currency costs in the quotation currency', () => {
    const items: QuotationItem[] = [
      createItem({
        id: 'major-1',
        name: 'Imported materials',
        quantity: 1,
        unitCost: 100,
        costCurrency: 'CNY',
      }),
      createItem({
        id: 'major-2',
        name: 'License',
        quantity: 1,
        unitCost: 50,
        costCurrency: 'USD',
      }),
    ]

    expect(
      calculateQuotationTotals(
        items,
        {
          globalMarkupRate: 10,
          taxRate: 0,
        },
        usdQuoteRates,
      ),
    ).toEqual({
      baseSubtotal: 64,
      markupAmount: 6.4,
      subtotalAfterMarkup: 70.4,
      taxableSubtotal: 70.4,
      taxAmount: 0,
      grandTotal: 70.4,
      taxBuckets: [
        {
          taxClassId: 'default-tax-class',
          label: '0%',
          rate: 0,
          taxableSubtotal: 70.4,
          taxAmount: 0,
        },
      ],
    })
  })

  it('rolls third-level detail lines into the sub-item and major item subtotal', () => {
    const item = createItem({
      id: 'major-1',
      name: 'Valve package',
      quantity: 1,
      unitCost: 9999,
      costCurrency: 'USD',
      children: [
        createItem({
          id: 'sub-1',
          name: 'Valve set',
          quantity: 1,
          unitCost: 8888,
          costCurrency: 'USD',
          children: [
            createItem({
              id: 'detail-1',
              name: 'Valve body',
              quantity: 2,
              unitCost: 100,
              costCurrency: 'USD',
            }),
            createItem({
              id: 'detail-2',
              name: 'Actuator',
              quantity: 1,
              unitCost: 150,
              costCurrency: 'USD',
            }),
          ],
        }),
      ],
    })

    expect(calculateMajorItemSummary(item, globalTotalsConfig, usdQuoteRates)).toEqual({
      itemId: 'major-1',
      baseSubtotal: 350,
      markupAmount: 35,
      subtotal: 385,
    })
  })

  it('uses the nearest markup override on leaf rows inside grouped items', () => {
    const item = createItem({
      id: 'major-1',
      name: 'Equipment package',
      markupRate: 5,
      children: [
        createItem({
          id: 'sub-1',
          name: 'Valve set',
          markupRate: 20,
          children: [
            createItem({
              id: 'detail-1',
              name: 'Valve body',
              quantity: 2,
              unitCost: 100,
              costCurrency: 'USD',
            }),
          ],
        }),
        createItem({
          id: 'sub-2',
          name: 'Installation',
          quantity: 1,
          unitCost: 50,
          costCurrency: 'USD',
        }),
      ],
    })

    expect(calculateMajorItemSummary(item, globalTotalsConfig, usdQuoteRates)).toEqual({
      itemId: 'major-1',
      baseSubtotal: 250,
      markupAmount: 42.5,
      subtotal: 292.5,
    })
  })

  it('multiplies a grouped child assembly by the parent quantity', () => {
    const item = createItem({
      id: 'major-1',
      name: 'Control panel package',
      quantity: 1,
      children: [
        createItem({
          id: 'sub-1',
          name: 'Assembly 1.1',
          quantity: 10,
          quantityUnit: 'ea',
          children: [
            createItem({
              id: 'detail-1',
              name: 'Main casing',
              quantity: 1,
              unitCost: 100,
              costCurrency: 'USD',
            }),
            createItem({
              id: 'detail-2',
              name: 'Fastener set',
              quantity: 10,
              unitCost: 2,
              costCurrency: 'USD',
            }),
            createItem({
              id: 'detail-3',
              name: 'Harness',
              quantity: 3,
              unitCost: 5,
              costCurrency: 'USD',
            }),
          ],
        }),
      ],
    })

    expect(calculateQuotationItemUnitSellingPrice(item.children[0], globalTotalsConfig.globalMarkupRate, usdQuoteRates)).toBe(148.5)
    expect(calculateMajorItemSummary(item, globalTotalsConfig, usdQuoteRates)).toEqual({
      itemId: 'major-1',
      baseSubtotal: 1350,
      markupAmount: 135,
      subtotal: 1485,
    })
  })

  it('converts EUR unit cost to quotation currency before markup', () => {
    // 100 EUR × 1.08 = 108 USD, then +10% markup → 118.80
    expect(calculateUnitSellingPrice({ unitCost: 100, costCurrency: 'EUR' }, 10, usdQuoteRates)).toBe(118.8)
  })

  it('converts GBP unit cost to quotation currency before markup', () => {
    // 100 GBP × 1.25 = 125 USD, then +10% markup → 137.50
    expect(calculateUnitSellingPrice({ unitCost: 100, costCurrency: 'GBP' }, 10, usdQuoteRates)).toBe(137.5)
  })

  it('returns exact cost when markup rate is 0%', () => {
    expect(calculateUnitSellingPrice({ unitCost: 200, costCurrency: 'USD' }, 0, usdQuoteRates)).toBe(200)
    expect(calculateLineSellingAmount({ quantity: 5, unitCost: 100, costCurrency: 'USD' }, 0, usdQuoteRates)).toBe(500)
  })

  it('returns 0 for zero quantity', () => {
    expect(calculateLineCost({ quantity: 0, unitCost: 500, costCurrency: 'USD' }, usdQuoteRates)).toBe(0)
    expect(calculateLineSellingAmount({ quantity: 0, unitCost: 500, costCurrency: 'USD' }, 20, usdQuoteRates)).toBe(0)
  })

  it('returns 0 for zero unit cost', () => {
    expect(calculateLineCost({ quantity: 5, unitCost: 0, costCurrency: 'USD' }, usdQuoteRates)).toBe(0)
  })

  it('clamps negative quantity to zero', () => {
    expect(calculateLineCost({ quantity: -3, unitCost: 100, costCurrency: 'USD' }, usdQuoteRates)).toBe(0)
  })

  it('clamps negative unit cost to zero', () => {
    expect(calculateLineCost({ quantity: 2, unitCost: -50, costCurrency: 'USD' }, usdQuoteRates)).toBe(0)
  })

  it('treats NaN quantity as zero', () => {
    expect(calculateLineCost({ quantity: NaN, unitCost: 100, costCurrency: 'USD' }, usdQuoteRates)).toBe(0)
  })

  it('treats Infinity quantity as zero', () => {
    expect(calculateLineCost({ quantity: Infinity, unitCost: 100, costCurrency: 'USD' }, usdQuoteRates)).toBe(0)
  })

  it('multiplies a grouped root assembly by its own quoted quantity', () => {
    const item = createItem({
      id: 'major-1',
      name: 'Pump skid assembly',
      quantity: 4,
      quantityUnit: 'ea',
      children: [
        createItem({
          id: 'sub-1',
          name: 'Pump',
          quantity: 1,
          unitCost: 100,
          costCurrency: 'USD',
        }),
        createItem({
          id: 'sub-2',
          name: 'Bolts',
          quantity: 8,
          unitCost: 2,
          costCurrency: 'USD',
        }),
      ],
    })

    expect(calculateQuotationItemUnitSellingPrice(item, globalTotalsConfig.globalMarkupRate, usdQuoteRates)).toBe(127.6)
    expect(calculateMajorItemSummary(item, globalTotalsConfig, usdQuoteRates)).toEqual({
      itemId: 'major-1',
      baseSubtotal: 464,
      markupAmount: 46.4,
      subtotal: 510.4,
    })
  })

  it('rolls manual-price and cost-plus children together under the same parent', () => {
    const item = createItem({
      id: 'major-mixed',
      name: 'Mixed package',
      quantity: 1,
      children: [
        createItem({
          id: 'child-manual',
          name: 'Quoted directly',
          quantity: 2,
          quantityUnit: 'ea',
          pricingMethod: 'manual_price',
          manualUnitPrice: 120,
        }),
        createItem({
          id: 'child-cost',
          name: 'Costed line',
          quantity: 1,
          quantityUnit: 'ea',
          unitCost: 100,
          costCurrency: 'USD',
        }),
      ],
    })

    expect(calculateMajorItemSummary(item, globalTotalsConfig, usdQuoteRates)).toEqual({
      itemId: 'major-mixed',
      baseSubtotal: 100,
      markupAmount: 10,
      subtotal: 350,
    })
  })
})

describe('getEffectiveMarkupRate', () => {
  it('uses own rate when it is a finite positive number', () => {
    expect(getEffectiveMarkupRate(25, 10)).toBe(25)
  })

  it('caps overly large markup rates at the supported maximum', () => {
    expect(getEffectiveMarkupRate(2_000, 10)).toBe(1_000)
  })

  it('falls back to global rate when own rate is undefined', () => {
    expect(getEffectiveMarkupRate(undefined, 15)).toBe(15)
  })

  it('clamps negative own rate to 0', () => {
    expect(getEffectiveMarkupRate(-5, 10)).toBe(0)
  })

  it('clamps negative global rate to 0 when own rate is absent', () => {
    expect(getEffectiveMarkupRate(undefined, -3)).toBe(0)
  })

  it('ignores NaN own rate and falls back to global rate', () => {
    expect(getEffectiveMarkupRate(NaN, 10)).toBe(10)
  })

  it('treats own rate of 0 as an explicit override (not a fallback)', () => {
    expect(getEffectiveMarkupRate(0, 20)).toBe(0)
  })
})

describe('calculateQuotationItemBaseSubtotal', () => {
  const usdRates: ExchangeRateTable = { USD: 1, CNY: 0.14, EUR: 1.08, GBP: 1.25 }

  it('returns quantity × unit cost for a leaf item', () => {
    const item = createItem({ quantity: 3, unitCost: 50, costCurrency: 'USD' })
    expect(calculateQuotationItemBaseSubtotal(item, usdRates)).toBe(150)
  })

  it('sums child costs and multiplies by parent quantity for a group', () => {
    // children: 3×10 = 30 and 1×20 = 20, sum = 50; parent qty 2 → 100
    const item = createItem({
      quantity: 2,
      children: [
        createItem({ quantity: 3, unitCost: 10, costCurrency: 'USD' }),
        createItem({ quantity: 1, unitCost: 20, costCurrency: 'USD' }),
      ],
    })
    expect(calculateQuotationItemBaseSubtotal(item, usdRates)).toBe(100)
  })

  it('converts foreign currency children before summing', () => {
    // 100 CNY × 0.14 = 14 USD; qty 1 parent
    const item = createItem({
      quantity: 1,
      children: [createItem({ quantity: 1, unitCost: 100, costCurrency: 'CNY' })],
    })
    expect(calculateQuotationItemBaseSubtotal(item, usdRates)).toBe(14)
  })
})

describe('calculateQuotationTotals edge cases', () => {
  const usdRates: ExchangeRateTable = { USD: 1, CNY: 0.14, EUR: 1.08, GBP: 1.25 }

  it('grand total equals base cost when markup and tax are zero', () => {
    const items = [createItem({ id: 'a', quantity: 3, unitCost: 100, costCurrency: 'USD' })]
    expect(
      calculateQuotationTotals(items, { globalMarkupRate: 0, taxRate: 0 }, usdRates),
    ).toEqual({
      baseSubtotal: 300,
      markupAmount: 0,
      subtotalAfterMarkup: 300,
      taxableSubtotal: 300,
      taxAmount: 0,
      grandTotal: 300,
      taxBuckets: [
        {
          taxClassId: 'default-tax-class',
          label: '0%',
          rate: 0,
          taxableSubtotal: 300,
          taxAmount: 0,
        },
      ],
    })
  })

  it('applies tax on top of the subtotal', () => {
    // base 1000, 10% tax -> grandTotal = 1100
    const items = [createItem({ id: 'a', quantity: 1, unitCost: 1000, costCurrency: 'USD' })]
    expect(
      calculateQuotationTotals(items, { globalMarkupRate: 0, taxRate: 10 }, usdRates),
    ).toEqual({
      baseSubtotal: 1000,
      markupAmount: 0,
      subtotalAfterMarkup: 1000,
      taxableSubtotal: 1000,
      taxAmount: 100,
      grandTotal: 1100,
      taxBuckets: [
        {
          taxClassId: 'default-tax-class',
          label: '10%',
          rate: 10,
          taxableSubtotal: 1000,
          taxAmount: 100,
        },
      ],
    })
  })

  it('adds quotation-level extra charges after tax', () => {
    const items = [createItem({ id: 'a', quantity: 1, unitCost: 1000, costCurrency: 'USD' })]

    expect(
      calculateQuotationTotals(
        items,
        {
          globalMarkupRate: 0,
          taxRate: 10,
          extraCharges: [
            { id: 'shipping', label: 'Shipping', amount: 80 },
            { id: 'misc', label: 'Misc', amount: 20 },
          ],
        },
        usdRates,
      ).grandTotal,
    ).toBe(1200)
  })

  it('calculates mixed tax buckets per tax class', () => {
    const goodsTaxClass = { id: 'tax-goods', label: 'Goods 13%', rate: 13 }
    const serviceTaxClass = { id: 'tax-service', label: 'Service 6%', rate: 6 }
    const items = [
      createItem({
        id: 'goods',
        name: 'Equipment',
        quantity: 1,
        unitCost: 1000,
        costCurrency: 'USD',
        taxClassId: goodsTaxClass.id,
      }),
      createItem({
        id: 'service',
        name: 'Commissioning',
        quantity: 1,
        unitCost: 500,
        costCurrency: 'USD',
        taxClassId: serviceTaxClass.id,
      }),
    ]

    const result = calculateQuotationTotals(
      items,
      {
        globalMarkupRate: 0,
        taxClasses: [goodsTaxClass, serviceTaxClass],
        defaultTaxClassId: goodsTaxClass.id,
      } as unknown as TotalsConfig,
      usdRates,
    )

    expect(result).toMatchObject({
      baseSubtotal: 1500,
      markupAmount: 0,
      subtotalAfterMarkup: 1500,
      taxableSubtotal: 1500,
      taxAmount: 160,
      grandTotal: 1660,
      taxBuckets: [
        {
          taxClassId: goodsTaxClass.id,
          label: goodsTaxClass.label,
          rate: goodsTaxClass.rate,
          taxableSubtotal: 1000,
          taxAmount: 130,
        },
        {
          taxClassId: serviceTaxClass.id,
          label: serviceTaxClass.label,
          rate: serviceTaxClass.rate,
          taxableSubtotal: 500,
          taxAmount: 30,
        },
      ],
    })
  })

  it('uses the nearest inherited tax class and lets children override it', () => {
    const goodsTaxClass = { id: 'tax-goods', label: 'Goods 13%', rate: 13 }
    const serviceTaxClass = { id: 'tax-service', label: 'Service 6%', rate: 6 }
    const items = [
      createItem({
        id: 'package',
        name: 'Package',
        taxClassId: goodsTaxClass.id,
        children: [
          createItem({
            id: 'equipment',
            name: 'Equipment',
            quantity: 1,
            unitCost: 100,
            costCurrency: 'USD',
          }),
          createItem({
            id: 'service',
            name: 'Service',
            quantity: 1,
            unitCost: 100,
            costCurrency: 'USD',
            taxClassId: serviceTaxClass.id,
          }),
        ],
      }),
    ]

    const result = calculateQuotationTotals(
      items,
      {
        globalMarkupRate: 0,
        taxClasses: [goodsTaxClass, serviceTaxClass],
        defaultTaxClassId: goodsTaxClass.id,
      } as unknown as TotalsConfig,
      usdRates,
    )

    expect(result.taxBuckets).toEqual([
      {
        taxClassId: goodsTaxClass.id,
        label: goodsTaxClass.label,
        rate: goodsTaxClass.rate,
        taxableSubtotal: 100,
        taxAmount: 13,
      },
      {
        taxClassId: serviceTaxClass.id,
        label: serviceTaxClass.label,
        rate: serviceTaxClass.rate,
        taxableSubtotal: 100,
        taxAmount: 6,
      },
    ])
    expect(result.taxAmount).toBe(19)
    expect(result.grandTotal).toBe(219)
  })

  it('does not round nested quantity multipliers before calculating tax buckets', () => {
    const taxClass = { id: 'tax-10', label: '10%', rate: 10 }
    const items = [
      createItem({
        id: 'parent',
        quantity: 0.33,
        taxClassId: taxClass.id,
        children: [
          createItem({
            id: 'child-group',
            quantity: 0.33,
            taxClassId: taxClass.id,
            children: [
              createItem({
                id: 'leaf',
                quantity: 1,
                unitCost: 1000,
                costCurrency: 'USD',
                taxClassId: taxClass.id,
              }),
            ],
          }),
        ],
      }),
    ]

    const result = calculateQuotationTotals(
      items,
      {
        globalMarkupRate: 0,
        taxClasses: [taxClass],
        defaultTaxClassId: taxClass.id,
      } as unknown as TotalsConfig,
      usdRates,
    )

    expect(result.subtotalAfterMarkup).toBe(108.9)
    expect(result.taxBuckets).toEqual([
      {
        taxClassId: taxClass.id,
        label: taxClass.label,
        rate: taxClass.rate,
        taxableSubtotal: 108.9,
        taxAmount: 10.89,
      },
    ])
    expect(result.grandTotal).toBe(119.79)
  })

  it('keeps tax bucket subtotals aligned with rounded quotation subtotals for fractional nested quantities', () => {
    const taxClass = { id: 'tax-10', label: '10%', rate: 10 }
    const items = [
      createItem({
        id: 'parent',
        quantity: 0.03,
        taxClassId: taxClass.id,
        children: [
          createItem({
            id: 'child-group',
            quantity: 0.07,
            taxClassId: taxClass.id,
            children: [
              createItem({
                id: 'leaf',
                quantity: 1,
                unitCost: 2.37,
                costCurrency: 'USD',
                taxClassId: taxClass.id,
              }),
            ],
          }),
        ],
      }),
    ]

    const result = calculateQuotationTotals(
      items,
      {
        globalMarkupRate: 0,
        taxClasses: [taxClass],
        defaultTaxClassId: taxClass.id,
      } as unknown as TotalsConfig,
      usdRates,
    )

    expect(result.subtotalAfterMarkup).toBe(0.01)
    expect(result.taxableSubtotal).toBe(0.01)
    expect(result.taxBuckets[0]?.taxableSubtotal).toBe(0.01)
  })

  it('reconciles markup with cost and selling subtotal for fractional nested quantities', () => {
    const item = createItem({
      id: 'parent',
      quantity: 1.5,
      markupRate: 7.5,
      children: [
        createItem({
          id: 'leaf',
          quantity: 2.5,
          unitCost: 10.005,
          costCurrency: 'USD',
        }),
      ],
    })

    expect(calculateMajorItemSummary(item, { globalMarkupRate: 0 }, usdRates)).toEqual({
      itemId: 'parent',
      baseSubtotal: 37.52,
      markupAmount: 2.83,
      subtotal: 40.35,
    })
  })

  it('caps tax at 100% of the taxable subtotal', () => {
    const items = [createItem({ id: 'a', quantity: 1, unitCost: 100, costCurrency: 'USD' })]
    expect(
      calculateQuotationTotals(
        items,
        { globalMarkupRate: 0, taxRate: 150 },
        usdRates,
      ),
    ).toEqual({
      baseSubtotal: 100,
      markupAmount: 0,
      subtotalAfterMarkup: 100,
      taxableSubtotal: 100,
      taxAmount: 100,
      grandTotal: 200,
      taxBuckets: [
        {
          taxClassId: 'default-tax-class',
          label: '100%',
          rate: 100,
          taxableSubtotal: 100,
          taxAmount: 100,
        },
      ],
    })
  })

  it('rounds money correctly for a floating-point-prone combination', () => {
    // 3 × $33.33 = $99.99 base; unit markup = roundMoney(33.33 × 0.10) = $3.33,
    // so unit selling price = $36.66 and line amount = 3 × $36.66 = $109.98.
    // markupAmount = $109.98 - $99.99 = $9.99 (never a fractional cent in the result)
    const items = [createItem({ id: 'a', quantity: 3, unitCost: 33.33, costCurrency: 'USD' })]
    const result = calculateQuotationTotals(
      items,
      { globalMarkupRate: 10, taxRate: 0 },
      usdRates,
    )
    expect(result.baseSubtotal).toBe(99.99)
    expect(result.markupAmount).toBe(9.99)
    expect(result.grandTotal).toBe(109.98)
  })

  it('rounds half-cent unit costs using decimal money rounding', () => {
    expect(calculateLineCost({ quantity: 1, unitCost: 10.075, costCurrency: 'USD' }, usdRates)).toBe(10.08)
    expect(calculateUnitSellingPrice({ unitCost: 10.075, costCurrency: 'USD' }, 0, usdRates)).toBe(10.08)
  })

  it('rounds half-cent manual prices using decimal money rounding', () => {
    expect(
      calculateLineSellingAmount(
        {
          quantity: 1,
          unitCost: 0,
          costCurrency: 'USD',
          pricingMethod: 'manual_price',
          manualUnitPrice: 10.075,
        },
        0,
        usdRates,
      ),
    ).toBe(10.08)
  })

  it('keeps cached root tax subtotals identical to a full quotation calculation', () => {
    const config: TotalsConfig = {
      globalMarkupRate: 12.5,
      taxMode: 'mixed',
      defaultTaxClassId: 'tax-goods',
      taxClasses: [
        { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
        { id: 'tax-service', label: 'Service 6%', rate: 6 },
      ],
    }
    const items = [
      createItem({
        id: 'root-1',
        quantity: 1.25,
        children: [
          createItem({
            id: 'child-1',
            quantity: 2.5,
            unitCost: 33.33,
            taxClassId: 'tax-goods',
          }),
        ],
      }),
      createItem({
        id: 'root-2',
        quantity: 1.5,
        pricingMethod: 'manual_price',
        manualUnitPrice: 47.25,
        unitCost: 25,
        taxClassId: 'tax-service',
      }),
    ]
    const summaries = items.map((item) => calculateMajorItemSummary(item, config, usdRates))
    const taxBucketSubtotals = items.flatMap((item) =>
      calculateQuotationItemTaxBucketSubtotals(item, config, usdRates),
    )

    expect(
      calculateQuotationTotalsFromSummaries(items, summaries, config, usdRates, taxBucketSubtotals),
    ).toEqual(calculateQuotationTotals(items, config, usdRates))
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
    pricingMethod: (overrides as QuotationItem & { pricingMethod?: 'cost_plus' | 'manual_price' }).pricingMethod,
    manualUnitPrice: (overrides as QuotationItem & { manualUnitPrice?: number }).manualUnitPrice,
    markupRate: overrides.markupRate,
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}
