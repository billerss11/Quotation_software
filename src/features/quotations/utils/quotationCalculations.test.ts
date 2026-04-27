import { describe, expect, it } from 'vitest'

import type { ExchangeRateTable, QuotationItem, TotalsConfig } from '../types'
import {
  calculateLineCost,
  calculateLineSellingAmount,
  calculateMajorItemSummary,
  calculateQuotationItemBaseSubtotal,
  calculateQuotationItemUnitSellingPrice,
  calculateQuotationTotals,
  calculateUnitSellingPrice,
  getEffectiveMarkupRate,
} from './quotationCalculations'

describe('quotation calculations', () => {
  const globalTotalsConfig: TotalsConfig = {
    globalMarkupRate: 10,
    discountMode: 'percentage',
    discountValue: 5,
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

  it('uses per-item markup before discount when a parent override exists', () => {
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

  it('uses the grouped expected total override as the selling subtotal', () => {
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

    expect(calculateQuotationItemUnitSellingPrice(item, globalTotalsConfig.globalMarkupRate, usdQuoteRates)).toBe(150)
    expect(calculateMajorItemSummary(item, globalTotalsConfig, usdQuoteRates)).toEqual({
      itemId: 'major-override',
      baseSubtotal: 240,
      markupAmount: 60,
      subtotal: 300,
    })
  })

  it('applies markup, percentage discount, and tax in order', () => {
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
      discountAmount: 115,
      taxableSubtotal: 2185,
      taxAmount: 284.05,
      grandTotal: 2469.05,
    })
  })

  it('caps fixed discounts so totals never go below zero before tax', () => {
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
          discountMode: 'fixed',
          discountValue: 500,
          taxRate: 13,
        },
        usdQuoteRates,
      ),
    ).toEqual({
      baseSubtotal: 100,
      markupAmount: 0,
      subtotalAfterMarkup: 100,
      discountAmount: 100,
      taxableSubtotal: 0,
      taxAmount: 0,
      grandTotal: 0,
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
          discountMode: 'fixed',
          discountValue: 0,
          taxRate: 0,
        },
        usdQuoteRates,
      ),
    ).toEqual({
      baseSubtotal: 64,
      markupAmount: 6.4,
      subtotalAfterMarkup: 70.4,
      discountAmount: 0,
      taxableSubtotal: 70.4,
      taxAmount: 0,
      grandTotal: 70.4,
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

  it('grand total equals base cost when markup, discount and tax are all zero', () => {
    const items = [createItem({ id: 'a', quantity: 3, unitCost: 100, costCurrency: 'USD' })]
    expect(
      calculateQuotationTotals(items, { globalMarkupRate: 0, discountMode: 'fixed', discountValue: 0, taxRate: 0 }, usdRates),
    ).toEqual({
      baseSubtotal: 300,
      markupAmount: 0,
      subtotalAfterMarkup: 300,
      discountAmount: 0,
      taxableSubtotal: 300,
      taxAmount: 0,
      grandTotal: 300,
    })
  })

  it('applies a partial fixed discount without going below zero', () => {
    const items = [createItem({ id: 'a', quantity: 1, unitCost: 1000, costCurrency: 'USD' })]
    expect(
      calculateQuotationTotals(items, { globalMarkupRate: 0, discountMode: 'fixed', discountValue: 200, taxRate: 0 }, usdRates),
    ).toEqual({
      baseSubtotal: 1000,
      markupAmount: 0,
      subtotalAfterMarkup: 1000,
      discountAmount: 200,
      taxableSubtotal: 800,
      taxAmount: 0,
      grandTotal: 800,
    })
  })

  it('grand total is zero when fixed discount equals or exceeds the subtotal', () => {
    const items = [createItem({ id: 'a', quantity: 1, unitCost: 100, costCurrency: 'USD' })]
    expect(
      calculateQuotationTotals(items, { globalMarkupRate: 0, discountMode: 'fixed', discountValue: 100, taxRate: 0 }, usdRates),
    ).toEqual({
      baseSubtotal: 100,
      markupAmount: 0,
      subtotalAfterMarkup: 100,
      discountAmount: 100,
      taxableSubtotal: 0,
      taxAmount: 0,
      grandTotal: 0,
    })
  })

  it('caps percentage discount at 100% of the subtotal', () => {
    const items = [createItem({ id: 'a', quantity: 1, unitCost: 100, costCurrency: 'USD' })]
    expect(
      calculateQuotationTotals(
        items,
        { globalMarkupRate: 0, discountMode: 'percentage', discountValue: 150, taxRate: 0 },
        usdRates,
      ),
    ).toEqual({
      baseSubtotal: 100,
      markupAmount: 0,
      subtotalAfterMarkup: 100,
      discountAmount: 100,
      taxableSubtotal: 0,
      taxAmount: 0,
      grandTotal: 0,
    })
  })

  it('applies tax on top of the after-discount subtotal', () => {
    // base 1000, 0% discount, 10% tax → grandTotal = 1100
    const items = [createItem({ id: 'a', quantity: 1, unitCost: 1000, costCurrency: 'USD' })]
    expect(
      calculateQuotationTotals(items, { globalMarkupRate: 0, discountMode: 'fixed', discountValue: 0, taxRate: 10 }, usdRates),
    ).toEqual({
      baseSubtotal: 1000,
      markupAmount: 0,
      subtotalAfterMarkup: 1000,
      discountAmount: 0,
      taxableSubtotal: 1000,
      taxAmount: 100,
      grandTotal: 1100,
    })
  })

  it('caps tax at 100% of the taxable subtotal', () => {
    const items = [createItem({ id: 'a', quantity: 1, unitCost: 100, costCurrency: 'USD' })]
    expect(
      calculateQuotationTotals(
        items,
        { globalMarkupRate: 0, discountMode: 'fixed', discountValue: 0, taxRate: 150 },
        usdRates,
      ),
    ).toEqual({
      baseSubtotal: 100,
      markupAmount: 0,
      subtotalAfterMarkup: 100,
      discountAmount: 0,
      taxableSubtotal: 100,
      taxAmount: 100,
      grandTotal: 200,
    })
  })

  it('rounds money correctly for a floating-point-prone combination', () => {
    // 3 × $33.33 = $99.99 base; unit markup = roundMoney(33.33 × 0.10) = $3.33,
    // so unit selling price = $36.66 and line amount = 3 × $36.66 = $109.98.
    // markupAmount = $109.98 - $99.99 = $9.99 (never a fractional cent in the result)
    const items = [createItem({ id: 'a', quantity: 3, unitCost: 33.33, costCurrency: 'USD' })]
    const result = calculateQuotationTotals(
      items,
      { globalMarkupRate: 10, discountMode: 'fixed', discountValue: 0, taxRate: 0 },
      usdRates,
    )
    expect(result.baseSubtotal).toBe(99.99)
    expect(result.markupAmount).toBe(9.99)
    expect(result.grandTotal).toBe(109.98)
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
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}
