import type { MajorItemSummary, QuotationMajorItem, QuotationSubItem } from '../types'

export type QuotationPreviewRowType = 'major' | 'sub' | 'subtotal'

export interface QuotationPreviewRow {
  key: string
  type: QuotationPreviewRowType
  itemNumber: string
  description: string
  detail: string
  quantity: number | null
  unitPrice: number | null
  amount: number | null
}

export function createQuotationPreviewRows(
  majorItems: QuotationMajorItem[],
  summaries: MajorItemSummary[],
): QuotationPreviewRow[] {
  const summaryByItemId = new Map(summaries.map((summary) => [summary.itemId, summary]))

  return majorItems.flatMap((item, itemIndex): QuotationPreviewRow[] => {
    const itemNumber = String(itemIndex + 1)
    const summary = summaryByItemId.get(item.id)

    if (item.subItems.length === 0) {
      return [
        {
          key: `${item.id}-major`,
          type: 'major' as const,
          itemNumber,
          description: item.title,
          detail: item.description,
          quantity: item.quantity,
          unitPrice: null,
          amount: summary?.subtotal ?? null,
        },
      ]
    }

    return [
      {
        key: `${item.id}-major`,
        type: 'major' as const,
        itemNumber,
        description: item.title,
        detail: item.description,
        quantity: null,
        unitPrice: null,
        amount: summary?.subtotal ?? null,
      },
      ...item.subItems.flatMap((subItem, subItemIndex) =>
        createSubItemRows(subItem, `${itemNumber}.${subItemIndex + 1}`),
      ),
    ]
  })
}

function createSubItemRows(item: QuotationSubItem, itemNumber: string): QuotationPreviewRow[] {
  if (item.children.length === 0) {
    return [
      {
        key: `${item.id}-sub`,
        type: 'sub',
        itemNumber,
        description: item.description,
        detail: item.notes ?? '',
        quantity: item.quantity,
        unitPrice: null,
        amount: null,
      },
    ]
  }

  return [
    {
      key: `${item.id}-sub`,
      type: 'sub',
      itemNumber,
      description: item.description,
      detail: item.notes ?? '',
      quantity: null,
      unitPrice: null,
      amount: null,
    },
    ...item.children.flatMap((child, childIndex) =>
      createSubItemRows(child, `${itemNumber}.${childIndex + 1}`),
    ),
  ]
}
