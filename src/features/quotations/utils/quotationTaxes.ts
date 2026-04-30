import type { QuotationItem, TaxClass, TaxMode, TotalsConfig } from '../types'

import { clampNumber, MAX_TAX_RATE } from './pricingLimits'

const FALLBACK_DEFAULT_TAX_CLASS_ID = 'default-tax-class'

export interface NormalizedTaxConfig {
  taxMode: TaxMode
  taxClasses: TaxClass[]
  defaultTaxClassId: string
}

export function createTaxClass(overrides: Partial<TaxClass> = {}): TaxClass {
  const rate = normalizeTaxRate(overrides.rate ?? 0)

  return {
    id: overrides.id ?? crypto.randomUUID(),
    label: normalizeTaxLabel(overrides.label, rate),
    rate,
  }
}

export function createCalculationTotalsConfig(config: TotalsConfig): TotalsConfig {
  return {
    globalMarkupRate: config.globalMarkupRate,
    discountMode: config.discountMode,
    discountValue: config.discountValue,
    taxMode: config.taxMode,
    defaultTaxClassId: config.defaultTaxClassId,
    taxRate: config.taxRate,
    taxClasses: Array.isArray(config.taxClasses)
      ? config.taxClasses.map((taxClass) => ({
        id: taxClass.id,
        label: formatTaxRatePercentage(taxClass.rate),
        rate: taxClass.rate,
      }))
      : config.taxClasses,
  }
}

export function normalizeTaxConfig(
  config: Pick<TotalsConfig, 'taxMode' | 'taxClasses' | 'defaultTaxClassId'> & { taxRate?: number },
): NormalizedTaxConfig {
  const legacyRate = typeof config.taxRate === 'number' && Number.isFinite(config.taxRate)
    ? normalizeTaxRate(config.taxRate)
    : 0
  const taxMode = config.taxMode === 'mixed' ? 'mixed' : 'single'
  const normalizedTaxClasses = Array.isArray(config.taxClasses)
    ? config.taxClasses.flatMap((taxClass) => normalizeTaxClass(taxClass))
    : []

  if (normalizedTaxClasses.length === 0) {
    const fallbackTaxClass = createTaxClass({
      id: FALLBACK_DEFAULT_TAX_CLASS_ID,
      rate: legacyRate,
    })

    return {
      taxMode,
      taxClasses: [fallbackTaxClass],
      defaultTaxClassId: fallbackTaxClass.id,
    }
  }

  const defaultTaxClassId = (
    typeof config.defaultTaxClassId === 'string'
    && normalizedTaxClasses.some((taxClass) => taxClass.id === config.defaultTaxClassId)
  )
    ? config.defaultTaxClassId
    : normalizedTaxClasses[0].id

  return {
    taxMode,
    taxClasses: normalizedTaxClasses,
    defaultTaxClassId,
  }
}

export function findResolvedTaxClass(
  config: Pick<TotalsConfig, 'taxClasses' | 'defaultTaxClassId'> & { taxRate?: number },
  itemTaxClassId?: string,
  inheritedTaxClassId?: string,
) {
  const normalizedConfig = normalizeTaxConfig(config)
  return findResolvedTaxClassInNormalizedConfig(normalizedConfig, itemTaxClassId, inheritedTaxClassId)
}

export function findResolvedTaxClassInNormalizedConfig(
  normalizedConfig: NormalizedTaxConfig,
  itemTaxClassId?: string,
  inheritedTaxClassId?: string,
) {
  const taxClassIds = new Set(normalizedConfig.taxClasses.map((taxClass) => taxClass.id))
  const resolvedTaxClassId = taxClassIds.has(itemTaxClassId ?? '')
    ? itemTaxClassId!
    : taxClassIds.has(inheritedTaxClassId ?? '')
      ? inheritedTaxClassId!
      : normalizedConfig.defaultTaxClassId

  return (
    normalizedConfig.taxClasses.find((taxClass) => taxClass.id === resolvedTaxClassId)
    ?? normalizedConfig.taxClasses[0]
  )
}

export function normalizeTaxRate(value: number) {
  return clampNumber(value, 0, MAX_TAX_RATE)
}

export function collectEffectiveTaxClassIds(items: QuotationItem[], config: TotalsConfig) {
  const taxClassIds = new Set<string>()
  collectEffectiveTaxClassIdsFromItems(items, config, taxClassIds)
  return Array.from(taxClassIds)
}

export function canUseSingleTaxMode(items: QuotationItem[], config: TotalsConfig) {
  return collectEffectiveTaxClassIds(items, config).length <= 1
}

export function resolveQuotationTaxMode(
  items: QuotationItem[],
  config: TotalsConfig,
  currentMode: TaxMode = 'single',
): TaxMode {
  if (!canUseSingleTaxMode(items, config)) {
    return 'mixed'
  }

  return currentMode
}

export function applyTaxClassToQuotationItems(items: QuotationItem[], taxClassId: string): QuotationItem[] {
  return items.map((item) => ({
    ...item,
    taxClassId,
    children: applyTaxClassToQuotationItems(item.children, taxClassId),
  }))
}

function normalizeTaxClass(value: unknown) {
  if (!isRecord(value)) {
    return []
  }

  const id = typeof value.id === 'string' && value.id.trim().length > 0
    ? value.id.trim()
    : crypto.randomUUID()
  const rate = typeof value.rate === 'number' && Number.isFinite(value.rate)
    ? normalizeTaxRate(value.rate)
    : 0
  const label = normalizeTaxLabel(typeof value.label === 'string' ? value.label : undefined, rate)

  return [
    {
      id,
      label,
      rate,
    },
  ]
}

function normalizeTaxLabel(label: string | undefined, rate: number) {
  if (typeof label === 'string' && label.trim().length > 0) {
    return label.trim()
  }

  return `${formatTaxRate(rate)}%`
}

function formatTaxRate(rate: number) {
  return Number.isInteger(rate) ? String(rate) : String(rate).replace(/(?:\.0+|(\.\d*[1-9])0+)$/, '$1')
}

/** User-visible rate string aligned with stored tax labels, e.g. "13%", "0%". Prefer over `TaxClass.label` when the rate input can drift from the immutable label text. */
export function formatTaxRatePercentage(rate: number) {
  return `${formatTaxRate(normalizeTaxRate(rate))}%`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectEffectiveTaxClassIdsFromItems(
  items: QuotationItem[],
  config: TotalsConfig,
  taxClassIds: Set<string>,
  inheritedTaxClassId?: string,
) {
  items.forEach((item) => {
    const nextInheritedTaxClassId = item.taxClassId ?? inheritedTaxClassId

    if (item.children.length > 0) {
      collectEffectiveTaxClassIdsFromItems(item.children, config, taxClassIds, nextInheritedTaxClassId)
      return
    }

    taxClassIds.add(findResolvedTaxClass(config, item.taxClassId, inheritedTaxClassId).id)
  })
}
