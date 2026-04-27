import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'

import type { QuotationDraft } from '../types'
import { createQuotationFileContent, parseQuotationFileContent } from './quotationFile'

describe('quotation file JSON', () => {
  it('serializes a quotation draft with a schema envelope', () => {
    const quotation = createQuotation()
    const parsed = JSON.parse(createQuotationFileContent(quotation))

    expect(parsed).toMatchObject({
      schemaVersion: 1,
      app: 'quotation-software',
      quotation,
    })
    expect(typeof parsed.exportedAt).toBe('string')
  })

  it('parses a valid quotation file', () => {
    const quotation = createQuotation()
    const content = createQuotationFileContent(quotation)

    expect(parseQuotationFileContent(content)).toEqual(quotation)
  })

  it('does not remap customerName into contactPerson when parsing quotation files', () => {
    const content = JSON.stringify({
      schemaVersion: 1,
      app: 'quotation-software',
      exportedAt: '2026-04-24T08:00:00.000Z',
      quotation: {
        ...createQuotation(),
        header: {
          ...createQuotation().header,
          customerName: 'Alex Buyer',
          contactPerson: '',
        },
      },
    })

    expect(parseQuotationFileContent(content).header.contactPerson).toBe('')
  })

  it('rejects JSON without quotation data', () => {
    expect(() => parseQuotationFileContent('{"schemaVersion":1}')).toThrow('Quotation file is missing quotation data.')
  })

  it('rejects a quotation file with an unsupported quotation currency', () => {
    const quotation = createQuotation()
    const content = createQuotationFileContent({
      ...quotation,
      header: {
        ...quotation.header,
        currency: 'JPY' as never,
      },
    })

    expect(() => parseQuotationFileContent(content)).toThrow('Quotation file has an unsupported quotation currency.')
  })

  it('serializes a reactive quotation draft without throwing', () => {
    const quotation = reactive(createQuotation())

    expect(() => createQuotationFileContent(quotation)).not.toThrow()
  })
})

function createQuotation(overrides: Partial<QuotationDraft['header']> = {}): QuotationDraft {
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
      currency: 'USD',
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
