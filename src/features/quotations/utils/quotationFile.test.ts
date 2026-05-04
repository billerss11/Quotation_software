import { reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { QuotationDraft, QuotationItem } from '../types'
import { createQuotationFileContent, parseQuotationFileContent, QuotationFileError } from './quotationFile'

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

  it('roundtrips quotation tax classes and item tax assignments', () => {
    const quotation = createQuotation()
    quotation.totalsConfig = {
      globalMarkupRate: 10,
      discountMode: 'percentage',
      discountValue: 0,
      taxMode: 'mixed',
      taxClasses: [
        { id: 'tax-0', label: '0%', rate: 0 },
        { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
        { id: 'tax-service', label: 'Service 6%', rate: 6 },
      ],
      defaultTaxClassId: 'tax-0',
    }
    quotation.majorItems = [
      createQuotationItem({
        id: 'major-1',
        name: 'Equipment',
        description: '',
        quantity: 1,
        quantityUnit: 'EA',
        unitCost: 0,
        costCurrency: 'USD',
        taxClassId: 'tax-goods',
        notes: '',
        children: [
          createQuotationItem({
            id: 'leaf-1',
            name: 'Commissioning',
            description: '',
            quantity: 1,
            quantityUnit: 'EA',
            unitCost: 200,
            costCurrency: 'USD',
            taxClassId: 'tax-service',
            notes: '',
            children: [],
          }),
        ],
      }),
    ]

    const content = createQuotationFileContent(quotation)

    expect(parseQuotationFileContent(content)).toEqual(quotation)
  })

  it('forces imported quotations with multiple effective tax classes into mixed mode', () => {
    const quotation = createQuotation()
    quotation.totalsConfig = {
      globalMarkupRate: 10,
      discountMode: 'percentage',
      discountValue: 0,
      taxMode: 'single',
      taxClasses: [
        { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
        { id: 'tax-service', label: 'Service 6%', rate: 6 },
      ],
      defaultTaxClassId: 'tax-goods',
    }
    quotation.majorItems = [
      createQuotationItem({
        id: 'major-1',
        name: 'Bundle',
        description: '',
        quantity: 1,
        quantityUnit: 'EA',
        unitCost: 0,
        costCurrency: 'USD',
        taxClassId: 'tax-goods',
        notes: '',
        children: [
          createQuotationItem({
            id: 'leaf-1',
            name: 'Goods',
            description: '',
            quantity: 1,
            quantityUnit: 'EA',
            unitCost: 100,
            costCurrency: 'USD',
            notes: '',
            children: [],
          }),
          createQuotationItem({
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
          }),
        ],
      }),
    ]

    const content = createQuotationFileContent(quotation)

    expect(parseQuotationFileContent(content).totalsConfig.taxMode).toBe('mixed')
  })

  it('defaults missing documentLocale to English when parsing old quotation files', () => {
    const quotation = createQuotation()
    const content = JSON.stringify({
      schemaVersion: 1,
      app: 'quotation-software',
      exportedAt: '2026-04-24T08:00:00.000Z',
      quotation: {
        ...quotation,
        header: {
          ...quotation.header,
          documentLocale: undefined,
        },
      },
    })

    expect(parseQuotationFileContent(content).header.documentLocale).toBe('en-US')
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
    expect(() => parseQuotationFileContent('{"schemaVersion":1}')).toThrowError(QuotationFileError)

    try {
      parseQuotationFileContent('{"schemaVersion":1}')
    } catch (error) {
      expect(error).toBeInstanceOf(QuotationFileError)
      expect((error as QuotationFileError).code).toBe('invalid_envelope')
    }
  })

  it('rejects quotation files with an invalid schema envelope', () => {
    const content = JSON.stringify({
      schemaVersion: 999,
      app: 'quotation-software',
      exportedAt: '2026-04-24T08:00:00.000Z',
      quotation: createQuotation(),
    })

    expect(() => parseQuotationFileContent(content)).toThrowError(QuotationFileError)

    try {
      parseQuotationFileContent(content)
    } catch (error) {
      expect(error).toBeInstanceOf(QuotationFileError)
      expect((error as QuotationFileError).code).toBe('invalid_envelope')
    }
  })

  it('parses a quotation file with a supported dynamic quotation currency', () => {
    const quotation = createQuotation()
    const content = createQuotationFileContent({
      ...quotation,
      header: {
        ...quotation.header,
        currency: 'JPY',
      },
      exchangeRates: {
        JPY: 1,
        USD: 149.2537313433,
      },
    })

    expect(parseQuotationFileContent(content).header.currency).toBe('JPY')
  })

  it('rejects a quotation file with an invalid quotation currency', () => {
    const quotation = createQuotation()
    const content = createQuotationFileContent({
      ...quotation,
      header: {
        ...quotation.header,
        currency: 'ZZZ',
      },
    })

    expect(() => parseQuotationFileContent(content)).toThrowError(QuotationFileError)
  })

  it('serializes a reactive quotation draft without throwing', () => {
    const quotation = reactive(createQuotation())

    expect(() => createQuotationFileContent(quotation)).not.toThrow()
  })

  it('serializes quotation files without an internal JSON parse round-trip', () => {
    const parseSpy = vi.spyOn(JSON, 'parse')

    createQuotationFileContent(createQuotation())

    expect(parseSpy).not.toHaveBeenCalled()
    parseSpy.mockRestore()
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
      documentLocale: 'en-US',
      notes: '',
      terms: '',
      revisionNumber: 1,
      ...overrides,
    },
    lineItemEntryMode: 'detailed',
    majorItems: [],
    totalsConfig: {
      globalMarkupRate: 10,
      discountMode: 'percentage',
      discountValue: 0,
      taxMode: 'single',
      taxClasses: [
        {
          id: 'tax-0',
          label: '0%',
          rate: 0,
        },
      ],
      defaultTaxClassId: 'tax-0',
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

function createQuotationItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'Item',
    description: overrides.description ?? '',
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? 'EA',
    pricingMethod: overrides.pricingMethod ?? 'cost_plus',
    manualUnitPrice: overrides.manualUnitPrice,
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? 'USD',
    markupRate: overrides.markupRate,
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}
