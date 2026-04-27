import type { ExchangeRateTable, QuotationItem } from '../types'
import {
  calculateQuotationItemBaseSubtotal,
  calculateQuotationItemSellingAmount,
  calculateQuotationItemUnitSellingPrice,
  calculateUnitSellingPrice,
  getEffectiveMarkupRate,
} from './quotationCalculations'

export interface InheritedMarkupContext {
  rate: number
  sourceLabel: string
}

export interface QuotationItemPricingDisplay {
  effectiveMarkupRate: number
  markupSource: 'self' | 'inherited' | 'global'
  markupSourceLabel: string
  baseAmount: number
  markupAmount: number
  subtotal: number
  unitSellingPrice: number
}

export function getQuotationItemPricingDisplay(
  item: QuotationItem,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  inheritedMarkupContext?: InheritedMarkupContext | null,
): QuotationItemPricingDisplay {
  const hasOwnMarkup = typeof item.markupRate === 'number' && Number.isFinite(item.markupRate)
  const inheritedRate = inheritedMarkupContext?.rate
  const effectiveMarkupRate = getEffectiveMarkupRate(item.markupRate, inheritedRate ?? globalMarkupRate)
  const baseAmount = calculateQuotationItemBaseSubtotal(item, exchangeRates)
  const subtotal = calculateQuotationItemSellingAmount(item, globalMarkupRate, exchangeRates, inheritedRate)

  return {
    effectiveMarkupRate,
    markupSource: hasOwnMarkup ? 'self' : inheritedMarkupContext ? 'inherited' : 'global',
    markupSourceLabel: hasOwnMarkup ? 'This item' : inheritedMarkupContext?.sourceLabel ?? 'Global',
    baseAmount,
    markupAmount: roundMoney(subtotal - baseAmount),
    subtotal,
    unitSellingPrice:
      item.children.length > 0
        ? calculateQuotationItemUnitSellingPrice(item, globalMarkupRate, exchangeRates, inheritedRate)
        : calculateUnitSellingPrice(item, effectiveMarkupRate, exchangeRates),
  }
}

export function createInheritedMarkupContext(
  item: QuotationItem,
  itemNumber: string,
  inheritedMarkupContext?: InheritedMarkupContext | null,
) {
  if (typeof item.markupRate === 'number' && Number.isFinite(item.markupRate)) {
    return {
      rate: Math.max(item.markupRate, 0),
      sourceLabel: itemNumber,
    } satisfies InheritedMarkupContext
  }

  return inheritedMarkupContext ?? null
}

export function calculateQuotationItemSectionUnitCost(item: QuotationItem, exchangeRates: ExchangeRateTable) {
  return item.children.reduce((sum, child) => sum + calculateQuotationItemBaseSubtotal(child, exchangeRates), 0)
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
