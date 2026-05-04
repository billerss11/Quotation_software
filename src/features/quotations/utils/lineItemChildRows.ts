import type { QuotationItem } from '../types'
import { createInheritedMarkupContext, type InheritedMarkupContext } from './quotationItemPricing'

export interface ChildRow {
  item: QuotationItem
  depth: number
  itemNumber: string
  inheritedMarkupContext: InheritedMarkupContext | null
  inheritedTaxClassId?: string
  parentItemId: string | null
}

export function buildChildRows(
  children: QuotationItem[],
  parentNumber: string,
  inheritedMarkupContext: InheritedMarkupContext | null,
  inheritedTaxClassId?: string,
  parentItemId: string | null = null,
): ChildRow[] {
  return children.flatMap((child, index) => {
    const itemNumber = `${parentNumber}.${index + 1}`
    const row: ChildRow = {
      item: child,
      depth: itemNumber.split('.').length,
      itemNumber,
      inheritedMarkupContext,
      inheritedTaxClassId,
      parentItemId,
    }

    return [
      row,
      ...buildChildRows(
        child.children,
        itemNumber,
        createInheritedMarkupContext(child, itemNumber, inheritedMarkupContext),
        child.taxClassId ?? inheritedTaxClassId,
        child.id,
      ),
    ]
  })
}
