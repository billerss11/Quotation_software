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
  calculateExtraChargesTotal,
  calculateQuotationTotals,
  calculateUnitSellingPrice,
} from './quotationCalculations'
import { roundMoney } from './moneyMath'
import { MAX_MARKUP_RATE } from './pricingLimits'
import { getQuotationRootItems } from './quotationItems'
import { findResolvedTaxClassInNormalizedConfig, normalizeTaxConfig } from './quotationTaxes'

const MARKUP_RATE_SCALE = 10_000

export type ItemGoalSeekFailureReason =
  | 'ineligible_item'
  | 'invalid_unit_cost'
  | 'target_below_minimum'
  | 'target_above_maximum'
  | 'target_unreachable'

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

  let markupRate = targetUnitPrice === minimumTarget
    ? 0
    : roundMarkupRate(((targetUnitPrice - convertedUnitCost) / convertedUnitCost) * 100)

  if (calculateUnitSellingPrice(item, markupRate, exchangeRates) !== targetUnitPrice) {
    let low = 0
    let high = MAX_MARKUP_RATE * MARKUP_RATE_SCALE
    while (low < high) {
      const tick = Math.floor((low + high) / 2)
      if (calculateUnitSellingPrice(item, tick / MARKUP_RATE_SCALE, exchangeRates) < targetUnitPrice) {
        low = tick + 1
      } else {
        high = tick
      }
    }
    markupRate = low / MARKUP_RATE_SCALE
    if (calculateUnitSellingPrice(item, markupRate, exchangeRates) !== targetUnitPrice) {
      return { ok: false, reason: 'target_unreachable', convertedUnitCost, minimumTarget, maximumTarget }
    }
  }

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
  const needsTaxRoundingSearch = options.target !== 'subtotal_before_tax'
    && normalizeTaxConfig(options.totalsConfig).taxClasses.length > 1
    && hasFractionalGroupQuantity(getQuotationRootItems(items))

  if (targetAmount < minimumAmount && !needsTaxRoundingSearch) {
    return {
      ok: false,
      reason: 'target_below_minimum',
      fixedSubtotal,
      adjustableBaseSubtotal,
      minimumAmount,
      maximumAmount,
    }
  }

  if (targetAmount > maximumAmount && !needsTaxRoundingSearch) {
    return {
      ok: false,
      reason: 'target_above_maximum',
      fixedSubtotal,
      adjustableBaseSubtotal,
      minimumAmount,
      maximumAmount,
    }
  }

  let closest = findClosestQuotationGoalSeekResult(items, targetAmount, exchangeRates, options)
  if (!closest.exact && needsTaxRoundingSearch) {
    closest = findTaxRoundedGoalSeekResult(items, targetAmount, exchangeRates, options, closest)
  }
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
    const projectedAmount = calculateGoalSeekAmount(
      items,
      representativeTick / MARKUP_RATE_SCALE,
      exchangeRates,
      options,
    )
    // Tax reconciliation can break the apparent plateau. Only return a
    // representative rate after checking its actual total.
    return {
      markupRate: projectedAmount === targetAmount ? representativeTick / MARKUP_RATE_SCALE : exactCandidate.markupRate,
      projectedAmount: targetAmount,
      exact: true as const,
    }
  }

  const closestCandidate = candidates.reduce((closest, candidate) =>
    Math.abs(candidate.projectedAmount - targetAmount)
      < Math.abs(closest.projectedAmount - targetAmount)
      ? candidate
      : closest,
  )
  return { markupRate: closestCandidate.markupRate, projectedAmount: closestCandidate.projectedAmount, exact: false }
}

function hasFractionalGroupQuantity(items: QuotationItem[]): boolean {
  return items.some((item) => item.children.length > 0 && (
    !Number.isInteger(item.quantity) || hasFractionalGroupQuantity(item.children)
  ))
}

// With mixed taxes, reconciling a fractional group can move a cent between
// tax classes. Search those non-monotonic regions using conservative bounds.
// The unrounded extension of leaf subtotals is monotonic; the error budget
// below covers every group round, bucket adjustment, and final tax round.
function findTaxRoundedGoalSeekResult(
  items: QuotationRootItem[],
  targetAmount: number,
  exchangeRates: ExchangeRateTable,
  options: QuotationGoalSeekOptions,
  initial: { markupRate: number; projectedAmount: number; exact: boolean },
) {
  const taxConfig = normalizeTaxConfig(options.totalsConfig)
  const leaves: Array<{ item: QuotationItem; multiplier: number; taxRate: number; markupRate?: number }> = []
  const halfCent = 0.00500001
  function collect(item: QuotationItem, multiplier = 1, markupRate?: number, taxClassId?: string): {
    subtotalError: number; bucketError: number; classes: Set<string>
  } {
    const quantity = normalizePositiveNumber(item.quantity)
    if (multiplier <= 0 || quantity <= 0) {
      return { subtotalError: 0, bucketError: 0, classes: new Set() }
    }
    const nextMarkup = getOwnMarkupRate(item) ?? markupRate
    const nextTaxClassId = item.taxClassId ?? taxClassId
    if (item.children.length === 0) {
      const taxClass = findResolvedTaxClassInNormalizedConfig(taxConfig, item.taxClassId, taxClassId)
      leaves.push({ item, multiplier, taxRate: taxClass.rate, markupRate: nextMarkup })
      return { subtotalError: 0, bucketError: 0, classes: new Set([taxClass.id]) }
    }
    const children = item.children.map((child) => collect(child, multiplier * quantity, nextMarkup, nextTaxClassId))
    const classes = new Set(children.flatMap((child) => [...child.classes]))
    return {
      subtotalError: quantity * children.reduce((sum, child) => sum + child.subtotalError, 0) + halfCent,
      bucketError: quantity * children.reduce((sum, child) => sum + child.bucketError, 0)
        + (classes.size === 1 ? 1 : 2 * classes.size + 1) * halfCent,
      classes,
    }
  }
  const roots = getQuotationRootItems(items).map((item) => collect(item))
  const classes = new Set(roots.flatMap((root) => [...root.classes]))
  const errorBudget = roots.reduce((sum, root) => sum + root.subtotalError + root.bucketError, 0)
    + (classes.size + 1) * halfCent
  const extraCharges = options.target === 'quotation_total' ? calculateExtraChargesTotal(options.totalsConfig.extraCharges) : 0
  function evaluate(tick: number) {
    const markupRate = tick / MARKUP_RATE_SCALE
    const amounts = leaves.map((leaf) => calculateLineSellingAmount(leaf.item, leaf.markupRate ?? markupRate, exchangeRates))
    const estimate = amounts.reduce((sum, amount, index) =>
      sum + amount * leaves[index].multiplier * (1 + leaves[index].taxRate / 100), extraCharges)
    return { tick, markupRate, amounts, estimate, projectedAmount: calculateGoalSeekAmount(items, markupRate, exchangeRates, options) }
  }
  let closest = initial
  function consider(value: ReturnType<typeof evaluate>) {
    if (Math.abs(value.projectedAmount - targetAmount) < Math.abs(closest.projectedAmount - targetAmount)) {
      closest = { markupRate: value.markupRate, projectedAmount: value.projectedAmount, exact: value.projectedAmount === targetAmount }
    }
  }
  const current = evaluate(Math.round(roundMarkupRate(options.totalsConfig.globalMarkupRate) * MARKUP_RATE_SCALE))
  consider(current)
  const pending = [[evaluate(0), evaluate(MAX_MARKUP_RATE * MARKUP_RATE_SCALE)]]
  while (pending.length > 0 && !closest.exact) {
    const [low, high] = pending.pop()!
    consider(low)
    consider(high)
    const distance = Math.abs(closest.projectedAmount - targetAmount)
    const tolerance = errorBudget + Number.EPSILON * Math.max(1, high.estimate) * (leaves.length + 1) * 8
    if (low.estimate - tolerance > targetAmount + distance || high.estimate + tolerance < targetAmount - distance) continue
    if (high.tick - low.tick <= 1 || low.amounts.every((amount, index) => amount === high.amounts[index])) continue
    const midTick = Math.floor((low.tick + high.tick) / 2)
    const mid = evaluate(midTick)
    consider(mid)
    pending.push([mid, high], [low, mid])
  }
  return closest
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
