import type {
  MajorItemSummary,
  ExchangeRateTable,
  PricingLine,
  CurrencyCode,
  QuotationExtraCharge,
  QuotationTaxBucket,
  QuotationItem,
  QuotationRootItem,
  QuotationTotals,
  TotalsConfig,
} from '../types'
import { createExchangeRates } from './exchangeRates'
import { getQuotationRootItems } from './quotationItems'
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
  pricingMethod?: PricingLine['pricingMethod']
  manualUnitPrice?: PricingLine['manualUnitPrice']
  unitCost: number
  costCurrency?: CurrencyCode
}

interface UnitSellingPriceInput {
  pricingMethod?: PricingLine['pricingMethod']
  manualUnitPrice?: PricingLine['manualUnitPrice']
  unitCost: number
  costCurrency?: CurrencyCode
}

type TaxBucketSubtotal = {
  taxClassId: string
  label: string
  rate: number
  subtotalAfterMarkup: number
}

export function calculateLineCost(line: LineAmountInput, exchangeRates: ExchangeRateTable = createDefaultExchangeRates()) {
  return roundMoney(toPositiveNumber(line.quantity) * convertUnitCost(line, exchangeRates))
}

export function calculateUnitSellingPrice(
  line: UnitSellingPriceInput,
  markupRate: number,
  exchangeRates: ExchangeRateTable = createDefaultExchangeRates(),
) {
  if (line.pricingMethod === 'manual_price') {
    return roundMoney(toPositiveNumber(line.manualUnitPrice ?? 0))
  }

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
  const markupAmount = calculateQuotationItemMarkupAmount(item, config.globalMarkupRate, exchangeRates)

  return {
    itemId: item.id,
    baseSubtotal,
    markupAmount,
    subtotal,
  }
}

export function calculateQuotationTotals(
  items: QuotationRootItem[],
  config: TotalsConfig,
  exchangeRates: ExchangeRateTable = createDefaultExchangeRates(),
): QuotationTotals {
  const quotationItems = getQuotationRootItems(items)
  const summaries = quotationItems.map((item) => calculateMajorItemSummary(item, config, exchangeRates))
  const baseSubtotal = roundMoney(sumAmounts(summaries.map((summary) => summary.baseSubtotal)))
  const markupAmount = roundMoney(sumAmounts(summaries.map((summary) => summary.markupAmount)))
  const subtotalAfterMarkup = roundMoney(sumAmounts(summaries.map((summary) => summary.subtotal)))
  const discountAmount = calculateDiscountAmount(subtotalAfterMarkup, config)
  const taxBuckets = calculateTaxBuckets(quotationItems, config, exchangeRates, discountAmount)
  const taxableSubtotal = roundMoney(sumAmounts(taxBuckets.map((bucket) => bucket.taxableSubtotal)))
  const taxAmount = roundMoney(sumAmounts(taxBuckets.map((bucket) => bucket.taxAmount)))
  const extraChargesTotal = calculateExtraChargesTotal(config.extraCharges)

  return {
    baseSubtotal,
    markupAmount,
    subtotalAfterMarkup,
    discountAmount,
    taxableSubtotal,
    taxAmount,
    grandTotal: roundMoney(taxableSubtotal + taxAmount + extraChargesTotal),
    taxBuckets,
  }
}

export function calculateExtraChargesTotal(extraCharges: QuotationExtraCharge[] | undefined) {
  return roundMoney(sumAmounts((extraCharges ?? []).map((charge) => toPositiveNumber(charge.amount))))
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

export function calculateQuotationItemMarkupAmount(
  item: QuotationItem,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  inheritedMarkupRate?: number,
): number {
  const nextInheritedMarkupRate = getInheritedMarkupRate(item.markupRate, inheritedMarkupRate)

  if (item.children.length > 0) {
    return roundMoney(
      toPositiveNumber(item.quantity)
        * sumAmounts(
          item.children.map((child) =>
            calculateQuotationItemMarkupAmount(child, globalMarkupRate, exchangeRates, nextInheritedMarkupRate),
          ),
        ),
    )
  }

  const lineCost = calculateLineCost(item, exchangeRates)

  if (item.pricingMethod === 'manual_price' && lineCost <= 0) {
    return 0
  }

  const sellingAmount = calculateLineSellingAmount(
    item,
    getEffectiveMarkupRate(item.markupRate, nextInheritedMarkupRate ?? globalMarkupRate),
    exchangeRates,
  )

  return roundMoney(Math.max(sellingAmount - lineCost, 0))
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
  const bucketMap = new Map<string, TaxBucketSubtotal>()
  const normalizedTaxConfig = normalizeTaxConfig(config)

  items.forEach((item) => {
    mergeTaxBucketSubtotals(bucketMap, collectTaxBucketSubtotalsFromItem(item, normalizedTaxConfig, exchangeRates, {
      globalMarkupRate: config.globalMarkupRate,
    }))
  })

  return Array.from(bucketMap.values())
}

function collectTaxBucketSubtotalsFromItem(
  item: QuotationItem,
  config: NormalizedTaxConfig,
  exchangeRates: ExchangeRateTable,
  context: {
    inheritedMarkupRate?: number
    inheritedTaxClassId?: string
    globalMarkupRate: number
  },
): TaxBucketSubtotal[] {
  const nextInheritedMarkupRate = getInheritedMarkupRate(item.markupRate, context.inheritedMarkupRate)
  const nextInheritedTaxClassId = item.taxClassId ?? context.inheritedTaxClassId

  if (item.children.length > 0) {
    const childBuckets = mergeTaxBucketSubtotalRows(item.children.flatMap((child) =>
      collectTaxBucketSubtotalsFromItem(child, config, exchangeRates, {
        inheritedMarkupRate: nextInheritedMarkupRate,
        inheritedTaxClassId: nextInheritedTaxClassId,
        globalMarkupRate: context.globalMarkupRate,
      }),
    ))
    const scaledBuckets = childBuckets.map((bucket) => ({
      ...bucket,
      subtotalAfterMarkup: roundMoney(bucket.subtotalAfterMarkup * toPositiveNumber(item.quantity)),
    }))

    return reconcileTaxBucketSubtotals(
      scaledBuckets,
      calculateQuotationItemSellingAmount(item, context.globalMarkupRate, exchangeRates, context.inheritedMarkupRate),
    )
  }

  const taxClass = findResolvedTaxClassInNormalizedConfig(config, item.taxClassId, context.inheritedTaxClassId)

  return [
    {
      taxClassId: taxClass.id,
      label: taxClass.label,
      rate: taxClass.rate,
      subtotalAfterMarkup: calculateLineSellingAmount(
        item,
        getEffectiveMarkupRate(item.markupRate, nextInheritedMarkupRate ?? context.globalMarkupRate),
        exchangeRates,
      ),
    },
  ]
}

function mergeTaxBucketSubtotals(bucketMap: Map<string, TaxBucketSubtotal>, rows: TaxBucketSubtotal[]) {
  rows.forEach((row) => {
    const existingBucket = bucketMap.get(row.taxClassId)

    if (existingBucket) {
      existingBucket.subtotalAfterMarkup = roundMoney(existingBucket.subtotalAfterMarkup + row.subtotalAfterMarkup)
      return
    }

    bucketMap.set(row.taxClassId, { ...row })
  })
}

function mergeTaxBucketSubtotalRows(rows: TaxBucketSubtotal[]) {
  const bucketMap = new Map<string, TaxBucketSubtotal>()
  mergeTaxBucketSubtotals(bucketMap, rows)
  return Array.from(bucketMap.values())
}

function reconcileTaxBucketSubtotals(rows: TaxBucketSubtotal[], expectedSubtotal: number) {
  const expected = roundMoney(expectedSubtotal)
  let adjustment = roundMoney(expected - roundMoney(sumAmounts(rows.map((row) => row.subtotalAfterMarkup))))

  if (rows.length === 0 || adjustment === 0) {
    return rows
  }

  const adjustedRows = rows.map((row) => ({ ...row }))

  if (adjustment > 0) {
    const index = findRoundingAdjustmentBucketIndex(adjustedRows)
    adjustedRows[index].subtotalAfterMarkup = roundMoney(adjustedRows[index].subtotalAfterMarkup + adjustment)
    return adjustedRows
  }

  for (let index = adjustedRows.length - 1; index >= 0 && adjustment < 0; index -= 1) {
    const reduction = Math.min(adjustedRows[index].subtotalAfterMarkup, Math.abs(adjustment))
    adjustedRows[index].subtotalAfterMarkup = roundMoney(adjustedRows[index].subtotalAfterMarkup - reduction)
    adjustment = roundMoney(adjustment + reduction)
  }

  return adjustedRows
}

function findRoundingAdjustmentBucketIndex(rows: TaxBucketSubtotal[]) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].subtotalAfterMarkup > 0) {
      return index
    }
  }

  return rows.length - 1
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
