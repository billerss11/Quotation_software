import type { MajorItemSummary, QuotationMajorItem } from '../types'

export interface MajorItemPricingDisplayRow {
  label: string
  amount: number
  emphasis: boolean
}

export interface MajorItemPricingDisplay {
  isRolledUp: boolean
  rows: MajorItemPricingDisplayRow[]
}

export function getMajorItemPricingDisplay(
  item: QuotationMajorItem,
  summary: MajorItemSummary | undefined,
): MajorItemPricingDisplay {
  if (item.subItems.length === 0) {
    return {
      isRolledUp: false,
      rows: [],
    }
  }

  return {
    isRolledUp: true,
    rows: [
      { label: 'Sub-items total', amount: summary?.baseSubtotal ?? 0, emphasis: false },
      { label: 'Markup', amount: summary?.markupAmount ?? 0, emphasis: false },
      { label: 'Parent subtotal', amount: summary?.subtotal ?? 0, emphasis: true },
    ],
  }
}
