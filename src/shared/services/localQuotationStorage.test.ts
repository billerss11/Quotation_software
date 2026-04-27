import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuotationDraft } from '@/features/quotations/types'

import { loadSavedQuotations, saveQuotationDraft } from './localQuotationStorage'

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

  return {
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    clear() {
      store.clear()
    },
  }
}
