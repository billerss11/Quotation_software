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

const pricingBasisExpectedHeaders = [
  'item_code',
  'item_name',
  'item_description',
  'qty',
  'qty_unit',
  'pricing_basis',
  'unit_price',
  'unit_cost',
  'cost_currency',
  'tax_class',
  'markup_override',
  'expected_total',
] as const

const legacyExpectedHeaders = [
  'item_code',
  'item_name',
  'item_description',
  'qty',
  'qty_unit',
  'unit_cost',
  'cost_currency',
  'markup_override',
  'expected_total',
] as const

const taxClassExpectedHeaders = [
  'item_code',
  'item_name',
  'item_description',
  'qty',
  'qty_unit',
  'unit_cost',
  'cost_currency',
  'tax_class',
  'markup_override',
  'expected_total',
] as const

const DEFAULT_IMPORTED_QUANTITY_UNIT = 'EA'

export type CsvImportIssueCode =
  | 'empty_file'
  | 'invalid_headers'
  | 'invalid_item_code'
  | 'missing_item_name'
  | 'invalid_number'
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

export interface CsvImportWarning {
  row: number
  column: string
  code: CsvImportWarningCode
  context: Record<string, string>
}

export interface ParsedLineItemsCsv {
  items: QuotationItem[]
  warnings: CsvImportWarning[]
}

export class CsvImportError extends Error {
  issues: CsvImportIssue[]
  warnings: CsvImportWarning[]

  constructor(issues: CsvImportIssue[], warnings: CsvImportWarning[] = []) {
    super('csv_import_failed')
    this.name = 'CsvImportError'
    this.issues = issues
    this.warnings = warnings
  }
}

interface ParsedCsvRow {
  row: number
  itemCode: string
  segments: number[]
  item: QuotationItem
  quantityProvided: boolean
  manualUnitPriceProvided: boolean
  unitCostProvided: boolean
  currencyProvided: boolean
  manualUnitPriceColumn: string
}

type CsvHeaderMode = 'current' | 'pricing_basis' | 'tax_class' | 'legacy'
type CsvImportParseState = {
  nextGeneratedRootCode: number
  reservedRootCodes: Set<number>
}

export function createLineItemsCsvTemplateContent() {
  return `${expectedHeaders.join(',')}\n`
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
  const rows = parseCsv(content)
  const issues: CsvImportIssue[] = []
  const warnings: CsvImportWarning[] = []

  if (rows.length === 0) {
    throw new CsvImportError([{ row: 1, code: 'empty_file' }])
  }

  const headers = rows[0].map((cell, index) => (index === 0 ? removeBom(cell.trim()) : cell.trim()))

  const headerMode = getHeaderMode(headers)

  if (!headerMode) {
    throw new CsvImportError([
      {
        row: 1,
        code: 'invalid_headers',
        context: {
          headers: expectedHeaders.join(', '),
        },
      },
    ])
  }

  const dataRows = rows.slice(1)
  const parseState = createCsvImportParseState(dataRows, headerMode)
  const parsedRows = dataRows
    .map((row, index) => parseDataRow(row, index + 2, fallbackCurrency, taxClasses, headerMode, issues, warnings, parseState))
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

  validateLeafValues(sortedRows, itemsByCode, issues)

  if (issues.length > 0) {
    throw new CsvImportError(issues, warnings)
  }

  return {
    items: roots,
    warnings,
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
  headerMode: CsvHeaderMode,
  issues: CsvImportIssue[],
  warnings: CsvImportWarning[],
  parseState: CsvImportParseState,
): ParsedCsvRow | null {
  const headers = getHeadersForMode(headerMode)
  const cells = headers.reduce<Record<string, string>>(
    (result, header, index) => {
      result[header] = (row[index] ?? '').trim()
      return result
    },
    createEmptyCells(),
  )
  cells.tax_class ??= ''
  cells.pricing_basis ??= ''
  cells.unit_price ??= ''
  cells.manual_unit_price ??= ''

  if (Object.values(cells).every((value) => value.length === 0)) {
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
  const manualUnitPriceCell = cells.manual_unit_price || cells.unit_price
  const manualUnitPriceColumn = headerMode === 'current' ? 'manual_unit_price' : 'unit_price'
  const manualUnitPrice = parseNumberCell(manualUnitPriceCell)
  const unitCost = parseNumberCell(cells.unit_cost)
  const markupRate = parseNumberCell(cells.markup_override)
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
  }

  if (cells.unit_cost.length > 0 && unitCost === null) {
    issues.push({
      row: rowNumber,
      column: 'unit_cost',
      code: 'invalid_number',
    })
  }

  if (manualUnitPriceCell.length > 0 && manualUnitPrice === null) {
    issues.push({
      row: rowNumber,
      column: manualUnitPriceColumn,
      code: 'invalid_number',
    })
  }

  if (cells.markup_override.length > 0 && markupRate === null) {
    issues.push({
      row: rowNumber,
      column: 'markup_override',
      code: 'invalid_number',
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
    unitCostProvided: cells.unit_cost.length > 0,
    currencyProvided: cells.cost_currency.length > 0,
    manualUnitPriceColumn,
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

function validateLeafValues(
  rows: ParsedCsvRow[],
  itemsByCode: Map<string, QuotationItem>,
  issues: CsvImportIssue[],
) {
  rows.forEach((row) => {
    const item = itemsByCode.get(row.itemCode)

    if (!item || item.children.length > 0) {
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
    }

    if (item.pricingMethod !== 'manual_price' && !row.unitCostProvided) {
      issues.push({
        row: row.row,
        column: 'unit_cost',
        code: 'missing_leaf_unit_cost',
      })
    }

    if (item.pricingMethod !== 'manual_price' && !row.currencyProvided) {
      issues.push({
        row: row.row,
        column: 'cost_currency',
        code: 'missing_leaf_currency',
      })
    }
  })
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
    case 'invalid_headers':
      return translate('quotations.csv.errors.invalidHeaders', {
        headers: issue.context?.headers ?? '',
      })
    case 'invalid_item_code':
      return translate('quotations.csv.errors.invalidItemCode')
    case 'missing_item_name':
      return translate('quotations.csv.errors.missingItemName')
    case 'invalid_number':
      return translate('quotations.csv.errors.invalidNumber', {
        column: issue.column ? translate(`quotations.csv.columns.${issue.column}`) : '',
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
  }
}

export function formatCsvImportIssueForAgent(issue: CsvImportIssue) {
  const column = issue.column ? ` ${issue.column}` : ''

  switch (issue.code) {
    case 'empty_file':
      return `Row ${issue.row}: CSV file is empty`
    case 'invalid_headers':
      return `Row ${issue.row}: invalid CSV headers`
    case 'invalid_item_code':
      return `Row ${issue.row}: item_code must be like 1, 1.1, or 1.1.1`
    case 'missing_item_name':
      return `Row ${issue.row}: item_name is required`
    case 'invalid_number':
      return `Row ${issue.row}:${column} must be numeric`
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
  }
}

function parseCsv(content: string) {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let insideQuotes = false

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
        continue
      }

      currentCell += character
      continue
    }

    if (character === '"') {
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
      continue
    }

    if (character !== '\r') {
      currentCell += character
    }
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

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function parseCurrencyCell(value: string): CurrencyCode | null {
  return parseCurrencyCode(value)
}

function getHeaderMode(headers: string[]): CsvHeaderMode | null {
  if (headers.length === expectedHeaders.length && headers.every((header, index) => header === expectedHeaders[index])) {
    return 'current'
  }

  if (
    headers.length === pricingBasisExpectedHeaders.length
    && headers.every((header, index) => header === pricingBasisExpectedHeaders[index])
  ) {
    return 'pricing_basis'
  }

  if (
    headers.length === taxClassExpectedHeaders.length
    && headers.every((header, index) => header === taxClassExpectedHeaders[index])
  ) {
    return 'tax_class'
  }

  if (
    headers.length === legacyExpectedHeaders.length
    && headers.every((header, index) => header === legacyExpectedHeaders[index])
  ) {
    return 'legacy'
  }

  return null
}

function getHeadersForMode(headerMode: CsvHeaderMode) {
  switch (headerMode) {
    case 'current':
      return expectedHeaders
    case 'pricing_basis':
      return pricingBasisExpectedHeaders
    case 'tax_class':
      return taxClassExpectedHeaders
    case 'legacy':
      return legacyExpectedHeaders
  }
}

function createCsvImportParseState(rows: string[][], headerMode: CsvHeaderMode): CsvImportParseState {
  const headers = getHeadersForMode(headerMode)
  const reservedRootCodes = new Set<number>()

  rows.forEach((row) => {
    const cells = headers.reduce<Record<string, string>>(
      (result, header, index) => {
        result[header] = (row[index] ?? '').trim()
        return result
      },
      createEmptyCells(),
    )

    if (Object.values(cells).every((value) => value.length === 0)) {
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
