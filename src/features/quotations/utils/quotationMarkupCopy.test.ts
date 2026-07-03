import { describe, expect, it } from 'vitest'

import type { QuotationItem } from '../types'
import type { QuotationItemPricingDisplay } from './quotationItemPricingDisplay'
import { getQuotationMarkupCopy } from './quotationMarkupCopy'

describe('quotation markup copy', () => {
  it('shows a direct no-markup message for leaf rows with an explicit 0% override', () => {
    const item = createItem()
    const pricing = createPricingDisplay({
      effectiveMarkupRate: 0,
      markupSource: 'self',
      markupSourceLabel: 'This item',
    })

    expect(getQuotationMarkupCopy(item, pricing)).toEqual({
      fieldLabelKey: 'quotations.lineItems.markupOverride',
      helperKey: 'quotations.lineItems.markupHints.leafZero',
      helperArgs: {},
    })
  })

  it('explains inherited markup clearly for leaf rows', () => {
    const item = createItem({
      quantity: 8,
      quantityUnit: 'EA',
    })
    const pricing = createPricingDisplay({
      effectiveMarkupRate: 12,
      markupSource: 'inherited',
      markupSourceLabel: '1.2',
      markupAmount: 447.2,
    })

    expect(getQuotationMarkupCopy(item, pricing)).toEqual({
      fieldLabelKey: 'quotations.lineItems.markupOverride',
      helperKey: 'quotations.lineItems.markupHints.leafInherited',
      helperArgs: {
        rate: 12,
        source: '1.2',
        amount: 55.9,
        unit: 'EA',
      },
    })
  })

  it('shows effective markup and fallback usage for group rows', () => {
    const item = createItem({
      markupRate: 10,
      children: [
        createItem({ id: 'child-uses-default' }),
        createItem({ id: 'child-override', markupRate: 20 }),
        createItem({
          id: 'child-group',
          children: [
            createItem({ id: 'detail-uses-default' }),
            createItem({ id: 'detail-override', markupRate: 30 }),
          ],
        }),
        createItem({
          id: 'child-group-override',
          markupRate: 15,
          children: [createItem({ id: 'detail-uses-child-group' })],
        }),
      ],
    })
    const pricing = createPricingDisplay({
      effectiveMarkupRate: 25,
      fallbackMarkupRate: 10,
      markupSource: 'self',
      markupSourceLabel: 'This item',
    })

    expect(getQuotationMarkupCopy(item, pricing)).toEqual({
      fieldLabelKey: 'quotations.lineItems.childMarkupFallback',
      helperKey: 'quotations.lineItems.markupHints.groupEffective',
      helperArgs: {
        effectiveRate: 25,
      },
      statusKey: 'quotations.lineItems.markupUsage.mixed',
      statusArgs: {
        usedCount: 2,
        ignoredCount: 3,
      },
      tooltipKey: 'quotations.lineItems.markupTooltip.group',
      tooltipArgs: {},
    })
  })

  it('warns when a group markup value is not used by any priced descendants', () => {
    const item = createItem({
      markupRate: 10,
      children: [
        createItem({ id: 'child-override', markupRate: 20 }),
        createItem({
          id: 'child-group-override',
          markupRate: 15,
          children: [createItem({ id: 'detail-uses-child-group' })],
        }),
      ],
    })

    expect(getQuotationMarkupCopy(item, createPricingDisplay()).statusKey).toBe(
      'quotations.lineItems.markupUsage.unused',
    )
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
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}

function createPricingDisplay(
  overrides: Partial<QuotationItemPricingDisplay> = {},
): QuotationItemPricingDisplay {
  return {
    effectiveMarkupRate: overrides.effectiveMarkupRate ?? 10,
    fallbackMarkupRate: overrides.fallbackMarkupRate ?? overrides.effectiveMarkupRate ?? 10,
    markupSource: overrides.markupSource ?? 'global',
    markupSourceLabel: overrides.markupSourceLabel ?? 'Global',
    baseAmount: overrides.baseAmount ?? 100,
    markupAmount: overrides.markupAmount ?? 10,
    subtotal: overrides.subtotal ?? 110,
    unitSellingPrice: overrides.unitSellingPrice ?? 110,
    taxClassId: overrides.taxClassId ?? null,
    taxClassLabel: overrides.taxClassLabel ?? null,
    taxRate: overrides.taxRate ?? null,
    effectiveTaxRate: overrides.effectiveTaxRate ?? null,
    hasMixedTaxClasses: overrides.hasMixedTaxClasses ?? false,
    taxAmount: overrides.taxAmount ?? 0,
    totalWithTax: overrides.totalWithTax ?? 110,
    unitPriceWithTax: overrides.unitPriceWithTax ?? 110,
  }
}
