import type { CurrencyCode, ExchangeRateTable } from '../types'
import { clampNumber, MAX_EXCHANGE_RATE, MIN_EXCHANGE_RATE } from './pricingLimits'
import { STANDARD_CURRENCY_CODES } from './currencyCodes'

const referenceExchangeRates: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  CNY: 0.14,
  GBP: 1.25,
  JPY: 0.0067,
  AUD: 0.64,
  HKD: 0.128,
  SGD: 0.74,
  KRW: 0.00073,
}

export function createExchangeRates(baseCurrency: CurrencyCode): ExchangeRateTable {
  const seededRates = Object.fromEntries(
    [...new Set([...STANDARD_CURRENCY_CODES, baseCurrency])].map((currency) => [
      currency,
      lookupReferenceRate(currency, 'USD'),
    ]),
  ) as ExchangeRateTable

  return convertRateTable(seededRates, baseCurrency)
}

export function normalizeExchangeRates(
  exchangeRates: Record<string, number> | undefined,
  baseCurrency: CurrencyCode,
): ExchangeRateTable {
  const source = exchangeRates && Object.keys(exchangeRates).length > 0
    ? exchangeRates
    : createExchangeRates(baseCurrency)
  const normalizedRates: ExchangeRateTable = {}

  for (const currency of Object.keys(source)) {
    const nextRate = source[currency]

    normalizedRates[currency] =
      typeof nextRate === 'number' && Number.isFinite(nextRate) && nextRate > 0
        ? clampNumber(nextRate, MIN_EXCHANGE_RATE, MAX_EXCHANGE_RATE)
        : lookupReferenceRate(currency, baseCurrency)
  }

  normalizedRates[baseCurrency] = 1

  return normalizedRates
}

export function rebaseExchangeRates(
  exchangeRates: Record<string, number> | undefined,
  currentBaseCurrency: CurrencyCode,
  nextBaseCurrency: CurrencyCode,
): ExchangeRateTable {
  return convertRateTable(normalizeExchangeRates(exchangeRates, currentBaseCurrency), nextBaseCurrency)
}

export function addCurrencyToRateTable(
  table: ExchangeRateTable,
  currency: string,
  baseCurrency: CurrencyCode,
): ExchangeRateTable {
  if (currency in table) {
    return table
  }

  return {
    ...table,
    [currency]: lookupReferenceRate(currency, baseCurrency),
  }
}

export function removeCurrencyFromRateTable(
  table: ExchangeRateTable,
  currency: string,
  baseCurrency: CurrencyCode,
): ExchangeRateTable {
  if (currency === baseCurrency || !(currency in table)) {
    return table
  }

  const next = { ...table }
  delete next[currency]
  return next
}

function roundRate(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000_000_000) / 10_000_000_000
}

function lookupReferenceRate(currency: string, baseCurrency: string) {
  const fromUsd = referenceExchangeRates[currency] ?? 1
  const baseToUsd = referenceExchangeRates[baseCurrency] ?? 1
  return roundRate(fromUsd / baseToUsd)
}

function convertRateTable(exchangeRates: ExchangeRateTable, nextBaseCurrency: CurrencyCode): ExchangeRateTable {
  const source = nextBaseCurrency in exchangeRates
    ? exchangeRates
    : {
        ...exchangeRates,
        [nextBaseCurrency]: lookupReferenceRate(nextBaseCurrency, findCurrentBase(exchangeRates)),
      }
  const denominator = source[nextBaseCurrency]
  const rebasedRates = {} as ExchangeRateTable

  for (const currency of Object.keys(source)) {
    rebasedRates[currency] = currency === nextBaseCurrency ? 1 : roundRate(source[currency] / denominator)
  }

  return rebasedRates
}

function findCurrentBase(table: ExchangeRateTable): string {
  return Object.keys(table).find((currency) => table[currency] === 1) ?? 'USD'
}
