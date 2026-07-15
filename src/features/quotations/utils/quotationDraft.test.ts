import { describe, expect, it } from 'vitest'

import type { QuotationDraft, QuotationTemplateId } from '../types'
import { createInitialQuotation, normalizeQuotationDraft } from './quotationDraft'

const supportedNonDefaultTemplateIds: QuotationTemplateId[] = [
  'technical-bid',
  'executive-summary',
  'luminous',
  'signal',
  'atelier',
]

describe('normalizeQuotationDraft', () => {
  it('preserves section headers during normalization without inventing a priced root row', () => {
    const quotation = normalizeQuotationDraft({
      ...createQuotationDraft('USD'),
      majorItems: [
        {
          id: 'section-1',
          kind: 'section_header',
          title: 'Valve',
        } as never,
      ],
    })

    expect(quotation.majorItems).toHaveLength(1)
    expect(quotation.majorItems[0]).toMatchObject({
      id: 'section-1',
      kind: 'section_header',
      title: 'Valve',
    })
  })

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
      extraCharges: [],
    })
    expect(quotation.companyProfileId).toBeNull()
    expect(quotation.companyProfileSnapshot.companyName).toBe('Your Company')
    expect(quotation.templateId).toBe('legacy')
    expect(quotation.outputSettings).toEqual({
      itemDetailLevel: 3,
    })
  })

  it('defaults legacy quotations without a template id to the legacy template', () => {
    const quotation = normalizeQuotationDraft(createQuotationDraft('USD'), {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.templateId).toBe('legacy')
  })

  it.each(supportedNonDefaultTemplateIds)('preserves supported quotation template id %s during normalization', (templateId) => {
    const quotation = normalizeQuotationDraft({
      ...createQuotationDraft('USD'),
      templateId,
    } as QuotationDraft, {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.templateId).toBe(templateId)
  })

  it('normalizes invalid quotation template ids to the legacy template', () => {
    const quotation = normalizeQuotationDraft({
      ...createQuotationDraft('USD'),
      templateId: 'unknown-template',
    } as unknown as QuotationDraft, {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.templateId).toBe('legacy')
  })

  it('defaults legacy quotations without output settings to full item detail', () => {
    const quotation = normalizeQuotationDraft({
      ...createQuotationDraft('USD'),
      outputSettings: undefined,
    }, {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.outputSettings).toEqual({
      itemDetailLevel: 3,
    })
  })

  it('normalizes invalid output item detail levels to full item detail', () => {
    const quotation = normalizeQuotationDraft({
      ...createQuotationDraft('USD'),
      outputSettings: {
        itemDetailLevel: 9,
      },
    } as unknown as QuotationDraft, {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.outputSettings).toEqual({
      itemDetailLevel: 3,
    })
  })

  it('normalizes quotation-level extra charges', () => {
    const quotation = normalizeQuotationDraft({
      ...createQuotationDraft('USD'),
      totalsConfig: {
        globalMarkupRate: 0,
        taxRate: 0,
        extraCharges: [
          { id: ' shipping ', label: ' Shipping ', amount: 125.5 },
          { id: '', label: 'Invalid amount', amount: Number.NaN },
          { id: 'negative', label: 'Negative amount', amount: -20 },
        ],
      },
    }, {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.totalsConfig.extraCharges).toEqual([
      { id: 'shipping', label: 'Shipping', amount: 125.5 },
      { id: expect.any(String), label: 'Invalid amount', amount: 0 },
      { id: 'negative', label: 'Negative amount', amount: 0 },
    ])
  })

  it('defaults mixed-tax document columns to the full exported column set', () => {
    const quotation = normalizeQuotationDraft(createQuotationDraft('USD'), {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.totalsConfig.mixedTaxColumns).toEqual([
      'taxRate',
      'unitPrice',
      'unitTax',
      'unitPriceWithTax',
      'taxAmount',
      'netAmount',
      'grossAmount',
    ])
  })

  it('normalizes saved mixed-tax document columns by removing invalid and duplicate entries', () => {
    const quotation = normalizeQuotationDraft({
      ...createQuotationDraft('USD'),
      totalsConfig: {
        globalMarkupRate: 0,
        taxMode: 'mixed',
        taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
        defaultTaxClassId: 'tax-default',
        mixedTaxColumns: ['grossAmount', 'invalid-column', 'taxRate', 'grossAmount'] as never,
      },
    }, {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.totalsConfig.mixedTaxColumns).toEqual(['grossAmount', 'taxRate'])
  })

  it('adds exchange rates for saved line-item cost currencies missing from legacy rate tables', () => {
    const quotation = normalizeQuotationDraft({
      ...createQuotationDraft('USD'),
      exchangeRates: {
        USD: 1,
      },
      majorItems: [
        {
          id: 'major-1',
          name: 'Imported work',
          description: '',
          quantity: 3,
          quantityUnit: 'days',
          unitCost: 200,
          costCurrency: 'JPY',
          notes: '',
          children: [],
        },
      ],
    }, {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.exchangeRates.JPY).toBeCloseTo(0.0067)
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
    templateId: 'legacy',
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
