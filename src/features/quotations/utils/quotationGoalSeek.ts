import type { ExchangeRateTable, QuotationItem, QuotationRootItem } from '../types'
import {
  calculateLineCost,
  calculateLineSellingAmount,
  calculateQuotationTotals,
  calculateUnitSellingPrice,
} from './quotationCalculations'
import { roundMoney } from './moneyMath'
import { MAX_MARKUP_RATE } from './pricingLimits'
import { getQuotationRootItems } from './quotationItems'

export type ItemGoalSeekFailureReason =
  | 'ineligible_item'
  | 'invalid_unit_cost'
  | 'target_below_minimum'
  | 'target_above_maximum'

export type QuotationGoalSeekFailureReason =
  | 'no_adjustable_items'
  | 'target_below_minimum'
  | 'target_above_maximum'

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
    targetSubtotal: number
    projectedSubtotal: number
    fixedSubtotal: number
    adjustableBaseSubtotal: number
    minimumSubtotal: number
    maximumSubtotal: number
  }
  | {
    ok: false
    reason: QuotationGoalSeekFailureReason
    fixedSubtotal?: number
    adjustableBaseSubtotal?: number
    minimumSubtotal?: number
    maximumSubtotal?: number
  }

interface QuotationGoalSeekSubtotals {
  fixedSubtotal: number
  adjustableBaseSubtotal: number
}

export interface ItemGoalSeekCandidate {
  item: QuotationItem
  itemNumber: string
  currentUnitPrice: number
  convertedUnitCost: number
}

export function collectItemGoalSeekCandidates(
  items: QuotationRootItem[],
  exchangeRates: ExchangeRateTable,
  globalMarkupRate = 0,
): ItemGoalSeekCandidate[] {
  return collectItemGoalSeekCandidatesFromItems(getQuotationRootItems(items), exchangeRates, globalMarkupRate)
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
  targetSubtotalBeforeTax: number,
  exchangeRates: ExchangeRateTable,
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

  const targetSubtotal = roundMoneyValue(targetSubtotalBeforeTax)
  const minimumSubtotal = roundMoneyValue(fixedSubtotal + adjustableBaseSubtotal)
  const maximumSubtotal = roundMoneyValue(fixedSubtotal + (adjustableBaseSubtotal * (1 + MAX_MARKUP_RATE / 100)))

  if (targetSubtotal < minimumSubtotal) {
    return {
      ok: false,
      reason: 'target_below_minimum',
      fixedSubtotal,
      adjustableBaseSubtotal,
      minimumSubtotal,
      maximumSubtotal,
    }
  }

  if (targetSubtotal > maximumSubtotal) {
    return {
      ok: false,
      reason: 'target_above_maximum',
      fixedSubtotal,
      adjustableBaseSubtotal,
      minimumSubtotal,
      maximumSubtotal,
    }
  }

  const markupRate = targetSubtotal === minimumSubtotal
    ? 0
    : roundMarkupRate(((targetSubtotal - fixedSubtotal) / adjustableBaseSubtotal - 1) * 100)

  return {
    ok: true,
    markupRate,
    targetSubtotal,
    projectedSubtotal: calculateGoalSeekSubtotal(items, markupRate, exchangeRates),
    fixedSubtotal,
    adjustableBaseSubtotal,
    minimumSubtotal,
    maximumSubtotal,
  }
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

    const convertedUnitCost = roundRateInput(getConvertedUnitCost(item, exchangeRates))

    if (!isGoalSeekDetailItem(item) || convertedUnitCost <= 0) {
      return []
    }

    return [{
      item,
      itemNumber,
      currentUnitPrice: calculateUnitSellingPrice(
        item,
        getOwnMarkupRate(item) ?? inheritedMarkupRate ?? globalMarkupRate,
        exchangeRates,
      ),
      convertedUnitCost,
    }]
  })
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

function calculateGoalSeekSubtotal(items: QuotationRootItem[], globalMarkupRate: number, exchangeRates: ExchangeRateTable) {
  return calculateQuotationTotals(
    items,
    {
      globalMarkupRate,
      taxRate: 0,
    },
    exchangeRates,
  ).subtotalAfterMarkup
}

function roundMarkupRate(value: number) {
  return Math.round(normalizePositiveNumber(value) * 10_000) / 10_000
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
