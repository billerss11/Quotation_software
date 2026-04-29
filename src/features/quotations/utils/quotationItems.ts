import type { CurrencyCode, QuotationItem } from '../types'
import { parseCurrencyCode } from './currencyCodes'
import {
  getDefaultQuotationChildItemName,
  getDefaultQuotationItemName,
  getDefaultQuotationSiblingItemName,
  getDuplicateItemName,
} from '@/shared/i18n/defaults'
import { DEFAULT_LOCALE, type SupportedLocale } from '@/shared/i18n/locale'

export function createQuotationItem(
  fallbackCurrency: CurrencyCode,
  overrides: Partial<QuotationItem> = {},
  locale: SupportedLocale = DEFAULT_LOCALE,
): QuotationItem {
  return {
    id: overrides.id ?? createId(),
    name: overrides.name ?? getDefaultQuotationItemName(locale),
    description: overrides.description ?? '',
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? 'EA',
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? fallbackCurrency,
    markupRate: overrides.markupRate,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}

export function normalizeQuotationItems(
  items: unknown,
  fallbackCurrency: CurrencyCode,
  locale: SupportedLocale = DEFAULT_LOCALE,
): QuotationItem[] {
  if (!Array.isArray(items)) {
    return []
  }

  return items.flatMap((item) => {
    const normalized = normalizeQuotationItem(item, fallbackCurrency, locale)
    return normalized ? [normalized] : []
  })
}

export function findQuotationItem(items: QuotationItem[], itemId: string): QuotationItem | undefined {
  for (const item of items) {
    if (item.id === itemId) {
      return item
    }

    const child = findQuotationItem(item.children, itemId)

    if (child) {
      return child
    }
  }

  return undefined
}

export function findQuotationItemPath(items: QuotationItem[], itemId: string): QuotationItem[] | null {
  for (const item of items) {
    if (item.id === itemId) {
      return [item]
    }

    const childPath = findQuotationItemPath(item.children, itemId)

    if (childPath) {
      return [item, ...childPath]
    }
  }

  return null
}

export function removeQuotationItem(items: QuotationItem[], itemId: string): QuotationItem[] {
  return items
    .filter((item) => item.id !== itemId)
    .map((item) => ({
      ...item,
      children: removeQuotationItem(item.children, itemId),
    }))
}

export function duplicateQuotationItem(
  item: QuotationItem,
  isRoot = true,
  locale: SupportedLocale = DEFAULT_LOCALE,
): QuotationItem {
  return {
    ...item,
    id: createId(),
    name: isRoot ? getDuplicateItemName(item.name, locale) : item.name,
    children: item.children.map((child) => duplicateQuotationItem(child, false, locale)),
  }
}

function normalizeQuotationItem(
  value: unknown,
  fallbackCurrency: CurrencyCode,
  locale: SupportedLocale,
): QuotationItem | null {
  if (!isRecord(value)) {
    return null
  }

  const rawCostCurrency = parseCurrencyCode(value.costCurrency)
  const costCurrency = rawCostCurrency ?? fallbackCurrency
  const childrenSource = Array.isArray(value.children)
    ? value.children
    : Array.isArray(value.subItems)
      ? value.subItems
      : []
  const normalized: QuotationItem = {
    id: typeof value.id === 'string' && value.id.trim().length > 0 ? value.id : createId(),
    name: getItemName(value, locale),
    description: normalizeText(typeof value.description === 'string' ? value.description : ''),
    quantity: toNumber(value.quantity, 1),
    quantityUnit: normalizeText(typeof value.quantityUnit === 'string' ? value.quantityUnit : ''),
    unitCost: toNumber(value.unitCost, 0),
    costCurrency,
    markupRate: parseOptionalNumber(value.markupRate),
    expectedTotal: parseOptionalNumber(value.expectedTotal),
    notes: normalizeText(typeof value.notes === 'string' ? value.notes : ''),
    children: [],
  }

  normalized.children = normalizeQuotationItems(childrenSource, costCurrency, locale)

  return normalized
}

function getItemName(value: Record<string, unknown>, locale: SupportedLocale) {
  if (typeof value.name === 'string' && value.name.trim().length > 0) {
    return normalizeText(value.name)
  }

  if (typeof value.title === 'string' && value.title.trim().length > 0) {
    return normalizeText(value.title)
  }

  if (typeof value.description === 'string' && value.description.trim().length > 0) {
    return normalizeText(value.description)
  }

  return getDefaultQuotationItemName(locale)
}

function parseOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeText(value: string) {
  return value.trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createId() {
  return crypto.randomUUID()
}
