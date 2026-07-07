import type { MixedTaxDocumentColumn } from '../types'
import { roundMoney } from './moneyMath'
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
        value: getQuotationPreviewRowUnitTax(row, pricing),
      }

    case 'unitPriceWithTax':
      return {
        kind: 'money',
        value: getQuotationPreviewRowUnitPriceWithTax(row, pricing),
      }

    case 'taxAmount':
      return {
        kind: 'money',
        value: getQuotationPreviewRowTaxAmount(row, pricing),
      }

    case 'netAmount':
      return {
        kind: 'money',
        value: getQuotationPreviewRowAmount(row, pricing),
      }

    case 'grossAmount':
      return {
        kind: 'money',
        value: getQuotationPreviewRowAmountWithTax(row, pricing),
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
) {
  const taxableAmount = getQuotationPreviewRowAmount(row, pricing)
  const taxAmount = getQuotationPreviewRowTaxAmount(row, pricing)

  if (taxableAmount === null || taxAmount === null) {
    return null
  }

  return roundMoney(taxableAmount + taxAmount)
}

export function getQuotationPreviewRowTaxAmount(
  row: QuotationPreviewRow,
  pricing: QuotationPreviewRowPricing,
) {
  const taxAmount = getQuotationPreviewRowCalculatedTaxAmount(row, pricing)

  if (taxAmount === null) {
    return null
  }

  return taxAmount
}

export function getQuotationPreviewRowUnitTax(
  row: QuotationPreviewRow,
  pricing: QuotationPreviewRowPricing,
) {
  const taxAmount = getQuotationPreviewRowTaxAmount(row, pricing)
  const quantity = row.quantity

  if (taxAmount === null || quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
    return null
  }

  return roundMoney(taxAmount / quantity)
}

export function getQuotationPreviewRowUnitPriceWithTax(
  row: QuotationPreviewRow,
  pricing: QuotationPreviewRowPricing,
) {
  const amountWithTax = getQuotationPreviewRowAmountWithTax(row, pricing)
  const quantity = row.quantity

  if (amountWithTax === null || quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
    return null
  }

  return roundMoney(amountWithTax / quantity)
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

function getQuotationPreviewRowCalculatedTaxAmount(
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
