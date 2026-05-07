import type { MajorItemSummary, QuotationItem, QuotationRootItem } from '../types'
import { isQuotationSectionHeader } from './quotationItems'

export type QuotationPreviewRowType = 'section' | 'major' | 'sub' | 'subtotal'

export interface QuotationPreviewRow {
  key: string
  type: QuotationPreviewRowType
  level: 1 | 2 | 3
  itemNumber: string
  description: string
  detail: string
  quantity: number | null
  quantityUnit: string
  unitPrice: number | null
  amount: number | null
}

export function createQuotationPreviewRows(
  majorItems: QuotationRootItem[],
  summaries: MajorItemSummary[],
): QuotationPreviewRow[] {
  const summaryByItemId = new Map(summaries.map((summary) => [summary.itemId, summary]))
  let pricedItemCount = 0

  return majorItems.flatMap((item): QuotationPreviewRow[] => {
    if (isQuotationSectionHeader(item)) {
      return [
        {
          key: `${item.id}-section`,
          type: 'section',
          level: 1,
          itemNumber: '',
          description: item.title,
          detail: '',
          quantity: null,
          quantityUnit: '',
          unitPrice: null,
          amount: null,
        },
      ]
    }

    pricedItemCount += 1
    const itemNumber = String(pricedItemCount)
    const summary = summaryByItemId.get(item.id)

    if (item.children.length === 0) {
      return [
        {
          key: `${item.id}-major`,
          type: 'major' as const,
          level: 1,
          itemNumber,
          description: item.name,
          detail: item.description,
          quantity: item.quantity,
          quantityUnit: item.quantityUnit,
          unitPrice: null,
          amount: summary?.subtotal ?? null,
        },
      ]
    }

    return [
      {
        key: `${item.id}-major`,
        type: 'major' as const,
        level: 1,
        itemNumber,
        description: item.name,
        detail: item.description,
        quantity: item.quantity,
        quantityUnit: item.quantityUnit,
        unitPrice: null,
        amount: summary?.subtotal ?? null,
      },
      ...item.children.flatMap((child, childIndex) =>
        createSubItemRows(child, `${itemNumber}.${childIndex + 1}`),
      ),
    ]
  })
}

function createSubItemRows(item: QuotationItem, itemNumber: string): QuotationPreviewRow[] {
  if (item.children.length === 0) {
    return [
      {
        key: `${item.id}-sub`,
        type: 'sub',
        level: itemNumber.split('.').length as 2 | 3,
        itemNumber,
        description: item.name,
        detail: item.description,
        quantity: item.quantity,
        quantityUnit: item.quantityUnit,
        unitPrice: null,
        amount: null,
      },
    ]
  }

  return [
    {
      key: `${item.id}-sub`,
      type: 'sub',
      level: itemNumber.split('.').length as 2 | 3,
      itemNumber,
      description: item.name,
      detail: item.description,
      quantity: item.quantity,
      quantityUnit: item.quantityUnit,
      unitPrice: null,
      amount: null,
    },
    ...item.children.flatMap((child, childIndex) =>
      createSubItemRows(child, `${itemNumber}.${childIndex + 1}`),
    ),
  ]
}
