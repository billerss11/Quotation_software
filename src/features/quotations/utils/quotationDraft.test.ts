import { describe, expect, it } from 'vitest'

import type { QuotationDraft } from '../types'
import { normalizeQuotationDraft } from './quotationDraft'

describe('normalizeQuotationDraft', () => {
  it('falls back an invalid header currency to USD before normalizing exchange rates', () => {
    const quotation = normalizeQuotationDraft(createQuotationDraft('ZZZ'), {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.header.currency).toBe('USD')
    expect(quotation.exchangeRates.USD).toBe(1)
  })

  it('preserves a supported dynamic header currency and keeps it as the exchange-rate base', () => {
    const quotation = normalizeQuotationDraft(createQuotationDraft('JPY'), {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.header.currency).toBe('JPY')
    expect(quotation.exchangeRates.JPY).toBe(1)
  })
})

function createQuotationDraft(currency: string): QuotationDraft {
  return {
    id: 'quote-1',
    header: {
      quotationNumber: 'Q-2026-001',
      quotationDate: '2026-04-23',
      customerCompany: 'Acme Industrial',
      contactPerson: 'Alex Buyer',
      contactDetails: 'alex@example.com',
      projectName: 'Valve supply',
      validityPeriod: '30 days',
      currency,
      documentLocale: 'en-US',
      notes: '',
      terms: '',
      revisionNumber: 1,
    },
    majorItems: [],
    totalsConfig: {
      globalMarkupRate: 10,
      discountMode: 'percentage',
      discountValue: 0,
      taxRate: 0,
    },
    exchangeRates: {
      [currency]: 1,
    },
    branding: {
      logoDataUrl: '',
      accentColor: '#0f766e',
    },
  }
}
