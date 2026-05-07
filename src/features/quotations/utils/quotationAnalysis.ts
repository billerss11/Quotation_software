import type {
  ExchangeRateTable,
  MajorItemSummary,
  QuotationDraft,
  QuotationItem,
  QuotationTotals,
} from '../types'
import { calculateLineCost, calculateUnitSellingPrice, getEffectiveMarkupRate } from './quotationCalculations'
import { getQuotationRootItems } from './quotationItems'

export interface QuotationAnalysisKpis {
  baseSubtotal: number
  markupAmount: number
  discountAmount: number
  taxAmount: number
  grandTotal: number
  grossMarginAmount: number
  grossMarginRate: number
  costCoverageRate: number
}

export interface QuotationAnalysisCompositionSummary {
  majorItemCount: number
  pricedLineCount: number
  currencyCount: number
  markupOverrideCount: number
}

export interface QuotationAnalysisMajorItemRow {
  itemId: string
  itemName: string
  baseSubtotal: number
  subtotal: number
  profitAmount: number
  grossMarginRate: number
  currencyExposure: Record<string, number>
}

export interface QuotationAnalysisCurrencyExposureRow {
  itemId: string
  itemName: string
  values: Record<string, number>
}

export interface QuotationAnalysisCurrencyExposure {
  currencies: string[]
  rows: QuotationAnalysisCurrencyExposureRow[]
}

export interface QuotationAnalysisBridgeStep {
  key: 'baseSubtotal' | 'markupAmount' | 'discountAmount' | 'taxAmount' | 'grandTotal'
  amount: number
  cumulativeStart: number
  cumulativeEnd: number
}

export interface QuotationAnalysisDataset {
  hasMeaningfulData: boolean
  kpis: QuotationAnalysisKpis
  compositionSummary: QuotationAnalysisCompositionSummary
  majorItemRows: QuotationAnalysisMajorItemRow[]
  currencyExposure: QuotationAnalysisCurrencyExposure
  bridge: QuotationAnalysisBridgeStep[]
}

export function createQuotationAnalysisDataset(
  quotation: QuotationDraft,
  itemSummaries: MajorItemSummary[],
  totals: QuotationTotals,
): QuotationAnalysisDataset {
  const rootItems = getQuotationRootItems(quotation.majorItems)
  const summaryByItemId = new Map(itemSummaries.map((summary) => [summary.itemId, summary]))
  const majorItemRows = rootItems
    .map((item) => createMajorItemRow(item, summaryByItemId.get(item.id)))
    .filter((row): row is QuotationAnalysisMajorItemRow => row !== null)
    .sort((left, right) => right.subtotal - left.subtotal || right.baseSubtotal - left.baseSubtotal)
  const currencies = Array.from(
    new Set(majorItemRows.flatMap((row) => Object.keys(row.currencyExposure))),
  ).sort((left, right) => left.localeCompare(right))
  const costCoverageRate = calculateCostCoverageRate(
    rootItems,
    quotation.totalsConfig.globalMarkupRate,
    quotation.exchangeRates,
    totals.subtotalAfterMarkup,
  )

  return {
    hasMeaningfulData: majorItemRows.length > 0,
    kpis: {
      baseSubtotal: roundMoney(totals.baseSubtotal),
      markupAmount: roundMoney(totals.markupAmount),
      discountAmount: roundMoney(totals.discountAmount),
      taxAmount: roundMoney(totals.taxAmount),
      grandTotal: roundMoney(totals.grandTotal),
      grossMarginAmount: roundMoney(totals.markupAmount),
      grossMarginRate: calculateRate(totals.markupAmount, totals.subtotalAfterMarkup),
      costCoverageRate,
    },
    compositionSummary: {
      majorItemCount: rootItems.length,
      pricedLineCount: countLeafItems(rootItems),
      currencyCount: countCurrencies(rootItems),
      markupOverrideCount: countMarkupOverrides(rootItems),
    },
    majorItemRows,
    currencyExposure: {
      currencies,
      rows: majorItemRows.map((row) => ({
        itemId: row.itemId,
        itemName: row.itemName,
        values: row.currencyExposure,
      })),
    },
    bridge: createBridgeSteps(totals),
  }
}

function createMajorItemRow(item: QuotationItem, summary?: MajorItemSummary): QuotationAnalysisMajorItemRow | null {
  if (!summary) {
    return null
  }

  if (summary.baseSubtotal <= 0 && summary.subtotal <= 0) {
    return null
  }

  return {
    itemId: item.id,
    itemName: item.name,
    baseSubtotal: roundMoney(summary.baseSubtotal),
    subtotal: roundMoney(summary.subtotal),
    profitAmount: roundMoney(summary.subtotal - summary.baseSubtotal),
    grossMarginRate: calculateRate(summary.subtotal - summary.baseSubtotal, summary.subtotal),
    currencyExposure: collectCurrencyExposure(item),
  }
}

function createBridgeSteps(totals: QuotationTotals): QuotationAnalysisBridgeStep[] {
  const steps: Array<Pick<QuotationAnalysisBridgeStep, 'key' | 'amount'>> = [
    { key: 'baseSubtotal', amount: roundMoney(totals.baseSubtotal) },
    { key: 'markupAmount', amount: roundMoney(totals.markupAmount) },
    { key: 'discountAmount', amount: roundMoney(-totals.discountAmount) },
    { key: 'taxAmount', amount: roundMoney(totals.taxAmount) },
  ]
  const bridgeSteps: QuotationAnalysisBridgeStep[] = []
  let runningTotal = 0

  for (const step of steps) {
    const nextTotal = roundMoney(runningTotal + step.amount)

    bridgeSteps.push({
      key: step.key,
      amount: step.amount,
      cumulativeStart: roundMoney(Math.min(runningTotal, nextTotal)),
      cumulativeEnd: roundMoney(Math.max(runningTotal, nextTotal)),
    })

    runningTotal = nextTotal
  }

  bridgeSteps.push({
    key: 'grandTotal',
    amount: roundMoney(totals.grandTotal),
    cumulativeStart: 0,
    cumulativeEnd: roundMoney(totals.grandTotal),
  })

  return bridgeSteps
}

function collectCurrencyExposure(item: QuotationItem) {
  const exposure = new Map<string, number>()

  collectCurrencyExposureFromItem(item, exposure, 1)

  return Object.fromEntries(
    Array.from(exposure.entries())
      .filter(([, amount]) => amount > 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, amount]) => [currency, roundMoney(amount)]),
  ) as Record<string, number>
}

function collectCurrencyExposureFromItem(
  item: QuotationItem,
  exposure: Map<string, number>,
  quantityMultiplier: number,
) {
  const nextQuantityMultiplier = roundMoney(quantityMultiplier * toPositiveNumber(item.quantity))

  if (item.children.length > 0) {
    item.children.forEach((child) => {
      collectCurrencyExposureFromItem(child, exposure, nextQuantityMultiplier)
    })
    return
  }

  const amount = calculateLineCost({
    quantity: nextQuantityMultiplier,
    unitCost: item.unitCost,
    costCurrency: item.costCurrency,
  })

  if (amount <= 0) {
    return
  }

  exposure.set(item.costCurrency, roundMoney((exposure.get(item.costCurrency) ?? 0) + amount))
}

function countLeafItems(items: QuotationItem[]): number {
  return items.reduce((count, item) => {
    if (item.children.length === 0) {
      return count + 1
    }

    return count + countLeafItems(item.children)
  }, 0)
}

function countCurrencies(items: QuotationItem[]) {
  const currencies = new Set<string>()

  collectCurrencies(items, currencies)

  return currencies.size
}

function collectCurrencies(items: QuotationItem[], currencies: Set<string>) {
  items.forEach((item) => {
    if (item.children.length === 0) {
      currencies.add(item.costCurrency)
      return
    }

    collectCurrencies(item.children, currencies)
  })
}

function countMarkupOverrides(items: QuotationItem[]): number {
  return items.reduce((count, item) => {
    const ownCount = typeof item.markupRate === 'number' && Number.isFinite(item.markupRate) ? 1 : 0
    return count + ownCount + countMarkupOverrides(item.children)
  }, 0)
}

function calculateCostCoverageRate(
  items: QuotationItem[],
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  subtotalAfterMarkup: number,
) {
  if (subtotalAfterMarkup <= 0) {
    return 0
  }

  const coveredRevenue = roundMoney(
    sumAmounts(items.map((item) => collectCostCoverageRevenue(item, globalMarkupRate, exchangeRates))),
  )

  return calculateRate(coveredRevenue, subtotalAfterMarkup)
}

function collectCostCoverageRevenue(
  item: QuotationItem,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  inheritedMarkupRate?: number,
): number {
  const nextInheritedMarkupRate = getNextInheritedMarkupRate(item, inheritedMarkupRate)

  if (item.children.length > 0) {
    return roundMoney(
      toPositiveNumber(item.quantity)
        * sumAmounts(
          item.children.map((child) =>
            collectCostCoverageRevenue(child, globalMarkupRate, exchangeRates, nextInheritedMarkupRate),
          ),
        ),
    )
  }

  if (!hasKnownCostData(item)) {
    return 0
  }

  return calculateLineCostCoverageRevenue(item, globalMarkupRate, exchangeRates, nextInheritedMarkupRate)
}

function calculateLineCostCoverageRevenue(
  item: QuotationItem,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  inheritedMarkupRate?: number,
) {
  return roundMoney(
    toPositiveNumber(item.quantity)
      * calculateLineSellingUnitPrice(item, globalMarkupRate, exchangeRates, inheritedMarkupRate),
  )
}

function calculateLineSellingUnitPrice(
  item: QuotationItem,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  inheritedMarkupRate?: number,
) {
  if (item.pricingMethod === 'manual_price' && !hasKnownCostData(item)) {
    return 0
  }

  return calculateUnitSellingPrice(
    item,
    getEffectiveMarkupRate(item.markupRate, inheritedMarkupRate ?? globalMarkupRate),
    exchangeRates,
  )
}

function getNextInheritedMarkupRate(item: QuotationItem, inheritedMarkupRate?: number) {
  if (typeof item.markupRate === 'number' && Number.isFinite(item.markupRate)) {
    return Math.max(item.markupRate, 0)
  }

  return inheritedMarkupRate
}

function hasKnownCostData(item: QuotationItem) {
  return item.pricingMethod === 'cost_plus' || (Number.isFinite(item.unitCost) && item.unitCost > 0)
}

function calculateRate(amount: number, total: number) {
  if (!Number.isFinite(amount) || !Number.isFinite(total) || total <= 0) {
    return 0
  }

  return roundMoney((amount / total) * 100)
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
