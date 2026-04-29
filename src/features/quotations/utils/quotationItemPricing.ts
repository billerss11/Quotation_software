import type { ExchangeRateTable, QuotationItem, TaxClass, TotalsConfig } from '../types'
import {
  calculateLineSellingAmount,
  calculateQuotationItemBaseSubtotal,
  calculateQuotationItemSellingAmount,
  calculateQuotationItemUnitSellingPrice,
  calculateUnitSellingPrice,
  getEffectiveMarkupRate,
} from './quotationCalculations'
import { findResolvedTaxClass, normalizeTaxRate } from './quotationTaxes'

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
  taxClassId: string | null
  taxClassLabel: string | null
  taxRate: number | null
  hasMixedTaxClasses: boolean
  taxAmount: number
  totalWithTax: number
  unitPriceWithTax: number
}

export function getQuotationItemPricingDisplay(
  item: QuotationItem,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  totalsConfig: TotalsConfig,
  inheritedMarkupContext?: InheritedMarkupContext | null,
  inheritedTaxClassId?: string,
): QuotationItemPricingDisplay {
  const hasOwnMarkup = typeof item.markupRate === 'number' && Number.isFinite(item.markupRate)
  const inheritedRate = inheritedMarkupContext?.rate
  const effectiveMarkupRate = getEffectiveMarkupRate(item.markupRate, inheritedRate ?? globalMarkupRate)
  const baseAmount = calculateQuotationItemBaseSubtotal(item, exchangeRates)
  const subtotal = calculateQuotationItemSellingAmount(item, globalMarkupRate, exchangeRates, inheritedRate)
  const taxComputation = calculateQuotationItemTaxComputation(
    item,
    globalMarkupRate,
    exchangeRates,
    totalsConfig,
    inheritedRate,
    inheritedTaxClassId,
  )
  const resolvedTaxClass = taxComputation.taxClasses.length === 1 ? taxComputation.taxClasses[0] : null
  const taxAmount = taxComputation.taxAmount
  const totalWithTax = roundMoney(subtotal + taxAmount)
  const unitSellingPrice =
    item.children.length > 0
      ? calculateQuotationItemUnitSellingPrice(item, globalMarkupRate, exchangeRates, inheritedRate)
      : calculateUnitSellingPrice(item, effectiveMarkupRate, exchangeRates)

  return {
    effectiveMarkupRate,
    markupSource: hasOwnMarkup ? 'self' : inheritedMarkupContext ? 'inherited' : 'global',
    markupSourceLabel: hasOwnMarkup ? 'This item' : inheritedMarkupContext?.sourceLabel ?? 'Global',
    baseAmount,
    markupAmount: roundMoney(subtotal - baseAmount),
    subtotal,
    unitSellingPrice,
    taxClassId: resolvedTaxClass?.id ?? null,
    taxClassLabel: resolvedTaxClass?.label ?? null,
    taxRate: resolvedTaxClass?.rate ?? null,
    hasMixedTaxClasses: taxComputation.taxClasses.length > 1,
    taxAmount,
    totalWithTax,
    unitPriceWithTax: calculateUnitPriceWithTax(item, totalWithTax),
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

function calculateRateAmount(amount: number, rate: number) {
  return roundMoney(amount * (normalizeTaxRate(rate) / 100))
}

function calculateUnitPriceWithTax(item: QuotationItem, totalWithTax: number) {
  const quantity = toPositiveNumber(item.quantity)

  if (quantity <= 0) {
    return 0
  }

  return roundMoney(totalWithTax / quantity)
}

function calculateQuotationItemTaxComputation(
  item: QuotationItem,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  totalsConfig: TotalsConfig,
  inheritedMarkupRate?: number,
  inheritedTaxClassId?: string,
): {
  taxAmount: number
  taxClasses: TaxClass[]
} {
  const nextInheritedMarkupRate = getNextInheritedMarkupRate(item, inheritedMarkupRate)
  const nextInheritedTaxClassId = item.taxClassId ?? inheritedTaxClassId

  if (item.children.length > 0) {
    const childComputations = item.children.map((child) =>
      calculateQuotationItemTaxComputation(
        child,
        globalMarkupRate,
        exchangeRates,
        totalsConfig,
        nextInheritedMarkupRate,
        nextInheritedTaxClassId,
      ),
    )

    return {
      taxAmount: roundMoney(
        toPositiveNumber(item.quantity)
        * childComputations.reduce((sum, childComputation) => sum + childComputation.taxAmount, 0),
      ),
      taxClasses: dedupeTaxClasses(childComputations.flatMap((childComputation) => childComputation.taxClasses)),
    }
  }

  const taxClass = findResolvedTaxClass(totalsConfig, item.taxClassId, inheritedTaxClassId)
  const amount = calculateLineAmountWithInheritedMarkup(item, globalMarkupRate, exchangeRates, inheritedMarkupRate)

  return {
    taxAmount: calculateRateAmount(amount, taxClass.rate),
    taxClasses: [taxClass],
  }
}

function calculateLineAmountWithInheritedMarkup(
  item: QuotationItem,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  inheritedMarkupRate?: number,
) {
  return calculateLineSellingAmount(
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

function dedupeTaxClasses(taxClasses: TaxClass[]) {
  const uniqueTaxClasses = new Map<string, TaxClass>()

  taxClasses.forEach((taxClass) => {
    uniqueTaxClasses.set(taxClass.id, taxClass)
  })

  return Array.from(uniqueTaxClasses.values())
}

function toPositiveNumber(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(value, 0)
}
