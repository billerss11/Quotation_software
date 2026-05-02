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
    const item = createItem()
    const pricing = createPricingDisplay({
      effectiveMarkupRate: 12,
      markupSource: 'inherited',
      markupSourceLabel: '1.2',
    })

    expect(getQuotationMarkupCopy(item, pricing)).toEqual({
      fieldLabelKey: 'quotations.lineItems.markupOverride',
      helperKey: 'quotations.lineItems.markupHints.leafInherited',
      helperArgs: {
        rate: 12,
        source: '1.2',
      },
    })
  })

  it('switches group rows to child fallback wording', () => {
    const item = createItem({
      children: [createItem({ id: 'child-1' })],
    })
    const pricing = createPricingDisplay({
      effectiveMarkupRate: 10,
      markupSource: 'global',
      markupSourceLabel: 'Global',
    })

    expect(getQuotationMarkupCopy(item, pricing)).toEqual({
      fieldLabelKey: 'quotations.lineItems.childMarkupFallback',
      helperKey: 'quotations.lineItems.markupHints.groupGlobal',
      helperArgs: {
        rate: 10,
      },
    })
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
