import { describe, expect, it } from 'vitest'

import type { ExchangeRateTable, QuotationDraft, QuotationItem, TotalsConfig } from '../types'
import { calculateMajorItemSummary, calculateQuotationTotals } from './quotationCalculations'
import { createQuotationAnalysisDataset } from './quotationAnalysis'
import { getQuotationRootItems } from './quotationItems'

const testExchangeRates: ExchangeRateTable = {
  USD: 1,
  CNY: 0.14,
  EUR: 1.08,
}

describe('createQuotationAnalysisDataset', () => {
  it('builds major-item rollups, bridge metrics, and composition summary from the active quotation', () => {
    const quotation = createQuotationDraft([
      createItem({
        id: 'major-1',
        name: 'Equipment',
        children: [
          createItem({
            id: 'sub-1',
            name: 'Imported valves',
            quantity: 10,
            unitCost: 100,
            costCurrency: 'CNY',
          }),
          createItem({
            id: 'sub-2',
            name: 'Install kit',
            quantity: 2,
            unitCost: 50,
            costCurrency: 'USD',
            markupRate: 25,
          }),
        ],
      }),
      createItem({
        id: 'major-2',
        name: 'Services',
        quantity: 4,
        unitCost: 80,
        costCurrency: 'USD',
      }),
    ], {
      globalMarkupRate: 10,
      taxRate: 5,
    })

    const itemSummaries = getQuotationRootItems(quotation.majorItems).map((item) =>
      calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
    )
    const totals = calculateQuotationTotals(
      quotation.majorItems,
      quotation.totalsConfig,
      quotation.exchangeRates,
    )

    expect(createQuotationAnalysisDataset(quotation, itemSummaries, totals)).toEqual({
      hasMeaningfulData: true,
      kpis: {
        baseSubtotal: 560,
        markupAmount: 71,
        taxAmount: 31.55,
        grandTotal: 662.55,
        grossMarginAmount: 71,
        grossMarginRate: 11.25,
        costCoverageRate: 100,
      },
      compositionSummary: {
        majorItemCount: 2,
        pricedLineCount: 3,
        currencyCount: 2,
        markupOverrideCount: 1,
      },
      majorItemRows: [
        {
          itemId: 'major-2',
          itemName: 'Services',
          baseSubtotal: 320,
          subtotal: 352,
          profitAmount: 32,
          effectiveMarkupRate: 10,
          grossMarginRate: 9.09,
          currencyExposure: {
            USD: 320,
          },
          taxClassLabels: ['5%'],
        },
        {
          itemId: 'major-1',
          itemName: 'Equipment',
          baseSubtotal: 240,
          subtotal: 279,
          profitAmount: 39,
          effectiveMarkupRate: 16.25,
          grossMarginRate: 13.98,
          currencyExposure: {
            CNY: 140,
            USD: 100,
          },
          taxClassLabels: ['5%'],
        },
      ],
      advisories: [
        {
          id: 'currency-major-1',
          type: 'currency_mix',
          severity: 'review',
          itemId: 'major-1',
          itemName: 'Equipment',
          currencies: ['CNY', 'USD'],
        },
      ],
      profitConfidence: {
        knownCostRevenue: 631,
        finalPriceRevenueWithoutCost: 0,
        finalPriceItemCountWithoutCost: 0,
        costVisibilityRate: 100,
      },
      currencyExposure: {
        currencies: ['CNY', 'USD'],
        rows: [
          {
            itemId: 'major-2',
            itemName: 'Services',
            values: {
              USD: 320,
            },
          },
          {
            itemId: 'major-1',
            itemName: 'Equipment',
            values: {
              CNY: 140,
              USD: 100,
            },
          },
        ],
      },
      bridge: [
        {
          key: 'baseSubtotal',
          amount: 560,
          cumulativeStart: 0,
          cumulativeEnd: 560,
        },
        {
          key: 'markupAmount',
          amount: 71,
          cumulativeStart: 560,
          cumulativeEnd: 631,
        },
        {
          key: 'taxAmount',
          amount: 31.55,
          cumulativeStart: 631,
          cumulativeEnd: 662.55,
        },
        {
          key: 'grandTotal',
          amount: 662.55,
          cumulativeStart: 0,
          cumulativeEnd: 662.55,
        },
      ],
    })
  })

  it('filters zero-value rows and exposes an empty-state dataset when the quotation has no meaningful priced data', () => {
    const quotation = createQuotationDraft([
      createItem({
        id: 'major-1',
        name: 'Placeholder',
        quantity: 1,
        unitCost: 0,
        costCurrency: 'USD',
      }),
    ], {
      globalMarkupRate: 10,
      taxRate: 0,
    })

    const itemSummaries = getQuotationRootItems(quotation.majorItems).map((item) =>
      calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
    )
    const totals = calculateQuotationTotals(
      quotation.majorItems,
      quotation.totalsConfig,
      quotation.exchangeRates,
    )

    expect(createQuotationAnalysisDataset(quotation, itemSummaries, totals)).toEqual({
      hasMeaningfulData: false,
      kpis: {
        baseSubtotal: 0,
        markupAmount: 0,
        taxAmount: 0,
        grandTotal: 0,
        grossMarginAmount: 0,
        grossMarginRate: 0,
        costCoverageRate: 0,
      },
      compositionSummary: {
        majorItemCount: 1,
        pricedLineCount: 1,
        currencyCount: 0,
        markupOverrideCount: 0,
      },
      advisories: [],
      profitConfidence: {
        knownCostRevenue: 0,
        finalPriceRevenueWithoutCost: 0,
        finalPriceItemCountWithoutCost: 0,
        costVisibilityRate: 0,
      },
      majorItemRows: [],
      currencyExposure: {
        currencies: [],
        rows: [],
      },
      bridge: [
        {
          key: 'baseSubtotal',
          amount: 0,
          cumulativeStart: 0,
          cumulativeEnd: 0,
        },
        {
          key: 'markupAmount',
          amount: 0,
          cumulativeStart: 0,
          cumulativeEnd: 0,
        },
        {
          key: 'taxAmount',
          amount: 0,
          cumulativeStart: 0,
          cumulativeEnd: 0,
        },
        {
          key: 'grandTotal',
          amount: 0,
          cumulativeStart: 0,
          cumulativeEnd: 0,
        },
      ],
    })
  })

  it('keeps analysis available for manual-price quotations and reports zero cost coverage', () => {
    const quotation = createQuotationDraft([
      createItem({
        id: 'major-1',
        name: 'Quick quote package',
        quantity: 2,
        pricingMethod: 'manual_price',
        manualUnitPrice: 150,
        unitCost: 0,
        costCurrency: 'USD',
      }),
    ], {
      globalMarkupRate: 10,
      taxRate: 0,
    })

    const itemSummaries = getQuotationRootItems(quotation.majorItems).map((item) =>
      calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
    )
    const totals = calculateQuotationTotals(
      quotation.majorItems,
      quotation.totalsConfig,
      quotation.exchangeRates,
    )

    expect(createQuotationAnalysisDataset(quotation, itemSummaries, totals)).toMatchObject({
      hasMeaningfulData: true,
      kpis: {
        baseSubtotal: 0,
        markupAmount: 0,
        taxAmount: 0,
        grandTotal: 300,
        grossMarginAmount: 0,
        grossMarginRate: 0,
        costCoverageRate: 0,
      },
      compositionSummary: {
        majorItemCount: 1,
        pricedLineCount: 1,
        currencyCount: 0,
        markupOverrideCount: 0,
      },
      profitConfidence: {
        knownCostRevenue: 0,
        finalPriceRevenueWithoutCost: 300,
        finalPriceItemCountWithoutCost: 1,
        costVisibilityRate: 0,
      },
      majorItemRows: [
        expect.objectContaining({
          itemId: 'major-1',
          subtotal: 300,
        }),
      ],
    })
  })

  it('reports tax-class mix only when one major item contains multiple effective tax classes', () => {
    const quotation = createQuotationDraft([
      createItem({
        id: 'major-1',
        name: 'Mixed tax package',
        children: [
          createItem({
            id: 'sub-1',
            unitCost: 100,
            taxClassId: 'standard',
          }),
          createItem({
            id: 'sub-2',
            unitCost: 100,
            taxClassId: 'reduced',
          }),
        ],
      }),
    ], {
      globalMarkupRate: 10,
      taxMode: 'mixed',
      defaultTaxClassId: 'standard',
      taxClasses: [
        { id: 'standard', label: 'Standard', rate: 13 },
        { id: 'reduced', label: 'Reduced', rate: 6 },
      ],
    })

    const itemSummaries = getQuotationRootItems(quotation.majorItems).map((item) =>
      calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
    )
    const totals = calculateQuotationTotals(
      quotation.majorItems,
      quotation.totalsConfig,
      quotation.exchangeRates,
    )

    expect(createQuotationAnalysisDataset(quotation, itemSummaries, totals).advisories).toContainEqual({
      id: 'tax-major-1',
      type: 'tax_mix',
      severity: 'review',
      itemId: 'major-1',
      itemName: 'Mixed tax package',
      taxClasses: ['Reduced', 'Standard'],
    })
  })

  it('keeps low-markup advisories even when many currency-mix advisories exist', () => {
    const mixedCurrencyItems = Array.from({ length: 6 }, (_, index) =>
      createItem({
        id: `currency-major-${index + 1}`,
        name: `Currency package ${index + 1}`,
        children: [
          createItem({
            id: `currency-sub-${index + 1}-a`,
            unitCost: 100,
            costCurrency: 'CNY',
          }),
          createItem({
            id: `currency-sub-${index + 1}-b`,
            unitCost: 100,
            costCurrency: 'USD',
          }),
        ],
      }),
    )
    const quotation = createQuotationDraft([
      ...mixedCurrencyItems,
      createItem({
        id: 'low-markup-major',
        name: 'Low markup package',
        unitCost: 100,
        markupRate: 5,
        costCurrency: 'USD',
      }),
    ], {
      globalMarkupRate: 10,
      taxRate: 0,
    })

    const itemSummaries = getQuotationRootItems(quotation.majorItems).map((item) =>
      calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
    )
    const totals = calculateQuotationTotals(
      quotation.majorItems,
      quotation.totalsConfig,
      quotation.exchangeRates,
    )

    expect(createQuotationAnalysisDataset(quotation, itemSummaries, totals).advisories).toContainEqual(
      expect.objectContaining({
        id: 'low-markup-low-markup-major',
        type: 'low_markup',
        severity: 'review',
        itemId: 'low-markup-major',
        itemName: 'Low markup package',
        markupRate: 5,
        threshold: 10,
      }),
    )
  })

  it('reports low-markup priced grandson items even when the major item rollup is healthy', () => {
    const quotation = createQuotationDraft([
      createItem({
        id: 'major-1',
        name: 'Balanced package',
        children: [
          createItem({
            id: 'high-margin-child',
            name: 'High margin child',
            unitCost: 100,
            markupRate: 50,
          }),
          createItem({
            id: 'sub-system',
            name: 'Sub system',
            children: [
              createItem({
                id: 'low-grandson',
                name: 'Low markup grandson',
                unitCost: 100,
                markupRate: 5,
              }),
            ],
          }),
        ],
      }),
    ], {
      globalMarkupRate: 10,
      taxRate: 0,
    })

    const itemSummaries = getQuotationRootItems(quotation.majorItems).map((item) =>
      calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
    )
    const totals = calculateQuotationTotals(
      quotation.majorItems,
      quotation.totalsConfig,
      quotation.exchangeRates,
    )
    const dataset = createQuotationAnalysisDataset(quotation, itemSummaries, totals)

    expect(dataset.majorItemRows[0]?.effectiveMarkupRate).toBe(27.5)
    expect(dataset.advisories).toContainEqual(
      expect.objectContaining({
        id: 'low-markup-low-grandson',
        type: 'low_markup',
        severity: 'review',
        itemId: 'low-grandson',
        itemName: 'Low markup grandson',
        parentItemId: 'major-1',
        parentItemName: 'Balanced package',
        itemPath: ['Balanced package', 'Sub system', 'Low markup grandson'],
        markupRate: 5,
        threshold: 10,
      }),
    )
  })

  it('does not treat incomplete zero-value rows as currency or tax problems', () => {
    const quotation = createQuotationDraft([
      createItem({
        id: 'major-1',
        name: 'Partially entered package',
        children: [
          createItem({
            id: 'priced-child',
            name: 'Priced child',
            unitCost: 100,
            costCurrency: 'CNY',
            taxClassId: 'reduced',
          }),
          createItem({
            id: 'blank-child',
            name: 'Blank child',
            unitCost: 0,
            costCurrency: 'USD',
            taxClassId: 'standard',
          }),
        ],
      }),
    ], {
      globalMarkupRate: 10,
      taxMode: 'mixed',
      defaultTaxClassId: 'standard',
      taxClasses: [
        { id: 'standard', label: 'Standard', rate: 13 },
        { id: 'reduced', label: 'Reduced', rate: 6 },
      ],
    })

    const itemSummaries = getQuotationRootItems(quotation.majorItems).map((item) =>
      calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
    )
    const totals = calculateQuotationTotals(
      quotation.majorItems,
      quotation.totalsConfig,
      quotation.exchangeRates,
    )
    const dataset = createQuotationAnalysisDataset(quotation, itemSummaries, totals)

    expect(dataset.compositionSummary.currencyCount).toBe(1)
    expect(dataset.majorItemRows[0]?.currencyExposure).toEqual({ CNY: 14 })
    expect(dataset.majorItemRows[0]?.taxClassLabels).toEqual(['Reduced'])
    expect(dataset.advisories).toEqual([])
  })

  it('reports manual-price losses in gross margin KPIs', () => {
    const quotation = createQuotationDraft([
      createItem({
        id: 'major-1',
        name: 'Loss-making manual package',
        quantity: 1,
        pricingMethod: 'manual_price',
        manualUnitPrice: 80,
        unitCost: 100,
        costCurrency: 'USD',
      }),
    ], {
      globalMarkupRate: 10,
      taxRate: 0,
    })

    const itemSummaries = getQuotationRootItems(quotation.majorItems).map((item) =>
      calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
    )
    const totals = calculateQuotationTotals(
      quotation.majorItems,
      quotation.totalsConfig,
      quotation.exchangeRates,
    )
    const dataset = createQuotationAnalysisDataset(quotation, itemSummaries, totals)

    expect(dataset.kpis.grossMarginAmount).toBe(-20)
    expect(dataset.kpis.grossMarginRate).toBe(-25)
    expect(dataset.majorItemRows[0]).toMatchObject({
      profitAmount: -20,
      grossMarginRate: -25,
    })
  })

  it('uses active exchange rates for currency exposure', () => {
    const quotation = createQuotationDraft([
      createItem({
        id: 'major-1',
        name: 'CNY package',
        quantity: 10,
        unitCost: 100,
        costCurrency: 'CNY',
      }),
    ], {
      globalMarkupRate: 0,
      taxRate: 0,
    })
    quotation.exchangeRates = {
      ...quotation.exchangeRates,
      CNY: 0.2,
    }

    const itemSummaries = getQuotationRootItems(quotation.majorItems).map((item) =>
      calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
    )
    const totals = calculateQuotationTotals(
      quotation.majorItems,
      quotation.totalsConfig,
      quotation.exchangeRates,
    )

    expect(createQuotationAnalysisDataset(quotation, itemSummaries, totals).majorItemRows[0]?.currencyExposure).toEqual({
      CNY: 200,
    })
  })

  it('includes quotation-level extra charges in the pricing bridge', () => {
    const quotation = createQuotationDraft([
      createItem({
        id: 'major-1',
        quantity: 1,
        unitCost: 100,
        costCurrency: 'USD',
      }),
    ], {
      globalMarkupRate: 0,
      taxRate: 0,
      extraCharges: [
        { id: 'shipping', label: 'Shipping', amount: 25 },
      ],
    })

    const itemSummaries = getQuotationRootItems(quotation.majorItems).map((item) =>
      calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
    )
    const totals = calculateQuotationTotals(
      quotation.majorItems,
      quotation.totalsConfig,
      quotation.exchangeRates,
    )

    expect(createQuotationAnalysisDataset(quotation, itemSummaries, totals).bridge).toEqual([
      {
        key: 'baseSubtotal',
        amount: 100,
        cumulativeStart: 0,
        cumulativeEnd: 100,
      },
      {
        key: 'markupAmount',
        amount: 0,
        cumulativeStart: 100,
        cumulativeEnd: 100,
      },
      {
        key: 'taxAmount',
        amount: 0,
        cumulativeStart: 100,
        cumulativeEnd: 100,
      },
      {
        key: 'extraCharges',
        amount: 25,
        cumulativeStart: 100,
        cumulativeEnd: 125,
      },
      {
        key: 'grandTotal',
        amount: 125,
        cumulativeStart: 0,
        cumulativeEnd: 125,
      },
    ])
  })
})

function createQuotationDraft(
  majorItems: QuotationItem[],
  totalsConfig: TotalsConfig,
): QuotationDraft {
  return {
    id: 'quotation-1',
    templateId: 'legacy',
    companyProfileId: null,
    companyProfileSnapshot: {
      companyName: 'CX Engineering',
      email: '',
      phone: '',
    },
    header: {
      quotationNumber: 'Q-2026-001',
      quotationDate: '2026-04-30',
      customerCompany: 'Acme Energy',
      contactPerson: 'Dana',
      contactDetails: 'dana@example.com',
      projectName: 'Pump Station Upgrade',
      validityPeriod: '30 days',
      currency: 'USD',
      documentLocale: 'en-US',
      notes: '',
    },
    majorItems,
    totalsConfig,
    exchangeRates: testExchangeRates,
    branding: {
      logoDataUrl: '',
      accentColor: '#047857',
    },
  }
}

function createItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'New item',
    description: overrides.description ?? '',
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? '',
    pricingMethod: (overrides as QuotationItem & { pricingMethod?: 'cost_plus' | 'manual_price' }).pricingMethod ?? 'cost_plus',
    manualUnitPrice: (overrides as QuotationItem & { manualUnitPrice?: number }).manualUnitPrice,
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? 'USD',
    markupRate: overrides.markupRate,
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}
