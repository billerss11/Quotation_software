import { describe, expect, it, vi } from 'vitest'

import { fetchLatestExchangeRates } from './onlineExchangeRates'

describe('fetchLatestExchangeRates', () => {
  it('fetches requested quotes and converts them to the app rate direction', async () => {
    const fetcher = vi.fn(async (input: string, _init?: RequestInit) => {
      if (input.endsWith('/currencies')) {
        return createJsonResponse([
          { iso_code: 'USD' },
          { iso_code: 'CNY' },
          { iso_code: 'EUR' },
          { iso_code: 'JPY' },
        ])
      }

      return createJsonResponse([
        { date: '2026-07-16', base: 'USD', quote: 'CNY', rate: 6.8 },
        { date: '2026-07-16', base: 'USD', quote: 'EUR', rate: 0.92 },
      ])
    })

    const result = await fetchLatestExchangeRates('usd', ['USD', 'CNY', 'EUR', 'JPY'], fetcher)

    const requestUrl = new URL(fetcher.mock.calls.find(([input]) => input.includes('/rates'))?.[0] ?? '')
    expect(requestUrl.origin + requestUrl.pathname).toBe('https://api.frankfurter.dev/v2/rates')
    expect(requestUrl.searchParams.get('base')).toBe('USD')
    expect(requestUrl.searchParams.get('quotes')).toBe('CNY,EUR,JPY')
    expect(result).toEqual({
      date: '2026-07-16',
      rates: {
        USD: 1,
        CNY: 0.1470588235,
        EUR: 1.0869565217,
      },
      missingCurrencies: ['JPY'],
    })
  })

  it('skips provider-unsupported currencies and reports them as missing', async () => {
    const fetcher = vi.fn(async (input: string, _init?: RequestInit) => {
      if (input.endsWith('/currencies')) {
        return createJsonResponse([{ iso_code: 'USD' }, { iso_code: 'CNY' }])
      }

      return createJsonResponse([
        { date: '2026-07-16', base: 'USD', quote: 'CNY', rate: 6.8 },
      ])
    })

    const result = await fetchLatestExchangeRates('USD', ['USD', 'CNY', 'XSU'], fetcher)

    const requestUrl = new URL(fetcher.mock.calls.find(([input]) => input.includes('/rates'))?.[0] ?? '')
    expect(requestUrl.searchParams.get('quotes')).toBe('CNY')
    expect(result.missingCurrencies).toEqual(['XSU'])
  })

  it('rejects an unsuccessful provider response', async () => {
    const fetcher = vi.fn(async (input: string, _init?: RequestInit) => {
      if (input.endsWith('/currencies')) {
        return createJsonResponse([{ iso_code: 'USD' }, { iso_code: 'EUR' }])
      }

      return createJsonResponse({}, 503)
    })

    await expect(fetchLatestExchangeRates('USD', ['USD', 'EUR'], fetcher))
      .rejects.toThrow('status 503')
  })

  it('rejects a response without any usable requested rates', async () => {
    const fetcher = vi.fn(async (input: string, _init?: RequestInit) => {
      if (input.endsWith('/currencies')) {
        return createJsonResponse([{ iso_code: 'USD' }, { iso_code: 'EUR' }])
      }

      return createJsonResponse([
        { date: '2026-07-16', base: 'USD', quote: 'GBP', rate: 0.76 },
      ])
    })

    await expect(fetchLatestExchangeRates('USD', ['USD', 'EUR'], fetcher))
      .rejects.toThrow('did not contain any requested rates')
  })
})

function createJsonResponse(value: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  } as Response
}
