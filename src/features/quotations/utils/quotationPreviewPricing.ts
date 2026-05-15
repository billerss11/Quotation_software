import type { ExchangeRateTable, QuotationItem, QuotationRootItem, TotalsConfig } from '../types'
import {
  getEffectiveMarkupRate,
} from './quotationCalculations'
import { findQuotationItemPath, isQuotationItem } from './quotationItems'
import {
  createInheritedMarkupContext,
  getQuotationItemPricingDisplay,
  type InheritedMarkupContext,
} from './quotationItemPricing'

export interface QuotationPreviewRowPricing {
  unitPrice: number | null
  amount: number | null
  isGroup: boolean
  taxClassId: string | null
  taxClassLabel: string | null
  taxRate: number | null
  effectiveTaxRate: number | null
  hasMixedTaxClasses: boolean
  unitPriceWithTax: number | null
  amountWithTax: number | null
}

export function getQuotationPreviewRowPricing(
  majorItems: QuotationRootItem[],
  rowKey: string,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  totalsConfig: TotalsConfig,
): QuotationPreviewRowPricing {
  const mappedPricing = createQuotationPreviewRowPricingMap(
    majorItems,
    globalMarkupRate,
    exchangeRates,
    totalsConfig,
  ).get(rowKey)

  if (mappedPricing) {
    return mappedPricing
  }

  const path = findQuotationPreviewItemPath(majorItems, rowKey)
  const item = path?.at(-1)

  if (!path || !item) {
    return {
      unitPrice: null,
      amount: null,
      isGroup: false,
      taxClassId: null,
      taxClassLabel: null,
      taxRate: null,
      effectiveTaxRate: null,
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
    taxRate: pricing.taxRate,
    effectiveTaxRate: pricing.effectiveTaxRate,
    hasMixedTaxClasses: pricing.hasMixedTaxClasses,
    unitPriceWithTax: pricing.unitPriceWithTax,
    amountWithTax: pricing.totalWithTax,
  }
}

export function createQuotationPreviewRowPricingMap(
  majorItems: QuotationRootItem[],
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  totalsConfig: TotalsConfig,
): Map<string, QuotationPreviewRowPricing> {
  const pricingByKey = new Map<string, QuotationPreviewRowPricing>()
  let pricedItemCount = 0

  majorItems.forEach((item) => {
    if (!isQuotationItem(item)) {
      return
    }

    pricedItemCount += 1
    collectQuotationPreviewRowPricing(
      pricingByKey,
      item,
      `${item.id}-major`,
      String(pricedItemCount),
      globalMarkupRate,
      exchangeRates,
      totalsConfig,
      null,
      undefined,
    )
  })

  return pricingByKey
}

function findQuotationPreviewItemPath(majorItems: QuotationRootItem[], rowKey: string) {
  const itemId = rowKey.replace(/-(major|sub|section|subtotal)$/, '')
  return findQuotationItemPath(majorItems, itemId)
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

function collectQuotationPreviewRowPricing(
  pricingByKey: Map<string, QuotationPreviewRowPricing>,
  item: QuotationItem,
  rowKey: string,
  itemNumber: string,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  totalsConfig: TotalsConfig,
  inheritedMarkupContext: InheritedMarkupContext | null,
  inheritedTaxClassId?: string,
) {
  const isGroup = item.children.length > 0
  const pricing = getQuotationItemPricingDisplay(
    item,
    globalMarkupRate,
    exchangeRates,
    totalsConfig,
    inheritedMarkupContext,
    inheritedTaxClassId,
  )

  pricingByKey.set(rowKey, {
    unitPrice: pricing.unitSellingPrice,
    amount: pricing.subtotal,
    isGroup,
    taxClassId: pricing.taxClassId,
    taxClassLabel: pricing.taxClassLabel,
    taxRate: pricing.taxRate,
    effectiveTaxRate: pricing.effectiveTaxRate,
    hasMixedTaxClasses: pricing.hasMixedTaxClasses,
    unitPriceWithTax: pricing.unitPriceWithTax,
    amountWithTax: pricing.totalWithTax,
  })

  const nextInheritedMarkupContext = createInheritedMarkupContext(item, itemNumber, inheritedMarkupContext)
  const nextInheritedTaxClassId = item.taxClassId ?? inheritedTaxClassId

  item.children.forEach((child, index) => {
    collectQuotationPreviewRowPricing(
      pricingByKey,
      child,
      `${child.id}-sub`,
      `${itemNumber}.${index + 1}`,
      globalMarkupRate,
      exchangeRates,
      totalsConfig,
      nextInheritedMarkupContext,
      nextInheritedTaxClassId,
    )
  })
}
