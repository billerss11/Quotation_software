import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'
import { replaceCustomerLibraryRecords } from '@/shared/services/localCustomerLibraryStorage'
import { saveQuotationDraft } from '@/shared/services/localQuotationStorage'
import {
  createDefaultReusableLibraryData,
  replaceReusableLibraryData,
} from '@/shared/services/reusableLibraryStore'

import type { QuotationDraft } from '../types'
import { useQuotationEditor } from './useQuotationEditor'

describe('useQuotationEditor customer library', () => {
  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })
    localStorageMock.clear()
    localStorageMock.failWrites = false
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
        contactPerson: 'History Contact',
        contactDetails: 'history@example.com',
      }),
    )
    replaceCustomerLibraryRecords([
      createCustomerLibraryRecord({
        id: 'customer-1',
        customerCompany: 'Library Company',
        contactPerson: 'Library Contact',
        contactDetails: 'library@example.com',
      }),
    ])

    const { customerRecords } = useQuotationEditor()

    expect(customerRecords.value).toEqual([
      createCustomerLibraryRecord({
        id: 'customer-1',
        customerCompany: 'Library Company',
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
        contactPerson: 'Library Contact',
        contactDetails: 'library@example.com',
      }),
    ])

    const { quotation, customerRecords, applyCustomerRecord } = useQuotationEditor()
    const record = customerRecords.value[0]

    applyCustomerRecord(record)

    expect(quotation.value.header.customerCompany).toBe('Library Company')
    expect(quotation.value.header.contactPerson).toBe('Library Contact')
    expect(quotation.value.header.contactDetails).toBe('library@example.com')

    quotation.value.header.customerCompany = 'Edited In Quotation'
    quotation.value.header.contactPerson = 'Edited Contact'

    expect(customerRecords.value[0]).toEqual(
      createCustomerLibraryRecord({
        id: 'customer-1',
        customerCompany: 'Library Company',
        contactPerson: 'Library Contact',
        contactDetails: 'library@example.com',
      }),
    )
  })

  it('refreshes customer records when the customer library changes after the editor is already open', () => {
    const { customerRecords } = useQuotationEditor()

    expect(customerRecords.value).toEqual([])

    replaceCustomerLibraryRecords([
      createCustomerLibraryRecord({
        id: 'customer-2',
        customerCompany: 'Schlumberger',
        contactPerson: 'Catalin Florin Ion',
        contactDetails: 'cIon@slb.com',
      }),
    ])

    expect(customerRecords.value).toEqual([
      createCustomerLibraryRecord({
        id: 'customer-2',
        customerCompany: 'Schlumberger',
        contactPerson: 'Catalin Florin Ion',
        contactDetails: 'cIon@slb.com',
      }),
    ])
  })

  it('creates a blank-number draft when quotation-number storage is unavailable', () => {
    replaceCustomerLibraryRecords([])
    localStorageMock.failWrites = true

    const editor = useQuotationEditor() as ReturnType<typeof useQuotationEditor> & {
      manualQuotationNumberRequired: { value: boolean }
      libraryStorageWarning: { value: { code: string } | null }
    }

    expect(editor.quotation.value.header.quotationNumber).toBe('')
    expect(editor.manualQuotationNumberRequired.value).toBe(true)
    expect(editor.libraryStorageWarning.value?.code).toBe('quota_exceeded')
  })

  it('clears the library warning after a later quotation-number write succeeds', () => {
    replaceCustomerLibraryRecords([])
    localStorageMock.failWrites = true
    const editor = useQuotationEditor() as ReturnType<typeof useQuotationEditor> & {
      libraryStorageWarning: { value: { code: string } | null }
    }

    localStorageMock.failWrites = false
    editor.updateHeaderField('quotationNumber', 'Q-2026-009')
    editor.saveCurrentQuotation()

    expect(editor.libraryStorageWarning.value).toBe(null)
  })

  it('uses a header number observed before a failed local draft save when allocating the next quotation', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T10:00:00.000Z'))

    try {
      replaceCustomerLibraryRecords([])
      const editor = useQuotationEditor()
      editor.updateHeaderField('quotationNumber', 'Q-2026-002')
      localStorageMock.failWrites = true

      expect(() => editor.saveCurrentQuotation()).toThrow()

      localStorageMock.failWrites = false
      editor.createNewQuotation()

      expect(editor.quotation.value.header.quotationNumber).toBe('Q-2026-003')
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses replacement numbering when creating a new quotation after a library reset', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T10:00:00.000Z'))

    try {
      const editor = useQuotationEditor()
      editor.updateHeaderField('quotationNumber', 'Q-2026-099')
      replaceReusableLibraryData(createDefaultReusableLibraryData())

      editor.createNewQuotation()

      expect(editor.quotation.value.header.quotationNumber).toBe('Q-2026-001')
    } finally {
      vi.useRealTimers()
    }
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
  customerCompany: string
  contactPerson: string
  contactDetails: string
}): QuotationDraft {
  return {
    id: overrides.id,
    templateId: 'classic',
    companyProfileId: null,
    companyProfileSnapshot: {
      companyName: 'CX Engineering',
      email: '',
      phone: '',
    },
    header: {
      quotationNumber: overrides.quotationNumber,
      quotationDate: '2026-04-24',
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
    failWrites: false,
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      if (this.failWrites) throw new DOMException('quota exceeded', 'QuotaExceededError')
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
