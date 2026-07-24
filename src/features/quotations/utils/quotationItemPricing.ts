import type { ExchangeRateTable, QuotationItem, QuotationTaxBucket, TotalsConfig } from '../types'
import {
  calculateQuotationItemMarkupAmount,
  calculateQuotationItemBaseSubtotal,
  calculateQuotationItemSellingAmount,
  calculateQuotationItemTaxBuckets,
  calculateQuotationItemUnitSellingPrice,
  calculateUnitSellingPrice,
  getEffectiveMarkupRate,
} from './quotationCalculations'
import { roundMoney } from './moneyMath'

export interface InheritedMarkupContext {
  rate: number
  sourceLabel: string
}

export interface QuotationItemPricingDisplay {
  effectiveMarkupRate: number
  fallbackMarkupRate: number
  markupSource: 'self' | 'inherited' | 'global'
  markupSourceLabel: string
  baseAmount: number
  markupAmount: number
  subtotal: number
  unitSellingPrice: number
  taxClassId: string | null
  taxClassLabel: string | null
  taxRate: number | null
  effectiveTaxRate: number | null
  hasMixedTaxClasses: boolean
  taxBuckets: QuotationItemPricingTaxBucket[]
  taxAmount: number
  taxRoundingAdjustment: number
  totalWithTax: number
  unitPriceWithTax: number
}

export interface QuotationItemPricingTaxBucket extends QuotationTaxBucket {
  calculatedTaxAmount: number
  taxRoundingAdjustment: number
}

export interface QuotationItemPricingOptions {
  taxBuckets?: QuotationTaxBucket[]
}

export function getQuotationItemPricingDisplay(
  item: QuotationItem,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  totalsConfig: TotalsConfig,
  inheritedMarkupContext?: InheritedMarkupContext | null,
  inheritedTaxClassId?: string,
  options: QuotationItemPricingOptions = {},
): QuotationItemPricingDisplay {
  const hasOwnMarkup = typeof item.markupRate === 'number' && Number.isFinite(item.markupRate)
  const inheritedRate = inheritedMarkupContext?.rate
  const fallbackMarkupRate = getEffectiveMarkupRate(item.markupRate, inheritedRate ?? globalMarkupRate)
  const baseAmount = calculateQuotationItemBaseSubtotal(item, exchangeRates)
  const markupAmount = calculateQuotationItemMarkupAmount(item, globalMarkupRate, exchangeRates, inheritedRate)
  const effectiveMarkupRate = item.children.length > 0
    ? calculateGroupEffectiveMarkupRate(baseAmount, markupAmount, fallbackMarkupRate)
    : fallbackMarkupRate
  const subtotal = calculateQuotationItemSellingAmount(item, globalMarkupRate, exchangeRates, inheritedRate)
  const calculatedTaxBuckets = calculateQuotationItemTaxBuckets(
    item,
    totalsConfig,
    exchangeRates,
    {
      globalMarkupRate,
      inheritedMarkupRate: inheritedRate,
      inheritedTaxClassId,
    },
  )
  const taxBuckets = (options.taxBuckets ?? calculatedTaxBuckets).map((bucket) => {
    const calculatedBucket = calculatedTaxBuckets.find(
      (candidate) => candidate.taxClassId === bucket.taxClassId,
    )
    const calculatedTaxAmount = calculatedBucket?.taxAmount ?? 0

    return {
      ...bucket,
      label: calculatedBucket?.label ?? bucket.label,
      rate: calculatedBucket?.rate ?? bucket.rate,
      taxableSubtotal: calculatedBucket?.taxableSubtotal ?? bucket.taxableSubtotal,
      calculatedTaxAmount,
      taxRoundingAdjustment: roundMoney(bucket.taxAmount - calculatedTaxAmount),
    }
  })
  const resolvedTaxBucket = taxBuckets.length === 1 ? taxBuckets[0] : null
  const calculatedTaxAmount = roundMoney(
    calculatedTaxBuckets.reduce((total, bucket) => total + bucket.taxAmount, 0),
  )
  const taxAmount = roundMoney(taxBuckets.reduce((total, bucket) => total + bucket.taxAmount, 0))
  const totalWithTax = roundMoney(subtotal + taxAmount)
  const effectiveTaxRate = calculateEffectiveTaxRate(subtotal, taxAmount)
  const unitSellingPrice =
    item.children.length > 0
      ? calculateQuotationItemUnitSellingPrice(item, globalMarkupRate, exchangeRates, inheritedRate)
      : calculateUnitSellingPrice(item, fallbackMarkupRate, exchangeRates)

  return {
    effectiveMarkupRate,
    fallbackMarkupRate,
    markupSource: hasOwnMarkup ? 'self' : inheritedMarkupContext ? 'inherited' : 'global',
    markupSourceLabel: hasOwnMarkup ? 'This item' : inheritedMarkupContext?.sourceLabel ?? 'Global',
    baseAmount,
    markupAmount,
    subtotal,
    unitSellingPrice,
    taxClassId: resolvedTaxBucket?.taxClassId ?? null,
    taxClassLabel: resolvedTaxBucket?.label ?? null,
    taxRate: resolvedTaxBucket?.rate ?? null,
    effectiveTaxRate,
    hasMixedTaxClasses: taxBuckets.length > 1,
    taxBuckets,
    taxAmount,
    taxRoundingAdjustment: roundMoney(taxAmount - calculatedTaxAmount),
    totalWithTax,
    unitPriceWithTax: calculateUnitPriceWithTax(item, totalWithTax),
  }
}

export function createInheritedMarkupContext(
  item: QuotationItem,
  itemNumber: string,
  inheritedMarkupContext?: InheritedMarkupContext | null,
) {
  if (typeof item.markupRate === 'number' && Number.isFinite(item.markupRate)) {
    return {
      rate: Math.max(item.markupRate, 0),
      sourceLabel: itemNumber,
    } satisfies InheritedMarkupContext
  }

  return inheritedMarkupContext ?? null
}

export function calculateQuotationItemSectionUnitCost(item: QuotationItem, exchangeRates: ExchangeRateTable) {
  return item.children.reduce((sum, child) => sum + calculateQuotationItemBaseSubtotal(child, exchangeRates), 0)
}

function calculateGroupEffectiveMarkupRate(baseAmount: number, markupAmount: number, fallbackMarkupRate: number) {
  if (baseAmount <= 0) {
    return fallbackMarkupRate
  }

  return roundMoney((markupAmount / baseAmount) * 100)
}

function calculateUnitPriceWithTax(item: QuotationItem, totalWithTax: number) {
  const quantity = toPositiveNumber(item.quantity)

  if (quantity <= 0) {
    return 0
  }

  return roundMoney(totalWithTax / quantity)
}

function calculateEffectiveTaxRate(subtotal: number, taxAmount: number) {
  if (subtotal <= 0) {
    return null
  }

  return roundMoney((taxAmount / subtotal) * 100)
}

function toPositiveNumber(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(value, 0)
}
