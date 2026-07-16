import type { CurrencyCode, QuotationItem, QuotationRootItem, TaxClass } from '../types'
import { parseCurrencyCode } from './currencyCodes'
import { getQuotationRootItems } from './quotationItems'

const expectedHeaders = [
  'item_code',
  'item_name',
  'item_description',
  'qty',
  'qty_unit',
  'manual_unit_price',
  'unit_cost',
  'cost_currency',
  'tax_class',
  'markup_override',
] as const

const DEFAULT_IMPORTED_QUANTITY_UNIT = 'EA'
const MAX_IMPORTED_MARKUP_RATE = 1_000

const supportedHeaders = new Set<CsvColumnName>([
  ...expectedHeaders,
  'pricing_basis',
  'unit_price',
  'expected_total',
])

type CsvCells = ReturnType<typeof createEmptyCells>
type CsvColumnName = keyof CsvCells

interface CsvHeaderMap {
  indexes: Partial<Record<CsvColumnName, number>>
  sourceColumnCount: number
  recognizedColumns: string[]
  ignoredColumns: string[]
}

export interface CsvImportMetadata {
  rowCount: number
  recognizedColumns: string[]
  ignoredColumns: string[]
}

export type CsvImportIssueCode =
  | 'empty_file'
  | 'malformed_csv'
  | 'missing_required_header'
  | 'duplicate_header'
  | 'extra_cells'
  | 'no_data_rows'
  | 'invalid_item_code'
  | 'missing_item_name'
  | 'invalid_number'
  | 'non_positive_number'
  | 'negative_number'
  | 'markup_out_of_range'
  | 'conflicting_unit_price'
  | 'pricing_basis_conflict'
  | 'unsupported_pricing_basis'
  | 'unsupported_currency'
  | 'unsupported_tax_class'
  | 'missing_parent'
  | 'missing_leaf_quantity'
  | 'missing_leaf_unit_price'
  | 'missing_leaf_unit_cost'
  | 'missing_leaf_currency'
  | 'duplicate_item_code'

export interface CsvImportIssue {
  row: number
  column?: string
  code: CsvImportIssueCode
  context?: Record<string, string>
}

export type CsvImportWarningCode =
  | 'missing_item_code_assigned'
  | 'missing_qty_unit_defaulted'
  | 'missing_group_quantity_defaulted'
  | 'manual_cost_currency_defaulted'
  | 'unknown_header_ignored'
  | 'redundant_unit_price'
  | 'group_pricing_ignored'
  | 'manual_markup_ignored'
  | 'leaf_expected_total_ignored'

export interface CsvImportWarning {
  row: number
  column: string
  code: CsvImportWarningCode
  context: Record<string, string>
}

export interface ParsedLineItemsCsv {
  items: QuotationItem[]
  warnings: CsvImportWarning[]
  rowCount: number
  recognizedColumns: string[]
  ignoredColumns: string[]
}

export class CsvImportError extends Error {
  issues: CsvImportIssue[]
  warnings: CsvImportWarning[]
  metadata: CsvImportMetadata

  constructor(
    issues: CsvImportIssue[],
    warnings: CsvImportWarning[] = [],
    metadata: CsvImportMetadata = createEmptyImportMetadata(),
  ) {
    super('csv_import_failed')
    this.name = 'CsvImportError'
    this.issues = issues
    this.warnings = warnings
    this.metadata = metadata
  }
}

interface ParsedCsvRow {
  row: number
  itemCode: string
  segments: number[]
  item: QuotationItem
  quantityProvided: boolean
  manualUnitPriceProvided: boolean
  manualUnitPriceValid: boolean
  unitCostProvided: boolean
  unitCostValid: boolean
  currencyProvided: boolean
  manualUnitPriceColumn: string
  manualUnitPriceColumns: string[]
  pricingBasisProvided: boolean
  markupProvided: boolean
  expectedTotalProvided: boolean
}

type CsvImportParseState = {
  nextGeneratedRootCode: number
  reservedRootCodes: Set<number>
}

export function createLineItemsCsvTemplateContent() {
  return `\uFEFF${expectedHeaders.join(',')}\n`
}

export function createLineItemsCsvContent(items: QuotationRootItem[], taxClasses: TaxClass[] = []) {
  const rows = [
    expectedHeaders.join(','),
    ...flattenItems(getQuotationRootItems(items)).map(({ itemCode, item }) =>
      [
        itemCode,
        escapeCsvCell(item.name),
        escapeCsvCell(item.description),
        formatCsvNumber(item.quantity),
        escapeCsvCell(item.quantityUnit),
        formatOptionalCsvNumber(getUnitPriceCell(item)),
        formatOptionalCsvNumber(getUnitCostCell(item)),
        escapeCsvCell(getCostCurrencyCell(item)),
        escapeCsvCell(getTaxClassLabel(item.taxClassId, taxClasses)),
        formatOptionalCsvNumber(item.markupRate),
      ].join(','),
    ),
  ]

  return `\uFEFF${rows.join('\n')}`
}

export function parseLineItemsCsvContent(
  content: string,
  fallbackCurrency: CurrencyCode,
  taxClasses: TaxClass[] = [],
): QuotationItem[] {
  return parseLineItemsCsvImport(content, fallbackCurrency, taxClasses).items
}

export function parseLineItemsCsvImport(
  content: string,
  fallbackCurrency: CurrencyCode,
  taxClasses: TaxClass[] = [],
): ParsedLineItemsCsv {
  if (removeBom(content).trim().length === 0) {
    throw new CsvImportError([{ row: 1, code: 'empty_file' }])
  }

  const rows = parseCsv(content)
  const issues: CsvImportIssue[] = []
  const warnings: CsvImportWarning[] = []

  if (rows.length === 0) {
    throw new CsvImportError([{ row: 1, code: 'empty_file' }])
  }

  const headers = rows[0].map((cell, index) => (index === 0 ? removeBom(cell) : cell))
  const headerMap = createHeaderMap(headers, issues, warnings)
  const metadata: CsvImportMetadata = {
    rowCount: 0,
    recognizedColumns: headerMap.recognizedColumns,
    ignoredColumns: headerMap.ignoredColumns,
  }

  if (issues.length > 0) {
    throw new CsvImportError(issues, warnings, metadata)
  }

  const dataRows = rows.slice(1)
  metadata.rowCount = dataRows.filter((row) => hasKnownDataCells(createCellsFromRow(row, headerMap))).length

  if (metadata.rowCount === 0) {
    issues.push({ row: 2, code: 'no_data_rows' })
  }

  const parseState = createCsvImportParseState(dataRows, headerMap)
  const parsedRows = dataRows
    .map((row, index) => parseDataRow(
      row,
      index + 2,
      fallbackCurrency,
      taxClasses,
      headerMap,
      issues,
      warnings,
      parseState,
    ))
    .filter((row): row is ParsedCsvRow => row !== null)

  validateDuplicateCodes(parsedRows, issues)
  const sortedRows = [...parsedRows].sort((left, right) => compareSegments(left.segments, right.segments))
  const itemsByCode = new Map<string, QuotationItem>()
  const roots: QuotationItem[] = []

  for (const row of sortedRows) {
    itemsByCode.set(row.itemCode, row.item)

    if (row.segments.length === 1) {
      roots.push(row.item)
      continue
    }

    const parentCode = row.segments.slice(0, -1).join('.')
    const parent = itemsByCode.get(parentCode)

    if (!parent) {
      issues.push({
        row: row.row,
        column: 'item_code',
        code: 'missing_parent',
        context: {
          parentCode,
        },
      })
      continue
    }

    parent.children.push(row.item)
  }

  validateRowRoles(sortedRows, itemsByCode, issues, warnings, fallbackCurrency)

  if (issues.length > 0) {
    throw new CsvImportError(issues, warnings, metadata)
  }

  return {
    items: roots,
    warnings,
    ...metadata,
  }
}

export function formatCsvImportError(
  error: unknown,
  translate: (key: string, params?: Record<string, string | number>) => string,
) {
  if (!(error instanceof CsvImportError)) {
    return error instanceof Error ? error.message : translate('quotations.csv.fallback')
  }

  const firstIssue = error.issues[0]

  if (!firstIssue) {
    return translate('quotations.csv.fallback')
  }

  const detail = formatIssue(firstIssue, translate)
  const remainingCount = error.issues.length - 1

  if (remainingCount > 0) {
    return `${translate('quotations.csv.rowPrefix', { row: firstIssue.row })} ${detail} ${translate('quotations.csv.moreIssues', { count: remainingCount })}`
  }

  return `${translate('quotations.csv.rowPrefix', { row: firstIssue.row })} ${detail}`
}

function parseDataRow(
  row: string[],
  rowNumber: number,
  fallbackCurrency: CurrencyCode,
  taxClasses: TaxClass[],
  headerMap: CsvHeaderMap,
  issues: CsvImportIssue[],
  warnings: CsvImportWarning[],
  parseState: CsvImportParseState,
): ParsedCsvRow | null {
  const cells = createCellsFromRow(row, headerMap)

  if (row.slice(headerMap.sourceColumnCount).some((cell) => cell.trim().length > 0)) {
    issues.push({
      row: rowNumber,
      code: 'extra_cells',
      context: {
        count: String(row.length - headerMap.sourceColumnCount),
      },
    })
  }

  if (!hasKnownDataCells(cells)) {
    return null
  }

  const itemCodeWarning = cells.item_code.length === 0
    ? createAssignedItemCodeWarning(rowNumber, cells, parseState)
    : null
  const segments = parseItemCode(cells.item_code)

  if (!segments) {
    issues.push({
      row: rowNumber,
      column: 'item_code',
      code: 'invalid_item_code',
    })
    return null
  }

  if (cells.item_name.length === 0) {
    issues.push({
      row: rowNumber,
      column: 'item_name',
      code: 'missing_item_name',
    })
    return null
  }

  if (itemCodeWarning) {
    warnings.push(itemCodeWarning)
  }

  const quantityUnit = cells.qty_unit.length > 0 ? cells.qty_unit : DEFAULT_IMPORTED_QUANTITY_UNIT

  if (cells.qty_unit.length === 0) {
    warnings.push({
      row: rowNumber,
      column: 'qty_unit',
      code: 'missing_qty_unit_defaulted',
      context: {
        unit: DEFAULT_IMPORTED_QUANTITY_UNIT,
      },
    })
  }

  const quantity = parseNumberCell(cells.qty)
  const currentManualUnitPrice = parseNumberCell(cells.manual_unit_price)
  const legacyManualUnitPrice = parseNumberCell(cells.unit_price)
  const manualUnitPriceCell = cells.manual_unit_price || cells.unit_price
  const manualUnitPriceColumn = cells.manual_unit_price.length > 0 ? 'manual_unit_price' : 'unit_price'
  const manualUnitPrice = cells.manual_unit_price.length > 0 ? currentManualUnitPrice : legacyManualUnitPrice
  const unitCost = parseNumberCell(cells.unit_cost)
  const markupRate = parsePercentCell(cells.markup_override)
  const expectedTotal = parseNumberCell(cells.expected_total)
  const pricingMethod = parsePricingMethodCell(cells.pricing_basis)
  const costCurrency = parseCurrencyCell(cells.cost_currency)
  const taxClassId = parseTaxClassCell(cells.tax_class, taxClasses)

  if (cells.qty.length > 0 && quantity === null) {
    issues.push({
      row: rowNumber,
      column: 'qty',
      code: 'invalid_number',
    })
  } else if (quantity !== null && quantity <= 0) {
    issues.push({
      row: rowNumber,
      column: 'qty',
      code: 'non_positive_number',
    })
  }

  if (cells.unit_cost.length > 0 && unitCost === null) {
    issues.push({
      row: rowNumber,
      column: 'unit_cost',
      code: 'invalid_number',
    })
  } else if (unitCost !== null && unitCost < 0) {
    issues.push({
      row: rowNumber,
      column: 'unit_cost',
      code: 'negative_number',
    })
  }

  if (cells.manual_unit_price.length > 0 && currentManualUnitPrice === null) {
    issues.push({
      row: rowNumber,
      column: 'manual_unit_price',
      code: 'invalid_number',
    })
  }

  if (cells.unit_price.length > 0 && legacyManualUnitPrice === null) {
    issues.push({
      row: rowNumber,
      column: 'unit_price',
      code: 'invalid_number',
    })
  }

  if (manualUnitPrice !== null && manualUnitPrice < 0) {
    issues.push({
      row: rowNumber,
      column: manualUnitPriceColumn,
      code: 'negative_number',
    })
  }

  if (
    currentManualUnitPrice !== null
    && legacyManualUnitPrice !== null
    && currentManualUnitPrice !== legacyManualUnitPrice
  ) {
    issues.push({
      row: rowNumber,
      column: 'manual_unit_price',
      code: 'conflicting_unit_price',
    })
  } else if (currentManualUnitPrice !== null && legacyManualUnitPrice !== null) {
    warnings.push({
      row: rowNumber,
      column: 'manual_unit_price',
      code: 'redundant_unit_price',
      context: {},
    })
  }

  if (cells.markup_override.length > 0 && markupRate === null) {
    issues.push({
      row: rowNumber,
      column: 'markup_override',
      code: 'invalid_number',
    })
  } else if (markupRate !== null && (markupRate < 0 || markupRate > MAX_IMPORTED_MARKUP_RATE)) {
    issues.push({
      row: rowNumber,
      column: 'markup_override',
      code: 'markup_out_of_range',
    })
  }

  if (cells.pricing_basis.length > 0 && !pricingMethod) {
    issues.push({
      row: rowNumber,
      column: 'pricing_basis',
      code: 'unsupported_pricing_basis',
    })
  }

  if (cells.expected_total.length > 0 && expectedTotal === null) {
    issues.push({
      row: rowNumber,
      column: 'expected_total',
      code: 'invalid_number',
    })
  } else if (expectedTotal !== null && expectedTotal < 0) {
    issues.push({
      row: rowNumber,
      column: 'expected_total',
      code: 'negative_number',
    })
  }

  if (cells.cost_currency.length > 0 && !costCurrency) {
    issues.push({
      row: rowNumber,
      column: 'cost_currency',
      code: 'unsupported_currency',
    })
  }

  if (cells.tax_class.length > 0 && !taxClassId) {
    issues.push({
      row: rowNumber,
      column: 'tax_class',
      code: 'unsupported_tax_class',
    })
  }

  const resolvedPricingMethod = resolvePricingMethod({
    pricingMethod,
    manualUnitPriceProvided: manualUnitPriceCell.length > 0,
  })

  if (pricingMethod === 'cost_plus' && manualUnitPriceCell.length > 0) {
    issues.push({
      row: rowNumber,
      column: 'pricing_basis',
      code: 'pricing_basis_conflict',
      context: {
        pricingBasis: 'cost_plus',
      },
    })
  }

  const item: QuotationItem = {
    id: crypto.randomUUID(),
    name: cells.item_name,
    description: cells.item_description,
    quantity: quantity ?? 1,
    quantityUnit,
    pricingMethod: resolvedPricingMethod,
    manualUnitPrice: manualUnitPrice ?? undefined,
    unitCost: unitCost ?? 0,
    costCurrency: costCurrency ?? fallbackCurrency,
    markupRate: markupRate ?? undefined,
    taxClassId: taxClassId ?? undefined,
    expectedTotal: expectedTotal ?? undefined,
    notes: '',
    children: [],
  }

  return {
    row: rowNumber,
    itemCode: cells.item_code,
    segments,
    item,
    quantityProvided: cells.qty.length > 0,
    manualUnitPriceProvided: manualUnitPriceCell.length > 0,
    manualUnitPriceValid: manualUnitPrice !== null,
    unitCostProvided: cells.unit_cost.length > 0,
    unitCostValid: unitCost !== null,
    currencyProvided: cells.cost_currency.length > 0,
    manualUnitPriceColumn,
    manualUnitPriceColumns: [
      cells.manual_unit_price.length > 0 ? 'manual_unit_price' : '',
      cells.unit_price.length > 0 ? 'unit_price' : '',
    ].filter(Boolean),
    pricingBasisProvided: cells.pricing_basis.length > 0,
    markupProvided: cells.markup_override.length > 0,
    expectedTotalProvided: cells.expected_total.length > 0,
  }
}

function createAssignedItemCodeWarning(
  rowNumber: number,
  cells: Record<string, string>,
  parseState: CsvImportParseState,
): CsvImportWarning {
  const itemCode = takeNextGeneratedRootCode(parseState)
  cells.item_code = itemCode

  return {
    row: rowNumber,
    column: 'item_code',
    code: 'missing_item_code_assigned',
    context: {
      itemCode,
    },
  }
}

function takeNextGeneratedRootCode(parseState: CsvImportParseState) {
  while (parseState.reservedRootCodes.has(parseState.nextGeneratedRootCode)) {
    parseState.nextGeneratedRootCode += 1
  }

  const itemCode = String(parseState.nextGeneratedRootCode)
  parseState.reservedRootCodes.add(parseState.nextGeneratedRootCode)
  parseState.nextGeneratedRootCode += 1
  return itemCode
}

function validateRowRoles(
  rows: ParsedCsvRow[],
  itemsByCode: Map<string, QuotationItem>,
  issues: CsvImportIssue[],
  warnings: CsvImportWarning[],
  fallbackCurrency: CurrencyCode,
) {
  rows.forEach((row) => {
    const item = itemsByCode.get(row.itemCode)

    if (!item) {
      return
    }

    if (item.children.length > 0) {
      removeIgnoredGroupPricingIssues(issues, warnings, row.row)

      if (!row.quantityProvided) {
        warnings.push({
          row: row.row,
          column: 'qty',
          code: 'missing_group_quantity_defaulted',
          context: {
            quantity: '1',
          },
        })
      }

      const ignoredColumns = [
        row.pricingBasisProvided ? 'pricing_basis' : '',
        ...row.manualUnitPriceColumns,
        row.unitCostProvided ? 'unit_cost' : '',
        row.currencyProvided ? 'cost_currency' : '',
      ].filter(Boolean)

      if (ignoredColumns.length > 0) {
        warnings.push({
          row: row.row,
          column: ignoredColumns[0] ?? 'pricing_basis',
          code: 'group_pricing_ignored',
          context: {
            columns: ignoredColumns.join(', '),
          },
        })
      }

      item.pricingMethod = 'cost_plus'
      item.manualUnitPrice = undefined
      item.unitCost = 0
      item.costCurrency = fallbackCurrency
      return
    }

    if (!row.quantityProvided) {
      issues.push({
        row: row.row,
        column: 'qty',
        code: 'missing_leaf_quantity',
      })
    }

    if (item.pricingMethod === 'manual_price' && !row.manualUnitPriceProvided) {
      issues.push({
        row: row.row,
        column: row.manualUnitPriceColumn,
        code: 'missing_leaf_unit_price',
      })
    } else if (
      item.pricingMethod === 'manual_price'
      && row.manualUnitPriceValid
      && (item.manualUnitPrice ?? 0) <= 0
    ) {
      issues.push({
        row: row.row,
        column: row.manualUnitPriceColumn,
        code: 'non_positive_number',
      })
    }

    if (item.pricingMethod !== 'manual_price' && !row.unitCostProvided) {
      issues.push({
        row: row.row,
        column: 'unit_cost',
        code: 'missing_leaf_unit_cost',
      })
    } else if (item.pricingMethod !== 'manual_price' && row.unitCostValid && item.unitCost <= 0) {
      issues.push({
        row: row.row,
        column: 'unit_cost',
        code: 'non_positive_number',
      })
    }

    if (item.pricingMethod !== 'manual_price' && !row.currencyProvided) {
      issues.push({
        row: row.row,
        column: 'cost_currency',
        code: 'missing_leaf_currency',
      })
    }

    if (item.pricingMethod === 'manual_price' && row.markupProvided) {
      warnings.push({
        row: row.row,
        column: 'markup_override',
        code: 'manual_markup_ignored',
        context: {},
      })
    }

    if (item.pricingMethod === 'manual_price' && row.unitCostProvided && !row.currencyProvided) {
      warnings.push({
        row: row.row,
        column: 'cost_currency',
        code: 'manual_cost_currency_defaulted',
        context: {
          currency: fallbackCurrency,
        },
      })
    }

    if (row.expectedTotalProvided) {
      warnings.push({
        row: row.row,
        column: 'expected_total',
        code: 'leaf_expected_total_ignored',
        context: {},
      })
      item.expectedTotal = undefined
    }
  })
}

function removeIgnoredGroupPricingIssues(
  issues: CsvImportIssue[],
  warnings: CsvImportWarning[],
  rowNumber: number,
) {
  const ignoredColumns = new Set([
    'pricing_basis',
    'manual_unit_price',
    'unit_price',
    'unit_cost',
    'cost_currency',
  ])

  for (let index = issues.length - 1; index >= 0; index -= 1) {
    const issue = issues[index]
    if (issue?.row === rowNumber && issue.column && ignoredColumns.has(issue.column)) {
      issues.splice(index, 1)
    }
  }

  for (let index = warnings.length - 1; index >= 0; index -= 1) {
    const warning = warnings[index]
    if (warning?.row === rowNumber && warning.code === 'redundant_unit_price') {
      warnings.splice(index, 1)
    }
  }
}

function validateDuplicateCodes(rows: ParsedCsvRow[], issues: CsvImportIssue[]) {
  const seen = new Set<string>()

  rows.forEach((row) => {
    if (seen.has(row.itemCode)) {
      issues.push({
        row: row.row,
        column: 'item_code',
        code: 'duplicate_item_code',
        context: {
          itemCode: row.itemCode,
        },
      })
      return
    }

    seen.add(row.itemCode)
  })
}

function formatIssue(
  issue: CsvImportIssue,
  translate: (key: string, params?: Record<string, string | number>) => string,
) {
  switch (issue.code) {
    case 'empty_file':
      return translate('quotations.csv.errors.emptyFile')
    case 'malformed_csv':
      return translate('quotations.csv.errors.malformedCsv')
    case 'missing_required_header':
      return translate('quotations.csv.errors.missingRequiredHeader', {
        header: issue.context?.header ?? '',
      })
    case 'duplicate_header':
      return translate('quotations.csv.errors.duplicateHeader', {
        header: issue.context?.header ?? '',
      })
    case 'extra_cells':
      return translate('quotations.csv.errors.extraCells')
    case 'no_data_rows':
      return translate('quotations.csv.errors.noDataRows')
    case 'invalid_item_code':
      return translate('quotations.csv.errors.invalidItemCode')
    case 'missing_item_name':
      return translate('quotations.csv.errors.missingItemName')
    case 'invalid_number':
      return translate('quotations.csv.errors.invalidNumber', {
        column: issue.column ? translate(`quotations.csv.columns.${issue.column}`) : '',
      })
    case 'non_positive_number':
      return translate('quotations.csv.errors.nonPositiveNumber', {
        column: issue.column ? translate(`quotations.csv.columns.${issue.column}`) : '',
      })
    case 'negative_number':
      return translate('quotations.csv.errors.negativeNumber', {
        column: issue.column ? translate(`quotations.csv.columns.${issue.column}`) : '',
      })
    case 'markup_out_of_range':
      return translate('quotations.csv.errors.markupOutOfRange')
    case 'conflicting_unit_price':
      return translate('quotations.csv.errors.conflictingUnitPrice')
    case 'pricing_basis_conflict':
      return translate('quotations.csv.errors.pricingBasisConflict', {
        pricingBasis: issue.context?.pricingBasis ?? '',
      })
    case 'unsupported_pricing_basis':
      return translate('quotations.csv.errors.unsupportedPricingBasis')
    case 'unsupported_currency':
      return translate('quotations.csv.errors.unsupportedCurrency')
    case 'unsupported_tax_class':
      return translate('quotations.csv.errors.unsupportedTaxClass')
    case 'missing_parent':
      return translate('quotations.csv.errors.missingParent', {
        parentCode: issue.context?.parentCode ?? '',
      })
    case 'missing_leaf_quantity':
      return translate('quotations.csv.errors.missingLeafQuantity')
    case 'missing_leaf_unit_price':
      return translate('quotations.csv.errors.missingLeafUnitPrice')
    case 'missing_leaf_unit_cost':
      return translate('quotations.csv.errors.missingLeafUnitCost')
    case 'missing_leaf_currency':
      return translate('quotations.csv.errors.missingLeafCurrency')
    case 'duplicate_item_code':
      return translate('quotations.csv.errors.duplicateItemCode', {
        itemCode: issue.context?.itemCode ?? '',
      })
  }
}

export function formatCsvImportIssue(
  issue: CsvImportIssue,
  translate: (key: string, params?: Record<string, string | number>) => string,
) {
  return formatIssue(issue, translate)
}

export function formatCsvImportWarning(
  warning: CsvImportWarning,
  translate: (key: string, params?: Record<string, string | number>) => string,
) {
  switch (warning.code) {
    case 'missing_item_code_assigned':
      return translate('quotations.csv.warnings.missingItemCodeAssigned', {
        itemCode: warning.context.itemCode ?? '',
      })
    case 'missing_qty_unit_defaulted':
      return translate('quotations.csv.warnings.missingQtyUnitDefaulted', {
        unit: warning.context.unit ?? DEFAULT_IMPORTED_QUANTITY_UNIT,
      })
    case 'missing_group_quantity_defaulted':
      return translate('quotations.csv.warnings.missingGroupQuantityDefaulted', {
        quantity: warning.context.quantity ?? '1',
      })
    case 'manual_cost_currency_defaulted':
      return translate('quotations.csv.warnings.manualCostCurrencyDefaulted', {
        currency: warning.context.currency ?? '',
      })
    case 'unknown_header_ignored':
      return translate('quotations.csv.warnings.unknownHeaderIgnored', {
        header: warning.context.header ?? '',
      })
    case 'redundant_unit_price':
      return translate('quotations.csv.warnings.redundantUnitPrice')
    case 'group_pricing_ignored':
      return translate('quotations.csv.warnings.groupPricingIgnored', {
        columns: warning.context.columns ?? '',
      })
    case 'manual_markup_ignored':
      return translate('quotations.csv.warnings.manualMarkupIgnored')
    case 'leaf_expected_total_ignored':
      return translate('quotations.csv.warnings.leafExpectedTotalIgnored')
  }
}

export function formatCsvImportIssueForAgent(issue: CsvImportIssue) {
  const column = issue.column ? ` ${issue.column}` : ''

  switch (issue.code) {
    case 'empty_file':
      return `Row ${issue.row}: CSV file is empty`
    case 'malformed_csv':
      return `Row ${issue.row}: malformed CSV quoting`
    case 'missing_required_header':
      return `Row ${issue.row}: required header ${issue.context?.header ?? ''} is missing`
    case 'duplicate_header':
      return `Row ${issue.row}: header ${issue.context?.header ?? ''} is duplicated`
    case 'extra_cells':
      return `Row ${issue.row}: row contains non-empty cells beyond the header columns`
    case 'no_data_rows':
      return `Row ${issue.row}: CSV contains no item rows`
    case 'invalid_item_code':
      return `Row ${issue.row}: item_code must be like 1, 1.1, or 1.1.1`
    case 'missing_item_name':
      return `Row ${issue.row}: item_name is required`
    case 'invalid_number':
      return `Row ${issue.row}:${column} must be numeric`
    case 'non_positive_number':
      return `Row ${issue.row}:${column} must be greater than zero`
    case 'negative_number':
      return `Row ${issue.row}:${column} must be zero or greater`
    case 'markup_out_of_range':
      return `Row ${issue.row}: markup_override must be between 0 and 1000 percent`
    case 'conflicting_unit_price':
      return `Row ${issue.row}: manual_unit_price and unit_price conflict`
    case 'pricing_basis_conflict':
      return `Row ${issue.row}: pricing_basis conflicts with the provided price columns`
    case 'unsupported_pricing_basis':
      return `Row ${issue.row}: pricing_basis must be cost_plus or manual_price`
    case 'unsupported_currency':
      return `Row ${issue.row}: cost_currency is unsupported`
    case 'unsupported_tax_class':
      return `Row ${issue.row}: tax_class is unsupported`
    case 'missing_parent':
      return `Row ${issue.row}: parent item_code ${issue.context?.parentCode ?? ''} is missing`
    case 'missing_leaf_quantity':
      return `Row ${issue.row}: leaf row requires qty`
    case 'missing_leaf_unit_price':
      return `Row ${issue.row}: manual-price leaf row requires unit price`
    case 'missing_leaf_unit_cost':
      return `Row ${issue.row}: leaf row requires unit_cost`
    case 'missing_leaf_currency':
      return `Row ${issue.row}: leaf row requires cost_currency`
    case 'duplicate_item_code':
      return `Row ${issue.row}: item_code ${issue.context?.itemCode ?? ''} is duplicated`
  }
}

export function formatCsvImportWarningForAgent(warning: CsvImportWarning) {
  switch (warning.code) {
    case 'missing_item_code_assigned':
      return `Row ${warning.row}: item_code assigned ${warning.context.itemCode ?? ''}`
    case 'missing_qty_unit_defaulted':
      return `Row ${warning.row}: qty_unit defaulted to ${warning.context.unit ?? DEFAULT_IMPORTED_QUANTITY_UNIT}`
    case 'missing_group_quantity_defaulted':
      return `Row ${warning.row}: group qty defaulted to ${warning.context.quantity ?? '1'}`
    case 'manual_cost_currency_defaulted':
      return `Row ${warning.row}: cost_currency defaulted to ${warning.context.currency ?? ''}`
    case 'unknown_header_ignored':
      return `Row ${warning.row}: unknown header ${warning.context.header ?? ''} ignored`
    case 'redundant_unit_price':
      return `Row ${warning.row}: matching manual_unit_price and unit_price values were provided`
    case 'group_pricing_ignored':
      return `Row ${warning.row}: group pricing columns ignored: ${warning.context.columns ?? ''}`
    case 'manual_markup_ignored':
      return `Row ${warning.row}: markup_override does not change a manual selling price`
    case 'leaf_expected_total_ignored':
      return `Row ${warning.row}: expected_total is ignored on leaf rows`
  }
}

function parseCsv(content: string) {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let insideQuotes = false
  let closedQuote = false
  let rowNumber = 1

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]
    const nextCharacter = content[index + 1]

    if (insideQuotes) {
      if (character === '"' && nextCharacter === '"') {
        currentCell += '"'
        index += 1
        continue
      }

      if (character === '"') {
        insideQuotes = false
        closedQuote = true
        continue
      }

      currentCell += character
      continue
    }

    if (closedQuote) {
      if (character === ',') {
        currentRow.push(currentCell)
        currentCell = ''
        closedQuote = false
        continue
      }

      if (character === '\n') {
        currentRow.push(currentCell)
        rows.push(currentRow)
        currentRow = []
        currentCell = ''
        closedQuote = false
        rowNumber += 1
        continue
      }

      if (character === '\r') {
        continue
      }

      throw new CsvImportError([{ row: rowNumber, code: 'malformed_csv' }])
    }

    if (character === '"') {
      if (currentCell.length > 0) {
        throw new CsvImportError([{ row: rowNumber, code: 'malformed_csv' }])
      }
      insideQuotes = true
      continue
    }

    if (character === ',') {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if (character === '\n') {
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''
      rowNumber += 1
      continue
    }

    if (character !== '\r') {
      currentCell += character
    }
  }

  if (insideQuotes) {
    throw new CsvImportError([{ row: rowNumber, code: 'malformed_csv' }])
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }

  return rows
}

function parseItemCode(value: string) {
  if (!/^[1-9]\d*(\.[1-9]\d*){0,2}$/.test(value)) {
    return null
  }

  return value.split('.').map((segment) => Number(segment))
}

function parseNumberCell(value: string) {
  if (value.length === 0) {
    return null
  }

  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function parsePercentCell(value: string) {
  const normalizedValue = value.endsWith('%') ? value.slice(0, -1).trim() : value
  return parseNumberCell(normalizedValue)
}

function parseCurrencyCell(value: string): CurrencyCode | null {
  return parseCurrencyCode(value)
}

function createHeaderMap(
  headers: string[],
  issues: CsvImportIssue[],
  warnings: CsvImportWarning[],
): CsvHeaderMap {
  const indexes: Partial<Record<CsvColumnName, number>> = {}
  const recognizedColumns: string[] = []
  const ignoredColumns: string[] = []

  headers.forEach((rawHeader, index) => {
    const displayHeader = rawHeader.trim() || `Column ${index + 1}`
    const normalizedHeader = normalizeHeader(rawHeader)

    if (!supportedHeaders.has(normalizedHeader as CsvColumnName)) {
      ignoredColumns.push(displayHeader)
      warnings.push({
        row: 1,
        column: displayHeader,
        code: 'unknown_header_ignored',
        context: {
          header: displayHeader,
        },
      })
      return
    }

    const column = normalizedHeader as CsvColumnName
    if (indexes[column] !== undefined) {
      issues.push({
        row: 1,
        column,
        code: 'duplicate_header',
        context: {
          header: column,
        },
      })
      return
    }

    indexes[column] = index
    recognizedColumns.push(column)
  })

  if (indexes.item_name === undefined) {
    issues.push({
      row: 1,
      column: 'item_name',
      code: 'missing_required_header',
      context: {
        header: 'item_name',
      },
    })
  }

  return {
    indexes,
    sourceColumnCount: headers.length,
    recognizedColumns,
    ignoredColumns,
  }
}

function normalizeHeader(value: string) {
  return removeBom(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
}

function createCellsFromRow(row: string[], headerMap: CsvHeaderMap): CsvCells {
  const cells = createEmptyCells()

  Object.entries(headerMap.indexes).forEach(([column, index]) => {
    cells[column as CsvColumnName] = (row[index] ?? '').trim()
  })

  return cells
}

function hasKnownDataCells(cells: CsvCells) {
  return Object.values(cells).some((value) => value.length > 0)
}

function createCsvImportParseState(rows: string[][], headerMap: CsvHeaderMap): CsvImportParseState {
  const reservedRootCodes = new Set<number>()

  rows.forEach((row) => {
    const cells = createCellsFromRow(row, headerMap)

    if (!hasKnownDataCells(cells)) {
      return
    }

    const segments = parseItemCode(cells.item_code)

    if (segments?.[0]) {
      reservedRootCodes.add(segments[0])
    }
  })

  return {
    nextGeneratedRootCode: 1,
    reservedRootCodes,
  }
}

function createEmptyImportMetadata(): CsvImportMetadata {
  return {
    rowCount: 0,
    recognizedColumns: [],
    ignoredColumns: [],
  }
}

function compareSegments(left: number[], right: number[]) {
  const maxLength = Math.max(left.length, right.length)

  for (let index = 0; index < maxLength; index += 1) {
    const leftSegment = left[index] ?? 0
    const rightSegment = right[index] ?? 0

    if (leftSegment !== rightSegment) {
      return leftSegment - rightSegment
    }
  }

  return 0
}

function removeBom(value: string) {
  return value.replace(/^\uFEFF/, '')
}

function flattenItems(items: QuotationItem[], parentSegments: number[] = []): Array<{ itemCode: string; item: QuotationItem }> {
  return items.flatMap((item, index) => {
    const segments = [...parentSegments, index + 1]

    return [
      {
        itemCode: segments.join('.'),
        item,
      },
      ...flattenItems(item.children, segments),
    ]
  })
}

function escapeCsvCell(value: string) {
  if (!/[",\n\r]/.test(value)) {
    return value
  }

  return `"${value.replace(/"/g, '""')}"`
}

function formatCsvNumber(value: number) {
  return Number.isFinite(value) ? String(value) : '0'
}

function formatOptionalCsvNumber(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function createEmptyCells() {
  return {
    item_code: '',
    item_name: '',
    item_description: '',
    qty: '',
    qty_unit: '',
    pricing_basis: '',
    unit_price: '',
    manual_unit_price: '',
    unit_cost: '',
    cost_currency: '',
    tax_class: '',
    markup_override: '',
    expected_total: '',
  }
}

function getUnitPriceCell(item: QuotationItem) {
  if (item.children.length > 0) {
    return undefined
  }

  return item.pricingMethod === 'manual_price' ? item.manualUnitPrice : undefined
}

function getUnitCostCell(item: QuotationItem) {
  if (item.children.length > 0) {
    return undefined
  }

  if (item.pricingMethod === 'cost_plus' || item.unitCost > 0) {
    return item.unitCost
  }

  return undefined
}

function getCostCurrencyCell(item: QuotationItem) {
  if (item.children.length > 0) {
    return ''
  }

  if (item.pricingMethod === 'cost_plus' || item.unitCost > 0) {
    return item.costCurrency
  }

  return ''
}

function getTaxClassLabel(taxClassId: string | undefined, taxClasses: TaxClass[]) {
  if (!taxClassId) {
    return ''
  }

  return taxClasses.find((taxClass) => taxClass.id === taxClassId)?.label ?? ''
}

function parseTaxClassCell(value: string, taxClasses: TaxClass[]) {
  if (value.length === 0) {
    return null
  }

  const normalizedValue = value.trim().toLowerCase()
  const matchedTaxClass = taxClasses.find((taxClass) =>
    taxClass.id.toLowerCase() === normalizedValue
    || taxClass.label.trim().toLowerCase() === normalizedValue,
  )

  return matchedTaxClass?.id ?? null
}

function parsePricingMethodCell(value: string): QuotationItem['pricingMethod'] | null {
  if (value.length === 0) {
    return null
  }

  const normalizedValue = value.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')

  if (normalizedValue === 'cost_plus' || normalizedValue === 'cost') {
    return 'cost_plus'
  }

  if (normalizedValue === 'manual_price' || normalizedValue === 'manual' || normalizedValue === 'direct_price') {
    return 'manual_price'
  }

  return null
}

function resolvePricingMethod(options: {
  pricingMethod: QuotationItem['pricingMethod'] | null
  manualUnitPriceProvided: boolean
}): QuotationItem['pricingMethod'] {
  if (options.pricingMethod) {
    return options.pricingMethod
  }

  if (options.manualUnitPriceProvided) {
    return 'manual_price'
  }

  return 'cost_plus'
}
