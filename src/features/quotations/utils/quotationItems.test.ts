import { describe, expect, it } from 'vitest'

import { createQuotationItem } from './quotationItems'

describe('quotation item factory', () => {
  it('seeds new item defaults in English by default', () => {
    expect(createQuotationItem('USD').name).toBe('New item')
  })

  it('seeds new item defaults in the requested locale', () => {
    expect(createQuotationItem('USD', {}, 'zh-CN').name).toBe('新项目')
  })

  it('defaults new item quantity unit to EA', () => {
    expect(createQuotationItem('USD').quantityUnit).toBe('EA')
  })

  it('allows the default quantity unit to be overridden', () => {
    expect(createQuotationItem('USD', { quantityUnit: 'set' }, 'zh-CN').quantityUnit).toBe('set')
  })
})
