import type {
  QuotationDraft,
  QuotationHeader,
  QuotationItem,
  QuotationItemField,
  QuotationRootItem,
  QuotationSectionHeader,
  TotalsConfig,
} from '../types'
import { isQuotationItem, isQuotationSectionHeader } from './quotationItems'

type FieldChangedSummary = {
  kind: 'fieldChanged'
  target: string
  fieldLabelKey: string
  previousValue: string
  nextValue: string
}

type ItemFieldChangedSummary = {
  kind: 'itemFieldChanged'
  target: string
  itemName: string
  fieldLabelKey: string
  previousValue: string
  nextValue: string
}

type ItemAddedRemovedSummary = {
  kind: 'itemAdded' | 'itemRemoved'
  target: string
  itemName: string
}

type FallbackSummary = {
  kind: 'fallback'
}

export type QuotationHistoryChangeSummary =
  | FieldChangedSummary
  | ItemFieldChangedSummary
  | ItemAddedRemovedSummary
  | FallbackSummary

type HeaderField = keyof Pick<
  QuotationHeader,
  | 'quotationNumber'
  | 'quotationDate'
  | 'customerCompany'
  | 'contactPerson'
  | 'contactDetails'
  | 'projectName'
  | 'validityPeriod'
  | 'currency'
  | 'documentLocale'
  | 'notes'
  | 'terms'
>

type TotalsField = keyof Pick<
  TotalsConfig,
  'globalMarkupRate' | 'discountMode' | 'discountValue' | 'taxMode' | 'taxRate'
>

interface HistoryRow {
  id: string
  name: string
  row: QuotationItem | QuotationSectionHeader
}

const HEADER_FIELDS: readonly [HeaderField, string][] = [
  ['projectName', 'quotations.history.fields.projectName'],
  ['customerCompany', 'quotations.history.fields.customerCompany'],
  ['contactPerson', 'quotations.history.fields.contactPerson'],
  ['contactDetails', 'quotations.history.fields.contactDetails'],
  ['quotationNumber', 'quotations.history.fields.quotationNumber'],
  ['quotationDate', 'quotations.history.fields.quotationDate'],
  ['validityPeriod', 'quotations.history.fields.validityPeriod'],
  ['currency', 'quotations.history.fields.currency'],
  ['documentLocale', 'quotations.history.fields.documentLocale'],
  ['notes', 'quotations.history.fields.notes'],
  ['terms', 'quotations.history.fields.terms'],
]

const ITEM_FIELDS: readonly [QuotationItemField, string][] = [
  ['name', 'quotations.history.fields.itemName'],
  ['description', 'quotations.history.fields.description'],
  ['quantity', 'quotations.history.fields.quantity'],
  ['quantityUnit', 'quotations.history.fields.quantityUnit'],
  ['pricingMethod', 'quotations.history.fields.pricingMethod'],
  ['manualUnitPrice', 'quotations.history.fields.manualUnitPrice'],
  ['unitCost', 'quotations.history.fields.unitCost'],
  ['costCurrency', 'quotations.history.fields.costCurrency'],
  ['markupRate', 'quotations.history.fields.markupRate'],
  ['taxClassId', 'quotations.history.fields.taxClass'],
  ['expectedTotal', 'quotations.history.fields.expectedTotal'],
  ['notes', 'quotations.history.fields.itemNotes'],
]

const TOTALS_FIELDS: readonly [TotalsField, string][] = [
  ['globalMarkupRate', 'quotations.history.fields.globalMarkupRate'],
  ['discountMode', 'quotations.history.fields.discountMode'],
  ['discountValue', 'quotations.history.fields.discountValue'],
  ['taxMode', 'quotations.history.fields.taxMode'],
  ['taxRate', 'quotations.history.fields.taxRate'],
]

export function describeQuotationHistoryChange(
  before: QuotationDraft,
  after: QuotationDraft,
): QuotationHistoryChangeSummary {
  const itemChange = describeItemChange(before.majorItems, after.majorItems)
  if (itemChange) {
    return itemChange
  }

  const headerChange = describeFieldChange(
    before.header,
    after.header,
    HEADER_FIELDS,
    (field) => `header:${String(field)}`,
  )
  if (headerChange) {
    return headerChange
  }

  const totalsChange = describeFieldChange(
    before.totalsConfig,
    after.totalsConfig,
    TOTALS_FIELDS,
    (field) => `totals:${String(field)}`,
  )
  if (totalsChange) {
    return totalsChange
  }

  const exchangeRateChange = describeExchangeRateChange(before, after)
  if (exchangeRateChange) {
    return exchangeRateChange
  }

  return { kind: 'fallback' }
}

function describeItemChange(
  beforeItems: QuotationRootItem[],
  afterItems: QuotationRootItem[],
): QuotationHistoryChangeSummary | null {
  const beforeRows = collectHistoryRows(beforeItems)
  const afterRows = collectHistoryRows(afterItems)

  for (const [id, afterRow] of afterRows) {
    if (!beforeRows.has(id)) {
      return {
        kind: 'itemAdded',
        target: getItemHistoryTarget(id),
        itemName: afterRow.name,
      }
    }
  }

  for (const [id, beforeRow] of beforeRows) {
    if (!afterRows.has(id)) {
      return {
        kind: 'itemRemoved',
        target: getItemHistoryTarget(id),
        itemName: beforeRow.name,
      }
    }
  }

  for (const [id, beforeRow] of beforeRows) {
    const afterRow = afterRows.get(id)
    if (!afterRow) {
      continue
    }

    if (isQuotationSectionHeader(beforeRow.row) && isQuotationSectionHeader(afterRow.row)) {
      const sectionChange = describeValueChange(
        beforeRow.row.title,
        afterRow.row.title,
        'quotations.history.fields.sectionTitle',
        getItemHistoryTarget(id, 'sectionTitle'),
      )
      if (sectionChange) {
        return {
          kind: 'itemFieldChanged',
          target: sectionChange.target,
          itemName: afterRow.name || beforeRow.name,
          fieldLabelKey: sectionChange.fieldLabelKey,
          previousValue: sectionChange.previousValue,
          nextValue: sectionChange.nextValue,
        }
      }
      continue
    }

    if (!isQuotationItem(beforeRow.row) || !isQuotationItem(afterRow.row)) {
      continue
    }

    const itemChange = describeFieldChange(
      beforeRow.row,
      afterRow.row,
      ITEM_FIELDS,
      (field) => getItemHistoryTarget(id, field),
    )
    if (itemChange) {
      return {
        kind: 'itemFieldChanged',
        target: itemChange.target,
        itemName: afterRow.name || beforeRow.name,
        fieldLabelKey: itemChange.fieldLabelKey,
        previousValue: itemChange.previousValue,
        nextValue: itemChange.nextValue,
      }
    }
  }

  return null
}

function describeFieldChange<T extends object, K extends keyof T>(
  before: T,
  after: T,
  fields: readonly [K, string][],
  getTarget: (field: K) => string,
): FieldChangedSummary | null {
  for (const [field, fieldLabelKey] of fields) {
    const change = describeValueChange(before[field], after[field], fieldLabelKey, getTarget(field))
    if (change) {
      return change
    }
  }

  return null
}

function describeValueChange(
  beforeValue: unknown,
  afterValue: unknown,
  fieldLabelKey: string,
  target: string,
): FieldChangedSummary | null {
  if (Object.is(beforeValue, afterValue)) {
    return null
  }

  return {
    kind: 'fieldChanged',
    target,
    fieldLabelKey,
    previousValue: formatHistoryValue(beforeValue),
    nextValue: formatHistoryValue(afterValue),
  }
}

function describeExchangeRateChange(
  before: QuotationDraft,
  after: QuotationDraft,
): FieldChangedSummary | null {
  const currencies = new Set([
    ...Object.keys(before.exchangeRates),
    ...Object.keys(after.exchangeRates),
  ])

  for (const currency of [...currencies].sort()) {
    const beforeRate = before.exchangeRates[currency]
    const afterRate = after.exchangeRates[currency]

    if (Object.is(beforeRate, afterRate)) {
      continue
    }

    return {
      kind: 'fieldChanged',
      target: `exchangeRate:${currency}`,
      fieldLabelKey: 'quotations.history.fields.exchangeRate',
      previousValue: formatCurrencyRate(currency, beforeRate),
      nextValue: formatCurrencyRate(currency, afterRate),
    }
  }

  return null
}

function getItemHistoryTarget(itemId: string, field?: string) {
  return field ? `item:${itemId}:${field}` : `item:${itemId}`
}

function collectHistoryRows(items: QuotationRootItem[]) {
  const rows = new Map<string, HistoryRow>()

  for (const item of items) {
    collectHistoryRow(item, rows)
  }

  return rows
}

function collectHistoryRow(row: QuotationRootItem | QuotationItem, rows: Map<string, HistoryRow>) {
  if (isQuotationSectionHeader(row)) {
    rows.set(row.id, {
      id: row.id,
      name: row.title,
      row,
    })
    return
  }

  if (!isQuotationItem(row)) {
    return
  }

  rows.set(row.id, {
    id: row.id,
    name: row.name,
    row,
  })

  for (const child of row.children) {
    collectHistoryRow(child, rows)
  }
}

function formatCurrencyRate(currency: string, rate: number | undefined) {
  if (rate === undefined) {
    return currency
  }

  return `${currency} ${formatHistoryValue(rate)}`
}

function formatHistoryValue(value: unknown) {
  if (value === undefined || value === null) {
    return ''
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Number(value.toFixed(4))) : ''
  }

  return String(value)
}
