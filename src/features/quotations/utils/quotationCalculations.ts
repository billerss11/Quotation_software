import type {
  MajorItemSummary,
  ExchangeRateTable,
  PricingLine,
  CurrencyCode,
  QuotationItem,
  QuotationTotals,
  TotalsConfig,
} from '../types'
import { createExchangeRates } from './exchangeRates'
import {
  clampNumber,
  MAX_DISCOUNT_PERCENTAGE,
  MAX_MARKUP_RATE,
  MAX_TAX_RATE,
} from './pricingLimits'

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
  const taxableSubtotal = roundMoney(Math.max(subtotalAfterMarkup - discountAmount, 0))
  const taxAmount = calculateMarkupAmount(taxableSubtotal, normalizeTaxRate(config.taxRate))

  return {
    baseSubtotal,
    markupAmount,
    subtotalAfterMarkup,
    discountAmount,
    taxableSubtotal,
    taxAmount,
    grandTotal: roundMoney(taxableSubtotal + taxAmount),
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
  const expectedTotalOverride = getExpectedTotalOverride(item)

  if (item.children.length > 0) {
    if (expectedTotalOverride !== null) {
      return getGroupUnitPriceFromTotal(item.quantity, expectedTotalOverride)
    }

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
  const expectedTotalOverride = getExpectedTotalOverride(item)

  if (expectedTotalOverride !== null) {
    return expectedTotalOverride
  }

  return calculateQuotationItemChildSellingAmount(item, globalMarkupRate, exchangeRates, inheritedMarkupRate)
}

export function calculateQuotationItemChildSellingAmount(
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

function normalizeTaxRate(value: number) {
  return clampNumber(value, 0, MAX_TAX_RATE)
}

function getInheritedMarkupRate(markupRate: PricingLine['markupRate'], inheritedMarkupRate?: number) {
  if (typeof markupRate === 'number' && Number.isFinite(markupRate)) {
    return normalizeMarkupRate(markupRate)
  }

  return inheritedMarkupRate
}

function getExpectedTotalOverride(item: QuotationItem) {
  if (item.children.length === 0 || typeof item.expectedTotal !== 'number' || !Number.isFinite(item.expectedTotal)) {
    return null
  }

  return roundMoney(toPositiveNumber(item.expectedTotal))
}

function getGroupUnitPriceFromTotal(quantity: number, total: number) {
  const normalizedQuantity = toPositiveNumber(quantity)
  if (normalizedQuantity === 0) {
    return total
  }

  return roundMoney(total / normalizedQuantity)
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
