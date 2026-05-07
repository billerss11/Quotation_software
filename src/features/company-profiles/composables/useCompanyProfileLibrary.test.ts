import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CompanyProfileRecord } from '@/shared/services/localCompanyProfileStorage'
import { replaceCompanyProfileRecords } from '@/shared/services/localCompanyProfileStorage'

import { useCompanyProfileLibrary } from './useCompanyProfileLibrary'

describe('useCompanyProfileLibrary', () => {
  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    let nextId = 1

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
      quotationApp: undefined,
    })
    vi.stubGlobal('crypto', {
      randomUUID: () => `company-${nextId++}`,
    })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T10:00:00.000Z'))
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('refreshes the current records immediately when the shared library is replaced', () => {
    seedCompanyProfiles(localStorageMock, [createCompanyProfileRecord()])

    const library = useCompanyProfileLibrary()

    replaceCompanyProfileRecords([])

    expect(library.records.value).toEqual([])
    expect(library.selectedRecordId.value).toBe(null)
    expect(library.draft.value).toMatchObject({
      companyName: 'Your Company',
      email: '',
      phone: '',
    })
  })
})

function createCompanyProfileRecord(
  overrides: Partial<CompanyProfileRecord> = {},
): CompanyProfileRecord {
  return {
    id: 'company-1',
    updatedAt: '2026-05-07T10:00:00.000Z',
    companyName: 'CX Engineering',
    email: 'sales@example.com',
    phone: '+86 123 4567',
    ...overrides,
  }
}

function seedCompanyProfiles(
  localStorageMock: ReturnType<typeof createLocalStorageMock>,
  records: CompanyProfileRecord[],
) {
  localStorageMock.setItem('quotation-software:company-profiles', JSON.stringify(records))
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
