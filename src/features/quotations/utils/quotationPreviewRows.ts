import type { MajorItemSummary, QuotationItem, QuotationOutputItemDetailLevel, QuotationRootItem } from '../types'
import { isQuotationSectionHeader } from './quotationItems'
import { DEFAULT_QUOTATION_OUTPUT_ITEM_DETAIL_LEVEL, normalizeQuotationOutputItemDetailLevel } from './quotationOutputSettings'

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

interface CreateQuotationPreviewRowsOptions {
  itemDetailLevel?: QuotationOutputItemDetailLevel
}

export function createQuotationPreviewRows(
  majorItems: QuotationRootItem[],
  summaries: MajorItemSummary[],
  options: CreateQuotationPreviewRowsOptions = {},
): QuotationPreviewRow[] {
  const summaryByItemId = new Map(summaries.map((summary) => [summary.itemId, summary]))
  const itemDetailLevel = normalizeQuotationOutputItemDetailLevel(
    options.itemDetailLevel ?? DEFAULT_QUOTATION_OUTPUT_ITEM_DETAIL_LEVEL,
  )
  let pricedItemCount = 0

  const rows = majorItems.flatMap((item): QuotationPreviewRow[] => {
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

  return rows.filter((row) => row.level <= itemDetailLevel)
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
