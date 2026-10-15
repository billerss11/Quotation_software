import type { QuotationInformationalTotal, QuotationOutputItemDetailLevel, QuotationOutputSettings } from '../types'

export const DEFAULT_QUOTATION_OUTPUT_ITEM_DETAIL_LEVEL: QuotationOutputItemDetailLevel = 3
export const QUOTATION_OUTPUT_ITEM_DETAIL_LEVELS: readonly QuotationOutputItemDetailLevel[] = [1, 2, 3]

export function createDefaultQuotationOutputSettings(): QuotationOutputSettings {
  return {
    itemDetailLevel: DEFAULT_QUOTATION_OUTPUT_ITEM_DETAIL_LEVEL,
  }
}

export function normalizeQuotationOutputSettings(value: unknown): QuotationOutputSettings {
  if (!isRecord(value)) {
    return createDefaultQuotationOutputSettings()
  }

  const settings: QuotationOutputSettings = {
    itemDetailLevel: normalizeQuotationOutputItemDetailLevel(value.itemDetailLevel),
  }

  if (typeof value.subtotalLabel === 'string') settings.subtotalLabel = value.subtotalLabel
  if (typeof value.informationalTotalsNote === 'string') settings.informationalTotalsNote = value.informationalTotalsNote
  if (typeof value.showInformationalTotals === 'boolean') settings.showInformationalTotals = value.showInformationalTotals
  if (Array.isArray(value.informationalTotals)) {
    settings.informationalTotals = value.informationalTotals
      .filter(isQuotationInformationalTotal)
      .map((row) => ({
        id: row.id,
        label: row.label,
        sectionIds: [...new Set(row.sectionIds)],
        ...(row.source === undefined ? {} : { source: row.source }),
        ...(row.itemIds === undefined ? {} : { itemIds: [...new Set(row.itemIds)] }),
        visible: row.visible,
      }))
  }

  return settings
}

export function isQuotationOutputSettings(value: unknown): value is QuotationOutputSettings {
  return isRecord(value)
    && isQuotationOutputItemDetailLevel(value.itemDetailLevel)
    && (value.subtotalLabel === undefined || typeof value.subtotalLabel === 'string')
    && (value.informationalTotalsNote === undefined || typeof value.informationalTotalsNote === 'string')
    && (value.showInformationalTotals === undefined || typeof value.showInformationalTotals === 'boolean')
    && (value.informationalTotals === undefined || (
      Array.isArray(value.informationalTotals) && value.informationalTotals.every(isQuotationInformationalTotal)
    ))
}

export function isQuotationInformationalTotal(value: unknown): value is QuotationInformationalTotal {
  return isRecord(value)
    && typeof value.id === 'string' && value.id.trim().length > 0
    && typeof value.label === 'string'
    && typeof value.visible === 'boolean'
    && Array.isArray(value.sectionIds)
    && value.sectionIds.every((id) => typeof id === 'string' && id.trim().length > 0)
    && (value.source === undefined || value.source === 'sections' || value.source === 'items')
    && (value.itemIds === undefined || (
      Array.isArray(value.itemIds) && value.itemIds.every((id) => typeof id === 'string' && id.trim().length > 0)
    ))
}

export function normalizeQuotationOutputItemDetailLevel(value: unknown): QuotationOutputItemDetailLevel {
  return isQuotationOutputItemDetailLevel(value)
    ? value
    : DEFAULT_QUOTATION_OUTPUT_ITEM_DETAIL_LEVEL
}

export function isQuotationOutputItemDetailLevel(value: unknown): value is QuotationOutputItemDetailLevel {
  return typeof value === 'number'
    && QUOTATION_OUTPUT_ITEM_DETAIL_LEVELS.includes(value as QuotationOutputItemDetailLevel)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
