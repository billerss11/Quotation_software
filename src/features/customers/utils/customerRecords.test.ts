import { describe, expect, it } from 'vitest'

import type { QuotationDraft } from '@/features/quotations/types'

import type { CustomerLibraryRecord } from './customerRecords'

import { createCustomerRecordKey, dedupeCustomerLibraryRecords, extractCustomerRecords } from './customerRecords'

describe('customer records', () => {
  it('extracts reusable customer records from saved quotations', () => {
    const records = extractCustomerRecords([
      createQuotation('q-1', 'Q-2026-001', 'Acme Industrial', 'Maria Chen', 'maria@example.com'),
      createQuotation('q-2', 'Q-2026-002', 'Northstar Projects', 'David Lee', 'david@example.com'),
    ])

    expect(records).toEqual([
      {
        key: 'acme industrial::maria chen::maria@example.com',
        customerCompany: 'Acme Industrial',
        contactPerson: 'Maria Chen',
        contactDetails: 'maria@example.com',
        lastQuotationNumber: 'Q-2026-001',
      },
      {
        key: 'northstar projects::david lee::david@example.com',
        customerCompany: 'Northstar Projects',
        contactPerson: 'David Lee',
        contactDetails: 'david@example.com',
        lastQuotationNumber: 'Q-2026-002',
      },
    ])
  })

  it('keeps the most recent customer record when duplicate customers exist', () => {
    const records = extractCustomerRecords([
      createQuotation(
        'q-1',
        'Q-2026-001',
        'Acme Industrial',
        'Maria Chen',
        'old@example.com',
        '2026-04-22',
      ),
      createQuotation(
        'q-2',
        'Q-2026-002',
        'Acme Industrial',
        'Maria Chen',
        'old@example.com',
        '2026-04-23',
      ),
    ])

    expect(records).toHaveLength(1)
    expect(records[0]?.lastQuotationNumber).toBe('Q-2026-002')
  })

  it('keeps the newest duplicate customer record by quotation date even when input is unsorted', () => {
    const records = extractCustomerRecords([
      createQuotation(
        'q-1',
        'Q-2026-001',
        'Acme Industrial',
        'Maria Chen',
        'old@example.com',
        '2026-04-24',
      ),
      createQuotation(
        'q-2',
        'Q-2026-002',
        'Acme Industrial',
        'Maria Chen',
        'old@example.com',
        '2026-04-22',
      ),
    ])

    expect(records).toHaveLength(1)
    expect(records[0]?.lastQuotationNumber).toBe('Q-2026-001')
  })

  it('keeps similar-but-different quotation records as separate entries', () => {
    const records = extractCustomerRecords([
      createQuotation(
        'q-1',
        'Q-2026-001',
        'Acme Industrial',
        'Sales Desk',
        'sales@example.com',
      ),
      createQuotation(
        'q-2',
        'Q-2026-002',
        'Acme Industrial',
        'North Region Team',
        'sales@example.com',
      ),
    ])

    expect(records).toHaveLength(2)
    expect(records.map((record) => record.contactPerson)).toEqual(['Sales Desk', 'North Region Team'])
  })

  it('deduplicates fully identical library records after normalization', () => {
    const records = dedupeCustomerLibraryRecords([
      createCustomerLibraryRecord({
        id: 'customer-1',
        updatedAt: '2026-04-23T08:00:00.000Z',
        customerCompany: ' Acme Industrial ',
        contactPerson: ' Maria Chen ',
        contactDetails: 'maria@example.com ',
      }),
      createCustomerLibraryRecord({
        id: 'customer-2',
        updatedAt: '2026-04-24T08:00:00.000Z',
        customerCompany: 'acme industrial',
        contactPerson: 'maria chen',
        contactDetails: 'MARIA@EXAMPLE.COM',
      }),
    ])

    expect(records).toEqual([
      {
        id: 'customer-2',
        updatedAt: '2026-04-24T08:00:00.000Z',
        customerCompany: 'acme industrial',
        contactPerson: 'maria chen',
        contactDetails: 'MARIA@EXAMPLE.COM',
      },
    ])
  })

  it('keeps similar-but-different library records as separate entries', () => {
    const records = dedupeCustomerLibraryRecords([
      createCustomerLibraryRecord({
        id: 'customer-1',
        updatedAt: '2026-04-23T08:00:00.000Z',
        customerCompany: 'Acme Industrial',
        contactPerson: 'Sales Desk',
        contactDetails: 'sales@example.com',
      }),
      createCustomerLibraryRecord({
        id: 'customer-2',
        updatedAt: '2026-04-24T08:00:00.000Z',
        customerCompany: 'Acme Industrial',
        contactPerson: 'North Region Team',
        contactDetails: 'sales@example.com',
      }),
    ])

    expect(records).toHaveLength(2)
    expect(records.map((record) => record.id)).toEqual(['customer-1', 'customer-2'])
  })

  it('preserves blank or partial library records during deduplication', () => {
    const records = dedupeCustomerLibraryRecords([
      createCustomerLibraryRecord({
        id: 'customer-blank',
        updatedAt: '2026-04-24T08:00:00.000Z',
        customerCompany: '',
        contactPerson: '',
        contactDetails: '',
      }),
      createCustomerLibraryRecord({
        id: 'customer-partial',
        updatedAt: '2026-04-24T09:00:00.000Z',
        customerCompany: 'Acme Industrial',
        contactPerson: '',
        contactDetails: '',
      }),
    ])

    expect(records).toEqual([
      {
        id: 'customer-blank',
        updatedAt: '2026-04-24T08:00:00.000Z',
        customerCompany: '',
        contactPerson: '',
        contactDetails: '',
      },
      {
        id: 'customer-partial',
        updatedAt: '2026-04-24T09:00:00.000Z',
        customerCompany: 'Acme Industrial',
        contactPerson: '',
        contactDetails: '',
      },
    ])
  })

  it('normalizes customer keys', () => {
    expect(
      createCustomerRecordKey({
        customerCompany: ' Acme Industrial ',
        contactPerson: 'Sales Desk',
        contactDetails: 'MARIA@example.com',
      }),
    ).toBe('acme industrial::sales desk::maria@example.com')
  })
})

function createQuotation(
  id: string,
  quotationNumber: string,
  customerCompany: string,
  contactPerson: string,
  contactDetails: string,
  quotationDate = '2026-04-23',
): QuotationDraft {
  return {
    id,
    header: {
      quotationNumber,
      quotationDate,
      customerCompany,
      contactPerson,
      contactDetails,
      projectName: '',
      validityPeriod: '30 days',
      currency: 'USD',
      notes: '',
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

function createCustomerLibraryRecord(
  overrides: Partial<CustomerLibraryRecord> = {},
): CustomerLibraryRecord {
  return {
    id: 'customer-1',
    updatedAt: '2026-04-23T08:00:00.000Z',
    customerCompany: 'Acme Industrial',
    contactPerson: 'Maria Chen',
    contactDetails: 'maria@example.com',
    ...overrides,
  }
}
