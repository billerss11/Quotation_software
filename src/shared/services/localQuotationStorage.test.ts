import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuotationDraft } from '@/features/quotations/types'

import {
  loadSavedQuotations,
  QuotationStorageError,
  saveQuotationDraft,
} from './localQuotationStorage'

describe('local quotation storage', () => {
  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves a reactive quotation draft without throwing', () => {
    expect(() => saveQuotationDraft(reactive(createQuotation()))).not.toThrow()
    expect(loadSavedQuotations()).toHaveLength(1)
  })

  it('stores each draft under its own key and keeps a separate draft index', () => {
    saveQuotationDraft(createQuotation())

    expect(localStorageMock.getItem('quotation-software:quotation-drafts')).toBeNull()
    expect(localStorageMock.getItem('quotation-software:quotation-draft-ids')).toBe(JSON.stringify(['quote-1']))
    expect(localStorageMock.getItem('quotation-software:quotation-draft:quote-1')).toContain('"id":"quote-1"')
  })

  it('does not remap customerName into contactPerson when loading saved quotations', () => {
    localStorageMock.setItem(
      'quotation-software:quotation-drafts',
      JSON.stringify([
        {
          ...createQuotation(),
          header: {
            ...createQuotation().header,
            customerName: 'Alex Buyer',
            contactPerson: '',
          },
        },
      ]),
    )

    expect(loadSavedQuotations()[0]?.header.contactPerson).toBe('')
  })

  it('defaults missing documentLocale to English when loading saved quotations', () => {
    localStorageMock.setItem(
      'quotation-software:quotation-drafts',
      JSON.stringify([
        {
          ...createQuotation(),
          header: {
            ...createQuotation().header,
            documentLocale: undefined,
          },
        },
      ]),
    )

    expect(loadSavedQuotations()[0]?.header.documentLocale).toBe('en-US')
  })

  it('loads legacy draft arrays when the new per-draft index is missing', () => {
    localStorageMock.setItem(
      'quotation-software:quotation-drafts',
      JSON.stringify([createQuotation()]),
    )

    expect(loadSavedQuotations()).toHaveLength(1)
    expect(loadSavedQuotations()[0]?.id).toBe('quote-1')
  })

  it('throws a quota error when local storage cannot persist a draft', () => {
    localStorageMock.failOnSetItemOnce(new Error('QuotaExceededError'))

    try {
      saveQuotationDraft(createQuotation())
      throw new Error('expected saveQuotationDraft to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(QuotationStorageError)
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toMatch(/quota/i)
    }
  })
})

function createQuotation(overrides: Partial<QuotationDraft['header']> = {}): QuotationDraft {
  return {
    id: 'quote-1',
    header: {
      quotationNumber: 'Q-2026-001',
      quotationDate: '2026-04-24',
      customerCompany: 'Acme Industrial',
      contactPerson: 'Alex Buyer',
      contactDetails: 'alex@example.com',
      projectName: 'Valve supply',
      validityPeriod: '30 days',
      currency: 'USD',
      documentLocale: 'en-US',
      notes: '',
      ...overrides,
    },
    majorItems: [],
    totalsConfig: {
      globalMarkupRate: 10,
      discountMode: 'percentage',
      discountValue: 0,
      taxRate: 0,
    },
    exchangeRates: {
      USD: 1,
      EUR: 1.08,
      CNY: 0.14,
      GBP: 1.25,
    },
    branding: {
      logoDataUrl: '',
      accentColor: '#0f766e',
    },
  }
}

function createLocalStorageMock() {
  const store = new Map<string, string>()
  let nextSetItemError: Error | null = null

  return {
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      if (nextSetItemError) {
        const error = nextSetItemError
        nextSetItemError = null
        throw error
      }

      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    failOnSetItemOnce(error: Error) {
      nextSetItemError = error
    },
    clear() {
      store.clear()
      nextSetItemError = null
    },
  }
}
