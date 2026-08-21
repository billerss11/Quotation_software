import type {
  ExchangeRateTable,
  QuotationItem,
  QuotationRootItem,
  QuotationTotals,
  TotalsConfig,
} from '../types'
import {
  calculateLineCost,
  calculateLineSellingAmount,
  calculateQuotationTotals,
  calculateUnitSellingPrice,
} from './quotationCalculations'
import { roundMoney } from './moneyMath'
import { MAX_MARKUP_RATE } from './pricingLimits'
import { getQuotationRootItems } from './quotationItems'

const MARKUP_RATE_SCALE = 10_000

export type ItemGoalSeekFailureReason =
  | 'ineligible_item'
  | 'invalid_unit_cost'
  | 'target_below_minimum'
  | 'target_above_maximum'

export type QuotationGoalSeekFailureReason =
  | 'no_adjustable_items'
  | 'target_below_minimum'
  | 'target_above_maximum'
  | 'target_unreachable'

export type QuotationGoalSeekTarget =
  | 'subtotal_before_tax'
  | 'total_after_tax'
  | 'quotation_total'

export interface QuotationGoalSeekOptions {
  target: QuotationGoalSeekTarget
  totalsConfig: TotalsConfig
}

export type ItemGoalSeekResult =
  | {
    ok: true
    markupRate: number
    targetUnitPrice: number
    projectedUnitPrice: number
    convertedUnitCost: number
    minimumTarget: number
    maximumTarget: number
  }
  | {
    ok: false
    reason: ItemGoalSeekFailureReason
    convertedUnitCost?: number
    minimumTarget?: number
    maximumTarget?: number
  }

export type QuotationGoalSeekResult =
  | {
    ok: true
    markupRate: number
    targetAmount: number
    projectedAmount: number
    fixedSubtotal: number
    adjustableBaseSubtotal: number
    minimumAmount: number
    maximumAmount: number
  }
  | {
    ok: false
    reason: QuotationGoalSeekFailureReason
    fixedSubtotal?: number
    adjustableBaseSubtotal?: number
    minimumAmount?: number
    maximumAmount?: number
    targetAmount?: number
    closestMarkupRate?: number
    closestAmount?: number
  }

interface QuotationGoalSeekSubtotals {
  fixedSubtotal: number
  adjustableBaseSubtotal: number
}

export interface ItemGoalSeekCandidate {
  item: QuotationItem
  itemNumber: string
  currentUnitPrice: number
  currentMarkupRate: number
  convertedUnitCost: number
}

export function collectItemGoalSeekCandidates(
  items: QuotationRootItem[],
  exchangeRates: ExchangeRateTable,
  globalMarkupRate = 0,
): ItemGoalSeekCandidate[] {
  return collectItemGoalSeekCandidatesFromItems(getQuotationRootItems(items), exchangeRates, globalMarkupRate)
}

export function collectScopedItemGoalSeekCandidates(
  items: QuotationRootItem[],
  itemId: string,
  exchangeRates: ExchangeRateTable,
  globalMarkupRate = 0,
): ItemGoalSeekCandidate[] {
  return collectScopedItemGoalSeekCandidatesFromItems(
    getQuotationRootItems(items),
    itemId,
    exchangeRates,
    globalMarkupRate,
  )
}

export function solveItemGoalSeekMarkup(
  item: QuotationItem,
  targetUnitPriceBeforeTax: number,
  exchangeRates: ExchangeRateTable,
): ItemGoalSeekResult {
  if (item.children.length > 0 || item.pricingMethod === 'manual_price') {
    return { ok: false, reason: 'ineligible_item' }
  }

  const convertedUnitCost = roundRateInput(getConvertedUnitCost(item, exchangeRates))

  if (convertedUnitCost <= 0) {
    return { ok: false, reason: 'invalid_unit_cost', convertedUnitCost: 0 }
  }

  const targetUnitPrice = roundMoneyValue(targetUnitPriceBeforeTax)
  const minimumTarget = calculateUnitSellingPrice(item, 0, exchangeRates)
  const maximumTarget = calculateUnitSellingPrice(item, MAX_MARKUP_RATE, exchangeRates)

  if (targetUnitPrice < minimumTarget) {
    return {
      ok: false,
      reason: 'target_below_minimum',
      convertedUnitCost,
      minimumTarget,
      maximumTarget,
    }
  }

  if (targetUnitPrice > maximumTarget) {
    return {
      ok: false,
      reason: 'target_above_maximum',
      convertedUnitCost,
      minimumTarget,
      maximumTarget,
    }
  }

  const markupRate = targetUnitPrice === minimumTarget
    ? 0
    : roundMarkupRate(((targetUnitPrice - convertedUnitCost) / convertedUnitCost) * 100)

  return {
    ok: true,
    markupRate,
    targetUnitPrice,
    projectedUnitPrice: calculateUnitSellingPrice(item, markupRate, exchangeRates),
    convertedUnitCost,
    minimumTarget,
    maximumTarget,
  }
}

export function solveQuotationGoalSeekGlobalMarkup(
  items: QuotationRootItem[],
  targetAmountInput: number,
  exchangeRates: ExchangeRateTable,
  options: QuotationGoalSeekOptions = {
    target: 'subtotal_before_tax',
    totalsConfig: { globalMarkupRate: 0, taxRate: 0 },
  },
): QuotationGoalSeekResult {
  const subtotals = collectQuotationGoalSeekSubtotals(getQuotationRootItems(items), exchangeRates)
  const fixedSubtotal = roundMoneyValue(subtotals.fixedSubtotal)
  const adjustableBaseSubtotal = roundMoneyValue(subtotals.adjustableBaseSubtotal)

  if (adjustableBaseSubtotal <= 0) {
    return {
      ok: false,
      reason: 'no_adjustable_items',
      fixedSubtotal,
      adjustableBaseSubtotal,
    }
  }

  const targetAmount = roundMoneyValue(targetAmountInput)
  const minimumAmount = calculateGoalSeekAmount(items, 0, exchangeRates, options)
  const maximumAmount = calculateGoalSeekAmount(items, MAX_MARKUP_RATE, exchangeRates, options)

  if (targetAmount < minimumAmount) {
    return {
      ok: false,
      reason: 'target_below_minimum',
      fixedSubtotal,
      adjustableBaseSubtotal,
      minimumAmount,
      maximumAmount,
    }
  }

  if (targetAmount > maximumAmount) {
    return {
      ok: false,
      reason: 'target_above_maximum',
      fixedSubtotal,
      adjustableBaseSubtotal,
      minimumAmount,
      maximumAmount,
    }
  }

  const closest = findClosestQuotationGoalSeekResult(items, targetAmount, exchangeRates, options)
  if (!closest.exact) {
    return {
      ok: false,
      reason: 'target_unreachable',
      targetAmount,
      closestMarkupRate: closest.markupRate,
      closestAmount: closest.projectedAmount,
      fixedSubtotal,
      adjustableBaseSubtotal,
      minimumAmount,
      maximumAmount,
    }
  }

  return {
    ok: true,
    markupRate: closest.markupRate,
    targetAmount,
    projectedAmount: closest.projectedAmount,
    fixedSubtotal,
    adjustableBaseSubtotal,
    minimumAmount,
    maximumAmount,
  }
}

export function getQuotationGoalSeekTargetAmount(
  totals: QuotationTotals,
  target: QuotationGoalSeekTarget,
) {
  if (target === 'total_after_tax') {
    return roundMoney(totals.taxableSubtotal + totals.taxAmount)
  }

  if (target === 'quotation_total') {
    return totals.grandTotal
  }

  return totals.subtotalAfterMarkup
}

export function isGoalSeekDetailItem(item: QuotationItem) {
  return item.children.length === 0 && item.pricingMethod !== 'manual_price'
}

function collectItemGoalSeekCandidatesFromItems(
  items: QuotationItem[],
  exchangeRates: ExchangeRateTable,
  globalMarkupRate: number,
  parentNumber = '',
  inheritedMarkupRate?: number,
): ItemGoalSeekCandidate[] {
  return items.flatMap((item, index) => {
    const itemNumber = parentNumber ? `${parentNumber}.${index + 1}` : String(index + 1)
    const nextInheritedMarkupRate = getOwnMarkupRate(item) ?? inheritedMarkupRate

    if (item.children.length > 0) {
      return collectItemGoalSeekCandidatesFromItems(
        item.children,
        exchangeRates,
        globalMarkupRate,
        itemNumber,
        nextInheritedMarkupRate,
      )
    }

    const candidate = createItemGoalSeekCandidate(
      item,
      itemNumber,
      exchangeRates,
      globalMarkupRate,
      inheritedMarkupRate,
    )

    return candidate ? [candidate] : []
  })
}

function collectScopedItemGoalSeekCandidatesFromItems(
  items: QuotationItem[],
  targetItemId: string,
  exchangeRates: ExchangeRateTable,
  globalMarkupRate: number,
  parentNumber = '',
  inheritedMarkupRate?: number,
): ItemGoalSeekCandidate[] {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const itemNumber = parentNumber ? `${parentNumber}.${index + 1}` : String(index + 1)
    const nextInheritedMarkupRate = getOwnMarkupRate(item) ?? inheritedMarkupRate

    if (item.id === targetItemId) {
      if (item.children.length > 0) {
        return collectItemGoalSeekCandidatesFromItems(
          item.children,
          exchangeRates,
          globalMarkupRate,
          itemNumber,
          nextInheritedMarkupRate,
        )
      }

      const candidate = createItemGoalSeekCandidate(
        item,
        itemNumber,
        exchangeRates,
        globalMarkupRate,
        inheritedMarkupRate,
      )

      return candidate ? [candidate] : []
    }

    if (item.children.length === 0) {
      continue
    }

    const childCandidates = collectScopedItemGoalSeekCandidatesFromItems(
      item.children,
      targetItemId,
      exchangeRates,
      globalMarkupRate,
      itemNumber,
      nextInheritedMarkupRate,
    )

    if (childCandidates.length > 0) {
      return childCandidates
    }
  }

  return []
}

function createItemGoalSeekCandidate(
  item: QuotationItem,
  itemNumber: string,
  exchangeRates: ExchangeRateTable,
  globalMarkupRate: number,
  inheritedMarkupRate?: number,
): ItemGoalSeekCandidate | null {
  const convertedUnitCost = roundRateInput(getConvertedUnitCost(item, exchangeRates))

  if (!isGoalSeekDetailItem(item) || convertedUnitCost <= 0) {
    return null
  }

  const currentMarkupRate = getOwnMarkupRate(item) ?? inheritedMarkupRate ?? globalMarkupRate

  return {
    item,
    itemNumber,
    currentUnitPrice: calculateUnitSellingPrice(
      item,
      currentMarkupRate,
      exchangeRates,
    ),
    currentMarkupRate,
    convertedUnitCost,
  }
}

function collectQuotationGoalSeekSubtotals(
  items: QuotationItem[],
  exchangeRates: ExchangeRateTable,
  inheritedMarkupRate?: number,
  quantityMultiplier = 1,
): QuotationGoalSeekSubtotals {
  return items.reduce<QuotationGoalSeekSubtotals>(
    (subtotals, item) => {
      const itemQuantityMultiplier = quantityMultiplier * normalizePositiveNumber(item.quantity)
      const nextInheritedMarkupRate = getOwnMarkupRate(item) ?? inheritedMarkupRate

      if (item.children.length > 0) {
        const childSubtotals = collectQuotationGoalSeekSubtotals(
          item.children,
          exchangeRates,
          nextInheritedMarkupRate,
          itemQuantityMultiplier,
        )

        return {
          fixedSubtotal: subtotals.fixedSubtotal + childSubtotals.fixedSubtotal,
          adjustableBaseSubtotal: subtotals.adjustableBaseSubtotal + childSubtotals.adjustableBaseSubtotal,
        }
      }

      if (item.pricingMethod === 'manual_price') {
        return {
          ...subtotals,
          fixedSubtotal: subtotals.fixedSubtotal + quantityMultiplier * calculateLineSellingAmount(item, 0, exchangeRates),
        }
      }

      const ownMarkupRate = getOwnMarkupRate(item)

      if (ownMarkupRate !== undefined || inheritedMarkupRate !== undefined) {
        return {
          ...subtotals,
          fixedSubtotal:
            subtotals.fixedSubtotal
            + quantityMultiplier * calculateLineSellingAmount(item, ownMarkupRate ?? inheritedMarkupRate ?? 0, exchangeRates),
        }
      }

      return {
        ...subtotals,
        adjustableBaseSubtotal: subtotals.adjustableBaseSubtotal + quantityMultiplier * calculateLineCost(item, exchangeRates),
      }
    },
    { fixedSubtotal: 0, adjustableBaseSubtotal: 0 },
  )
}

function getOwnMarkupRate(item: QuotationItem) {
  return typeof item.markupRate === 'number' && Number.isFinite(item.markupRate)
    ? Math.max(item.markupRate, 0)
    : undefined
}

function getConvertedUnitCost(item: QuotationItem, exchangeRates: ExchangeRateTable) {
  const rate = item.costCurrency ? exchangeRates[item.costCurrency] : 1
  return normalizePositiveNumber(item.unitCost) * normalizePositiveNumber(rate)
}

function roundMoneyValue(value: number) {
  return roundMoney(normalizePositiveNumber(value))
}

function calculateGoalSeekAmount(
  items: QuotationRootItem[],
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  options: QuotationGoalSeekOptions,
) {
  const totals = calculateQuotationTotals(
    items,
    {
      ...options.totalsConfig,
      globalMarkupRate,
    },
    exchangeRates,
  )

  return getQuotationGoalSeekTargetAmount(totals, options.target)
}

function findClosestQuotationGoalSeekResult(
  items: QuotationRootItem[],
  targetAmount: number,
  exchangeRates: ExchangeRateTable,
  options: QuotationGoalSeekOptions,
) {
  const maximumTick = Math.round(MAX_MARKUP_RATE * MARKUP_RATE_SCALE)
  let lowerBound = 0
  let upperBound = maximumTick

  while (lowerBound <= upperBound) {
    const tick = Math.floor((lowerBound + upperBound) / 2)
    const projectedAmount = calculateGoalSeekAmount(items, tick / MARKUP_RATE_SCALE, exchangeRates, options)

    if (projectedAmount < targetAmount) {
      lowerBound = tick + 1
    } else {
      upperBound = tick - 1
    }
  }

  const candidateTicks = [...new Set([
    Math.max(0, Math.min(maximumTick, lowerBound - 1)),
    Math.max(0, Math.min(maximumTick, lowerBound)),
  ])]
  const candidates = candidateTicks.map((tick) => ({
    tick,
    markupRate: tick / MARKUP_RATE_SCALE,
    projectedAmount: calculateGoalSeekAmount(items, tick / MARKUP_RATE_SCALE, exchangeRates, options),
  }))
  const exactCandidate = candidates.find((candidate) => candidate.projectedAmount === targetAmount)
  if (exactCandidate) {
    let lastExactTick = exactCandidate.tick
    let exactLowerBound = exactCandidate.tick + 1
    let exactUpperBound = maximumTick

    while (exactLowerBound <= exactUpperBound) {
      const tick = Math.floor((exactLowerBound + exactUpperBound) / 2)
      const projectedAmount = calculateGoalSeekAmount(items, tick / MARKUP_RATE_SCALE, exchangeRates, options)

      if (projectedAmount <= targetAmount) {
        lastExactTick = tick
        exactLowerBound = tick + 1
      } else {
        exactUpperBound = tick - 1
      }
    }

    const currentTick = Math.round(
      Math.min(normalizePositiveNumber(options.totalsConfig.globalMarkupRate), MAX_MARKUP_RATE)
      * MARKUP_RATE_SCALE,
    )
    const representativeTick = currentTick >= exactCandidate.tick && currentTick <= lastExactTick
      ? currentTick
      : Math.round((exactCandidate.tick + lastExactTick) / 2)
    return {
      markupRate: representativeTick / MARKUP_RATE_SCALE,
      projectedAmount: calculateGoalSeekAmount(
        items,
        representativeTick / MARKUP_RATE_SCALE,
        exchangeRates,
        options,
      ),
      exact: true as const,
    }
  }

  const closestCandidate = candidates.reduce((closest, candidate) =>
    Math.abs(candidate.projectedAmount - targetAmount)
      < Math.abs(closest.projectedAmount - targetAmount)
      ? candidate
      : closest,
  )
  return { ...closestCandidate, exact: false as const }
}

function roundMarkupRate(value: number) {
  return Math.round(Math.min(normalizePositiveNumber(value), MAX_MARKUP_RATE) * MARKUP_RATE_SCALE) / MARKUP_RATE_SCALE
}

function roundRateInput(value: number) {
  return Math.round(normalizePositiveNumber(value) * 1_000_000) / 1_000_000
}

function normalizePositiveNumber(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(value, 0)
}
