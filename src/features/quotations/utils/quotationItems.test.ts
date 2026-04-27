import { describe, expect, it } from 'vitest'

import { createQuotationItem } from './quotationItems'

describe('quotation item factory', () => {
  it('defaults new item quantity unit to EA', () => {
    expect(createQuotationItem('USD').quantityUnit).toBe('EA')
  })

  it('allows the default quantity unit to be overridden', () => {
    expect(createQuotationItem('USD', { quantityUnit: 'set' }).quantityUnit).toBe('set')
  })
})
