import { describe, expect, it } from 'vitest'

import type { QuotationPreviewRowPricing } from './quotationPreviewPricing'
import type { QuotationPreviewRow } from './quotationPreviewRows'
import { getMixedTaxDocumentColumnValue } from './quotationDocumentColumnValues'

describe('quotation document column values', () => {
  it('returns mixed-tax row values from the shared preview pricing rules', () => {
    const row = createPreviewRow({ quantity: 2 })
    const pricing = createPreviewRowPricing({
      unitPrice: 100,
      amount: 200,
      taxRate: 13,
      amountWithTax: 226,
    })

    expect(getMixedTaxDocumentColumnValue('taxRate', row, pricing, 'Mixed Tax')).toEqual({
      kind: 'text',
      value: '13%',
    })
    expect(getMixedTaxDocumentColumnValue('unitPrice', row, pricing, 'Mixed Tax')).toEqual({
      kind: 'money',
      value: 100,
    })
    expect(getMixedTaxDocumentColumnValue('unitTax', row, pricing, 'Mixed Tax')).toEqual({
      kind: 'money',
      value: 13,
    })
    expect(getMixedTaxDocumentColumnValue('unitPriceWithTax', row, pricing, 'Mixed Tax')).toEqual({
      kind: 'money',
      value: 113,
    })
    expect(getMixedTaxDocumentColumnValue('taxAmount', row, pricing, 'Mixed Tax')).toEqual({
      kind: 'money',
      value: 26,
    })
    expect(getMixedTaxDocumentColumnValue('netAmount', row, pricing, 'Mixed Tax')).toEqual({
      kind: 'money',
      value: 200,
    })
    expect(getMixedTaxDocumentColumnValue('grossAmount', row, pricing, 'Mixed Tax')).toEqual({
      kind: 'money',
      value: 226,
    })
  })

  it('uses the mixed-tax label when grouped rows have no single effective tax rate', () => {
    const row = createPreviewRow({ amount: 300, quantity: 1 })
    const pricing = createPreviewRowPricing({
      amount: 300,
      hasMixedTaxClasses: true,
      effectiveTaxRate: null,
      taxRate: null,
    })

    expect(getMixedTaxDocumentColumnValue('taxRate', row, pricing, 'Mixed Tax')).toEqual({
      kind: 'text',
      value: 'Mixed Tax',
    })
  })
})

function createPreviewRow(overrides: Partial<QuotationPreviewRow> = {}): QuotationPreviewRow {
  return {
    key: overrides.key ?? 'row-1',
    type: overrides.type ?? 'major',
    level: overrides.level ?? 1,
    itemNumber: overrides.itemNumber ?? '1',
    description: overrides.description ?? 'Line item',
    detail: overrides.detail ?? '',
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? 'ea',
    unitPrice: overrides.unitPrice ?? null,
    amount: overrides.amount ?? null,
  }
}

function createPreviewRowPricing(
  overrides: Partial<QuotationPreviewRowPricing> = {},
): QuotationPreviewRowPricing {
  return {
    unitPrice: overrides.unitPrice ?? null,
    amount: overrides.amount ?? null,
    isGroup: overrides.isGroup ?? false,
    taxClassId: overrides.taxClassId ?? null,
    taxClassLabel: overrides.taxClassLabel ?? null,
    taxRate: overrides.taxRate ?? null,
    effectiveTaxRate: overrides.effectiveTaxRate ?? null,
    hasMixedTaxClasses: overrides.hasMixedTaxClasses ?? false,
    unitPriceWithTax: overrides.unitPriceWithTax ?? null,
    amountWithTax: overrides.amountWithTax ?? null,
  }
}
