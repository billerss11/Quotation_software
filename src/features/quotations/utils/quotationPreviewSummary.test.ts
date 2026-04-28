import { describe, expect, it } from 'vitest'

import { shouldShowQuotationPreviewDiscount } from './quotationPreviewSummary'

describe('quotation preview summary', () => {
  it('hides the discount row when the discount amount is zero', () => {
    expect(shouldShowQuotationPreviewDiscount(0)).toBe(false)
  })

  it('shows the discount row when the discount amount is greater than zero', () => {
    expect(shouldShowQuotationPreviewDiscount(115)).toBe(true)
  })
})
