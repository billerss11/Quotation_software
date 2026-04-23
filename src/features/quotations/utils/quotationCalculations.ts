import type {
  MajorItemSummary,
  ExchangeRateTable,
  PricingLine,
  CurrencyCode,
  QuotationMajorItem,
  QuotationTotals,
  TotalsConfig,
} from '../types'

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
  return roundMoney(unitCost + calculateMarkupAmount(unitCost, markupRate))
}

export function calculateLineSellingAmount(
  line: LineAmountInput,
  markupRate: number,
  exchangeRates: ExchangeRateTable = createDefaultExchangeRates(),
) {
  return roundMoney(toPositiveNumber(line.quantity) * calculateUnitSellingPrice(line, markupRate, exchangeRates))
}

export function calculateMajorItemSummary(
  item: QuotationMajorItem,
  config: TotalsConfig,
  exchangeRates: ExchangeRateTable = createDefaultExchangeRates(),
): MajorItemSummary {
  const baseSubtotal = calculateMajorItemBaseSubtotal(item, exchangeRates)
  const markupRate = getEffectiveMarkupRate(item.markupRate, config.globalMarkupRate)
  const markupAmount = calculateMarkupAmount(baseSubtotal, markupRate)

  return {
    itemId: item.id,
    baseSubtotal,
    markupAmount,
    subtotal: roundMoney(baseSubtotal + markupAmount),
  }
}

export function calculateQuotationTotals(
  items: QuotationMajorItem[],
  config: TotalsConfig,
  exchangeRates: ExchangeRateTable = createDefaultExchangeRates(),
): QuotationTotals {
  const summaries = items.map((item) => calculateMajorItemSummary(item, config, exchangeRates))
  const baseSubtotal = roundMoney(sumAmounts(summaries.map((summary) => summary.baseSubtotal)))
  const markupAmount = roundMoney(sumAmounts(summaries.map((summary) => summary.markupAmount)))
  const subtotalAfterMarkup = roundMoney(baseSubtotal + markupAmount)
  const discountAmount = calculateDiscountAmount(subtotalAfterMarkup, config)
  const taxableSubtotal = roundMoney(Math.max(subtotalAfterMarkup - discountAmount, 0))
  const taxAmount = calculateMarkupAmount(taxableSubtotal, config.taxRate)

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
  return {
    USD: baseCurrency === 'USD' ? 1 : 1,
    EUR: baseCurrency === 'EUR' ? 1 : 1,
    CNY: baseCurrency === 'CNY' ? 1 : 1,
    GBP: baseCurrency === 'GBP' ? 1 : 1,
  }
}

function calculateMajorItemBaseSubtotal(item: QuotationMajorItem, exchangeRates: ExchangeRateTable) {
  if (item.subItems.length > 0) {
    return roundMoney(sumAmounts(item.subItems.map((subItem) => calculateLineCost(subItem, exchangeRates))))
  }

  return calculateLineCost(item, exchangeRates)
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
    return calculateMarkupAmount(amount, config.discountValue)
  }

  return roundMoney(Math.min(toPositiveNumber(config.discountValue), amount))
}

export function getEffectiveMarkupRate(markupRate: PricingLine['markupRate'], globalMarkupRate: number) {
  if (typeof markupRate === 'number' && Number.isFinite(markupRate)) {
    return Math.max(markupRate, 0)
  }

  return toPositiveNumber(globalMarkupRate)
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
