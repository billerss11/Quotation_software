export interface QuotationDocumentColumnContent {
  kind: 'money' | 'text'
  header: string
  values: string[]
}

export interface QuotationDocumentTableLayout {
  compactPriceBreakdown: boolean
  quantityColumnWidth: number
  unitColumnWidth: number
  taxColumnWidth: number
  moneyColumnWidth: number
}

const PORTRAIT_TABLE_WIDTH = 734
const LANDSCAPE_TABLE_WIDTH = 1_063
const MIN_PORTRAIT_DESCRIPTION_WIDTH = 210
const MIN_LANDSCAPE_DESCRIPTION_WIDTH = 230
const NUMBER_COLUMN_WIDTH = 44
const MIN_QUANTITY_COLUMN_WIDTH = 54
const MAX_QUANTITY_COLUMN_WIDTH = 90
const UNIT_COLUMN_WIDTH = 68
const MIN_TAX_COLUMN_WIDTH = 72
const MIN_MONEY_COLUMN_WIDTH = 88
const CELL_HORIZONTAL_SPACE = 16
const DOCUMENT_TEXT_SIZE = 10.67

export function getQuotationDocumentTableLayout(
  columns: readonly QuotationDocumentColumnContent[],
  quantities: readonly string[],
): QuotationDocumentTableLayout {
  const usesLandscapePage = columns.length >= 5
  const availableWidth = usesLandscapePage ? LANDSCAPE_TABLE_WIDTH : PORTRAIT_TABLE_WIDTH
  const descriptionWidth = usesLandscapePage
    ? MIN_LANDSCAPE_DESCRIPTION_WIDTH
    : MIN_PORTRAIT_DESCRIPTION_WIDTH
  const quantityColumnWidth = Math.min(
    MAX_QUANTITY_COLUMN_WIDTH,
    Math.max(MIN_QUANTITY_COLUMN_WIDTH, estimateColumnWidth(quantities)),
  )
  const minimumMoneyColumnWidth = columns.length <= 2 ? 124 : MIN_MONEY_COLUMN_WIDTH
  const minimumTaxColumnWidth = columns.length <= 2 ? 58 : MIN_TAX_COLUMN_WIDTH
  const moneyColumnWidth = Math.max(
    minimumMoneyColumnWidth,
    ...columns
      .filter((column) => column.kind === 'money')
      .flatMap((column) => [estimateColumnWidth([column.header, ...column.values])]),
  )
  const taxColumnWidth = Math.max(
    minimumTaxColumnWidth,
    ...columns
      .filter((column) => column.kind === 'text')
      .flatMap((column) => [Math.min(88, estimateColumnWidth([column.header, ...column.values]))]),
  )
  const requiredPriceWidth = columns.reduce(
    (total, column) => total + (column.kind === 'money' ? moneyColumnWidth : taxColumnWidth),
    0,
  )
  const requiredWidth = NUMBER_COLUMN_WIDTH
    + quantityColumnWidth
    + UNIT_COLUMN_WIDTH
    + descriptionWidth
    + requiredPriceWidth

  return {
    compactPriceBreakdown: requiredWidth > availableWidth,
    quantityColumnWidth,
    unitColumnWidth: UNIT_COLUMN_WIDTH,
    taxColumnWidth,
    moneyColumnWidth,
  }
}

export function getSingleTaxMoneyColumnWidth(values: readonly string[]) {
  return Math.min(160, Math.max(128, estimateColumnWidth(values)))
}

function estimateColumnWidth(values: readonly string[]) {
  const widestText = Math.max(0, ...values.map((value) => estimateTextWidth(value)))
  return Math.ceil(widestText + CELL_HORIZONTAL_SPACE)
}

function estimateTextWidth(value: string) {
  const emWidth = Array.from(value).reduce((width, character) => {
    if (/\p{Script=Han}/u.test(character)) return width + 1
    if (/[A-ZMW@%]/.test(character)) return width + 0.7
    if (/[0-9a-z]/.test(character)) return width + 0.58
    if (/[,.:;()\-+\/]/.test(character)) return width + 0.34
    return width + 0.5
  }, 0)

  return emWidth * DOCUMENT_TEXT_SIZE
}
