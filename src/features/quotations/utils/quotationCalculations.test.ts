import { describe, expect, it } from 'vitest'

import type { ExchangeRateTable, QuotationMajorItem, TotalsConfig } from '../types'
import {
  calculateLineCost,
  calculateLineSellingAmount,
  calculateUnitSellingPrice,
  calculateMajorItemSummary,
  calculateQuotationTotals,
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
    const item: QuotationMajorItem = {
      id: 'major-1',
      type: 'major',
      title: 'Surface Equipment Supply',
      description: 'Parent text only',
      quantity: 1,
      unitCost: 9999,
      costCurrency: 'USD',
      subItems: [
        {
          id: 'sub-1',
          type: 'sub',
          description: 'Valve set',
          quantity: 2,
          unitCost: 100,
          costCurrency: 'USD',
        },
        {
          id: 'sub-2',
          type: 'sub',
          description: 'Fittings',
          quantity: 3,
          unitCost: 50,
          costCurrency: 'USD',
        },
      ],
    }

    expect(calculateMajorItemSummary(item, globalTotalsConfig, usdQuoteRates)).toEqual({
      itemId: 'major-1',
      baseSubtotal: 350,
      markupAmount: 35,
      subtotal: 385,
    })
  })

  it('uses per-item markup before discount when a parent override exists', () => {
    const item: QuotationMajorItem = {
      id: 'major-2',
      type: 'major',
      title: 'Installation',
      description: 'Labor and commissioning',
      quantity: 4,
      unitCost: 500,
      costCurrency: 'USD',
      markupRate: 20,
      subItems: [],
    }

    expect(calculateMajorItemSummary(item, globalTotalsConfig, usdQuoteRates)).toEqual({
      itemId: 'major-2',
      baseSubtotal: 2000,
      markupAmount: 400,
      subtotal: 2400,
    })
  })

  it('applies markup, percentage discount, and tax in order', () => {
    const items: QuotationMajorItem[] = [
      {
        id: 'major-1',
        type: 'major',
        title: 'Equipment',
        description: '',
        quantity: 1,
        unitCost: 1000,
        costCurrency: 'USD',
        subItems: [],
      },
      {
        id: 'major-2',
        type: 'major',
        title: 'Services',
        description: '',
        quantity: 2,
        unitCost: 500,
        costCurrency: 'USD',
        markupRate: 20,
        subItems: [],
      },
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
    const items: QuotationMajorItem[] = [
      {
        id: 'major-1',
        type: 'major',
        title: 'Equipment',
        description: '',
        quantity: 1,
        unitCost: 100,
        costCurrency: 'USD',
        subItems: [],
      },
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
    const items: QuotationMajorItem[] = [
      {
        id: 'major-1',
        type: 'major',
        title: 'Imported materials',
        description: '',
        quantity: 1,
        unitCost: 100,
        costCurrency: 'CNY',
        subItems: [],
      },
      {
        id: 'major-2',
        type: 'major',
        title: 'License',
        description: '',
        quantity: 1,
        unitCost: 50,
        costCurrency: 'USD',
        subItems: [],
      },
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
})
