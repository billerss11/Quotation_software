import { describe, expect, it } from 'vitest'

import { getQuotationDocumentTableLayout } from './quotationDocumentTableLayout'

describe('quotation document table layout', () => {
  it('keeps ordinary full mixed-tax output in separate landscape columns', () => {
    const columns = [
      textColumn('Tax %', ['13%', 'Mixed (effective 12.22%)']),
      ...Array.from({ length: 6 }, (_, index) => moneyColumn(`Money ${index + 1}`, ['$39,140.94'])),
    ]

    expect(getQuotationDocumentTableLayout(columns, ['1', '24']).compactPriceBreakdown).toBe(false)
  })

  it('keeps ordinary four-column portrait output comparable', () => {
    const columns = Array.from(
      { length: 4 },
      (_, index) => moneyColumn(`Amount ${index + 1}`, ['$39,140.94']),
    )

    expect(getQuotationDocumentTableLayout(columns, ['1']).compactPriceBreakdown).toBe(false)
  })

  it('uses a compact price breakdown when long values cannot fit at a readable size', () => {
    const columns = [
      textColumn('Tax %', ['Mixed (effective 12.22%)']),
      ...Array.from(
        { length: 6 },
        (_, index) => moneyColumn(`Money ${index + 1}`, ['$12,345,678,901.23']),
      ),
    ]

    expect(getQuotationDocumentTableLayout(columns, ['1']).compactPriceBreakdown).toBe(true)
  })

  it('widens the quantity column for long quantities within a bounded width', () => {
    const layout = getQuotationDocumentTableLayout(
      [moneyColumn('Amount', ['$100.00'])],
      ['12345678901234567890'],
    )

    expect(layout.quantityColumnWidth).toBe(90)
  })
})

function moneyColumn(header: string, values: string[]) {
  return { kind: 'money' as const, header, values }
}

function textColumn(header: string, values: string[]) {
  return { kind: 'text' as const, header, values }
}
