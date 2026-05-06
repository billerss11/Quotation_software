import { describe, expect, it } from 'vitest'

import type { QuotationDraft } from '../types'
import { createInitialQuotation, normalizeQuotationDraft } from './quotationDraft'

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

  it('migrates a legacy quotation taxRate into a generated default tax class', () => {
    const quotation = normalizeQuotationDraft(createQuotationDraft('USD'), {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.totalsConfig).toMatchObject({
      taxClasses: [
        {
          rate: 0,
        },
      ],
    })
  })

  it('creates new quotations with a single default 0% tax class', () => {
    const quotation = createInitialQuotation([], 'en-US')

    expect(quotation.totalsConfig).toMatchObject({
      taxMode: 'single',
      taxClasses: [
        {
          rate: 0,
        },
      ],
    })
    expect(quotation.companyProfileId).toBeNull()
    expect(quotation.companyProfileSnapshot.companyName).toBeTruthy()
  })

  it('adds a default company snapshot when normalizing a legacy quotation without company fields', () => {
    const quotation = normalizeQuotationDraft(createQuotationDraft('USD'), {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.companyProfileId).toBeNull()
    expect(quotation.companyProfileSnapshot).toEqual({
      companyName: expect.any(String),
      email: '',
      phone: '',
    })
  })

  it('forces quotations with multiple effective tax classes into mixed mode during normalization', () => {
    const quotation = normalizeQuotationDraft({
      ...createQuotationDraft('USD'),
      totalsConfig: {
        globalMarkupRate: 10,
        discountMode: 'percentage',
        discountValue: 0,
        taxMode: 'single',
        taxClasses: [
          { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
          { id: 'tax-service', label: 'Service 6%', rate: 6 },
        ],
        defaultTaxClassId: 'tax-goods',
      },
      majorItems: [
        {
          id: 'major-1',
          name: 'Package',
          description: '',
          quantity: 1,
          quantityUnit: 'EA',
          unitCost: 0,
          costCurrency: 'USD',
          taxClassId: 'tax-goods',
          notes: '',
          children: [
            {
              id: 'leaf-1',
              name: 'Goods',
              description: '',
              quantity: 1,
              quantityUnit: 'EA',
              unitCost: 100,
              costCurrency: 'USD',
              notes: '',
              children: [],
            },
            {
              id: 'leaf-2',
              name: 'Service',
              description: '',
              quantity: 1,
              quantityUnit: 'EA',
              unitCost: 100,
              costCurrency: 'USD',
              taxClassId: 'tax-service',
              notes: '',
              children: [],
            },
          ],
        },
      ],
    }, {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.totalsConfig.taxMode).toBe('mixed')
  })
})

function createQuotationDraft(currency: string): QuotationDraft {
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
      taxMode: 'single',
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
