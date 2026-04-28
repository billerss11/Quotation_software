import { describe, expect, it } from 'vitest'

import { getCurrencyOptions } from './currencyOptions'

describe('currency options', () => {
  it('shares the supported quotation currencies in display order', () => {
    expect(getCurrencyOptions()).toEqual(['USD', 'EUR', 'CNY', 'GBP'])
  })
})
