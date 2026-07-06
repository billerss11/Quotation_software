import type { MixedTaxDocumentColumn } from '../types'

export type MixedTaxDocumentColumnValueKind = 'money' | 'text'

export interface MixedTaxDocumentColumnDefinition {
  id: MixedTaxDocumentColumn
  selectorLabelKey: string
  headerLabelKey: string
  headerNoteKey?: string
  valueKind: MixedTaxDocumentColumnValueKind
  cellClass: 'col-money' | 'col-tax'
  colClass: 'ledger-col-money' | 'ledger-col-tax'
}

export const MIXED_TAX_DOCUMENT_COLUMN_DEFINITIONS: readonly MixedTaxDocumentColumnDefinition[] = [
  {
    id: 'taxRate',
    selectorLabelKey: 'quotations.totals.mixedTaxColumns.options.taxRate',
    headerLabelKey: 'quotations.document.table.taxRateShort',
    valueKind: 'text',
    cellClass: 'col-tax',
    colClass: 'ledger-col-tax',
  },
  {
    id: 'unitPrice',
    selectorLabelKey: 'quotations.totals.mixedTaxColumns.options.unitPrice',
    headerLabelKey: 'quotations.document.table.unitPriceShort',
    headerNoteKey: 'quotations.document.table.excludingTaxShort',
    valueKind: 'money',
    cellClass: 'col-money',
    colClass: 'ledger-col-money',
  },
  {
    id: 'unitTax',
    selectorLabelKey: 'quotations.totals.mixedTaxColumns.options.unitTax',
    headerLabelKey: 'quotations.document.table.unitTaxShort',
    valueKind: 'money',
    cellClass: 'col-money',
    colClass: 'ledger-col-money',
  },
  {
    id: 'taxAmount',
    selectorLabelKey: 'quotations.totals.mixedTaxColumns.options.taxAmount',
    headerLabelKey: 'quotations.document.table.taxAmountShort',
    headerNoteKey: 'quotations.document.table.totalTaxShort',
    valueKind: 'money',
    cellClass: 'col-money',
    colClass: 'ledger-col-money',
  },
  {
    id: 'netAmount',
    selectorLabelKey: 'quotations.totals.mixedTaxColumns.options.netAmount',
    headerLabelKey: 'quotations.document.table.amountBeforeTaxShort',
    headerNoteKey: 'quotations.document.table.excludingTaxShort',
    valueKind: 'money',
    cellClass: 'col-money',
    colClass: 'ledger-col-money',
  },
  {
    id: 'grossAmount',
    selectorLabelKey: 'quotations.totals.mixedTaxColumns.options.grossAmount',
    headerLabelKey: 'quotations.document.table.amountWithTaxShort',
    headerNoteKey: 'quotations.document.table.includingTaxShort',
    valueKind: 'money',
    cellClass: 'col-money',
    colClass: 'ledger-col-money',
  },
]

export const MIXED_TAX_DOCUMENT_COLUMNS: MixedTaxDocumentColumn[] = MIXED_TAX_DOCUMENT_COLUMN_DEFINITIONS.map(
  (definition) => definition.id,
)

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

export function getMixedTaxDocumentColumnDefinitions(value: unknown): MixedTaxDocumentColumnDefinition[] {
  const selectedColumns = new Set(normalizeMixedTaxDocumentColumns(value))

  return MIXED_TAX_DOCUMENT_COLUMN_DEFINITIONS.filter((definition) => selectedColumns.has(definition.id))
}

export function isMixedTaxDocumentColumn(value: unknown): value is MixedTaxDocumentColumn {
  return typeof value === 'string' && mixedTaxDocumentColumnSet.has(value as MixedTaxDocumentColumn)
}
