import { strFromU8, unzip } from 'fflate'
import type { UnzipFileFilter } from 'fflate'
import { readSheet } from 'read-excel-file/universal'

import type { CurrencyCode, TaxClass } from '../types'
import { LINE_ITEMS_IMPORT_HEADERS, parseLineItemsRowsImport } from './lineItemsCsv'
import type { ParsedLineItemsCsv } from './lineItemsCsv'

const IMPORT_SHEET_NAME = 'Import Data'
const WORKBOOK_PATH = 'xl/workbook.xml'
const WORKBOOK_RELATIONSHIPS_PATH = 'xl/_rels/workbook.xml.rels'
const MAX_XLSX_FILE_BYTES = 10 * 1024 * 1024
const MAX_XLSX_XML_BYTES = 16 * 1024 * 1024
const XML_ENTITY_PATTERN = /&#x([0-9a-f]+);|&#(\d+);|&(amp|apos|gt|lt|quot);/gi
const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: '\'',
  gt: '>',
  lt: '<',
  quot: '"',
}

type XlsxImportErrorCode =
  | 'invalid_workbook'
  | 'missing_import_sheet'
  | 'invalid_headers'
  | 'unsupported_cell_type'
  | 'unsupported_formula'

export class XlsxImportError extends Error {
  constructor(
    public readonly code: XlsxImportErrorCode,
    public readonly row = 1,
    public readonly column?: string,
  ) {
    super(code)
    this.name = 'XlsxImportError'
  }
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export function formatXlsxImportError(error: unknown, t: TranslateFn) {
  if (!(error instanceof XlsxImportError)) {
    return t('quotations.xlsx.errors.invalidWorkbook')
  }

  if (error.code === 'missing_import_sheet') {
    return t('quotations.xlsx.errors.missingImportSheet', { sheet: IMPORT_SHEET_NAME })
  }

  if (error.code === 'unsupported_cell_type') {
    return t('quotations.xlsx.errors.unsupportedCellType', { cell: error.column ?? '-' })
  }

  if (error.code === 'unsupported_formula') {
    return t('quotations.xlsx.errors.unsupportedFormula', { cell: error.column ?? '-' })
  }

  if (error.code === 'invalid_headers') {
    return t('quotations.xlsx.errors.invalidHeaders')
  }

  return t('quotations.xlsx.errors.invalidWorkbook')
}

export async function parseLineItemsXlsxImport(
  content: Uint8Array,
  fallbackCurrency: CurrencyCode,
  taxClasses: TaxClass[] = [],
): Promise<ParsedLineItemsCsv> {
  if (content.byteLength > MAX_XLSX_FILE_BYTES) {
    throw new XlsxImportError('invalid_workbook')
  }

  let worksheetInspection: WorksheetInspection

  try {
    worksheetInspection = await inspectImportSheet(content)
  } catch (error) {
    if (error instanceof XlsxImportError) throw error
    throw new XlsxImportError('invalid_workbook')
  }

  if (worksheetInspection.formulaCell) {
    throw new XlsxImportError(
      'unsupported_formula',
      worksheetInspection.formulaCell.row,
      worksheetInspection.formulaCell.address,
    )
  }

  let sheetData: unknown[][]
  try {
    sheetData = await readSheet(Uint8Array.from(content).buffer, IMPORT_SHEET_NAME)
  } catch {
    throw new XlsxImportError('invalid_workbook')
  }

  const rows = sheetData.map((row, rowIndex) =>
    row.map((cell, columnIndex) => normalizeCell(
      cell,
      rowIndex,
      columnIndex,
      worksheetInspection.percentageCells,
    )),
  )

  if (!hasExactHeaders(rows[0])) {
    throw new XlsxImportError('invalid_headers')
  }

  return parseLineItemsRowsImport(rows, fallbackCurrency, taxClasses)
}

function hasExactHeaders(row: string[] | undefined) {
  return row?.length === LINE_ITEMS_IMPORT_HEADERS.length
    && LINE_ITEMS_IMPORT_HEADERS.every((header, index) => row[index] === header)
}

function normalizeCell(
  cell: unknown,
  rowIndex: number,
  columnIndex: number,
  percentageCells: Set<string>,
) {
  if (cell === null) return ''
  if (typeof cell === 'string') return decodeXmlEntities(cell)
  if (typeof cell === 'number') {
    return percentageCells.has(createCellAddress(rowIndex, columnIndex))
      ? formatPercentagePoints(cell)
      : String(cell)
  }

  throw new XlsxImportError(
    'unsupported_cell_type',
    rowIndex + 1,
    createCellAddress(rowIndex, columnIndex),
  )
}

interface FormulaCell {
  address: string
  row: number
}

interface WorksheetInspection {
  formulaCell: FormulaCell | null
  percentageCells: Set<string>
}

async function inspectImportSheet(content: Uint8Array): Promise<WorksheetInspection> {
  let xmlBytes = 0
  let exceedsXmlLimit = false
  const metadataFiles = await unzipFiles(content, ({ name, originalSize }) => {
    if (name.endsWith('.xml') || name.endsWith('.xml.rels')) {
      xmlBytes += originalSize
      exceedsXmlLimit ||= xmlBytes > MAX_XLSX_XML_BYTES
    }

    return !exceedsXmlLimit
      && (name === WORKBOOK_PATH || name === WORKBOOK_RELATIONSHIPS_PATH)
  })

  if (exceedsXmlLimit) {
    throw new Error('Workbook XML exceeds the import limit')
  }

  const workbookXml = readWorkbookXmlFile(metadataFiles, WORKBOOK_PATH)
  const relationshipsXml = readWorkbookXmlFile(metadataFiles, WORKBOOK_RELATIONSHIPS_PATH)
  const sheetTag = findXmlTags(workbookXml, 'sheet').find((tag) =>
    decodeXmlEntities(getXmlAttribute(tag, 'name') ?? '') === IMPORT_SHEET_NAME,
  )

  if (!sheetTag) {
    throw new XlsxImportError('missing_import_sheet')
  }

  const relationshipId = getXmlAttribute(sheetTag, 'r:id')
  if (!relationshipId) throw new Error('Import sheet relationship not found')

  const relationshipTag = findXmlTags(relationshipsXml, 'Relationship').find((tag) =>
    getXmlAttribute(tag, 'Id') === relationshipId,
  )
  const target = relationshipTag ? getXmlAttribute(relationshipTag, 'Target') : undefined

  if (!target || getXmlAttribute(relationshipTag ?? '', 'TargetMode') === 'External') {
    throw new Error('Import sheet path not found')
  }

  const worksheetPath = resolveWorkbookRelationshipTarget(target)
  const stylesRelationshipTag = findXmlTags(relationshipsXml, 'Relationship').find((tag) =>
    (getXmlAttribute(tag, 'Type') ?? '').endsWith('/styles')
    && getXmlAttribute(tag, 'TargetMode') !== 'External',
  )
  const stylesTarget = stylesRelationshipTag
    ? getXmlAttribute(stylesRelationshipTag, 'Target')
    : undefined
  const stylesPath = stylesTarget ? resolveWorkbookRelationshipTarget(stylesTarget) : null
  const worksheetFiles = await unzipFiles(content, ({ name }) =>
    name === worksheetPath || name === stylesPath,
  )
  const worksheetXml = readWorkbookXmlFile(worksheetFiles, worksheetPath)
  const stylesXml = stylesPath ? readWorkbookXmlFile(worksheetFiles, stylesPath) : undefined
  return inspectWorksheetXml(worksheetXml, stylesXml)
}

function inspectWorksheetXml(worksheetXml: string, stylesXml?: string): WorksheetInspection {
  const percentageStyleIndexes = stylesXml
    ? findPercentageStyleIndexes(stylesXml)
    : new Set<number>()
  const percentageCells = new Set<string>()
  const cellPattern = /<(?:[a-z_][\w.-]*:)?c\b([^>]*)>([\s\S]*?)<\/(?:[a-z_][\w.-]*:)?c\s*>/gi
  const formulaPattern = /<(?:[a-z_][\w.-]*:)?f(?:\s[^>]*)?\/?>/i

  for (const match of worksheetXml.matchAll(cellPattern)) {
    const address = getXmlAttribute(match[1] ?? '', 'r')
    const cellContent = match[2] ?? ''

    if (formulaPattern.test(cellContent)) {
      const row = address?.match(/\d+$/)?.[0]

      if (!address || !row) {
        throw new Error('Formula cell address not found')
      }

      return {
        formulaCell: {
          address,
          row: Number(row),
        },
        percentageCells,
      }
    }

    const styleIndex = Number.parseInt(getXmlAttribute(match[1] ?? '', 's') ?? '0', 10)
    if (address && /^I\d+$/i.test(address) && percentageStyleIndexes.has(styleIndex)) {
      percentageCells.add(address.toUpperCase())
    }
  }

  return {
    formulaCell: null,
    percentageCells,
  }
}

function unzipFiles(content: Uint8Array, filter: UnzipFileFilter) {
  return new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(content, { filter }, (error, files) => {
      if (error) reject(error)
      else resolve(files)
    })
  })
}

function readWorkbookXmlFile(files: Record<string, Uint8Array>, filePath: string) {
  const content = files[filePath]
  if (!content) {
    throw new Error(`Workbook file not found: ${filePath}`)
  }

  return strFromU8(content)
}

function findXmlTags(xml: string, localName: string) {
  const escapedName = escapeRegExp(localName)
  return xml.match(new RegExp(`<(?:[a-z_][\\w.-]*:)?${escapedName}\\b[^>]*\\/?>`, 'gi')) ?? []
}

function findXmlElementContent(xml: string, localName: string) {
  const escapedName = escapeRegExp(localName)
  return new RegExp(
    `<(?:[a-z_][\\w.-]*:)?${escapedName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-z_][\\w.-]*:)?${escapedName}\\s*>`,
    'i',
  ).exec(xml)?.[1]
}

function findPercentageStyleIndexes(stylesXml: string) {
  const percentageFormatIds = new Set([9, 10])

  for (const tag of findXmlTags(stylesXml, 'numFmt')) {
    const id = Number.parseInt(getXmlAttribute(tag, 'numFmtId') ?? '', 10)
    const formatCode = decodeXmlEntities(getXmlAttribute(tag, 'formatCode') ?? '')

    if (Number.isInteger(id) && hasPercentageToken(formatCode)) {
      percentageFormatIds.add(id)
    }
  }

  const cellXfs = findXmlElementContent(stylesXml, 'cellXfs')
  if (!cellXfs) return new Set<number>()

  const percentageStyleIndexes = new Set<number>()
  findXmlTags(cellXfs, 'xf').forEach((tag, index) => {
    const formatId = Number.parseInt(getXmlAttribute(tag, 'numFmtId') ?? '0', 10)
    if (percentageFormatIds.has(formatId)) {
      percentageStyleIndexes.add(index)
    }
  })

  return percentageStyleIndexes
}

function hasPercentageToken(formatCode: string) {
  let insideQuotes = false

  for (let index = 0; index < formatCode.length; index += 1) {
    const character = formatCode[index]

    if (character === '"') {
      insideQuotes = !insideQuotes
      continue
    }

    if (!insideQuotes && (character === '\\' || character === '_' || character === '*')) {
      index += 1
      continue
    }

    if (!insideQuotes && character === '%') {
      return true
    }
  }

  return false
}

function getXmlAttribute(tag: string, attributeName: string) {
  const escapedName = escapeRegExp(attributeName)
  const match = new RegExp(`(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)
  return match?.[1] ?? match?.[2]
}

function resolveWorkbookRelationshipTarget(target: string) {
  const unresolvedPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`
  const segments: string[] = []

  for (const segment of unresolvedPath.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (segments.length === 0) throw new Error('Invalid workbook relationship path')
      segments.pop()
      continue
    }
    segments.push(segment)
  }

  return segments.join('/')
}

function decodeXmlEntities(value: string) {
  return value.replace(
    XML_ENTITY_PATTERN,
    (match, hexCode: string | undefined, decimalCode: string | undefined, entityName: string | undefined) => {
      if (entityName) {
        return XML_ENTITIES[entityName.toLowerCase()] ?? match
      }

      const codePoint = Number.parseInt(hexCode ?? decimalCode ?? '', hexCode ? 16 : 10)
      return isValidXmlCodePoint(codePoint) ? String.fromCodePoint(codePoint) : match
    },
  )
}

function isValidXmlCodePoint(value: number) {
  return value === 0x09
    || value === 0x0A
    || value === 0x0D
    || (value >= 0x20 && value <= 0xD7FF)
    || (value >= 0xE000 && value <= 0xFFFD)
    || (value >= 0x10000 && value <= 0x10FFFF)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createCellAddress(rowIndex: number, columnIndex: number) {
  let columnName = ''
  let remaining = columnIndex + 1

  while (remaining > 0) {
    remaining -= 1
    columnName = String.fromCharCode(65 + (remaining % 26)) + columnName
    remaining = Math.floor(remaining / 26)
  }

  return `${columnName}${rowIndex + 1}`
}

function formatPercentagePoints(value: number) {
  const scaledValue = value * 100
  return Number.isFinite(scaledValue)
    ? String(Number(scaledValue.toPrecision(15)))
    : String(value)
}
