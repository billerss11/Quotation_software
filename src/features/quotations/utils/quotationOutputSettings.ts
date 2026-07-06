import type { QuotationOutputItemDetailLevel, QuotationOutputSettings } from '../types'

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

  return {
    itemDetailLevel: normalizeQuotationOutputItemDetailLevel(value.itemDetailLevel),
  }
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
