import { computed } from 'vue'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency, formatPercent } from '@/shared/utils/formatters'

import type { CurrencyCode, MajorItemSummary, QuotationItem } from '../types'
import { roundMoneyDivision } from '../utils/moneyMath'
import { calculateCostSalesPercentage } from '../utils/quotationCalculations'
import type { QuotationItemPricingDisplay } from '../utils/quotationItemPricing'

export type LineItemSummaryMode = 'totals' | 'unit'

export type LineItemSummaryModeOption = {
  label: string
  value: LineItemSummaryMode
}

export type LineItemSummaryMetric = {
  label: string
  value: string
  kind: 'default' | 'tax' | 'total'
}

interface UseLineItemCardSummaryOptions {
  item: () => QuotationItem
  summaryMode: () => LineItemSummaryMode
  currency: () => CurrencyCode
  currentLocale: () => SupportedLocale
  summary: () => MajorItemSummary
  rootPricingDisplay: () => QuotationItemPricingDisplay | undefined
  showAmountWithTax: () => boolean
  getTaxAmount: (item: QuotationItem) => number
  getAmountWithTax: (item: QuotationItem) => number
  translate: (key: string) => string
}

export function useLineItemCardSummary(options: UseLineItemCardSummaryOptions) {
  const summaryModeOptions = computed<LineItemSummaryModeOption[]>(() => [
    {
      label: options.translate('quotations.lineItems.summaryModes.totals'),
      value: 'totals',
    },
    {
      label: options.translate('quotations.lineItems.summaryModes.unit'),
      value: 'unit',
    },
  ])

  const unitSummaryMetrics = computed<LineItemSummaryMetric[]>(() => {
    const item = options.item()
    const summary = options.summary()
    const pricing = options.rootPricingDisplay()

    if (!pricing) {
      return []
    }

    return [
      {
        label: options.translate('quotations.lineItems.unitCost'),
        value: formatSummaryCurrency(calculateUnitSummaryAmount(summary.baseSubtotal, item.quantity), options),
        kind: 'default',
      },
      {
        label: options.translate('quotations.lineItems.summaryLabels.markupAmount'),
        value: formatSummaryCurrency(calculateUnitSummaryAmount(summary.markupAmount, item.quantity), options),
        kind: 'default',
      },
      {
        label: options.translate('quotations.lineItems.summaryLabels.unitPrice'),
        value: formatSummaryCurrency(pricing.unitSellingPrice, options),
        kind: 'default',
      },
      ...(shouldShowTaxSummary(item)
        ? [{
            label: options.translate('quotations.lineItems.summaryLabels.taxAmount'),
            value: formatSummaryCurrency(calculateUnitSummaryAmount(pricing.taxAmount, item.quantity), options),
            kind: 'tax' as const,
          }]
        : []),
      ...(shouldShowTaxInclusiveSummary(item)
        ? [{
            label: options.translate('quotations.lineItems.summaryLabels.unitPriceWithTax'),
            value: formatSummaryCurrency(pricing.unitPriceWithTax, options),
            kind: 'total' as const,
          }]
        : []),
      {
        label: options.translate('quotations.lineItems.summaryLabels.costSalesPct'),
        value: formatCostSalesPercentage(pricing.baseAmount, pricing.subtotal, options),
        kind: 'default',
      },
    ]
  })

  const totalSummaryMetrics = computed<LineItemSummaryMetric[]>(() => {
    const item = options.item()
    const summary = options.summary()

    return [
      {
        label: options.translate('quotations.lineItems.quantity'),
        value: formatQuantitySummaryValue(item.quantity, item.quantityUnit, options.currentLocale()),
        kind: 'default',
      },
      {
        label: options.translate('quotations.lineItems.summaryLabels.costSubtotal'),
        value: formatSummaryCurrency(summary.baseSubtotal, options),
        kind: 'default',
      },
      {
        label: options.translate('quotations.lineItems.summaryLabels.markupAmount'),
        value: formatSummaryCurrency(summary.markupAmount, options),
        kind: 'default',
      },
      {
        label: options.translate('quotations.lineItems.summaryLabels.subtotalExcludingTax'),
        value: formatSummaryCurrency(summary.subtotal, options),
        kind: 'default',
      },
      ...(shouldShowTaxSummary(item)
        ? [{
            label: options.translate('quotations.lineItems.summaryLabels.taxAmount'),
            value: formatSummaryCurrency(options.getTaxAmount(item), options),
            kind: 'tax' as const,
          }]
        : []),
      ...(shouldShowTaxInclusiveSummary(item)
        ? [{
            label: options.translate('quotations.lineItems.summaryLabels.totalIncludingTax'),
            value: formatSummaryCurrency(options.getAmountWithTax(item), options),
            kind: 'total' as const,
          }]
        : []),
      {
        label: options.translate('quotations.lineItems.summaryLabels.costSalesPct'),
        value: formatCostSalesPercentage(summary.baseSubtotal, summary.subtotal, options),
        kind: 'default',
      },
    ]
  })

  const activeSummaryMetrics = computed(() =>
    options.summaryMode() === 'unit' ? unitSummaryMetrics.value : totalSummaryMetrics.value,
  )

  function shouldShowTaxSummary(item: QuotationItem) {
    return options.getTaxAmount(item) > 0.004
  }

  function shouldShowTaxInclusiveSummary(item: QuotationItem) {
    return options.showAmountWithTax() && shouldShowTaxSummary(item)
  }

  return {
    summaryModeOptions,
    activeSummaryMetrics,
    shouldShowTaxSummary,
  }
}

export function calculateUnitSummaryAmount(amount: number, quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0
  }

  return roundMoneyDivision(amount, quantity)
}

export function formatQuantitySummaryValue(quantity: number, unit: string, currentLocale: SupportedLocale) {
  const normalizedQuantity = Number.isFinite(quantity) ? quantity : 0
  const formattedQuantity = new Intl.NumberFormat(currentLocale, {
    minimumFractionDigits: Number.isInteger(normalizedQuantity) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(normalizedQuantity)
  const normalizedUnit = unit.trim()

  return normalizedUnit.length > 0 ? `${formattedQuantity} ${normalizedUnit}` : formattedQuantity
}

function formatSummaryCurrency(amount: number, options: Pick<UseLineItemCardSummaryOptions, 'currency' | 'currentLocale'>) {
  return formatCurrency(amount, options.currency(), options.currentLocale())
}

function formatCostSalesPercentage(
  costAmount: number,
  salesAmount: number,
  options: Pick<UseLineItemCardSummaryOptions, 'currentLocale' | 'translate'>,
) {
  const percentage = calculateCostSalesPercentage(costAmount, salesAmount)

  if (percentage === null) {
    return options.translate('common.emptyValue')
  }

  return formatPercent(percentage, options.currentLocale())
}
