import type {
  ExchangeRateTable,
  PricingMethod,
  QuotationItem,
  QuotationTaxBucket,
  TotalsConfig,
} from '../types'
import { roundMoney, roundMoneyDivision } from './moneyMath'
import { calculateCostSalesPercentage } from './quotationCalculations'
import {
  createInheritedMarkupContext,
  getQuotationItemPricingDisplay,
  type InheritedMarkupContext,
  type QuotationItemPricingTaxBucket,
} from './quotationItemPricingDisplay'
import {
  normalizeTaxConfig,
  type NormalizedTaxConfig,
} from './quotationTaxes'

export interface CalculationExplanationStep {
  id: string
  kind: string
  labelKey: string
  formulaKey: string
  values: Record<string, number | string | null>
}

export interface CalculationExplanationTaxSource {
  kind: 'self' | 'inherited' | 'default' | 'mixed'
  sourceLabel: string | null
}

export interface CalculationExplanationTotals {
  baseAmount: number
  markupAmount: number
  subtotal: number
  taxAmount: number
  totalWithTax: number
  unitSellingPrice: number
  unitPriceWithTax: number
  effectiveMarkupRate: number
  markupSource: 'self' | 'inherited' | 'global'
  markupSourceLabel: string | null
  taxClassLabel: string | null
  taxRate: number | null
  effectiveTaxRate: number | null
  hasMixedTaxClasses: boolean
  taxBuckets: QuotationItemPricingTaxBucket[]
  taxSource: CalculationExplanationTaxSource
}

export interface CalculationExplanationNode {
  itemId: string
  itemNumber: string
  name: string
  depth: number
  isGroup: boolean
  pricingMethod: 'cost_plus' | 'manual_price'
  quantity: number
  quantityUnit: string
  totals: CalculationExplanationTotals
  steps: CalculationExplanationStep[]
  children: CalculationExplanationNode[]
}

export interface CreateCalculationExplanationTreeOptions {
  item: QuotationItem
  itemNumber: string
  globalMarkupRate: number
  exchangeRates: ExchangeRateTable
  totalsConfig: TotalsConfig
  allocatedTaxBuckets?: QuotationTaxBucket[]
}

interface CreateCalculationExplanationNodeOptions extends CreateCalculationExplanationTreeOptions {
  depth: number
  inheritedMarkupContext: InheritedMarkupContext | null
  inheritedTaxClassId?: string
  inheritedTaxSourceLabel: string | null
  normalizedTaxConfig: NormalizedTaxConfig
}

export function createCalculationExplanationTree(
  options: CreateCalculationExplanationTreeOptions,
): CalculationExplanationNode {
  return createCalculationExplanationNode({
    ...options,
    depth: 1,
    inheritedMarkupContext: null,
    inheritedTaxClassId: undefined,
    inheritedTaxSourceLabel: null,
    normalizedTaxConfig: normalizeTaxConfig(options.totalsConfig),
  })
}

function createCalculationExplanationNode(
  options: CreateCalculationExplanationNodeOptions,
): CalculationExplanationNode {
  const pricing = getQuotationItemPricingDisplay(
    options.item,
    options.globalMarkupRate,
    options.exchangeRates,
    options.totalsConfig,
    options.inheritedMarkupContext,
    options.inheritedTaxClassId,
    { taxBuckets: options.depth === 1 ? options.allocatedTaxBuckets : undefined },
  )
  const nextInheritedMarkupContext = createInheritedMarkupContext(
    options.item,
    options.itemNumber,
    options.inheritedMarkupContext,
  )
  const nextInheritedTaxClassId = options.item.taxClassId ?? options.inheritedTaxClassId
  const nextInheritedTaxSourceLabel = options.item.taxClassId
    ? options.itemNumber
    : options.inheritedTaxSourceLabel
  const children = options.item.children.map((child, index) =>
    createCalculationExplanationNode({
      ...options,
      item: child,
      itemNumber: `${options.itemNumber}.${index + 1}`,
      depth: options.depth + 1,
      inheritedMarkupContext: nextInheritedMarkupContext,
      inheritedTaxClassId: nextInheritedTaxClassId,
      inheritedTaxSourceLabel: nextInheritedTaxSourceLabel,
      allocatedTaxBuckets: undefined,
    }),
  )
  const totals: CalculationExplanationTotals = {
    baseAmount: pricing.baseAmount,
    markupAmount: pricing.markupAmount,
    subtotal: pricing.subtotal,
    taxAmount: pricing.taxAmount,
    totalWithTax: pricing.totalWithTax,
    unitSellingPrice: pricing.unitSellingPrice,
    unitPriceWithTax: pricing.unitPriceWithTax,
    effectiveMarkupRate: pricing.effectiveMarkupRate,
    markupSource: pricing.markupSource,
    markupSourceLabel: pricing.markupSource === 'inherited' ? pricing.markupSourceLabel : null,
    taxClassLabel: pricing.hasMixedTaxClasses ? null : pricing.taxClassLabel,
    taxRate: pricing.taxRate,
    effectiveTaxRate: pricing.effectiveTaxRate,
    hasMixedTaxClasses: pricing.hasMixedTaxClasses,
    taxBuckets: pricing.taxBuckets,
    taxSource: getTaxSource(options, pricing.hasMixedTaxClasses),
  }
  const pricingMethod = getPricingMethod(options.item)

  return {
    itemId: options.item.id,
    itemNumber: options.itemNumber,
    name: options.item.name,
    depth: options.depth,
    isGroup: children.length > 0,
    pricingMethod,
    quantity: options.item.quantity,
    quantityUnit: options.item.quantityUnit,
    totals,
    steps: children.length > 0
      ? createGroupSteps(totals, children, options.item.quantity)
      : createLeafSteps(options.item, pricingMethod, totals, options.exchangeRates),
    children,
  }
}

function createLeafSteps(
  item: QuotationItem,
  pricingMethod: PricingMethod,
  totals: CalculationExplanationTotals,
  exchangeRates: ExchangeRateTable,
): CalculationExplanationStep[] {
  if (pricingMethod === 'manual_price') {
    return createManualPriceLeafSteps(item, totals, exchangeRates)
  }

  return createCostPlusLeafSteps(item, totals, exchangeRates)
}

function createCostPlusLeafSteps(
  item: QuotationItem,
  totals: CalculationExplanationTotals,
  exchangeRates: ExchangeRateTable,
): CalculationExplanationStep[] {
  const exchangeRate = getExchangeRate(item, exchangeRates)
  const rawConvertedUnitCost = toPositiveNumber(item.unitCost) * exchangeRate
  const convertedUnitCost = roundMoney(rawConvertedUnitCost)
  const unitMarkup = roundMoney(rawConvertedUnitCost * (totals.effectiveMarkupRate / 100))

  return [
    createStep('convertedUnitCost', {
      unitCost: toPositiveNumber(item.unitCost),
      exchangeRate,
      costCurrency: item.costCurrency,
      result: convertedUnitCost,
    }),
    createStep('unitMarkup', {
      rawConvertedUnitCost,
      markupRate: totals.effectiveMarkupRate,
      result: unitMarkup,
    }),
    createStep('unitSellingPrice', {
      convertedUnitCost,
      unitMarkup,
      result: totals.unitSellingPrice,
    }),
    createUnitTaxStep(totals, item.quantity),
    createLeafUnitPriceWithTaxStep(totals, item.quantity),
    createStep('subtotal', {
      unitSellingPrice: totals.unitSellingPrice,
      quantity: toPositiveNumber(item.quantity),
      result: totals.subtotal,
    }),
    ...createTaxSteps(totals),
    createTotalWithTaxStep(totals),
    createCostSalesPercentageStep(totals),
  ]
}

function createManualPriceLeafSteps(
  item: QuotationItem,
  totals: CalculationExplanationTotals,
  exchangeRates: ExchangeRateTable,
): CalculationExplanationStep[] {
  const exchangeRate = getExchangeRate(item, exchangeRates)
  const manualUnitPrice = roundMoney(toPositiveNumber(item.manualUnitPrice ?? 0))
  const convertedUnitCost = roundMoney(toPositiveNumber(item.unitCost) * exchangeRate)

  return [
    createStep('manualUnitPrice', {
      manualUnitPrice,
      result: totals.unitSellingPrice,
    }),
    createUnitTaxStep(totals, item.quantity),
    createLeafUnitPriceWithTaxStep(totals, item.quantity),
    createStep('manualSubtotal', {
      manualUnitPrice,
      quantity: toPositiveNumber(item.quantity),
      result: totals.subtotal,
    }),
    createStep('convertedTotalCost', {
      unitCost: toPositiveNumber(item.unitCost),
      exchangeRate,
      convertedUnitCost,
      quantity: toPositiveNumber(item.quantity),
      result: totals.baseAmount,
    }),
    totals.baseAmount > 0
      ? createStep('manualMarkupAmount', {
          subtotal: totals.subtotal,
          baseAmount: totals.baseAmount,
          result: totals.markupAmount,
        })
      : createStep('manualMarkupUnavailable', {
          result: totals.markupAmount,
        }),
    ...createTaxSteps(totals),
    createTotalWithTaxStep(totals),
    createCostSalesPercentageStep(totals),
  ]
}

function createGroupSteps(
  totals: CalculationExplanationTotals,
  children: CalculationExplanationNode[],
  quantity: number,
): CalculationExplanationStep[] {
  const childBaseAmount = sumChildTotals(children, (child) => child.totals.baseAmount)
  const childSubtotal = sumChildTotals(children, (child) => child.totals.subtotal)
  const childMarkupAmount = sumChildTotals(children, (child) => child.totals.markupAmount)
  return [
    createGroupUnitPriceWithTaxStep(totals, quantity),
    createStep('groupBaseRollup', {
      childTotal: childBaseAmount,
      quantity: toPositiveNumber(quantity),
      result: totals.baseAmount,
    }),
    createStep('groupSubtotalRollup', {
      childTotal: childSubtotal,
      quantity: toPositiveNumber(quantity),
      result: totals.subtotal,
    }),
    createStep('groupMarkupRollup', {
      childTotal: childMarkupAmount,
      quantity: toPositiveNumber(quantity),
      result: totals.markupAmount,
    }),
    createStep('groupEffectiveMarkupRate', {
      markupAmount: totals.markupAmount,
      baseAmount: totals.baseAmount,
      result: totals.effectiveMarkupRate,
    }),
    ...createTaxSteps(totals),
    createTotalWithTaxStep(totals),
    createCostSalesPercentageStep(totals),
  ]
}

function createTaxSteps(totals: CalculationExplanationTotals) {
  return [
    ...totals.taxBuckets.flatMap((bucket) => [
      createStep('taxBucketAmount', {
        taxClass: bucket.label,
        taxableSubtotal: bucket.taxableSubtotal,
        taxRate: bucket.rate,
        result: bucket.calculatedTaxAmount,
      }, `taxBucketAmount:${bucket.taxClassId}`),
      ...(bucket.taxRoundingAdjustment === 0
        ? []
        : [createStep('taxRoundingAllocation', {
            calculatedTaxAmount: bucket.calculatedTaxAmount,
            adjustment: bucket.taxRoundingAdjustment,
            result: bucket.taxAmount,
          }, `taxRoundingAllocation:${bucket.taxClassId}`)]),
    ]),
    createStep('taxAmount', {
      bucketCount: totals.taxBuckets.length,
      result: totals.taxAmount,
    }),
  ]
}

function createTotalWithTaxStep(totals: CalculationExplanationTotals) {
  return createStep('totalWithTax', {
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    result: totals.totalWithTax,
  })
}

function createUnitTaxStep(totals: CalculationExplanationTotals, quantity: number) {
  return createStep('unitTaxAmount', {
    taxAmount: totals.taxAmount,
    quantity: toPositiveNumber(quantity),
    result: calculateUnitAmount(totals.taxAmount, quantity),
  })
}

function createLeafUnitPriceWithTaxStep(totals: CalculationExplanationTotals, quantity: number) {
  return createStep('leafUnitPriceWithTax', {
    totalWithTax: totals.totalWithTax,
    quantity: toPositiveNumber(quantity),
    result: totals.unitPriceWithTax,
  })
}

function createGroupUnitPriceWithTaxStep(totals: CalculationExplanationTotals, quantity: number) {
  return createStep('groupUnitPriceWithTax', {
    totalWithTax: totals.totalWithTax,
    quantity: toPositiveNumber(quantity),
    result: totals.unitPriceWithTax,
  })
}

function createCostSalesPercentageStep(totals: CalculationExplanationTotals) {
  return createStep('costSalesPercentage', {
    baseAmount: totals.baseAmount,
    subtotal: totals.subtotal,
    result: calculateCostSalesPercentage(totals.baseAmount, totals.subtotal),
  })
}

function calculateUnitAmount(amount: number, quantity: number) {
  return roundMoneyDivision(amount, toPositiveNumber(quantity))
}

function createStep(
  kind: string,
  values: Record<string, number | string | null>,
  id = kind,
): CalculationExplanationStep {
  return {
    id,
    kind,
    labelKey: `quotations.lineItems.calculationExplanation.steps.${kind}.label`,
    formulaKey: `quotations.lineItems.calculationExplanation.steps.${kind}.formula`,
    values,
  }
}

function getTaxSource(
  options: CreateCalculationExplanationNodeOptions,
  hasMixedTaxClasses: boolean,
): CalculationExplanationTaxSource {
  if (hasMixedTaxClasses) {
    return { kind: 'mixed', sourceLabel: null }
  }

  const taxClassIds = new Set(options.normalizedTaxConfig.taxClasses.map((taxClass) => taxClass.id))

  if (taxClassIds.has(options.item.taxClassId ?? '')) {
    return { kind: 'self', sourceLabel: options.itemNumber }
  }

  if (taxClassIds.has(options.inheritedTaxClassId ?? '')) {
    return { kind: 'inherited', sourceLabel: options.inheritedTaxSourceLabel }
  }

  return { kind: 'default', sourceLabel: null }
}

function getPricingMethod(item: QuotationItem): PricingMethod {
  return item.pricingMethod === 'manual_price' ? 'manual_price' : 'cost_plus'
}

function getExchangeRate(item: QuotationItem, exchangeRates: ExchangeRateTable) {
  return toPositiveNumber(exchangeRates[item.costCurrency] ?? 0)
}

function sumChildTotals(
  children: CalculationExplanationNode[],
  getAmount: (child: CalculationExplanationNode) => number,
) {
  return roundMoney(children.reduce((sum, child) => sum + getAmount(child), 0))
}

function toPositiveNumber(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(value, 0)
}
