import { describe, expect, it } from 'vitest'

import type { QuotationDraft } from '@/features/quotations/types'

import { createCustomerRecordKey, extractCustomerRecords } from './customerRecords'

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
        customerName: 'Maria Chen',
        contactPerson: 'Maria Chen',
        contactDetails: 'maria@example.com',
        lastQuotationNumber: 'Q-2026-001',
      },
      {
        key: 'northstar projects::david lee::david@example.com',
        customerCompany: 'Northstar Projects',
        customerName: 'David Lee',
        contactPerson: 'David Lee',
        contactDetails: 'david@example.com',
        lastQuotationNumber: 'Q-2026-002',
      },
    ])
  })

  it('keeps the most recent customer record when duplicate customers exist', () => {
    const records = extractCustomerRecords([
      createQuotation('q-1', 'Q-2026-001', 'Acme Industrial', 'Maria Chen', 'old@example.com'),
      createQuotation('q-2', 'Q-2026-002', 'Acme Industrial', 'Maria Chen', 'old@example.com'),
    ])

    expect(records).toHaveLength(1)
    expect(records[0]?.lastQuotationNumber).toBe('Q-2026-002')
  })

  it('normalizes customer keys', () => {
    expect(createCustomerRecordKey(' Acme Industrial ', 'Maria Chen', 'MARIA@example.com')).toBe(
      'acme industrial::maria chen::maria@example.com',
    )
  })
})

function createQuotation(
  id: string,
  quotationNumber: string,
  customerCompany: string,
  customerName: string,
  contactDetails: string,
): QuotationDraft {
  return {
    id,
    header: {
      quotationNumber,
      quotationDate: '2026-04-23',
      customerName,
      customerCompany,
      contactPerson: customerName,
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
