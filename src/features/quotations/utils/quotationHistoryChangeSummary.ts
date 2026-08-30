import type { QuotationItem, QuotationItemField } from '../types'

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

type ActionSummary = {
  kind: 'action'
  messageKey: string
  params?: Record<string, string | number>
  target?: string
}

type FallbackSummary = {
  kind: 'fallback'
}

export type QuotationHistoryChangeSummary =
  | FieldChangedSummary
  | ItemFieldChangedSummary
  | ItemAddedRemovedSummary
  | ActionSummary
  | FallbackSummary

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

export function createQuotationItemFieldChangeSummary(
  itemId: string,
  itemName: string,
  field: QuotationItemField,
  beforeValue: QuotationItem[QuotationItemField],
  afterValue: QuotationItem[QuotationItemField],
): QuotationHistoryChangeSummary {
  return {
    kind: 'itemFieldChanged',
    target: getItemHistoryTarget(itemId, field),
    itemName,
    fieldLabelKey: getItemFieldLabelKey(field),
    previousValue: formatHistoryValue(beforeValue),
    nextValue: formatHistoryValue(afterValue),
  }
}

export function createQuotationFieldChangeSummary(
  target: string,
  fieldLabelKey: string,
  beforeValue: unknown,
  afterValue: unknown,
): QuotationHistoryChangeSummary {
  return {
    kind: 'fieldChanged',
    target,
    fieldLabelKey,
    previousValue: formatHistoryValue(beforeValue),
    nextValue: formatHistoryValue(afterValue),
  }
}

export function createQuotationItemAddedRemovedSummary(
  kind: 'itemAdded' | 'itemRemoved',
  itemId: string,
  itemName: string,
): QuotationHistoryChangeSummary {
  return {
    kind,
    target: getItemHistoryTarget(itemId),
    itemName,
  }
}

export function createQuotationActionSummary(
  messageKey: string,
  params?: Record<string, string | number>,
  target?: string,
): QuotationHistoryChangeSummary {
  return {
    kind: 'action',
    messageKey,
    params,
    target,
  }
}

export function formatQuotationHistoryChangeSummary(
  summary: QuotationHistoryChangeSummary,
  translate: (key: string, params?: Record<string, string | number>) => string,
  maxValueCharacters?: number,
) {
  const formatValue = (value: string) => {
    const normalized = value.trim() || translate('common.emptyValue')
    if (!maxValueCharacters || normalized.length <= maxValueCharacters) return normalized
    return `${normalized.slice(0, Math.max(0, maxValueCharacters - 1)).trimEnd()}…`
  }

  if (summary.kind === 'fieldChanged') {
    return translate('quotations.history.fieldChanged', {
      field: translate(summary.fieldLabelKey),
      before: formatValue(summary.previousValue),
      after: formatValue(summary.nextValue),
    })
  }

  if (summary.kind === 'itemFieldChanged') {
    return translate('quotations.history.itemFieldChanged', {
      item: formatValue(summary.itemName),
      field: translate(summary.fieldLabelKey),
      before: formatValue(summary.previousValue),
      after: formatValue(summary.nextValue),
    })
  }

  if (summary.kind === 'itemAdded') {
    return translate('quotations.history.itemAdded', { item: formatValue(summary.itemName) })
  }

  if (summary.kind === 'itemRemoved') {
    return translate('quotations.history.itemRemoved', { item: formatValue(summary.itemName) })
  }

  if (summary.kind === 'action') {
    return translate(summary.messageKey, summary.params)
  }

  return translate('quotations.history.fallback')
}

function getItemHistoryTarget(itemId: string, field?: string) {
  return field ? `item:${itemId}:${field}` : `item:${itemId}`
}

function getItemFieldLabelKey(field: QuotationItemField) {
  return ITEM_FIELDS.find(([candidate]) => candidate === field)?.[1] ?? 'quotations.history.fields.itemName'
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
