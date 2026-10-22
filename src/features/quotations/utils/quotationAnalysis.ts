import type {
  ExchangeRateTable,
  MajorItemSummary,
  QuotationDraft,
  QuotationItem,
  QuotationTotals,
} from '../types'
import { calculateLineCost, calculateUnitSellingPrice, getEffectiveMarkupRate } from './quotationCalculations'
import { roundMoney, scaleRoundedAmounts } from './moneyMath'
import { getQuotationRootItems } from './quotationItems'
import {
  findResolvedTaxClassInNormalizedConfig,
  normalizeTaxConfig,
  resolveInheritedTaxClassId,
  type NormalizedTaxConfig,
} from './quotationTaxes'

const LOW_MARKUP_RATE_THRESHOLD = 10

export type QuotationAnalysisAdvisoryType = 'currency_mix' | 'tax_mix' | 'zero_markup' | 'low_markup'
export type QuotationAnalysisAdvisorySeverity = 'review' | 'check'

export interface QuotationAnalysisAdvisory {
  id: string
  type: QuotationAnalysisAdvisoryType
  severity: QuotationAnalysisAdvisorySeverity
  itemId: string
  itemName: string
  parentItemId?: string
  parentItemName?: string
  itemPath?: string[]
  currencies?: string[]
  taxClasses?: string[]
  markupRate?: number
  threshold?: number
}

export interface QuotationAnalysisKpis {
  baseSubtotal: number
  markupAmount: number
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
  knownCostRevenue: number
  finalPriceRevenueWithoutCost: number
  profitAmount: number
  effectiveMarkupRate: number
  grossMarginRate: number
  currencyExposure: Record<string, number>
  taxClassLabels: string[]
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
  key: 'baseSubtotal' | 'knownCostProfit' | 'salesWithoutCost' | 'taxAmount' | 'extraCharges' | 'grandTotal'
  amount: number
  cumulativeStart: number
  cumulativeEnd: number
}

export interface QuotationAnalysisProfitConfidence {
  knownCostRevenue: number
  finalPriceRevenueWithoutCost: number
  finalPriceItemCountWithoutCost: number
  costVisibilityRate: number
}

interface QuotationAnalysisFinancialContributions {
  knownCostRevenue: number
  finalPriceRevenueWithoutCost: number
  finalPriceItemCountWithoutCost: number
  knownCostBase: number
  knownCostProfit: number
}

interface MarkupCheckRow {
  itemId: string
  itemName: string
  parentItemId?: string
  parentItemName?: string
  itemPath: string[]
  markupRate: number
}

export interface QuotationAnalysisDataset {
  hasMeaningfulData: boolean
  kpis: QuotationAnalysisKpis
  compositionSummary: QuotationAnalysisCompositionSummary
  advisories: QuotationAnalysisAdvisory[]
  profitConfidence: QuotationAnalysisProfitConfidence
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
  const normalizedTaxConfig = normalizeTaxConfig(quotation.totalsConfig)
  const financialContributionsByItemId = new Map(
    rootItems.map((item) => [
      item.id,
      collectFinancialContributions(
        item,
        quotation.totalsConfig.globalMarkupRate,
        quotation.exchangeRates,
      ),
    ]),
  )
  const majorItemRows = rootItems
    .map((item) =>
      createMajorItemRow(
        item,
        quotation.exchangeRates,
        quotation.totalsConfig.globalMarkupRate,
        normalizedTaxConfig,
        summaryByItemId.get(item.id),
        financialContributionsByItemId.get(item.id),
      ),
    )
    .filter((row): row is QuotationAnalysisMajorItemRow => row !== null)
    .sort((left, right) => right.subtotal - left.subtotal || right.baseSubtotal - left.baseSubtotal)
  const currencies = Array.from(
    new Set(majorItemRows.flatMap((row) => Object.keys(row.currencyExposure))),
  ).sort((left, right) => left.localeCompare(right))
  const financialContributions = Array.from(financialContributionsByItemId.values())
  const profitConfidence = createProfitConfidence(financialContributions, totals.subtotalAfterMarkup)
  const grossMarginAmount = roundMoney(sumAmounts(financialContributions.map((row) => row.knownCostProfit)))
  const advisories = createAdvisories(
    majorItemRows,
    rootItems,
    quotation.totalsConfig.globalMarkupRate,
    quotation.exchangeRates,
  )

  return {
    hasMeaningfulData: majorItemRows.length > 0,
    kpis: {
      baseSubtotal: roundMoney(totals.baseSubtotal),
      markupAmount: roundMoney(totals.markupAmount),
      taxAmount: roundMoney(totals.taxAmount),
      grandTotal: roundMoney(totals.grandTotal),
      grossMarginAmount,
      grossMarginRate: calculateRate(grossMarginAmount, profitConfidence.knownCostRevenue),
      costCoverageRate: profitConfidence.costVisibilityRate,
    },
    compositionSummary: {
      majorItemCount: rootItems.length,
      pricedLineCount: countLeafItems(rootItems),
      currencyCount: countCurrencies(rootItems, quotation.exchangeRates),
      markupOverrideCount: countMarkupOverrides(rootItems),
    },
    advisories,
    profitConfidence,
    majorItemRows,
    currencyExposure: {
      currencies,
      rows: majorItemRows.map((row) => ({
        itemId: row.itemId,
        itemName: row.itemName,
        values: row.currencyExposure,
      })),
    },
    bridge: createBridgeSteps(totals, grossMarginAmount, profitConfidence.finalPriceRevenueWithoutCost),
  }
}

function createMajorItemRow(
  item: QuotationItem,
  exchangeRates: ExchangeRateTable,
  globalMarkupRate: number,
  normalizedTaxConfig: NormalizedTaxConfig,
  summary?: MajorItemSummary,
  financialContributions?: QuotationAnalysisFinancialContributions,
): QuotationAnalysisMajorItemRow | null {
  if (!summary || !financialContributions) {
    return null
  }

  if (summary.baseSubtotal <= 0 && summary.subtotal <= 0) {
    return null
  }

  const profitAmount = financialContributions.knownCostProfit

  return {
    itemId: item.id,
    itemName: item.name,
    baseSubtotal: roundMoney(summary.baseSubtotal),
    subtotal: roundMoney(summary.subtotal),
    knownCostRevenue: financialContributions.knownCostRevenue,
    finalPriceRevenueWithoutCost: financialContributions.finalPriceRevenueWithoutCost,
    profitAmount,
    effectiveMarkupRate: calculateRate(profitAmount, summary.baseSubtotal),
    grossMarginRate: calculateRate(profitAmount, financialContributions.knownCostRevenue),
    currencyExposure: collectCurrencyExposure(item, exchangeRates),
    taxClassLabels: collectTaxClassLabels(item, normalizedTaxConfig, globalMarkupRate, exchangeRates),
  }
}

function createAdvisories(
  majorItemRows: QuotationAnalysisMajorItemRow[],
  rootItems: QuotationItem[],
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
): QuotationAnalysisAdvisory[] {
  const currencyAdvisories = majorItemRows
    .filter((row) => Object.keys(row.currencyExposure).length > 1)
    .map((row): QuotationAnalysisAdvisory => ({
      id: `currency-${row.itemId}`,
      type: 'currency_mix',
      severity: 'review',
      itemId: row.itemId,
      itemName: row.itemName,
      currencies: Object.keys(row.currencyExposure),
    }))
  const taxAdvisories = majorItemRows
    .filter((row) => row.taxClassLabels.length > 1)
    .map((row): QuotationAnalysisAdvisory => ({
      id: `tax-${row.itemId}`,
      type: 'tax_mix',
      severity: 'review',
      itemId: row.itemId,
      itemName: row.itemName,
      taxClasses: row.taxClassLabels,
    }))
  const markupRows = rootItems.flatMap((item) =>
    collectMarkupCheckRows(item, item, globalMarkupRate, exchangeRates),
  )
  const zeroMarkupAdvisories = markupRows
    .filter((row) => row.markupRate <= 0)
    .map((row): QuotationAnalysisAdvisory => ({
      id: `zero-markup-${row.itemId}`,
      type: 'zero_markup',
      severity: 'check',
      itemId: row.itemId,
      itemName: row.itemName,
      parentItemId: row.parentItemId,
      parentItemName: row.parentItemName,
      itemPath: row.itemPath,
      markupRate: row.markupRate,
    }))
  const lowMarkupAdvisories = markupRows
    .filter((row) =>
      row.markupRate > 0
      && row.markupRate < LOW_MARKUP_RATE_THRESHOLD,
    )
    .map((row): QuotationAnalysisAdvisory => ({
      id: `low-markup-${row.itemId}`,
      type: 'low_markup',
      severity: 'review',
      itemId: row.itemId,
      itemName: row.itemName,
      parentItemId: row.parentItemId,
      parentItemName: row.parentItemName,
      itemPath: row.itemPath,
      markupRate: row.markupRate,
      threshold: LOW_MARKUP_RATE_THRESHOLD,
    }))

  return [
    ...currencyAdvisories,
    ...taxAdvisories,
    ...zeroMarkupAdvisories,
    ...lowMarkupAdvisories,
  ]
}

function createBridgeSteps(
  totals: QuotationTotals,
  knownCostProfit: number,
  salesWithoutCost: number,
): QuotationAnalysisBridgeStep[] {
  const extraCharges = roundMoney(totals.grandTotal - totals.taxableSubtotal - totals.taxAmount)
  const steps: Array<Pick<QuotationAnalysisBridgeStep, 'key' | 'amount'>> = [
    { key: 'baseSubtotal', amount: roundMoney(totals.baseSubtotal) },
    { key: 'knownCostProfit', amount: roundMoney(knownCostProfit) },
    ...(salesWithoutCost > 0 ? [{ key: 'salesWithoutCost' as const, amount: roundMoney(salesWithoutCost) }] : []),
    { key: 'taxAmount', amount: roundMoney(totals.taxAmount) },
    ...(extraCharges > 0 ? [{ key: 'extraCharges' as const, amount: extraCharges }] : []),
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

function collectCurrencyExposure(item: QuotationItem, exchangeRates: ExchangeRateTable) {
  if (item.children.length === 0) {
    const amount = calculateLineCost(item, exchangeRates)
    return amount > 0 ? { [item.costCurrency]: amount } : {}
  }

  const exposure = new Map<string, number>()
  for (const child of item.children) {
    for (const [currency, amount] of Object.entries(collectCurrencyExposure(child, exchangeRates))) {
      exposure.set(currency, roundMoney((exposure.get(currency) ?? 0) + amount))
    }
  }
  const currencies = [...exposure.keys()]
  const scaledAmounts = scaleRoundedAmounts([...exposure.values()], item.quantity)

  return Object.fromEntries(
    currencies.map((currency, index) => [currency, scaledAmounts[index]] as const)
      .filter(([, amount]) => amount > 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, amount]) => [currency, roundMoney(amount)]),
  ) as Record<string, number>
}

function collectTaxClassLabels(
  item: QuotationItem,
  normalizedTaxConfig: NormalizedTaxConfig,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
) {
  const taxClasses = new Map<string, string>()

  collectTaxClassesFromItem(item, normalizedTaxConfig, taxClasses, globalMarkupRate, exchangeRates)

  return Array.from(taxClasses.values()).sort((left, right) => left.localeCompare(right))
}

function collectTaxClassesFromItem(
  item: QuotationItem,
  normalizedTaxConfig: NormalizedTaxConfig,
  taxClasses: Map<string, string>,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  quantityMultiplier = 1,
  inheritedTaxClassId?: string,
  inheritedMarkupRate?: number,
) {
  const nextInheritedTaxClassId = resolveInheritedTaxClassId(normalizedTaxConfig, item.taxClassId, inheritedTaxClassId)
  const nextInheritedMarkupRate = getNextInheritedMarkupRate(item, inheritedMarkupRate)
  const nextQuantityMultiplier = quantityMultiplier * toPositiveNumber(item.quantity)

  if (item.children.length > 0) {
    item.children.forEach((child) => {
      collectTaxClassesFromItem(
        child,
        normalizedTaxConfig,
        taxClasses,
        globalMarkupRate,
        exchangeRates,
        nextQuantityMultiplier,
        nextInheritedTaxClassId,
        nextInheritedMarkupRate,
      )
    })
    return
  }

  if (calculateLeafSellingAmount(item, nextQuantityMultiplier, globalMarkupRate, exchangeRates, inheritedMarkupRate) <= 0) {
    return
  }

  const taxClass = findResolvedTaxClassInNormalizedConfig(normalizedTaxConfig, item.taxClassId, inheritedTaxClassId)
  taxClasses.set(taxClass.id, taxClass.label)
}

function collectMarkupCheckRows(
  item: QuotationItem,
  rootItem: QuotationItem,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  quantityMultiplier = 1,
  inheritedMarkupRate?: number,
  path: QuotationItem[] = [],
): MarkupCheckRow[] {
  const nextQuantityMultiplier = quantityMultiplier * toPositiveNumber(item.quantity)
  const nextInheritedMarkupRate = getNextInheritedMarkupRate(item, inheritedMarkupRate)
  const nextPath = [...path, item]

  if (item.children.length > 0) {
    return item.children.flatMap((child) =>
      collectMarkupCheckRows(
        child,
        rootItem,
        globalMarkupRate,
        exchangeRates,
        nextQuantityMultiplier,
        nextInheritedMarkupRate,
        nextPath,
      ),
    )
  }

  const baseSubtotal = calculateLineCost({
    quantity: nextQuantityMultiplier,
    unitCost: item.unitCost,
    costCurrency: item.costCurrency,
  }, exchangeRates)

  if (baseSubtotal <= 0) {
    return []
  }

  const sellingAmount = calculateLeafSellingAmount(
    item,
    nextQuantityMultiplier,
    globalMarkupRate,
    exchangeRates,
    inheritedMarkupRate,
  )
  const markupRate = calculateRate(roundMoney(sellingAmount - baseSubtotal), baseSubtotal)

  return [
    {
      itemId: item.id,
      itemName: item.name,
      parentItemId: item.id === rootItem.id ? undefined : rootItem.id,
      parentItemName: item.id === rootItem.id ? undefined : rootItem.name,
      itemPath: nextPath.map((pathItem) => pathItem.name),
      markupRate,
    },
  ]
}

function calculateLeafSellingAmount(
  item: QuotationItem,
  quantity: number,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  inheritedMarkupRate?: number,
) {
  return roundMoney(
    quantity
    * calculateUnitSellingPrice(
      item,
      getEffectiveMarkupRate(item.markupRate, inheritedMarkupRate ?? globalMarkupRate),
      exchangeRates,
    ),
  )
}

function countLeafItems(items: QuotationItem[]): number {
  return items.reduce((count, item) => {
    if (item.children.length === 0) {
      return count + 1
    }

    return count + countLeafItems(item.children)
  }, 0)
}

function countCurrencies(items: QuotationItem[], exchangeRates: ExchangeRateTable) {
  const currencies = new Set<string>()

  collectCurrencies(items, currencies, exchangeRates)

  return currencies.size
}

function collectCurrencies(
  items: QuotationItem[],
  currencies: Set<string>,
  exchangeRates: ExchangeRateTable,
  quantityMultiplier = 1,
) {
  items.forEach((item) => {
    const nextQuantityMultiplier = quantityMultiplier * toPositiveNumber(item.quantity)

    if (item.children.length === 0) {
      const amount = calculateLineCost({
        quantity: nextQuantityMultiplier,
        unitCost: item.unitCost,
        costCurrency: item.costCurrency,
      }, exchangeRates)

      if (amount > 0) {
        currencies.add(item.costCurrency)
      }

      return
    }

    collectCurrencies(item.children, currencies, exchangeRates, nextQuantityMultiplier)
  })
}

function countMarkupOverrides(items: QuotationItem[]): number {
  return items.reduce((count, item) => {
    const ownCount = typeof item.markupRate === 'number' && Number.isFinite(item.markupRate) ? 1 : 0
    return count + ownCount + countMarkupOverrides(item.children)
  }, 0)
}

function createProfitConfidence(
  rows: QuotationAnalysisFinancialContributions[],
  subtotalAfterMarkup: number,
): QuotationAnalysisProfitConfidence {
  const knownCostRevenue = roundMoney(sumAmounts(rows.map((row) => row.knownCostRevenue)))
  const finalPriceRevenueWithoutCost = roundMoney(sumAmounts(rows.map((row) => row.finalPriceRevenueWithoutCost)))

  return {
    knownCostRevenue,
    finalPriceRevenueWithoutCost,
    finalPriceItemCountWithoutCost: rows.reduce(
      (count, row) => count + row.finalPriceItemCountWithoutCost,
      0,
    ),
    costVisibilityRate: calculateRate(knownCostRevenue, subtotalAfterMarkup),
  }
}

function collectFinancialContributions(
  item: QuotationItem,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  inheritedMarkupRate?: number,
): QuotationAnalysisFinancialContributions {
  const nextInheritedMarkupRate = getNextInheritedMarkupRate(item, inheritedMarkupRate)
  const quantity = toPositiveNumber(item.quantity)

  if (item.children.length > 0) {
    const rows = item.children.map((child) =>
      collectFinancialContributions(child, globalMarkupRate, exchangeRates, nextInheritedMarkupRate),
    )
    const [knownCostRevenue, finalPriceRevenueWithoutCost] = scaleRoundedAmounts([
      roundMoney(sumAmounts(rows.map((row) => row.knownCostRevenue))),
      roundMoney(sumAmounts(rows.map((row) => row.finalPriceRevenueWithoutCost))),
    ], quantity)
    const [knownCostBase] = scaleRoundedAmounts([
      roundMoney(sumAmounts(rows.map((row) => row.knownCostBase))),
    ], quantity)

    return {
      knownCostRevenue,
      finalPriceRevenueWithoutCost,
      knownCostBase,
      knownCostProfit: roundMoney(knownCostRevenue - knownCostBase),
      finalPriceItemCountWithoutCost: quantity > 0 ? rows.reduce(
        (count, row) => count + row.finalPriceItemCountWithoutCost,
        0,
      ) : 0,
    }
  }

  const sellingAmount = roundMoney(
    quantity
    * calculateUnitSellingPrice(
      item,
      getEffectiveMarkupRate(item.markupRate, inheritedMarkupRate ?? globalMarkupRate),
      exchangeRates,
    ),
  )
  const knownCostBase = calculateLineCost(item, exchangeRates)

  if (hasKnownCostData(item)) {
    return {
      knownCostRevenue: sellingAmount,
      finalPriceRevenueWithoutCost: 0,
      knownCostBase,
      knownCostProfit: roundMoney(sellingAmount - knownCostBase),
      finalPriceItemCountWithoutCost: 0,
    }
  }

  if (item.pricingMethod === 'manual_price' && sellingAmount > 0) {
    return {
      knownCostRevenue: 0,
      finalPriceRevenueWithoutCost: sellingAmount,
      knownCostBase: 0,
      knownCostProfit: 0,
      finalPriceItemCountWithoutCost: 1,
    }
  }

  return {
    knownCostRevenue: 0,
    finalPriceRevenueWithoutCost: 0,
    knownCostBase: 0,
    knownCostProfit: 0,
    finalPriceItemCountWithoutCost: 0,
  }
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
