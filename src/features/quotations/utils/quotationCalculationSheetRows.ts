import type { ExchangeRateTable, PricingMethod, QuotationItem, TotalsConfig } from '../types'
import {
  createInheritedMarkupContext,
  getQuotationItemPricingDisplay,
  type InheritedMarkupContext,
} from './quotationItemPricingDisplay'

export interface CalculationSheetRow {
  itemId: string
  itemNumber: string
  depth: number
  name: string
  quantity: number
  quantityUnit: string
  isGroup: boolean
  pricingMethod: PricingMethod
  costCurrency: string | null
  hasMixedCostCurrencies: boolean
  exchangeRate: number | null
  unitCost: number
  totalCost: number
  markupRate: number
  markupSource: 'self' | 'inherited' | 'global'
  markupSourceLabel: string | null
  unitMarkupAmount: number
  totalMarkupAmount: number
  unitPrice: number
  subtotal: number
  taxClassLabel: string | null
  taxRate: number | null
  effectiveTaxRate: number | null
  hasMixedTaxClasses: boolean
  unitTaxAmount: number
  totalTaxAmount: number
  unitTotalWithTax: number
  totalWithTax: number
}

export interface CreateCalculationSheetRowsOptions {
  item: QuotationItem
  itemNumber: string
  globalMarkupRate: number
  exchangeRates: ExchangeRateTable
  totalsConfig: TotalsConfig
}

export function createCalculationSheetRows(options: CreateCalculationSheetRowsOptions): CalculationSheetRow[] {
  return collectCalculationSheetRows({
    ...options,
    depth: 1,
    inheritedMarkupContext: null,
    inheritedTaxClassId: undefined,
  })
}

function collectCalculationSheetRows(options: CreateCalculationSheetRowsOptions & {
  depth: number
  inheritedMarkupContext: InheritedMarkupContext | null
  inheritedTaxClassId?: string
}): CalculationSheetRow[] {
  const pricing = getQuotationItemPricingDisplay(
    options.item,
    options.globalMarkupRate,
    options.exchangeRates,
    options.totalsConfig,
    options.inheritedMarkupContext,
    options.inheritedTaxClassId,
  )
  const nextInheritedMarkupContext = createInheritedMarkupContext(
    options.item,
    options.itemNumber,
    options.inheritedMarkupContext,
  )
  const nextInheritedTaxClassId = options.item.taxClassId ?? options.inheritedTaxClassId
  const costCurrencySummary = getCostCurrencySummary(options.item)

  return [
    {
      itemId: options.item.id,
      itemNumber: options.itemNumber,
      depth: options.depth,
      name: options.item.name,
      quantity: options.item.quantity,
      quantityUnit: options.item.quantityUnit,
      isGroup: options.item.children.length > 0,
      pricingMethod: options.item.pricingMethod === 'manual_price' ? 'manual_price' : 'cost_plus',
      costCurrency: costCurrencySummary.currency,
      hasMixedCostCurrencies: costCurrencySummary.mixed,
      exchangeRate: options.item.children.length > 0 ? null : getExchangeRate(options.exchangeRates, options.item.costCurrency),
      unitCost: calculateUnitAmount(pricing.baseAmount, options.item.quantity),
      totalCost: pricing.baseAmount,
      markupRate: pricing.effectiveMarkupRate,
      markupSource: pricing.markupSource,
      markupSourceLabel: pricing.markupSource === 'inherited' ? pricing.markupSourceLabel : null,
      unitMarkupAmount: calculateUnitAmount(pricing.markupAmount, options.item.quantity),
      totalMarkupAmount: pricing.markupAmount,
      unitPrice: pricing.unitSellingPrice,
      subtotal: pricing.subtotal,
      taxClassLabel: pricing.hasMixedTaxClasses ? null : pricing.taxClassLabel,
      taxRate: pricing.taxRate,
      effectiveTaxRate: pricing.effectiveTaxRate,
      hasMixedTaxClasses: pricing.hasMixedTaxClasses,
      unitTaxAmount: calculateUnitAmount(pricing.taxAmount, options.item.quantity),
      totalTaxAmount: pricing.taxAmount,
      unitTotalWithTax: pricing.unitPriceWithTax,
      totalWithTax: pricing.totalWithTax,
    },
    ...options.item.children.flatMap((child, index) =>
      collectCalculationSheetRows({
        ...options,
        item: child,
        itemNumber: `${options.itemNumber}.${index + 1}`,
        depth: options.depth + 1,
        inheritedMarkupContext: nextInheritedMarkupContext,
        inheritedTaxClassId: nextInheritedTaxClassId,
      }),
    ),
  ]
}

function getCostCurrencySummary(item: QuotationItem) {
  const currencies = collectLeafCostCurrencies(item)

  if (currencies.size === 1) {
    return {
      currency: [...currencies][0] ?? null,
      mixed: false,
    }
  }

  return {
    currency: null,
    mixed: currencies.size > 1,
  }
}

function collectLeafCostCurrencies(item: QuotationItem): Set<string> {
  if (item.children.length === 0) {
    return new Set([item.costCurrency])
  }

  return item.children.reduce((currencies, child) => {
    for (const currency of collectLeafCostCurrencies(child)) {
      currencies.add(currency)
    }

    return currencies
  }, new Set<string>())
}

function calculateUnitAmount(amount: number, quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0
  }

  return roundMoney(amount / quantity)
}

function getExchangeRate(exchangeRates: ExchangeRateTable, currency: string) {
  return exchangeRates[currency] ?? 1
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
