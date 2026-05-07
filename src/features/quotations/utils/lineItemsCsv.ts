import type { CurrencyCode, QuotationItem, QuotationRootItem, TaxClass } from '../types'
import { parseCurrencyCode } from './currencyCodes'
import { getQuotationRootItems } from './quotationItems'

const expectedHeaders = [
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

export class CsvImportError extends Error {
  issues: CsvImportIssue[]

  constructor(issues: CsvImportIssue[]) {
    super('csv_import_failed')
    this.name = 'CsvImportError'
    this.issues = issues
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
}

type CsvHeaderMode = 'pricing_basis' | 'tax_class' | 'legacy'

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
        escapeCsvCell(getPricingBasisCell(item)),
        formatOptionalCsvNumber(getUnitPriceCell(item)),
        formatOptionalCsvNumber(getUnitCostCell(item)),
        escapeCsvCell(getCostCurrencyCell(item)),
        escapeCsvCell(getTaxClassLabel(item.taxClassId, taxClasses)),
        formatOptionalCsvNumber(item.markupRate),
        formatOptionalCsvNumber(item.expectedTotal),
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
  const rows = parseCsv(content)
  const issues: CsvImportIssue[] = []

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

  const parsedRows = rows
    .slice(1)
    .map((row, index) => parseDataRow(row, index + 2, fallbackCurrency, taxClasses, headerMode, issues))
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
    throw new CsvImportError(issues)
  }

  return roots
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
): ParsedCsvRow | null {
  const headers = headerMode === 'pricing_basis'
    ? expectedHeaders
    : headerMode === 'tax_class'
      ? taxClassExpectedHeaders
      : legacyExpectedHeaders
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

  if (Object.values(cells).every((value) => value.length === 0)) {
    return null
  }

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

  const quantity = parseNumberCell(cells.qty)
  const manualUnitPrice = parseNumberCell(cells.unit_price)
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

  if (cells.unit_price.length > 0 && manualUnitPrice === null) {
    issues.push({
      row: rowNumber,
      column: 'unit_price',
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
    manualUnitPriceProvided: cells.unit_price.length > 0,
    unitCostProvided: cells.unit_cost.length > 0,
    currencyProvided: cells.cost_currency.length > 0,
    markupProvided: cells.markup_override.length > 0,
  })

  const item: QuotationItem = {
    id: crypto.randomUUID(),
    name: cells.item_name,
    description: cells.item_description,
    quantity: quantity ?? 1,
    quantityUnit: cells.qty_unit,
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
    manualUnitPriceProvided: cells.unit_price.length > 0,
    unitCostProvided: cells.unit_cost.length > 0,
    currencyProvided: cells.cost_currency.length > 0,
  }
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
        column: 'unit_price',
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

function hasExpectedHeaders(headers: string[]) {
  return getHeaderMode(headers) !== null
}

function getHeaderMode(headers: string[]): CsvHeaderMode | null {
  if (headers.length === expectedHeaders.length && headers.every((header, index) => header === expectedHeaders[index])) {
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
    unit_cost: '',
    cost_currency: '',
    tax_class: '',
    markup_override: '',
    expected_total: '',
  }
}

function getPricingBasisCell(item: QuotationItem) {
  if (item.children.length > 0) {
    return ''
  }

  return item.pricingMethod ?? 'cost_plus'
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
  unitCostProvided: boolean
  currencyProvided: boolean
  markupProvided: boolean
}): QuotationItem['pricingMethod'] {
  if (options.pricingMethod) {
    return options.pricingMethod
  }

  if (
    options.manualUnitPriceProvided
    && !options.unitCostProvided
    && !options.currencyProvided
    && !options.markupProvided
  ) {
    return 'manual_price'
  }

  return 'cost_plus'
}
