import { describe, expect, it, vi } from 'vitest'

import type { QuotationDraft, QuotationTemplateId } from '../types'
import { createInitialQuotation, normalizeQuotationDraft } from './quotationDraft'
import { createQuotationFileContent, parseQuotationDocumentContent } from './quotationFile'

const supportedNonDefaultTemplateIds: QuotationTemplateId[] = [
  'technical-bid',
  'executive-summary',
  'luminous',
  'signal',
  'atelier',
  'spreadsheet',
]

describe('new quotation local date', () => {
  it.each([
    ['2026-12-31T16:30:00.000Z', 2027, 0, 1, '2027-01-01'],
    ['2027-01-01T04:30:00.000Z', 2026, 11, 31, '2026-12-31'],
  ] as const)('uses local calendar parts while keeping UTC metadata at %s', (instant, year, month, day, expected) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(instant))
    // Simulate calendar parts in time zones on either side of UTC, independently of the test host.
    vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(year)
    vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(month)
    vi.spyOn(Date.prototype, 'getDate').mockReturnValue(day)
    try {
      const quotation = createInitialQuotation([], 'en-US')
      expect(quotation.header.quotationDate).toBe(expected)
      expect(quotation.metadata?.createdAt).toBe(instant)
    } finally {
      vi.restoreAllMocks()
      vi.useRealTimers()
    }
  })
})

describe('normalizeQuotationDraft', () => {
  it.each([1, 2])('migrates invalid schema-%s revision numbers into a reopenable current document', schemaVersion => {
    for (const revisionNumber of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 1e20]) {
      const quotation = createQuotationDraft('USD')
      quotation.header.revisionNumber = revisionNumber
      const migrated = parseQuotationDocumentContent(JSON.stringify({
        schemaVersion,
        app: 'quotation-software',
        exportedAt: '2026-04-24T08:00:00.000Z',
        quotation,
      }))

      expect(migrated.quotation.header.revisionNumber).toBe(1)
      const serialized = createQuotationFileContent(migrated.quotation, migrated.revisions)
      expect(parseQuotationDocumentContent(serialized)).toEqual(migrated)
    }
  })

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
    expect(quotation.templateId).toBe('classic')
    expect(quotation.outputSettings).toEqual({
      itemDetailLevel: 3,
    })
  })

  it('defaults older quotations without a template id to the classic template', () => {
    const quotation = normalizeQuotationDraft(createQuotationDraft('USD'), {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.templateId).toBe('classic')
  })

  it('migrates the previous legacy template id to classic', () => {
    const quotation = normalizeQuotationDraft({
      ...createQuotationDraft('USD'),
      templateId: 'legacy',
    } as unknown as QuotationDraft, {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.templateId).toBe('classic')
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

  it('normalizes invalid quotation template ids to the classic template', () => {
    const quotation = normalizeQuotationDraft({
      ...createQuotationDraft('USD'),
      templateId: 'unknown-template',
    } as unknown as QuotationDraft, {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.templateId).toBe('classic')
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

  it('defaults mixed-tax document columns to the standard visible column set', () => {
    const quotation = normalizeQuotationDraft(createQuotationDraft('USD'), {
      ensureAtLeastOneItem: false,
    })

    expect(quotation.totalsConfig.mixedTaxColumns).toEqual([
      'taxRate',
      'unitPrice',
      'unitPriceWithTax',
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
    templateId: 'classic',
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
