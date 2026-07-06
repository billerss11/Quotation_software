import type { MixedTaxDocumentColumn } from '../types'
import type { QuotationPreviewRowPricing } from './quotationPreviewPricing'
import type { QuotationPreviewRow } from './quotationPreviewRows'
import { formatTaxRatePercentage } from './quotationTaxes'

export type MixedTaxDocumentColumnValue =
  | {
    kind: 'money'
    value: number | null
  }
  | {
    kind: 'text'
    value: string
  }

export const EMPTY_QUOTATION_PREVIEW_ROW_PRICING: QuotationPreviewRowPricing = {
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

export function getMixedTaxDocumentColumnValue(
  column: MixedTaxDocumentColumn,
  row: QuotationPreviewRow,
  pricing: QuotationPreviewRowPricing,
  discountRatio: number,
  mixedTaxLabel: string,
): MixedTaxDocumentColumnValue {
  switch (column) {
    case 'taxRate':
      return {
        kind: 'text',
        value: getQuotationPreviewRowTaxLabel(row, pricing, mixedTaxLabel),
      }

    case 'unitPrice':
      return {
        kind: 'money',
        value: getQuotationPreviewRowUnitPrice(row, pricing),
      }

    case 'unitTax':
      return {
        kind: 'money',
        value: getQuotationPreviewRowUnitTax(row, pricing, discountRatio),
      }

    case 'taxAmount':
      return {
        kind: 'money',
        value: getQuotationPreviewRowTaxAmount(row, pricing, discountRatio),
      }

    case 'netAmount':
      return {
        kind: 'money',
        value: getQuotationPreviewRowAmount(row, pricing),
      }

    case 'grossAmount':
      return {
        kind: 'money',
        value: getQuotationPreviewRowAmountWithTax(row, pricing, discountRatio),
      }
  }
}

export function getQuotationPreviewRowUnitPrice(
  row: QuotationPreviewRow,
  pricing: QuotationPreviewRowPricing,
) {
  if (!shouldShowQuotationPreviewRowPricing(row, pricing)) {
    return null
  }

  return pricing.unitPrice
}

export function getQuotationPreviewRowAmount(
  row: QuotationPreviewRow,
  pricing: QuotationPreviewRowPricing,
) {
  if (!shouldShowQuotationPreviewRowPricing(row, pricing)) {
    return null
  }

  return pricing.amount ?? row.amount
}

export function getQuotationPreviewRowAmountWithTax(
  row: QuotationPreviewRow,
  pricing: QuotationPreviewRowPricing,
  discountRatio: number,
) {
  const taxableAmount = getQuotationPreviewRowTaxableAmount(row, pricing, discountRatio)
  const taxAmount = getQuotationPreviewRowTaxAmount(row, pricing, discountRatio)

  if (taxableAmount === null || taxAmount === null) {
    return null
  }

  return roundMoney(taxableAmount + taxAmount)
}

export function getQuotationPreviewRowTaxAmount(
  row: QuotationPreviewRow,
  pricing: QuotationPreviewRowPricing,
  discountRatio: number,
) {
  const preDiscountTaxAmount = getQuotationPreviewRowPreDiscountTaxAmount(row, pricing)

  if (preDiscountTaxAmount === null) {
    return null
  }

  return roundMoney(preDiscountTaxAmount * (1 - discountRatio))
}

export function getQuotationPreviewRowUnitTax(
  row: QuotationPreviewRow,
  pricing: QuotationPreviewRowPricing,
  discountRatio: number,
) {
  const taxAmount = getQuotationPreviewRowTaxAmount(row, pricing, discountRatio)
  const quantity = row.quantity

  if (taxAmount === null || quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
    return null
  }

  return roundMoney(taxAmount / quantity)
}

export function getQuotationPreviewRowTaxLabel(
  row: QuotationPreviewRow,
  pricing: QuotationPreviewRowPricing,
  mixedTaxLabel: string,
) {
  if (!shouldShowQuotationPreviewRowPricing(row, pricing)) {
    return ''
  }

  if (pricing.hasMixedTaxClasses) {
    return pricing.effectiveTaxRate !== null
      ? formatTaxRatePercentage(pricing.effectiveTaxRate)
      : mixedTaxLabel
  }

  if (pricing.taxRate !== null) {
    return formatTaxRatePercentage(pricing.taxRate)
  }

  return ''
}

export function shouldShowQuotationPreviewRowPricing(
  row: QuotationPreviewRow,
  pricing: QuotationPreviewRowPricing,
) {
  return pricing.amount !== null || row.amount !== null
}

function getQuotationPreviewRowTaxableAmount(
  row: QuotationPreviewRow,
  pricing: QuotationPreviewRowPricing,
  discountRatio: number,
) {
  const amount = getQuotationPreviewRowAmount(row, pricing)

  if (amount === null) {
    return null
  }

  return roundMoney(amount * (1 - discountRatio))
}

function getQuotationPreviewRowPreDiscountTaxAmount(
  row: QuotationPreviewRow,
  pricing: QuotationPreviewRowPricing,
) {
  if (!shouldShowQuotationPreviewRowPricing(row, pricing)) {
    return null
  }

  if (pricing.amount !== null && pricing.amountWithTax !== null) {
    return roundMoney(pricing.amountWithTax - pricing.amount)
  }

  const amount = getQuotationPreviewRowAmount(row, pricing)
  const taxRate = pricing.effectiveTaxRate ?? pricing.taxRate

  if (amount === null || taxRate === null) {
    return null
  }

  return roundMoney(amount * (taxRate / 100))
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
