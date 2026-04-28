import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'
import type { QuotationDraft } from '@/features/quotations/types'

import {
  deleteCustomerLibraryRecord,
  loadCustomerLibraryRecords,
  replaceCustomerLibraryRecords,
  saveCustomerLibraryRecord,
} from './localCustomerLibraryStorage'
import { saveQuotationDraft } from './localQuotationStorage'

describe('local customer library storage', () => {
  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    let nextId = 1

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })
    vi.stubGlobal('crypto', {
      randomUUID: () => `customer-${nextId++}`,
    })
    localStorageMock.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-24T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('saves and loads customer library records', () => {
    expect(() => saveCustomerLibraryRecord(reactive(createCustomerLibraryRecord()))).not.toThrow()

    expect(loadCustomerLibraryRecords()).toEqual([createCustomerLibraryRecord()])
  })

  it('replaces customer library records', () => {
    saveCustomerLibraryRecord(createCustomerLibraryRecord())

    replaceCustomerLibraryRecords([
      createCustomerLibraryRecord({
        id: 'customer-2',
        customerCompany: 'Northstar Projects',
        contactPerson: 'David Lee',
        contactDetails: 'david@example.com',
      }),
    ])

    expect(loadCustomerLibraryRecords()).toEqual([
      createCustomerLibraryRecord({
        id: 'customer-2',
        customerCompany: 'Northstar Projects',
        contactPerson: 'David Lee',
        contactDetails: 'david@example.com',
      }),
    ])
  })

  it('deletes customer library records by id', () => {
    replaceCustomerLibraryRecords([
      createCustomerLibraryRecord(),
      createCustomerLibraryRecord({
        id: 'customer-2',
        customerCompany: 'Northstar Projects',
        contactPerson: 'David Lee',
        contactDetails: 'david@example.com',
      }),
    ])

    deleteCustomerLibraryRecord('customer-1')

    expect(loadCustomerLibraryRecords()).toEqual([
      createCustomerLibraryRecord({
        id: 'customer-2',
        customerCompany: 'Northstar Projects',
        contactPerson: 'David Lee',
        contactDetails: 'david@example.com',
      }),
    ])
  })

  it('seeds the customer library from saved quotations only once without duplicates', () => {
    saveQuotationDraft(
      createQuotation({
        id: 'quote-1',
        quotationNumber: 'Q-2026-001',
        quotationDate: '2026-04-22',
        customerCompany: 'Acme Industrial',
        contactPerson: 'Maria Chen',
        contactDetails: 'maria@example.com',
      }),
    )
    saveQuotationDraft(
      createQuotation({
        id: 'quote-2',
        quotationNumber: 'Q-2026-002',
        quotationDate: '2026-04-24',
        customerCompany: 'Acme Industrial',
        contactPerson: 'Maria Chen',
        contactDetails: 'maria@example.com',
      }),
    )
    saveQuotationDraft(
      createQuotation({
        id: 'quote-3',
        quotationNumber: 'Q-2026-003',
        quotationDate: '2026-04-23',
        customerCompany: 'Northstar Projects',
        contactPerson: 'David Lee',
        contactDetails: 'david@example.com',
      }),
    )

    expect(loadCustomerLibraryRecords()).toEqual([
      createCustomerLibraryRecord({
        id: 'customer-1',
        updatedAt: '2026-04-24T10:00:00.000Z',
      }),
      createCustomerLibraryRecord({
        id: 'customer-2',
        updatedAt: '2026-04-24T10:00:00.000Z',
        customerCompany: 'Northstar Projects',
        contactPerson: 'David Lee',
        contactDetails: 'david@example.com',
      }),
    ])

    saveCustomerLibraryRecord(
      createCustomerLibraryRecord({
        id: 'customer-9',
        customerCompany: 'Manual Customer',
        contactPerson: 'Manual Contact',
        contactDetails: 'manual@example.com',
      }),
    )

    expect(loadCustomerLibraryRecords()).toEqual([
      createCustomerLibraryRecord({
        id: 'customer-1',
        updatedAt: '2026-04-24T10:00:00.000Z',
      }),
      createCustomerLibraryRecord({
        id: 'customer-2',
        updatedAt: '2026-04-24T10:00:00.000Z',
        customerCompany: 'Northstar Projects',
        contactPerson: 'David Lee',
        contactDetails: 'david@example.com',
      }),
      createCustomerLibraryRecord({
        id: 'customer-9',
        customerCompany: 'Manual Customer',
        contactPerson: 'Manual Contact',
        contactDetails: 'manual@example.com',
      }),
    ])
  })

})

function createCustomerLibraryRecord(
  overrides: Partial<CustomerLibraryRecord> = {},
): CustomerLibraryRecord {
  return {
    id: 'customer-1',
    updatedAt: '2026-04-24T10:00:00.000Z',
    customerCompany: 'Acme Industrial',
    contactPerson: 'Maria Chen',
    contactDetails: 'maria@example.com',
    ...overrides,
  }
}

function createQuotation(overrides: {
  id: string
  quotationNumber: string
  quotationDate: string
  customerCompany: string
  contactPerson: string
  contactDetails: string
}): QuotationDraft {
  return {
    id: overrides.id,
    header: {
      quotationNumber: overrides.quotationNumber,
      quotationDate: overrides.quotationDate,
      customerCompany: overrides.customerCompany,
      contactPerson: overrides.contactPerson,
      contactDetails: overrides.contactDetails,
      projectName: '',
      validityPeriod: '30 days',
      currency: 'USD',
      documentLocale: 'en-US',
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

function createLocalStorageMock() {
  const store = new Map<string, string>()

  return {
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
}
