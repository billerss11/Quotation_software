import { describe, expect, it } from 'vitest'

import {
  isSupportedCurrencyCode,
  normalizeCurrencyCode,
  parseCurrencyCode,
  sortCurrencyCodes,
  STANDARD_CURRENCY_CODES,
} from './currencyCodes'

describe('currencyCodes', () => {
  it('keeps the standard starter currencies in a stable order', () => {
    expect(STANDARD_CURRENCY_CODES).toEqual(['USD', 'EUR', 'CNY', 'GBP'])
  })

  it('normalizes lowercase currency input to uppercase ISO-style codes', () => {
    expect(normalizeCurrencyCode(' jpy ')).toBe('JPY')
  })

  it('rejects blank and malformed input', () => {
    expect(normalizeCurrencyCode('')).toBeNull()
    expect(normalizeCurrencyCode('US')).toBeNull()
    expect(normalizeCurrencyCode('USDT')).toBeNull()
    expect(normalizeCurrencyCode('12$')).toBeNull()
  })

  it('accepts supported runtime currency codes', () => {
    expect(isSupportedCurrencyCode('JPY')).toBe(true)
    expect(parseCurrencyCode('jpy')).toBe('JPY')
  })

  it('rejects runtime-unsupported 3-letter codes', () => {
    expect(isSupportedCurrencyCode('ZZZ')).toBe(false)
    expect(parseCurrencyCode('zzz')).toBeNull()
  })

  it('sorts currencies alphabetically with the base currency first', () => {
    expect(sortCurrencyCodes(['JPY', 'USD', 'AUD', 'EUR'], 'USD')).toEqual(['USD', 'AUD', 'EUR', 'JPY'])
  })
})
