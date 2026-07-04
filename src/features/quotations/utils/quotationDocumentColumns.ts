import type { MixedTaxDocumentColumn } from '../types'

export const MIXED_TAX_DOCUMENT_COLUMNS: MixedTaxDocumentColumn[] = [
  'taxRate',
  'unitPrice',
  'taxAmount',
  'netAmount',
  'grossAmount',
]

export const DEFAULT_MIXED_TAX_DOCUMENT_COLUMNS = [...MIXED_TAX_DOCUMENT_COLUMNS]

const mixedTaxDocumentColumnSet = new Set<MixedTaxDocumentColumn>(MIXED_TAX_DOCUMENT_COLUMNS)

export function normalizeMixedTaxDocumentColumns(value: unknown): MixedTaxDocumentColumn[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_MIXED_TAX_DOCUMENT_COLUMNS]
  }

  const selectedColumns: MixedTaxDocumentColumn[] = []

  value.forEach((column) => {
    if (!isMixedTaxDocumentColumn(column) || selectedColumns.includes(column)) {
      return
    }

    selectedColumns.push(column)
  })

  return selectedColumns
}

export function toggleMixedTaxDocumentColumn(
  columns: unknown,
  column: MixedTaxDocumentColumn,
  isVisible: boolean,
) {
  const selectedColumns = new Set(normalizeMixedTaxDocumentColumns(columns))

  if (isVisible) {
    selectedColumns.add(column)
  } else {
    selectedColumns.delete(column)
  }

  return MIXED_TAX_DOCUMENT_COLUMNS.filter((candidate) => selectedColumns.has(candidate))
}

export function isMixedTaxDocumentColumn(value: unknown): value is MixedTaxDocumentColumn {
  return typeof value === 'string' && mixedTaxDocumentColumnSet.has(value as MixedTaxDocumentColumn)
}
