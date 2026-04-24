import { describe, expect, it } from 'vitest'

import { createExchangeRates, normalizeExchangeRates, rebaseExchangeRates } from './exchangeRates'

describe('exchange rates', () => {
  describe('createExchangeRates', () => {
    it('sets USD = 1 when base currency is USD', () => {
      const rates = createExchangeRates('USD')
      expect(rates.USD).toBe(1)
      expect(rates.EUR).toBeCloseTo(1.08)
      expect(rates.CNY).toBeCloseTo(0.14)
      expect(rates.GBP).toBeCloseTo(1.25)
    })

    it('sets EUR = 1 and adjusts other currencies when base is EUR', () => {
      const rates = createExchangeRates('EUR')
      expect(rates.EUR).toBe(1)
      expect(rates.USD).toBeCloseTo(1 / 1.08, 5)
      expect(rates.CNY).toBeCloseTo(0.14 / 1.08, 5)
      expect(rates.GBP).toBeCloseTo(1.25 / 1.08, 5)
    })

    it('sets CNY = 1 and rebases all other rates relative to CNY', () => {
      const rates = createExchangeRates('CNY')
      expect(rates.CNY).toBe(1)
      expect(rates.USD).toBeCloseTo(1 / 0.14, 4)
    })

    it('sets GBP = 1 and rebases all other rates relative to GBP', () => {
      const rates = createExchangeRates('GBP')
      expect(rates.GBP).toBe(1)
      expect(rates.USD).toBeCloseTo(1 / 1.25, 5)
    })
  })

  describe('normalizeExchangeRates', () => {
    it('accepts custom rates that replace defaults', () => {
      const rates = normalizeExchangeRates({ CNY: 0.15 }, 'USD')
      expect(rates.CNY).toBe(0.15)
      expect(rates.USD).toBe(1)
      expect(rates.EUR).toBeCloseTo(1.08)
    })

    it('ignores zero rates and keeps defaults', () => {
      const rates = normalizeExchangeRates({ CNY: 0 }, 'USD')
      expect(rates.CNY).toBeCloseTo(0.14)
    })

    it('ignores negative rates and keeps defaults', () => {
      const rates = normalizeExchangeRates({ EUR: -1 }, 'USD')
      expect(rates.EUR).toBeCloseTo(1.08)
    })

    it('ignores NaN rates and keeps defaults', () => {
      const rates = normalizeExchangeRates({ GBP: NaN }, 'USD')
      expect(rates.GBP).toBeCloseTo(1.25)
    })

    it('always forces base currency to 1 even if caller passes a different value', () => {
      const rates = normalizeExchangeRates({ USD: 99 }, 'USD')
      expect(rates.USD).toBe(1)
    })

    it('handles undefined input gracefully and returns defaults', () => {
      const rates = normalizeExchangeRates(undefined, 'USD')
      expect(rates.USD).toBe(1)
      expect(rates.EUR).toBeCloseTo(1.08)
    })
  })

  describe('rebaseExchangeRates', () => {
    const usdBaseRates = { USD: 1, EUR: 1.08, CNY: 0.14, GBP: 1.25 }

    it('rebases USD table to EUR so EUR = 1', () => {
      const rates = rebaseExchangeRates(usdBaseRates, 'USD', 'EUR')
      expect(rates.EUR).toBe(1)
      expect(rates.USD).toBeCloseTo(1 / 1.08, 5)
      expect(rates.CNY).toBeCloseTo(0.14 / 1.08, 5)
    })

    it('rebases USD table to GBP so GBP = 1', () => {
      const rates = rebaseExchangeRates(usdBaseRates, 'USD', 'GBP')
      expect(rates.GBP).toBe(1)
      expect(rates.USD).toBeCloseTo(1 / 1.25, 5)
    })

    it('returns equivalent table when source and target base are the same', () => {
      const rates = rebaseExchangeRates(usdBaseRates, 'USD', 'USD')
      expect(rates.USD).toBe(1)
      expect(rates.EUR).toBeCloseTo(1.08)
    })
  })
})
