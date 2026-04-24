import type { CurrencyCode, QuotationItem } from '../types'

const expectedHeaders = [
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

export function createLineItemsCsvTemplateContent() {
  return `${expectedHeaders.join(',')}\n`
}

export interface CsvImportIssue {
  row: number
  column?: string
  message: string
}

export class CsvImportError extends Error {
  issues: CsvImportIssue[]

  constructor(issues: CsvImportIssue[]) {
    super(createCsvImportMessage(issues))
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
  unitCostProvided: boolean
  currencyProvided: boolean
}

export function parseLineItemsCsvContent(content: string, fallbackCurrency: CurrencyCode): QuotationItem[] {
  const rows = parseCsv(content)
  const issues: CsvImportIssue[] = []

  if (rows.length === 0) {
    throw new CsvImportError([{ row: 1, message: 'CSV file is empty.' }])
  }

  const headers = rows[0].map((cell, index) => (index === 0 ? removeBom(cell.trim()) : cell.trim()))

  if (!hasExpectedHeaders(headers)) {
    throw new CsvImportError([
      {
        row: 1,
        message: `CSV columns must exactly match: ${expectedHeaders.join(', ')}`,
      },
    ])
  }

  const parsedRows = rows
    .slice(1)
    .map((row, index) => parseDataRow(row, index + 2, fallbackCurrency, issues))
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
        message: `Parent item_code ${parentCode} is missing.`,
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

export function formatCsvImportError(error: unknown) {
  if (!(error instanceof CsvImportError)) {
    return error instanceof Error ? error.message : 'Could not import CSV file'
  }

  const firstIssue = error.issues[0]

  if (!firstIssue) {
    return error.message
  }

  const remainingCount = error.issues.length - 1
  const rowPrefix = firstIssue.row ? `Row ${firstIssue.row}` : 'CSV'
  const detail = firstIssue.column ? `${firstIssue.column}: ${firstIssue.message}` : firstIssue.message

  return remainingCount > 0 ? `${rowPrefix} ${detail} (+${remainingCount} more)` : `${rowPrefix} ${detail}`
}

function parseDataRow(
  row: string[],
  rowNumber: number,
  fallbackCurrency: CurrencyCode,
  issues: CsvImportIssue[],
): ParsedCsvRow | null {
  const cells = expectedHeaders.reduce<Record<(typeof expectedHeaders)[number], string>>(
    (result, header, index) => {
      result[header] = (row[index] ?? '').trim()
      return result
    },
    {
      item_code: '',
      item_name: '',
      item_description: '',
      qty: '',
      qty_unit: '',
      unit_cost: '',
      cost_currency: '',
      markup_override: '',
      expected_total: '',
    },
  )

  if (Object.values(cells).every((value) => value.length === 0)) {
    return null
  }

  const segments = parseItemCode(cells.item_code)

  if (!segments) {
    issues.push({
      row: rowNumber,
      column: 'item_code',
      message: 'item_code must use numbering like 1, 1.1, or 1.1.1.',
    })
    return null
  }

  if (cells.item_name.length === 0) {
    issues.push({
      row: rowNumber,
      column: 'item_name',
      message: 'item_name is required.',
    })
    return null
  }

  const quantity = parseNumberCell(cells.qty)
  const unitCost = parseNumberCell(cells.unit_cost)
  const markupRate = parseNumberCell(cells.markup_override)
  const expectedTotal = parseNumberCell(cells.expected_total)
  const costCurrency = parseCurrencyCell(cells.cost_currency)

  if (cells.qty.length > 0 && quantity === null) {
    issues.push({
      row: rowNumber,
      column: 'qty',
      message: 'qty must be numeric when provided.',
    })
  }

  if (cells.unit_cost.length > 0 && unitCost === null) {
    issues.push({
      row: rowNumber,
      column: 'unit_cost',
      message: 'unit_cost must be numeric when provided.',
    })
  }

  if (cells.markup_override.length > 0 && markupRate === null) {
    issues.push({
      row: rowNumber,
      column: 'markup_override',
      message: 'markup_override must be numeric when provided.',
    })
  }

  if (cells.expected_total.length > 0 && expectedTotal === null) {
    issues.push({
      row: rowNumber,
      column: 'expected_total',
      message: 'expected_total must be numeric when provided.',
    })
  }

  if (cells.cost_currency.length > 0 && !costCurrency) {
    issues.push({
      row: rowNumber,
      column: 'cost_currency',
      message: 'cost_currency must be one of USD, EUR, CNY, or GBP.',
    })
  }

  const item: QuotationItem = {
    id: crypto.randomUUID(),
    name: cells.item_name,
    description: cells.item_description,
    quantity: quantity ?? 1,
    quantityUnit: cells.qty_unit,
    unitCost: unitCost ?? 0,
    costCurrency: costCurrency ?? fallbackCurrency,
    markupRate: markupRate ?? undefined,
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
        message: 'Leaf rows require a numeric qty value.',
      })
    }

    if (!row.unitCostProvided) {
      issues.push({
        row: row.row,
        column: 'unit_cost',
        message: 'Leaf rows require a numeric unit_cost value.',
      })
    }

    if (!row.currencyProvided) {
      issues.push({
        row: row.row,
        column: 'cost_currency',
        message: 'Leaf rows require a supported cost_currency value.',
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
        message: `Duplicate item_code ${row.itemCode}.`,
      })
      return
    }

    seen.add(row.itemCode)
  })
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
  return value === 'USD' || value === 'EUR' || value === 'CNY' || value === 'GBP' ? value : null
}

function hasExpectedHeaders(headers: string[]) {
  return headers.length === expectedHeaders.length && headers.every((header, index) => header === expectedHeaders[index])
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

function createCsvImportMessage(issues: CsvImportIssue[]) {
  if (issues.length === 0) {
    return 'CSV import failed.'
  }

  const firstIssue = issues[0]
  return firstIssue.column
    ? `CSV import failed: row ${firstIssue.row} ${firstIssue.column} ${firstIssue.message}`
    : `CSV import failed: ${firstIssue.message}`
}

function removeBom(value: string) {
  return value.replace(/^\uFEFF/, '')
}
