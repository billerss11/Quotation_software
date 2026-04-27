import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CustomerLibraryRecord } from '../utils/customerRecords'
import { useCustomerLibrary } from './useCustomerLibrary'

describe('useCustomerLibrary', () => {
  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    let nextId = 1

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
      quotationApp: undefined,
    })
    vi.stubGlobal('crypto', {
      randomUUID: () => `customer-${nextId++}`,
    })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-24T10:00:00.000Z'))
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('creates and saves a new customer record', () => {
    const library = useCustomerLibrary()

    library.draft.value.customerCompany = 'Acme Industrial'
    library.draft.value.contactPerson = 'Maria Chen'
    library.draft.value.contactDetails = 'maria@example.com'
    library.saveDraft()

    expect(library.records.value).toEqual([
      createCustomerLibraryRecord(),
    ])
    expect(library.selectedRecordId.value).toBe('customer-1')
  })

  it('selects and updates an existing customer record', () => {
    seedCustomerLibrary(localStorageMock, [
      createCustomerLibraryRecord(),
      createCustomerLibraryRecord({
        id: 'customer-2',
        customerCompany: 'Northstar Projects',
        contactPerson: 'David Lee',
        contactDetails: 'david@example.com',
      }),
    ])

    const library = useCustomerLibrary()

    library.selectRecord('customer-2')
    library.draft.value.contactDetails = 'updated@example.com'
    library.saveDraft()

    expect(library.records.value).toEqual([
      createCustomerLibraryRecord(),
      createCustomerLibraryRecord({
        id: 'customer-2',
        updatedAt: '2026-04-24T10:00:00.000Z',
        customerCompany: 'Northstar Projects',
        contactPerson: 'David Lee',
        contactDetails: 'updated@example.com',
      }),
    ])
    expect(library.selectedRecordId.value).toBe('customer-2')
  })

  it('deletes the selected customer record and falls back to a new draft', () => {
    seedCustomerLibrary(localStorageMock, [createCustomerLibraryRecord()])

    const library = useCustomerLibrary()

    library.selectRecord('customer-1')
    library.deleteSelectedRecord()

    expect(library.records.value).toEqual([])
    expect(library.selectedRecordId.value).toBe(null)
    expect(library.draft.value).toEqual({
      id: 'customer-1',
      updatedAt: '2026-04-24T10:00:00.000Z',
      customerCompany: '',
      contactPerson: '',
      contactDetails: '',
    })
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

function seedCustomerLibrary(
  localStorageMock: ReturnType<typeof createLocalStorageMock>,
  records: CustomerLibraryRecord[],
) {
  localStorageMock.setItem('quotation-software:customer-library', JSON.stringify(records))
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
