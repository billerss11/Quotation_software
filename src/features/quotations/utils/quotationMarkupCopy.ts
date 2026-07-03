import type { QuotationItem } from '../types'
import type { QuotationItemPricingDisplay } from './quotationItemPricingDisplay'

type MarkupCopyArgs = Record<string, number | string>
type GroupMarkupUsage = {
  usedCount: number
  ignoredCount: number
}

export interface QuotationMarkupCopy {
  fieldLabelKey: 'quotations.lineItems.markupOverride' | 'quotations.lineItems.childMarkupFallback'
  helperKey:
    | 'quotations.lineItems.markupHints.leafSelf'
    | 'quotations.lineItems.markupHints.leafInherited'
    | 'quotations.lineItems.markupHints.leafGlobal'
    | 'quotations.lineItems.markupHints.leafZero'
    | 'quotations.lineItems.markupHints.groupEffective'
  helperArgs: MarkupCopyArgs
  statusKey?:
    | 'quotations.lineItems.markupUsage.all'
    | 'quotations.lineItems.markupUsage.mixed'
    | 'quotations.lineItems.markupUsage.unused'
    | 'quotations.lineItems.markupUsage.none'
  statusArgs?: MarkupCopyArgs
  tooltipKey?: 'quotations.lineItems.markupTooltip.group'
  tooltipArgs?: MarkupCopyArgs
}

export function getQuotationMarkupCopy(
  item: Pick<QuotationItem, 'children' | 'quantity' | 'quantityUnit'>,
  pricing: Pick<
    QuotationItemPricingDisplay,
    'effectiveMarkupRate' | 'fallbackMarkupRate' | 'markupSource' | 'markupSourceLabel' | 'markupAmount'
  >,
): QuotationMarkupCopy {
  if (item.children.length > 0) {
    const usage = calculateGroupMarkupUsage(item.children)

    return {
      fieldLabelKey: 'quotations.lineItems.childMarkupFallback',
      helperKey: 'quotations.lineItems.markupHints.groupEffective',
      helperArgs: {
        effectiveRate: pricing.effectiveMarkupRate,
      },
      ...getGroupMarkupUsageCopy(usage),
      tooltipKey: 'quotations.lineItems.markupTooltip.group',
      tooltipArgs: {},
    }
  }

  if (pricing.markupSource === 'self' && pricing.effectiveMarkupRate === 0) {
    return {
      fieldLabelKey: 'quotations.lineItems.markupOverride',
      helperKey: 'quotations.lineItems.markupHints.leafZero',
      helperArgs: {},
    }
  }

  return {
    fieldLabelKey: 'quotations.lineItems.markupOverride',
    helperKey:
      pricing.markupSource === 'self'
        ? 'quotations.lineItems.markupHints.leafSelf'
        : pricing.markupSource === 'inherited'
          ? 'quotations.lineItems.markupHints.leafInherited'
          : 'quotations.lineItems.markupHints.leafGlobal',
    helperArgs:
      pricing.markupSource === 'inherited'
        ? {
            rate: pricing.effectiveMarkupRate,
            source: pricing.markupSourceLabel,
            amount: calculatePerUnitMarkupAmount(pricing.markupAmount, item.quantity),
            unit: item.quantityUnit.trim() || 'item',
          }
        : {
            rate: pricing.effectiveMarkupRate,
            amount: calculatePerUnitMarkupAmount(pricing.markupAmount, item.quantity),
            unit: item.quantityUnit.trim() || 'item',
          },
  }
}

function calculatePerUnitMarkupAmount(markupAmount: number, quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0
  }

  return Math.round(((markupAmount / quantity) + Number.EPSILON) * 100) / 100
}

function calculateGroupMarkupUsage(children: QuotationItem[]): GroupMarkupUsage {
  return children.reduce(
    (usage, child) => mergeUsage(usage, calculateDescendantMarkupUsage(child, true)),
    { usedCount: 0, ignoredCount: 0 },
  )
}

function calculateDescendantMarkupUsage(
  item: QuotationItem,
  canUseCurrentGroupFallback: boolean,
): GroupMarkupUsage {
  const hasOwnMarkup = typeof item.markupRate === 'number' && Number.isFinite(item.markupRate)

  if (item.children.length > 0) {
    return item.children.reduce(
      (usage, child) =>
        mergeUsage(usage, calculateDescendantMarkupUsage(child, canUseCurrentGroupFallback && !hasOwnMarkup)),
      { usedCount: 0, ignoredCount: 0 },
    )
  }

  if (canUseCurrentGroupFallback && !hasOwnMarkup) {
    return { usedCount: 1, ignoredCount: 0 }
  }

  return { usedCount: 0, ignoredCount: 1 }
}

function mergeUsage(left: GroupMarkupUsage, right: GroupMarkupUsage): GroupMarkupUsage {
  return {
    usedCount: left.usedCount + right.usedCount,
    ignoredCount: left.ignoredCount + right.ignoredCount,
  }
}

function getGroupMarkupUsageCopy(
  usage: GroupMarkupUsage,
): Pick<QuotationMarkupCopy, 'statusKey' | 'statusArgs'> {
  if (usage.usedCount <= 0 && usage.ignoredCount <= 0) {
    return {
      statusKey: 'quotations.lineItems.markupUsage.none' as const,
      statusArgs: {},
    }
  }

  if (usage.usedCount <= 0) {
    return {
      statusKey: 'quotations.lineItems.markupUsage.unused' as const,
      statusArgs: {},
    }
  }

  if (usage.ignoredCount <= 0) {
    return {
      statusKey: 'quotations.lineItems.markupUsage.all' as const,
      statusArgs: { usedCount: usage.usedCount },
    }
  }

  return {
    statusKey: 'quotations.lineItems.markupUsage.mixed' as const,
    statusArgs: usage,
  }
}
