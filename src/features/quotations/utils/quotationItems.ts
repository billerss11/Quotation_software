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

  return items.reduce<QuotationRootItem[]>((normalizedItems, item) => {
    const normalizedSectionHeader = normalizeQuotationSectionHeader(item, locale)

    if (normalizedSectionHeader) {
      normalizedItems.push(normalizedSectionHeader)
      return normalizedItems
    }

    const normalizedItem = normalizeQuotationItem(item, fallbackCurrency, locale)

    if (normalizedItem) {
      normalizedItems.push(normalizedItem)
    }

    return normalizedItems
  }, [])
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

export function moveQuotationRootRowToIndex(
  items: QuotationRootItem[],
  itemId: string,
  targetIndex: number,
) {
  const sourceIndex = items.findIndex((item) => item.id === itemId)

  if (sourceIndex === -1) {
    return
  }

  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, items.length))
  const adjustedTargetIndex = boundedTargetIndex > sourceIndex ? boundedTargetIndex - 1 : boundedTargetIndex

  if (adjustedTargetIndex === sourceIndex) {
    return
  }

  const [item] = items.splice(sourceIndex, 1)
  items.splice(adjustedTargetIndex, 0, item)
}

export function moveQuotationTreeRow(
  items: QuotationRootItem[],
  itemId: string,
  targetParentId: string | null,
  targetIndex: number,
  dropMode: 'before' | 'inside' | 'after',
) {
  void dropMode
  const sourceLocation = findQuotationRowLocation(items, itemId)

  if (!sourceLocation) {
    return
  }

  if (!isQuotationItem(sourceLocation.item)) {
    if (targetParentId !== null) {
      return
    }

    moveQuotationRootRowToIndex(items, itemId, targetIndex)
    return
  }

  if (targetParentId === itemId || containsQuotationItemId(sourceLocation.item.children, targetParentId)) {
    return
  }

  const subtreeMaxDepth = getQuotationSubtreeMaxDepth(sourceLocation.item)
  const targetParentLocation = targetParentId ? findQuotationRowLocation(items, targetParentId) : null

  if (targetParentId !== null) {
    if (!targetParentLocation || !isQuotationItem(targetParentLocation.item)) {
      return
    }

    if (targetParentLocation.depth + subtreeMaxDepth > 3) {
      return
    }
  }

  const targetContainer: QuotationRootItem[] | QuotationItem[] = targetParentLocation && isQuotationItem(targetParentLocation.item)
    ? targetParentLocation.item.children
    : items
  let boundedTargetIndex = clampTargetIndex(targetIndex, targetContainer.length)

  if (sourceLocation.container === targetContainer && sourceLocation.index < boundedTargetIndex) {
    boundedTargetIndex -= 1
  }

  if (sourceLocation.container === targetContainer && sourceLocation.index === boundedTargetIndex) {
    return
  }

  const [movedItem] = sourceLocation.container.splice(sourceLocation.index, 1)
  targetContainer.splice(boundedTargetIndex, 0, movedItem as never)
}

interface QuotationRowLocation {
  item: QuotationRootItem
  container: QuotationRootItem[] | QuotationItem[]
  index: number
  depth: 1 | 2 | 3
}

function findQuotationRowLocation(
  items: QuotationRootItem[],
  itemId: string,
  depth: 1 | 2 | 3 = 1,
  container: QuotationRootItem[] | QuotationItem[] = items,
): QuotationRowLocation | null {
  for (let index = 0; index < container.length; index += 1) {
    const item = container[index] as QuotationRootItem

    if (item.id === itemId) {
      return {
        item,
        container,
        index,
        depth,
      }
    }

    if (!isQuotationItem(item) || depth === 3) {
      continue
    }

    const childLocation = findQuotationRowLocation(
      items,
      itemId,
      (depth + 1) as 2 | 3,
      item.children,
    )

    if (childLocation) {
      return childLocation
    }
  }

  return null
}

function containsQuotationItemId(items: QuotationItem[], itemId: string | null): boolean {
  if (!itemId) {
    return false
  }

  return items.some((item) =>
    item.id === itemId || containsQuotationItemId(item.children, itemId),
  )
}

function getQuotationSubtreeMaxDepth(item: QuotationItem): number {
  if (item.children.length === 0) {
    return 1
  }

  return 1 + Math.max(...item.children.map((child) => getQuotationSubtreeMaxDepth(child)))
}

function clampTargetIndex(targetIndex: number, containerLength: number) {
  return Math.max(0, Math.min(targetIndex, containerLength))
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
