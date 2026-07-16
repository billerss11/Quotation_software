import type { ExchangeRateTable } from '../types'

const FRANKFURTER_RATES_URL = 'https://api.frankfurter.dev/v2/rates'
const FRANKFURTER_CURRENCIES_URL = 'https://api.frankfurter.dev/v2/currencies'
const FETCH_TIMEOUT_MS = 10_000
const RATE_PRECISION = 10_000_000_000

let cachedFrankfurterCurrencies: Set<string> | null = null

type ExchangeRateFetcher = (input: string, init?: RequestInit) => Promise<Response>

export interface OnlineExchangeRateResult {
  rates: ExchangeRateTable
  date: string
  missingCurrencies: string[]
}

export async function fetchLatestExchangeRates(
  baseCurrency: string,
  currencies: readonly string[],
  fetcher: ExchangeRateFetcher = fetch,
): Promise<OnlineExchangeRateResult> {
  const base = baseCurrency.trim().toUpperCase()
  const quotes = [...new Set(currencies.map((currency) => currency.trim().toUpperCase()))]
    .filter((currency) => currency !== base)

  if (quotes.length === 0) {
    throw new Error('At least one target currency is required.')
  }

  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const supportedCurrencies = await fetchFrankfurterCurrencies(fetcher, controller.signal)
    if (!supportedCurrencies.has(base)) {
      throw new Error('Quotation currency is not supported by Frankfurter.')
    }

    const providerQuotes = quotes.filter((currency) => supportedCurrencies.has(currency))
    if (providerQuotes.length === 0) {
      throw new Error('No requested currency is supported by Frankfurter.')
    }

    const url = new URL(FRANKFURTER_RATES_URL)
    url.searchParams.set('base', base)
    url.searchParams.set('quotes', providerQuotes.join(','))

    const response = await fetcher(url.toString(), { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Exchange-rate request failed with status ${response.status}.`)
    }

    return parseExchangeRateResponse(await response.json(), base, quotes)
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

async function fetchFrankfurterCurrencies(fetcher: ExchangeRateFetcher, signal: AbortSignal) {
  if (fetcher === fetch && cachedFrankfurterCurrencies) {
    return cachedFrankfurterCurrencies
  }

  const response = await fetcher(FRANKFURTER_CURRENCIES_URL, { signal })
  if (!response.ok) {
    throw new Error(`Currency-list request failed with status ${response.status}.`)
  }

  const currencies = parseFrankfurterCurrencies(await response.json())
  if (fetcher === fetch) {
    cachedFrankfurterCurrencies = currencies
  }

  return currencies
}

function parseFrankfurterCurrencies(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error('Currency-list response is invalid.')
  }

  const currencies = new Set<string>()
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.iso_code !== 'string') {
      continue
    }

    const currency = entry.iso_code.trim().toUpperCase()
    if (/^[A-Z]{3}$/.test(currency)) {
      currencies.add(currency)
    }
  }

  if (currencies.size === 0) {
    throw new Error('Currency-list response did not contain any currencies.')
  }

  return currencies
}

function parseExchangeRateResponse(
  value: unknown,
  baseCurrency: string,
  requestedQuotes: readonly string[],
): OnlineExchangeRateResult {
  if (!Array.isArray(value)) {
    throw new Error('Exchange-rate response is invalid.')
  }

  const requestedQuoteSet = new Set(requestedQuotes)
  const rates: ExchangeRateTable = { [baseCurrency]: 1 }
  let date = ''

  for (const entry of value) {
    if (
      !isRecord(entry)
      || entry.base !== baseCurrency
      || typeof entry.quote !== 'string'
      || !requestedQuoteSet.has(entry.quote)
      || typeof entry.rate !== 'number'
      || !Number.isFinite(entry.rate)
      || entry.rate <= 0
      || typeof entry.date !== 'string'
      || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)
    ) {
      continue
    }

    rates[entry.quote] = roundRate(1 / entry.rate)
    date ||= entry.date
  }

  const fetchedCurrencies = new Set(Object.keys(rates))
  const missingCurrencies = requestedQuotes.filter((currency) => !fetchedCurrencies.has(currency))

  if (!date || Object.keys(rates).length === 1) {
    throw new Error('Exchange-rate response did not contain any requested rates.')
  }

  return { rates, date, missingCurrencies }
}

function roundRate(value: number) {
  return Math.round((value + Number.EPSILON) * RATE_PRECISION) / RATE_PRECISION
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
