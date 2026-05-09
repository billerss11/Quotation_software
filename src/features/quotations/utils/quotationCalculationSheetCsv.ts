import type { CalculationSheetRow } from './quotationCalculationSheetRows'

export interface CalculationSheetCsvLabels {
  groups: {
    item: string
    inputs: string
    unit: string
    total: string
  }
  columns: {
    number: string
    name: string
    quantity: string
    unit: string
    costCurrency: string
    markupRate: string
    taxClass: string
    taxRate: string
    cost: string
    markup: string
    price: string
    tax: string
    total: string
    subtotalExcludingTax: string
  }
  rollup: string
  taxClassMixed: string
  costCurrencyMixed: string
  manualPrice: string
  globalRate: (rate: string) => string
  inheritedRate: (rate: string, source: string) => string
}

export interface CreateCalculationSheetCsvContentOptions {
  rows: CalculationSheetRow[]
  currency: string
  includeTaxClass: boolean
  labels: CalculationSheetCsvLabels
}

type CsvColumn = {
  header: string
  value: (row: CalculationSheetRow) => string | number
}

export function createCalculationSheetCsvContent(options: CreateCalculationSheetCsvContentOptions) {
  const columns = createColumns(options)
  const lines = [
    columns.map((column) => escapeCsvCell(column.header)).join(','),
    ...options.rows.map((row) => columns.map((column) => escapeCsvCell(column.value(row))).join(',')),
  ]

  return `\uFEFF${lines.join('\n')}`
}

function createColumns(options: CreateCalculationSheetCsvContentOptions): CsvColumn[] {
  const { labels, currency, includeTaxClass } = options
  const amountHeader = (group: string, label: string) => createHeader(group, `${label} (${currency})`)
  const columns: CsvColumn[] = [
    { header: createHeader(labels.groups.item, labels.columns.number), value: (row) => row.itemNumber },
    { header: createHeader(labels.groups.item, labels.columns.name), value: (row) => row.name },
    { header: createHeader(labels.groups.inputs, labels.columns.quantity), value: (row) => formatQuantity(row.quantity) },
    { header: createHeader(labels.groups.inputs, labels.columns.unit), value: (row) => row.quantityUnit },
    { header: createHeader(labels.groups.inputs, labels.columns.costCurrency), value: (row) => formatFx(row, labels) },
    { header: createHeader(labels.groups.inputs, labels.columns.markupRate), value: (row) => formatMarkupRate(row, labels) },
  ]

  if (includeTaxClass) {
    columns.push({
      header: createHeader(labels.groups.inputs, labels.columns.taxClass),
      value: (row) => formatTaxClass(row, labels),
    })
  }

  columns.push(
    { header: createHeader(labels.groups.inputs, labels.columns.taxRate), value: (row) => formatRate(row.taxRate ?? row.effectiveTaxRate) },
    { header: amountHeader(labels.groups.unit, labels.columns.cost), value: (row) => formatMoney(row.unitCost) },
    { header: amountHeader(labels.groups.unit, labels.columns.markup), value: (row) => formatMoney(row.unitMarkupAmount) },
    { header: amountHeader(labels.groups.unit, labels.columns.price), value: (row) => formatMoney(row.unitPrice) },
    { header: amountHeader(labels.groups.unit, labels.columns.tax), value: (row) => formatMoney(row.unitTaxAmount) },
    { header: amountHeader(labels.groups.unit, labels.columns.total), value: (row) => formatMoney(row.unitTotalWithTax) },
    { header: amountHeader(labels.groups.total, labels.columns.cost), value: (row) => formatMoney(row.totalCost) },
    { header: amountHeader(labels.groups.total, labels.columns.markup), value: (row) => formatMoney(row.totalMarkupAmount) },
    { header: amountHeader(labels.groups.total, labels.columns.subtotalExcludingTax), value: (row) => formatMoney(row.subtotal) },
    { header: amountHeader(labels.groups.total, labels.columns.tax), value: (row) => formatMoney(row.totalTaxAmount) },
    { header: amountHeader(labels.groups.total, labels.columns.total), value: (row) => formatMoney(row.totalWithTax) },
  )

  return columns
}

function createHeader(group: string, column: string) {
  return `${group} - ${column}`
}

function formatFx(row: CalculationSheetRow, labels: CalculationSheetCsvLabels) {
  if (row.hasMixedCostCurrencies) {
    return labels.costCurrencyMixed
  }

  if (row.costCurrency === null) {
    return labels.rollup
  }

  return row.costCurrency
}

function formatMarkupRate(row: CalculationSheetRow, labels: CalculationSheetCsvLabels) {
  if (row.pricingMethod === 'manual_price') {
    return labels.manualPrice
  }

  const rate = formatRate(row.markupRate)

  if (row.markupSource === 'global') {
    return labels.globalRate(rate)
  }

  if (row.markupSource === 'inherited') {
    return labels.inheritedRate(rate, row.markupSourceLabel ?? '-')
  }

  return rate
}

function formatTaxClass(row: CalculationSheetRow, labels: CalculationSheetCsvLabels) {
  return row.hasMixedTaxClasses ? labels.taxClassMixed : row.taxClassLabel ?? ''
}

function formatRate(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return ''
  }

  return `${formatDecimal(value, 4)}%`
}

function formatQuantity(value: number) {
  return formatDecimal(value, 2)
}

function formatMoney(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

function formatDecimal(value: number, maximumFractionDigits: number) {
  if (!Number.isFinite(value)) {
    return '0'
  }

  return Number(value.toFixed(maximumFractionDigits)).toString()
}

function escapeCsvCell(value: string | number) {
  const cell = String(value)

  if (!/[",\r\n]/.test(cell)) {
    return cell
  }

  return `"${cell.replace(/"/g, '""')}"`
}
