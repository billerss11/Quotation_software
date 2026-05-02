import type { MajorItemSummary, QuotationItem } from '../types'

export type QuotationPreviewRowType = 'major' | 'sub' | 'subtotal'

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
  majorItems: QuotationItem[],
  summaries: MajorItemSummary[],
): QuotationPreviewRow[] {
  const summaryByItemId = new Map(summaries.map((summary) => [summary.itemId, summary]))

  return majorItems.flatMap((item, itemIndex): QuotationPreviewRow[] => {
    const itemNumber = String(itemIndex + 1)
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
