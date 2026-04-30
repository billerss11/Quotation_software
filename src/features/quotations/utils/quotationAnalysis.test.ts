import { describe, expect, it } from 'vitest'

import type { ExchangeRateTable, QuotationDraft, QuotationItem, TotalsConfig } from '../types'
import { calculateMajorItemSummary, calculateQuotationTotals } from './quotationCalculations'
import { createQuotationAnalysisDataset } from './quotationAnalysis'

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
      discountMode: 'fixed',
      discountValue: 50,
      taxRate: 5,
    })

    const itemSummaries = quotation.majorItems.map((item) =>
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
        discountAmount: 50,
        taxAmount: 29.05,
        grandTotal: 610.05,
        grossMarginAmount: 71,
        grossMarginRate: 11.25,
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
          grossMarginRate: 9.09,
          currencyExposure: {
            USD: 320,
          },
        },
        {
          itemId: 'major-1',
          itemName: 'Equipment',
          baseSubtotal: 240,
          subtotal: 279,
          profitAmount: 39,
          grossMarginRate: 13.98,
          currencyExposure: {
            CNY: 140,
            USD: 100,
          },
        },
      ],
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
          key: 'discountAmount',
          amount: -50,
          cumulativeStart: 581,
          cumulativeEnd: 631,
        },
        {
          key: 'taxAmount',
          amount: 29.05,
          cumulativeStart: 581,
          cumulativeEnd: 610.05,
        },
        {
          key: 'grandTotal',
          amount: 610.05,
          cumulativeStart: 0,
          cumulativeEnd: 610.05,
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
      discountMode: 'fixed',
      discountValue: 0,
      taxRate: 0,
    })

    const itemSummaries = quotation.majorItems.map((item) =>
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
        discountAmount: 0,
        taxAmount: 0,
        grandTotal: 0,
        grossMarginAmount: 0,
        grossMarginRate: 0,
      },
      compositionSummary: {
        majorItemCount: 1,
        pricedLineCount: 1,
        currencyCount: 1,
        markupOverrideCount: 0,
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
          key: 'discountAmount',
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
})

function createQuotationDraft(
  majorItems: QuotationItem[],
  totalsConfig: TotalsConfig,
): QuotationDraft {
  return {
    id: 'quotation-1',
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
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? 'USD',
    markupRate: overrides.markupRate,
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}
