import type { CurrencyCode, ExchangeRateTable } from '../types'

const referenceExchangeRates: ExchangeRateTable = {
  USD: 1,
  EUR: 1.08,
  CNY: 0.14,
  GBP: 1.25,
}

const currencies: CurrencyCode[] = ['USD', 'EUR', 'CNY', 'GBP']

export function createExchangeRates(baseCurrency: CurrencyCode): ExchangeRateTable {
  return convertRateTable(referenceExchangeRates, baseCurrency)
}

export function normalizeExchangeRates(
  exchangeRates: Partial<ExchangeRateTable> | undefined,
  baseCurrency: CurrencyCode,
): ExchangeRateTable {
  const defaults = createExchangeRates(baseCurrency)

  for (const currency of currencies) {
    const nextRate = exchangeRates?.[currency]

    if (typeof nextRate === 'number' && Number.isFinite(nextRate) && nextRate > 0) {
      defaults[currency] = nextRate
    }
  }

  defaults[baseCurrency] = 1

  return defaults
}

export function rebaseExchangeRates(
  exchangeRates: Partial<ExchangeRateTable> | undefined,
  currentBaseCurrency: CurrencyCode,
  nextBaseCurrency: CurrencyCode,
): ExchangeRateTable {
  return convertRateTable(normalizeExchangeRates(exchangeRates, currentBaseCurrency), nextBaseCurrency)
}

function roundRate(value: number) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000
}

function convertRateTable(exchangeRates: ExchangeRateTable, nextBaseCurrency: CurrencyCode): ExchangeRateTable {
  const denominator = exchangeRates[nextBaseCurrency]
  const rebasedRates = {} as ExchangeRateTable

  for (const currency of currencies) {
    rebasedRates[currency] = currency === nextBaseCurrency ? 1 : roundRate(exchangeRates[currency] / denominator)
  }

  return rebasedRates
}
