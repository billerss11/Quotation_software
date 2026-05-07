import type { CurrencyCode, QuotationItem, QuotationRootItem, QuotationSectionHeader } from '../types'
import { parseCurrencyCode } from './currencyCodes'
import {
  getDefaultQuotationChildItemName,
  getDefaultQuotationItemName,
  getDefaultQuotationSectionHeaderName,
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
    pricingMethod: overrides.pricingMethod ?? 'cost_plus',
    manualUnitPrice: overrides.manualUnitPrice,
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? fallbackCurrency,
    markupRate: overrides.markupRate,
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}

export function createQuotationSectionHeader(
  locale: SupportedLocale = DEFAULT_LOCALE,
  overrides: Partial<QuotationSectionHeader> = {},
): QuotationSectionHeader {
  return {
    id: overrides.id ?? createId(),
    kind: 'section_header',
    title: overrides.title ?? getDefaultQuotationSectionHeaderName(locale),
  }
}

export function isQuotationSectionHeader(value: unknown): value is QuotationSectionHeader {
  return isRecord(value) && value.kind === 'section_header'
}

export function isQuotationItem(value: QuotationRootItem | QuotationItem | unknown): value is QuotationItem {
  return isRecord(value) && Array.isArray(value.children)
}

export function getQuotationRootItems(items: QuotationRootItem[]): QuotationItem[] {
  return items.filter(isQuotationItem)
}

export function normalizeQuotationItems(
  items: unknown,
  fallbackCurrency: CurrencyCode,
  locale: SupportedLocale = DEFAULT_LOCALE,
): QuotationRootItem[] {
  if (!Array.isArray(items)) {
    return []
  }

  return items.flatMap((item) => {
    const normalizedSectionHeader = normalizeQuotationSectionHeader(item, locale)

    if (normalizedSectionHeader) {
      return [normalizedSectionHeader]
    }

    const normalizedItem = normalizeQuotationItem(item, fallbackCurrency, locale)
    return normalizedItem ? [normalizedItem] : []
  })
}

export function findQuotationItem(items: QuotationRootItem[], itemId: string): QuotationItem | undefined {
  for (const item of items) {
    if (!isQuotationItem(item)) {
      continue
    }

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

export function findQuotationItemPath(items: QuotationRootItem[], itemId: string): QuotationItem[] | null {
  for (const item of items) {
    if (!isQuotationItem(item)) {
      continue
    }

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

export function removeQuotationItem(items: QuotationRootItem[], itemId: string): QuotationRootItem[] {
  return items
    .filter((item) => item.id !== itemId)
    .map((item) => {
      if (!isQuotationItem(item)) {
        return item
      }

      return {
        ...item,
        children: removeQuotationItem(item.children, itemId) as QuotationItem[],
      }
    })
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

function normalizeQuotationSectionHeader(
  value: unknown,
  locale: SupportedLocale,
): QuotationSectionHeader | null {
  if (!isQuotationSectionHeader(value)) {
    return null
  }

  return {
    id: typeof value.id === 'string' && value.id.trim().length > 0 ? value.id : createId(),
    kind: 'section_header',
    title: normalizeText(value.title || getDefaultQuotationSectionHeaderName(locale)),
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
    pricingMethod: parsePricingMethod(value.pricingMethod, value.manualUnitPrice),
    manualUnitPrice: parseOptionalNumber(value.manualUnitPrice),
    unitCost: toNumber(value.unitCost, 0),
    costCurrency,
    markupRate: parseOptionalNumber(value.markupRate),
    taxClassId: parseOptionalString(value.taxClassId),
    expectedTotal: parseOptionalNumber(value.expectedTotal),
    notes: normalizeText(typeof value.notes === 'string' ? value.notes : ''),
    children: [],
  }

  normalized.children = normalizeQuotationChildItems(childrenSource, costCurrency, locale)

  return normalized
}

function normalizeQuotationChildItems(
  items: unknown,
  fallbackCurrency: CurrencyCode,
  locale: SupportedLocale,
): QuotationItem[] {
  if (!Array.isArray(items)) {
    return []
  }

  return items.flatMap((item) => {
    const normalized = normalizeQuotationItem(item, fallbackCurrency, locale)
    return normalized ? [normalized] : []
  })
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

function parseOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function parsePricingMethod(pricingMethod: unknown, manualUnitPrice: unknown) {
  if (pricingMethod === 'manual_price' || pricingMethod === 'cost_plus') {
    return pricingMethod
  }

  return typeof manualUnitPrice === 'number' && Number.isFinite(manualUnitPrice)
    ? 'manual_price'
    : 'cost_plus'
}

function normalizeText(value: string) {
  const normalizedValue = value.trim()
  return normalizedValue.length > 0 ? normalizedValue : value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createId() {
  return crypto.randomUUID()
}

export {
  getDefaultQuotationChildItemName,
  getDefaultQuotationSiblingItemName,
}
