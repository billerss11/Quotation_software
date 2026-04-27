import type { ExchangeRateTable, QuotationItem } from '../types'
import {
  calculateQuotationItemSellingAmount,
  calculateQuotationItemUnitSellingPrice,
  calculateUnitSellingPrice,
  getEffectiveMarkupRate,
} from './quotationCalculations'
import { findQuotationItemPath } from './quotationItems'

export interface QuotationPreviewRowPricing {
  unitPrice: number | null
  amount: number | null
  isGroup: boolean
}

export function getQuotationPreviewRowPricing(
  majorItems: QuotationItem[],
  rowKey: string,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
): QuotationPreviewRowPricing {
  const path = findQuotationPreviewItemPath(majorItems, rowKey)
  const item = path?.at(-1)

  if (!path || !item) {
    return {
      unitPrice: null,
      amount: null,
      isGroup: false,
    }
  }

  const inheritedMarkupRate = getAncestorMarkupRate(path, globalMarkupRate)
  const isGroup = item.children.length > 0

  return {
    unitPrice: isGroup
      ? calculateQuotationItemUnitSellingPrice(item, globalMarkupRate, exchangeRates, inheritedMarkupRate)
      : calculateUnitSellingPrice(item, getPathMarkupRate(path, globalMarkupRate), exchangeRates),
    amount: calculateQuotationItemSellingAmount(item, globalMarkupRate, exchangeRates, inheritedMarkupRate),
    isGroup,
  }
}

function findQuotationPreviewItemPath(majorItems: QuotationItem[], rowKey: string) {
  const itemId = rowKey.replace(/-(major|sub|subtotal)$/, '')
  return findQuotationItemPath(majorItems, itemId)
}

function getPathMarkupRate(path: QuotationItem[], globalMarkupRate: number) {
  return path.reduce(
    (currentMarkupRate, item) => getEffectiveMarkupRate(item.markupRate, currentMarkupRate),
    globalMarkupRate,
  )
}

function getAncestorMarkupRate(path: QuotationItem[], globalMarkupRate: number) {
  if (path.length <= 1) {
    return undefined
  }

  return path
    .slice(0, -1)
    .reduce(
      (currentMarkupRate, item) => getEffectiveMarkupRate(item.markupRate, currentMarkupRate),
      globalMarkupRate,
    )
}
