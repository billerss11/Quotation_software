import type { QuotationItem } from '../types'
import type { QuotationItemPricingDisplay } from './quotationItemPricingDisplay'

export interface QuotationMarkupCopy {
  fieldLabelKey: 'quotations.lineItems.markupOverride' | 'quotations.lineItems.childMarkupFallback'
  helperKey:
    | 'quotations.lineItems.markupHints.leafSelf'
    | 'quotations.lineItems.markupHints.leafInherited'
    | 'quotations.lineItems.markupHints.leafGlobal'
    | 'quotations.lineItems.markupHints.leafZero'
    | 'quotations.lineItems.markupHints.groupSelf'
    | 'quotations.lineItems.markupHints.groupInherited'
    | 'quotations.lineItems.markupHints.groupGlobal'
  helperArgs: Record<string, number | string>
}

export function getQuotationMarkupCopy(
  item: Pick<QuotationItem, 'children'>,
  pricing: Pick<QuotationItemPricingDisplay, 'effectiveMarkupRate' | 'markupSource' | 'markupSourceLabel'>,
): QuotationMarkupCopy {
  if (item.children.length > 0) {
    return {
      fieldLabelKey: 'quotations.lineItems.childMarkupFallback',
      helperKey:
        pricing.markupSource === 'self'
          ? 'quotations.lineItems.markupHints.groupSelf'
          : pricing.markupSource === 'inherited'
            ? 'quotations.lineItems.markupHints.groupInherited'
            : 'quotations.lineItems.markupHints.groupGlobal',
      helperArgs:
        pricing.markupSource === 'inherited'
          ? { rate: pricing.effectiveMarkupRate, source: pricing.markupSourceLabel }
          : { rate: pricing.effectiveMarkupRate },
    }
  }

  if (pricing.markupSource === 'self') {
    return pricing.effectiveMarkupRate === 0
      ? {
          fieldLabelKey: 'quotations.lineItems.markupOverride',
          helperKey: 'quotations.lineItems.markupHints.leafZero',
          helperArgs: {},
        }
      : {
          fieldLabelKey: 'quotations.lineItems.markupOverride',
          helperKey: 'quotations.lineItems.markupHints.leafSelf',
          helperArgs: { rate: pricing.effectiveMarkupRate },
        }
  }

  return {
    fieldLabelKey: 'quotations.lineItems.markupOverride',
    helperKey:
      pricing.markupSource === 'inherited'
        ? 'quotations.lineItems.markupHints.leafInherited'
        : 'quotations.lineItems.markupHints.leafGlobal',
    helperArgs:
      pricing.markupSource === 'inherited'
        ? { rate: pricing.effectiveMarkupRate, source: pricing.markupSourceLabel }
        : { rate: pricing.effectiveMarkupRate },
  }
}
