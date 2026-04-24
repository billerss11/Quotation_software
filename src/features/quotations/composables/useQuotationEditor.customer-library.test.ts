import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'
import { replaceCustomerLibraryRecords } from '@/shared/services/localCustomerLibraryStorage'
import { saveQuotationDraft } from '@/shared/services/localQuotationStorage'

import type { QuotationDraft } from '../types'
import { useQuotationEditor } from './useQuotationEditor'

describe('useQuotationEditor customer library', () => {
  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads reusable customers from the standalone customer library instead of quotation history', () => {
    saveQuotationDraft(
      createQuotation({
        id: 'quote-1',
        quotationNumber: 'Q-2026-001',
        customerCompany: 'History Company',
        customerName: 'History Contact',
        contactPerson: 'History Contact',
        contactDetails: 'history@example.com',
      }),
    )
    replaceCustomerLibraryRecords([
      createCustomerLibraryRecord({
        id: 'customer-1',
        customerCompany: 'Library Company',
        customerName: 'Library Contact',
        contactPerson: 'Library Contact',
        contactDetails: 'library@example.com',
      }),
    ])

    const { customerRecords } = useQuotationEditor()

    expect(customerRecords.value).toEqual([
      createCustomerLibraryRecord({
        id: 'customer-1',
        customerCompany: 'Library Company',
        customerName: 'Library Contact',
        contactPerson: 'Library Contact',
        contactDetails: 'library@example.com',
      }),
    ])
  })

  it('copies customer library fields into the quotation header without keeping a live link', () => {
    replaceCustomerLibraryRecords([
      createCustomerLibraryRecord({
        id: 'customer-1',
        customerCompany: 'Library Company',
        customerName: 'Library Contact',
        contactPerson: 'Library Contact',
        contactDetails: 'library@example.com',
      }),
    ])

    const { quotation, customerRecords, applyCustomerRecord } = useQuotationEditor()
    const record = customerRecords.value[0]

    applyCustomerRecord(record)

    expect(quotation.value.header.customerCompany).toBe('Library Company')
    expect(quotation.value.header.customerName).toBe('Library Contact')
    expect(quotation.value.header.contactPerson).toBe('Library Contact')
    expect(quotation.value.header.contactDetails).toBe('library@example.com')

    quotation.value.header.customerCompany = 'Edited In Quotation'
    quotation.value.header.contactPerson = 'Edited Contact'

    expect(customerRecords.value[0]).toEqual(
      createCustomerLibraryRecord({
        id: 'customer-1',
        customerCompany: 'Library Company',
        customerName: 'Library Contact',
        contactPerson: 'Library Contact',
        contactDetails: 'library@example.com',
      }),
    )
  })
})

function createCustomerLibraryRecord(
  overrides: Partial<CustomerLibraryRecord> = {},
): CustomerLibraryRecord {
  return {
    id: 'customer-1',
    updatedAt: '2026-04-24T10:00:00.000Z',
    customerCompany: 'Acme Industrial',
    customerName: 'Maria Chen',
    contactPerson: 'Maria Chen',
    contactDetails: 'maria@example.com',
    ...overrides,
  }
}

function createQuotation(overrides: {
  id: string
  quotationNumber: string
  customerCompany: string
  customerName: string
  contactPerson: string
  contactDetails: string
}): QuotationDraft {
  return {
    id: overrides.id,
    header: {
      quotationNumber: overrides.quotationNumber,
      quotationDate: '2026-04-24',
      customerName: overrides.customerName,
      customerCompany: overrides.customerCompany,
      contactPerson: overrides.contactPerson,
      contactDetails: overrides.contactDetails,
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

function createLocalStorageMock() {
  const store = new Map<string, string>()

  return {
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    clear() {
      store.clear()
    },
  }
}
