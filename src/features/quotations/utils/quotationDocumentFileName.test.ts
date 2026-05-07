import { describe, expect, it } from 'vitest'

import type { QuotationDraft } from '../types'
import { createQuotationDocumentFileName } from './quotationDocumentFileName'

describe('quotation document file name', () => {
  it('creates a PDF file name from quotation number and customer', () => {
    expect(createQuotationDocumentFileName(createQuotation(), 'pdf')).toBe('Q-2026-001-Acme Industrial.pdf')
  })

  it('includes revision numbers above one', () => {
    expect(
      createQuotationDocumentFileName(
        createQuotation({
          revisionNumber: 3,
          customerCompany: '',
          contactPerson: 'Alex Buyer',
        }),
        'pdf',
      ),
    ).toBe('Q-2026-001-Rev-3-Alex Buyer.pdf')
  })

  it('sanitizes invalid file-system characters and falls back when header fields are empty', () => {
    expect(
      createQuotationDocumentFileName(
        createQuotation({
          quotationNumber: 'Q:2026/001',
          customerCompany: '',
          contactPerson: '',
        }),
        'json',
      ),
    ).toBe('Q-2026-001.json')
  })

  it('falls back to quotation when the sanitized name is empty', () => {
    expect(
      createQuotationDocumentFileName(
        createQuotation({
          quotationNumber: '::',
          customerCompany: '',
          contactPerson: '',
        }),
        'pdf',
      ),
    ).toBe('quotation.pdf')
  })
})

function createQuotation(overrides: Partial<QuotationDraft['header']> = {}): QuotationDraft {
  return {
    id: 'quote-1',
    companyProfileId: null,
    companyProfileSnapshot: {
      companyName: 'CX Engineering',
      email: '',
      phone: '',
    },
    header: {
      quotationNumber: 'Q-2026-001',
      quotationDate: '2026-04-23',
      customerCompany: 'Acme Industrial',
      contactPerson: 'Alex Buyer',
      contactDetails: 'alex@example.com',
      projectName: 'Valve supply',
      validityPeriod: '30 days',
      currency: 'USD',
      documentLocale: 'en-US',
      notes: '',
      terms: '',
      revisionNumber: 1,
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
