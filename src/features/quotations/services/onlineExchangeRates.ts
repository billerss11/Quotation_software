import type { ExchangeRateTable } from '../types'

const FRANKFURTER_RATES_URL = 'https://api.frankfurter.dev/v2/rates'
const FETCH_TIMEOUT_MS = 10_000
const RATE_PRECISION = 10_000_000_000

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

  const url = new URL(FRANKFURTER_RATES_URL)
  url.searchParams.set('base', base)
  url.searchParams.set('quotes', quotes.join(','))

  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetcher(url.toString(), { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Exchange-rate request failed with status ${response.status}.`)
    }

    return parseExchangeRateResponse(await response.json(), base, quotes)
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
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
