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

export function getReferenceCurrencyCodes() {
  return Object.keys(referenceExchangeRates).sort((left, right) => left.localeCompare(right))
}

export function createExchangeRates(baseCurrency: CurrencyCode): ExchangeRateTable {
  const seededRates = {} as ExchangeRateTable

  for (const currency of new Set([...STANDARD_CURRENCY_CODES, baseCurrency])) {
    const rate = lookupReferenceRate(currency, baseCurrency)
    if (rate !== null) {
      seededRates[currency] = rate
    }
  }

  seededRates[baseCurrency] = 1
  return seededRates
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

    if (typeof nextRate === 'number' && Number.isFinite(nextRate) && nextRate > 0) {
      normalizedRates[currency] = clampNumber(nextRate, MIN_EXCHANGE_RATE, MAX_EXCHANGE_RATE)
      continue
    }

    const referenceRate = lookupReferenceRate(currency, baseCurrency)
    if (referenceRate !== null) {
      normalizedRates[currency] = referenceRate
    }
  }

  normalizedRates[baseCurrency] = 1

  return normalizedRates
}

export function rebaseExchangeRates(
  exchangeRates: Record<string, number> | undefined,
  currentBaseCurrency: CurrencyCode,
  nextBaseCurrency: CurrencyCode,
  nextCurrencyRateInCurrentBase?: number,
): ExchangeRateTable | null {
  return convertRateTable(
    normalizeExchangeRates(exchangeRates, currentBaseCurrency),
    currentBaseCurrency,
    nextBaseCurrency,
    nextCurrencyRateInCurrentBase,
  )
}

export function addCurrencyToRateTable(
  table: ExchangeRateTable,
  currency: string,
  baseCurrency: CurrencyCode,
): ExchangeRateTable {
  if (currency in table) {
    return table
  }

  const referenceRate = lookupReferenceRate(currency, baseCurrency)
  if (referenceRate === null) {
    return table
  }

  return {
    ...table,
    [currency]: referenceRate,
  }
}

export function ensureCurrenciesInRateTable(
  table: ExchangeRateTable,
  currencies: Iterable<string>,
  baseCurrency: CurrencyCode,
): ExchangeRateTable {
  let nextTable = normalizeExchangeRates(table, baseCurrency)

  for (const currency of currencies) {
    nextTable = addCurrencyToRateTable(nextTable, currency, baseCurrency)
  }

  return nextTable
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
  if (currency === baseCurrency) {
    return 1
  }

  const fromUsd = referenceExchangeRates[currency]
  const baseToUsd = referenceExchangeRates[baseCurrency]
  if (fromUsd === undefined || baseToUsd === undefined) {
    return null
  }

  return roundRate(fromUsd / baseToUsd)
}

function convertRateTable(
  exchangeRates: ExchangeRateTable,
  currentBaseCurrency: CurrencyCode,
  nextBaseCurrency: CurrencyCode,
  nextCurrencyRateInCurrentBase?: number,
): ExchangeRateTable | null {
  const suppliedRate = typeof nextCurrencyRateInCurrentBase === 'number'
    && Number.isFinite(nextCurrencyRateInCurrentBase)
    && nextCurrencyRateInCurrentBase > 0
    ? clampNumber(nextCurrencyRateInCurrentBase, MIN_EXCHANGE_RATE, MAX_EXCHANGE_RATE)
    : null
  const denominator = suppliedRate
    ?? exchangeRates[nextBaseCurrency]
    ?? lookupReferenceRate(nextBaseCurrency, currentBaseCurrency)
  if (denominator === null || !Number.isFinite(denominator) || denominator <= 0) {
    return null
  }

  const source = {
    ...exchangeRates,
    [nextBaseCurrency]: denominator,
  }
  const rebasedRates = {} as ExchangeRateTable

  for (const currency of Object.keys(source)) {
    rebasedRates[currency] = currency === nextBaseCurrency ? 1 : roundRate(source[currency] / denominator)
  }

  return rebasedRates
}
