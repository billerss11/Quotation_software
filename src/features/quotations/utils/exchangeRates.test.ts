import { describe, expect, it } from 'vitest'

import {
  addCurrencyToRateTable,
  createExchangeRates,
  normalizeExchangeRates,
  rebaseExchangeRates,
  removeCurrencyFromRateTable,
} from './exchangeRates'

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
      expect(rates.USD).toBeCloseTo(1 / 0.14, 10)
    })

    it('sets GBP = 1 and rebases all other rates relative to GBP', () => {
      const rates = createExchangeRates('GBP')
      expect(rates.GBP).toBe(1)
      expect(rates.USD).toBeCloseTo(1 / 1.25, 5)
    })

    it('adds a dynamic base currency to the default seeded table', () => {
      const rates = createExchangeRates('JPY')
      expect(rates.JPY).toBe(1)
      expect(rates.USD).toBeCloseTo(1 / 0.0067, 5)
    })
  })

  describe('normalizeExchangeRates', () => {
    it('accepts a sparse dynamic rate table and preserves only those keys plus the base', () => {
      const rates = normalizeExchangeRates({ CNY: 0.15 }, 'USD')
      expect(rates.CNY).toBe(0.15)
      expect(rates.USD).toBe(1)
      expect(Object.keys(rates)).toEqual(['CNY', 'USD'])
    })

    it('replaces invalid dynamic rates with reference-derived values', () => {
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

    it('caps overly large rates to the supported maximum', () => {
      const rates = normalizeExchangeRates({ EUR: 9_999_999 }, 'USD')
      expect(rates.EUR).toBe(1_000_000)
    })

    it('handles undefined input gracefully and seeds the standard starter currencies', () => {
      const rates = normalizeExchangeRates(undefined, 'USD')
      expect(rates.USD).toBe(1)
      expect(rates.EUR).toBeCloseTo(1.08)
      expect(rates.CNY).toBeCloseTo(0.14)
      expect(rates.GBP).toBeCloseTo(1.25)
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

    it('rebases into a currency not previously in the table using reference rates', () => {
      const rates = rebaseExchangeRates({ USD: 1, CNY: 0.14 }, 'USD', 'EUR')
      expect(rates.EUR).toBe(1)
      expect(rates.USD).toBeCloseTo(1 / 1.08, 5)
      expect(rates.CNY).toBeCloseTo(0.14 / 1.08, 5)
    })
  })

  describe('addCurrencyToRateTable', () => {
    it('adds a new currency with a reference-based default rate', () => {
      const table = createExchangeRates('USD')
      const next = addCurrencyToRateTable(table, 'JPY', 'USD')
      expect(next.JPY).toBeCloseTo(0.0067)
      expect(next.USD).toBe(1)
    })

    it('does not overwrite an existing currency', () => {
      const table = { USD: 1, CNY: 0.15 }
      const next = addCurrencyToRateTable(table, 'CNY', 'USD')
      expect(next).toEqual(table)
    })
  })

  describe('removeCurrencyFromRateTable', () => {
    it('removes the specified non-base currency', () => {
      const table = { USD: 1, CNY: 0.14, EUR: 1.08 }
      const next = removeCurrencyFromRateTable(table, 'CNY', 'USD')
      expect('CNY' in next).toBe(false)
      expect(next.USD).toBe(1)
      expect(next.EUR).toBeCloseTo(1.08)
    })

    it('does not remove the base currency', () => {
      const table = { USD: 1, CNY: 0.14 }
      const next = removeCurrencyFromRateTable(table, 'USD', 'USD')
      expect(next).toEqual(table)
    })
  })
})
