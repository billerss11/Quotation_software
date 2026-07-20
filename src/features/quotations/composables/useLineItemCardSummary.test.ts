import { shallowRef } from 'vue'
import { describe, expect, it } from 'vitest'

import type { MajorItemSummary, QuotationItem } from '../types'
import type { QuotationItemPricingDisplay } from '../utils/quotationItemPricing'
import {
  calculateUnitSummaryAmount,
  formatQuantitySummaryValue,
  type LineItemSummaryMode,
  useLineItemCardSummary,
} from './useLineItemCardSummary'

describe('useLineItemCardSummary', () => {
  it('builds total and unit summary metrics from existing pricing values', () => {
    const item = shallowRef(createItem({
      quantity: 2,
      quantityUnit: 'EA',
    }))
    const summary = shallowRef<MajorItemSummary>({
      itemId: 'item-1',
      baseSubtotal: 100,
      markupAmount: 10,
      subtotal: 110,
    })
    const pricing = shallowRef<QuotationItemPricingDisplay>({
      effectiveMarkupRate: 10,
      fallbackMarkupRate: 10,
      markupSource: 'global',
      markupSourceLabel: 'Global',
      baseAmount: 100,
      markupAmount: 10,
      subtotal: 110,
      unitSellingPrice: 55,
      taxClassId: 'default',
      taxClassLabel: 'Tax',
      taxRate: 5,
      effectiveTaxRate: 5,
      hasMixedTaxClasses: false,
      taxAmount: 5.5,
      totalWithTax: 115.5,
      unitPriceWithTax: 57.75,
    })
    const summaryMode = shallowRef<LineItemSummaryMode>('totals')
    const lineSummary = useLineItemCardSummary({
      item: () => item.value,
      summaryMode: () => summaryMode.value,
      currency: () => 'USD',
      currentLocale: () => 'en-US',
      summary: () => summary.value,
      rootPricingDisplay: () => pricing.value,
      showAmountWithTax: () => true,
      getTaxAmount: () => pricing.value.taxAmount,
      getAmountWithTax: () => pricing.value.totalWithTax,
      translate: translateKey,
    })

    expect(lineSummary.activeSummaryMetrics.value).toEqual([
      { label: 'Quantity', value: '2 EA', kind: 'default' },
      { label: 'Cost subtotal', value: '$100.00', kind: 'default' },
      { label: 'Markup amount', value: '$10.00', kind: 'default' },
      { label: 'Subtotal excluding tax', value: '$110.00', kind: 'default' },
      { label: 'Tax amount', value: '$5.50', kind: 'tax' },
      { label: 'Total including tax', value: '$115.50', kind: 'total' },
      { label: 'Cost / Sales', value: '90.91%', kind: 'default' },
    ])

    summaryMode.value = 'unit'

    expect(lineSummary.activeSummaryMetrics.value).toEqual([
      { label: 'Unit cost', value: '$50.00', kind: 'default' },
      { label: 'Markup amount', value: '$5.00', kind: 'default' },
      { label: 'Unit price', value: '$55.00', kind: 'default' },
      { label: 'Tax amount', value: '$2.75', kind: 'tax' },
      { label: 'Unit price with tax', value: '$57.75', kind: 'total' },
      { label: 'Cost / Sales', value: '90.91%', kind: 'default' },
    ])
  })

  it('hides tax metrics below the display threshold', () => {
    const item = shallowRef(createItem())
    const summary = shallowRef<MajorItemSummary>({
      itemId: 'item-1',
      baseSubtotal: 100,
      markupAmount: 0,
      subtotal: 100,
    })
    const pricing = shallowRef<QuotationItemPricingDisplay>({
      effectiveMarkupRate: 0,
      fallbackMarkupRate: 0,
      markupSource: 'global',
      markupSourceLabel: 'Global',
      baseAmount: 100,
      markupAmount: 0,
      subtotal: 100,
      unitSellingPrice: 100,
      taxClassId: null,
      taxClassLabel: null,
      taxRate: null,
      effectiveTaxRate: null,
      hasMixedTaxClasses: false,
      taxAmount: 0.004,
      totalWithTax: 100,
      unitPriceWithTax: 100,
    })
    const lineSummary = useLineItemCardSummary({
      item: () => item.value,
      summaryMode: () => 'totals',
      currency: () => 'USD',
      currentLocale: () => 'en-US',
      summary: () => summary.value,
      rootPricingDisplay: () => pricing.value,
      showAmountWithTax: () => true,
      getTaxAmount: () => pricing.value.taxAmount,
      getAmountWithTax: () => pricing.value.totalWithTax,
      translate: translateKey,
    })

    expect(lineSummary.shouldShowTaxSummary(item.value)).toBe(false)
    expect(lineSummary.activeSummaryMetrics.value.map((metric) => metric.kind)).toEqual([
      'default',
      'default',
      'default',
      'default',
      'default',
    ])
  })

  it('shows an empty value for cost over sales when the selling subtotal is zero', () => {
    const item = shallowRef(createItem())
    const summary = shallowRef<MajorItemSummary>({
      itemId: 'item-1',
      baseSubtotal: 100,
      markupAmount: -100,
      subtotal: 0,
    })
    const pricing = shallowRef<QuotationItemPricingDisplay>({
      effectiveMarkupRate: 0,
      fallbackMarkupRate: 0,
      markupSource: 'global',
      markupSourceLabel: 'Global',
      baseAmount: 100,
      markupAmount: -100,
      subtotal: 0,
      unitSellingPrice: 0,
      taxClassId: null,
      taxClassLabel: null,
      taxRate: null,
      effectiveTaxRate: null,
      hasMixedTaxClasses: false,
      taxAmount: 0,
      totalWithTax: 0,
      unitPriceWithTax: 0,
    })
    const lineSummary = useLineItemCardSummary({
      item: () => item.value,
      summaryMode: () => 'totals',
      currency: () => 'USD',
      currentLocale: () => 'en-US',
      summary: () => summary.value,
      rootPricingDisplay: () => pricing.value,
      showAmountWithTax: () => false,
      getTaxAmount: () => pricing.value.taxAmount,
      getAmountWithTax: () => pricing.value.totalWithTax,
      translate: translateKey,
    })

    expect(lineSummary.activeSummaryMetrics.value).toContainEqual({
      label: 'Cost / Sales',
      value: '--',
      kind: 'default',
    })
  })

  it('formats unit amounts and quantities defensively', () => {
    expect(calculateUnitSummaryAmount(10, 4)).toBe(2.5)
    expect(calculateUnitSummaryAmount(10, 0)).toBe(0)
    expect(formatQuantitySummaryValue(2.5, ' m ', 'en-US')).toBe('2.50 m')
  })
})

function translateKey(key: string) {
  return {
    'quotations.lineItems.summaryModes.totals': 'Totals',
    'quotations.lineItems.summaryModes.unit': 'Unit',
    'quotations.lineItems.unitCost': 'Unit cost',
    'quotations.lineItems.summaryLabels.markupAmount': 'Markup amount',
    'quotations.lineItems.summaryLabels.costSalesPct': 'Cost / Sales',
    'quotations.lineItems.summaryLabels.unitPrice': 'Unit price',
    'quotations.lineItems.summaryLabels.taxAmount': 'Tax amount',
    'quotations.lineItems.summaryLabels.unitPriceWithTax': 'Unit price with tax',
    'quotations.lineItems.quantity': 'Quantity',
    'quotations.lineItems.summaryLabels.costSubtotal': 'Cost subtotal',
    'quotations.lineItems.summaryLabels.subtotalExcludingTax': 'Subtotal excluding tax',
    'quotations.lineItems.summaryLabels.totalIncludingTax': 'Total including tax',
    'common.emptyValue': '--',
  }[key] ?? key
}

function createItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'New item',
    description: overrides.description ?? '',
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? '',
    pricingMethod: overrides.pricingMethod,
    manualUnitPrice: overrides.manualUnitPrice,
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? 'USD',
    markupRate: overrides.markupRate,
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}
