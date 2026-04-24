import type { MajorItemSummary, QuotationItem } from '../types'
import type { QuotationItemAmountMismatch } from './quotationItemValidation'

export interface MajorItemPricingDisplayRow {
  label: string
  amount: number
  emphasis: boolean
}

export interface MajorItemPricingDisplay {
  isRolledUp: boolean
  rows: MajorItemPricingDisplayRow[]
  mismatch: QuotationItemAmountMismatch | null
}

export function getMajorItemPricingDisplay(
  item: QuotationItem,
  summary: MajorItemSummary | undefined,
): MajorItemPricingDisplay {
  if (item.children.length === 0) {
    return {
      isRolledUp: false,
      rows: [],
      mismatch: null,
    }
  }

  return {
    isRolledUp: true,
    rows: [
      { label: 'Sub-items total', amount: summary?.baseSubtotal ?? 0, emphasis: false },
      { label: 'Markup', amount: summary?.markupAmount ?? 0, emphasis: false },
      { label: 'Parent subtotal', amount: summary?.subtotal ?? 0, emphasis: true },
    ],
    mismatch: null,
  }
}
