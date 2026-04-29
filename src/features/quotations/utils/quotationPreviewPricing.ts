import type { ExchangeRateTable, QuotationItem, TotalsConfig } from '../types'
import {
  getEffectiveMarkupRate,
} from './quotationCalculations'
import { findQuotationItemPath } from './quotationItems'
import { getQuotationItemPricingDisplay } from './quotationItemPricing'

export interface QuotationPreviewRowPricing {
  unitPrice: number | null
  amount: number | null
  isGroup: boolean
  taxClassId: string | null
  taxClassLabel: string | null
  hasMixedTaxClasses: boolean
  unitPriceWithTax: number | null
  amountWithTax: number | null
}

export function getQuotationPreviewRowPricing(
  majorItems: QuotationItem[],
  rowKey: string,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  totalsConfig: TotalsConfig,
): QuotationPreviewRowPricing {
  const path = findQuotationPreviewItemPath(majorItems, rowKey)
  const item = path?.at(-1)

  if (!path || !item) {
    return {
      unitPrice: null,
      amount: null,
      isGroup: false,
      taxClassId: null,
      taxClassLabel: null,
      hasMixedTaxClasses: false,
      unitPriceWithTax: null,
      amountWithTax: null,
    }
  }

  const inheritedMarkupRate = getAncestorMarkupRate(path, globalMarkupRate)
  const inheritedTaxClassId = getAncestorTaxClassId(path)
  const isGroup = item.children.length > 0
  const pricing = getQuotationItemPricingDisplay(
    item,
    globalMarkupRate,
    exchangeRates,
    totalsConfig,
    inheritedMarkupRate === undefined ? null : { rate: inheritedMarkupRate, sourceLabel: '' },
    inheritedTaxClassId,
  )

  return {
    unitPrice: pricing.unitSellingPrice,
    amount: pricing.subtotal,
    isGroup,
    taxClassId: pricing.taxClassId,
    taxClassLabel: pricing.taxClassLabel,
    hasMixedTaxClasses: pricing.hasMixedTaxClasses,
    unitPriceWithTax: pricing.unitPriceWithTax,
    amountWithTax: pricing.totalWithTax,
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

function getAncestorTaxClassId(path: QuotationItem[]) {
  if (path.length <= 1) {
    return undefined
  }

  return path
    .slice(0, -1)
    .reduce<string | undefined>(
      (currentTaxClassId, item) => item.taxClassId ?? currentTaxClassId,
      undefined,
    )
}
