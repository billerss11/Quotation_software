import type { QuotationItem } from '../types'

export function isQuotationItemIncomplete(item: QuotationItem, isQuick: boolean): boolean {
  if (!String(item.name ?? '').trim()) return true

  const qty = typeof item.quantity === 'number' ? item.quantity : 0
  const unit = String(item.quantityUnit ?? '').trim()
  const missingQtyOrUnit = !(qty > 0) || !unit

  if (item.children.length === 0) {
    if (isQuick || item.pricingMethod === 'manual_price') {
      return missingQtyOrUnit || !(typeof item.manualUnitPrice === 'number' && item.manualUnitPrice > 0)
    }

    return missingQtyOrUnit || !(typeof item.unitCost === 'number' && item.unitCost > 0)
  }

  return missingQtyOrUnit
}

export function countIncompleteQuotationItems(items: QuotationItem[], isQuick: boolean): number {
  let count = 0

  for (const item of items) {
    if (isQuotationItemIncomplete(item, isQuick)) count++
    if (item.children.length > 0) {
      count += countIncompleteQuotationItems(item.children, isQuick)
    }
  }

  return count
}

export function hasIncompleteQuotationItem(item: QuotationItem, isQuick: boolean): boolean {
  return countIncompleteQuotationItems([item], isQuick) > 0
}
