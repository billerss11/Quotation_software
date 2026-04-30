import type {
  MajorItemSummary,
  ExchangeRateTable,
  PricingLine,
  CurrencyCode,
  QuotationTaxBucket,
  QuotationItem,
  QuotationTotals,
  TotalsConfig,
} from '../types'
import { createExchangeRates } from './exchangeRates'
import {
  clampNumber,
  MAX_DISCOUNT_PERCENTAGE,
  MAX_MARKUP_RATE,
} from './pricingLimits'
import {
  findResolvedTaxClassInNormalizedConfig,
  normalizeTaxConfig,
  normalizeTaxRate,
  type NormalizedTaxConfig,
} from './quotationTaxes'

interface LineAmountInput {
  quantity: number
  unitCost: number
  costCurrency?: CurrencyCode
}

interface UnitSellingPriceInput {
  unitCost: number
  costCurrency?: CurrencyCode
}

export function calculateLineCost(line: LineAmountInput, exchangeRates: ExchangeRateTable = createDefaultExchangeRates()) {
  return roundMoney(toPositiveNumber(line.quantity) * convertUnitCost(line, exchangeRates))
}

export function calculateUnitSellingPrice(
  line: UnitSellingPriceInput,
  markupRate: number,
  exchangeRates: ExchangeRateTable = createDefaultExchangeRates(),
) {
  const unitCost = convertUnitCost(line, exchangeRates)
  return roundMoney(unitCost + calculateMarkupAmount(unitCost, normalizeMarkupRate(markupRate)))
}

export function calculateLineSellingAmount(
  line: LineAmountInput,
  markupRate: number,
  exchangeRates: ExchangeRateTable = createDefaultExchangeRates(),
) {
  return roundMoney(toPositiveNumber(line.quantity) * calculateUnitSellingPrice(line, markupRate, exchangeRates))
}

export function calculateMajorItemSummary(
  item: QuotationItem,
  config: TotalsConfig,
  exchangeRates: ExchangeRateTable = createDefaultExchangeRates(),
): MajorItemSummary {
  const baseSubtotal = calculateQuotationItemBaseSubtotal(item, exchangeRates)
  const subtotal = calculateQuotationItemSellingAmount(item, config.globalMarkupRate, exchangeRates)
  const markupAmount = roundMoney(subtotal - baseSubtotal)

  return {
    itemId: item.id,
    baseSubtotal,
    markupAmount,
    subtotal,
  }
}

export function calculateQuotationTotals(
  items: QuotationItem[],
  config: TotalsConfig,
  exchangeRates: ExchangeRateTable = createDefaultExchangeRates(),
): QuotationTotals {
  const summaries = items.map((item) => calculateMajorItemSummary(item, config, exchangeRates))
  const baseSubtotal = roundMoney(sumAmounts(summaries.map((summary) => summary.baseSubtotal)))
  const markupAmount = roundMoney(sumAmounts(summaries.map((summary) => summary.markupAmount)))
  const subtotalAfterMarkup = roundMoney(baseSubtotal + markupAmount)
  const discountAmount = calculateDiscountAmount(subtotalAfterMarkup, config)
  const taxBuckets = calculateTaxBuckets(items, config, exchangeRates, discountAmount)
  const taxableSubtotal = roundMoney(sumAmounts(taxBuckets.map((bucket) => bucket.taxableSubtotal)))
  const taxAmount = roundMoney(sumAmounts(taxBuckets.map((bucket) => bucket.taxAmount)))

  return {
    baseSubtotal,
    markupAmount,
    subtotalAfterMarkup,
    discountAmount,
    taxableSubtotal,
    taxAmount,
    grandTotal: roundMoney(taxableSubtotal + taxAmount),
    taxBuckets,
  }
}

export function createDefaultExchangeRates(baseCurrency: CurrencyCode = 'USD'): ExchangeRateTable {
  return createExchangeRates(baseCurrency)
}

export function calculateQuotationItemBaseSubtotal(
  item: QuotationItem,
  exchangeRates: ExchangeRateTable,
): number {
  if (item.children.length > 0) {
    return roundMoney(
      toPositiveNumber(item.quantity) *
        sumAmounts(item.children.map((child) => calculateQuotationItemBaseSubtotal(child, exchangeRates))),
    )
  }

  return calculateLineCost(item, exchangeRates)
}

export function calculateQuotationItemUnitSellingPrice(
  item: QuotationItem,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  inheritedMarkupRate?: number,
): number {
  const nextInheritedMarkupRate = getInheritedMarkupRate(item.markupRate, inheritedMarkupRate)

  if (item.children.length > 0) {
    return roundMoney(
      sumAmounts(
        item.children.map((child) =>
          calculateQuotationItemSellingAmount(child, globalMarkupRate, exchangeRates, nextInheritedMarkupRate),
        ),
      ),
    )
  }

  return calculateUnitSellingPrice(
    item,
    getEffectiveMarkupRate(item.markupRate, nextInheritedMarkupRate ?? globalMarkupRate),
    exchangeRates,
  )
}

export function calculateQuotationItemSellingAmount(
  item: QuotationItem,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  inheritedMarkupRate?: number,
): number {
  const nextInheritedMarkupRate = getInheritedMarkupRate(item.markupRate, inheritedMarkupRate)

  if (item.children.length > 0) {
    return roundMoney(
      toPositiveNumber(item.quantity) *
        sumAmounts(
          item.children.map((child) =>
            calculateQuotationItemSellingAmount(child, globalMarkupRate, exchangeRates, nextInheritedMarkupRate),
          ),
        ),
    )
  }

  return calculateLineSellingAmount(
    item,
    getEffectiveMarkupRate(item.markupRate, nextInheritedMarkupRate ?? globalMarkupRate),
    exchangeRates,
  )
}

function convertUnitCost(line: UnitSellingPriceInput, exchangeRates: ExchangeRateTable) {
  const rate = line.costCurrency ? exchangeRates[line.costCurrency] : 1
  return toPositiveNumber(line.unitCost) * toPositiveNumber(rate)
}

function calculateMarkupAmount(amount: number, markupRate: number) {
  return roundMoney(amount * (toPositiveNumber(markupRate) / 100))
}

function calculateDiscountAmount(amount: number, config: TotalsConfig) {
  if (config.discountMode === 'percentage') {
    return calculateMarkupAmount(amount, clampNumber(config.discountValue, 0, MAX_DISCOUNT_PERCENTAGE))
  }

  return roundMoney(Math.min(toPositiveNumber(config.discountValue), amount))
}

export function getEffectiveMarkupRate(markupRate: PricingLine['markupRate'], globalMarkupRate: number) {
  if (typeof markupRate === 'number' && Number.isFinite(markupRate)) {
    return normalizeMarkupRate(markupRate)
  }

  return normalizeMarkupRate(globalMarkupRate)
}

function sumAmounts(amounts: number[]) {
  return amounts.reduce((total, amount) => total + amount, 0)
}

function toPositiveNumber(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(value, 0)
}

function normalizeMarkupRate(value: number) {
  return clampNumber(value, 0, MAX_MARKUP_RATE)
}

function getInheritedMarkupRate(markupRate: PricingLine['markupRate'], inheritedMarkupRate?: number) {
  if (typeof markupRate === 'number' && Number.isFinite(markupRate)) {
    return normalizeMarkupRate(markupRate)
  }

  return inheritedMarkupRate
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function calculateTaxBuckets(
  items: QuotationItem[],
  config: TotalsConfig,
  exchangeRates: ExchangeRateTable,
  discountAmount: number,
) {
  const bucketSubtotals = collectTaxBucketSubtotals(items, config, exchangeRates)
  const subtotalAfterMarkup = roundMoney(sumAmounts(bucketSubtotals.map((bucket) => bucket.subtotalAfterMarkup)))
  let remainingSubtotal = subtotalAfterMarkup
  let remainingDiscount = discountAmount

  return bucketSubtotals.map((bucket, index): QuotationTaxBucket => {
    const isLastBucket = index === bucketSubtotals.length - 1
    const bucketDiscount = isLastBucket
      ? roundMoney(Math.min(remainingDiscount, bucket.subtotalAfterMarkup))
      : calculateProratedBucketDiscount(bucket.subtotalAfterMarkup, remainingSubtotal, remainingDiscount)
    const taxableSubtotal = roundMoney(Math.max(bucket.subtotalAfterMarkup - bucketDiscount, 0))

    remainingSubtotal = roundMoney(Math.max(remainingSubtotal - bucket.subtotalAfterMarkup, 0))
    remainingDiscount = roundMoney(Math.max(remainingDiscount - bucketDiscount, 0))

    return {
      taxClassId: bucket.taxClassId,
      label: bucket.label,
      rate: bucket.rate,
      taxableSubtotal,
      taxAmount: calculateMarkupAmount(taxableSubtotal, normalizeTaxRate(bucket.rate)),
    }
  })
}

function collectTaxBucketSubtotals(
  items: QuotationItem[],
  config: TotalsConfig,
  exchangeRates: ExchangeRateTable,
) {
  const bucketMap = new Map<string, { taxClassId: string; label: string; rate: number; subtotalAfterMarkup: number }>()
  const normalizedTaxConfig = normalizeTaxConfig(config)

  collectTaxBucketSubtotalsFromItems(items, normalizedTaxConfig, exchangeRates, bucketMap, {
    quantityMultiplier: 1,
    globalMarkupRate: config.globalMarkupRate,
  })

  return Array.from(bucketMap.values())
}

function collectTaxBucketSubtotalsFromItems(
  items: QuotationItem[],
  config: NormalizedTaxConfig,
  exchangeRates: ExchangeRateTable,
  bucketMap: Map<string, { taxClassId: string; label: string; rate: number; subtotalAfterMarkup: number }>,
  context: {
    inheritedMarkupRate?: number
    inheritedTaxClassId?: string
    quantityMultiplier: number
    globalMarkupRate: number
  },
) {
  items.forEach((item) => {
    const nextInheritedMarkupRate = getInheritedMarkupRate(item.markupRate, context.inheritedMarkupRate)
    const nextInheritedTaxClassId = item.taxClassId ?? context.inheritedTaxClassId

    if (item.children.length > 0) {
      collectTaxBucketSubtotalsFromItems(item.children, config, exchangeRates, bucketMap, {
        inheritedMarkupRate: nextInheritedMarkupRate,
        inheritedTaxClassId: nextInheritedTaxClassId,
        quantityMultiplier: roundMoney(context.quantityMultiplier * toPositiveNumber(item.quantity)),
        globalMarkupRate: context.globalMarkupRate,
      })
      return
    }

    const taxClass = findResolvedTaxClassInNormalizedConfig(config, item.taxClassId, context.inheritedTaxClassId)
    const subtotalAfterMarkup = roundMoney(
      context.quantityMultiplier * calculateLineSellingAmount(
        item,
        getEffectiveMarkupRate(item.markupRate, nextInheritedMarkupRate ?? context.globalMarkupRate),
        exchangeRates,
      ),
    )
    const existingBucket = bucketMap.get(taxClass.id)

    if (existingBucket) {
      existingBucket.subtotalAfterMarkup = roundMoney(existingBucket.subtotalAfterMarkup + subtotalAfterMarkup)
      return
    }

    bucketMap.set(taxClass.id, {
      taxClassId: taxClass.id,
      label: taxClass.label,
      rate: taxClass.rate,
      subtotalAfterMarkup,
    })
  })
}

function calculateProratedBucketDiscount(
  bucketSubtotal: number,
  remainingSubtotal: number,
  remainingDiscount: number,
) {
  if (bucketSubtotal <= 0 || remainingSubtotal <= 0 || remainingDiscount <= 0) {
    return 0
  }

  return roundMoney(Math.min(remainingDiscount, bucketSubtotal, remainingDiscount * (bucketSubtotal / remainingSubtotal)))
}
