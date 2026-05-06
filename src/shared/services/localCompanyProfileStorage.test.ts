import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createDefaultCompanyProfile,
  createDefaultCompanyProfileRecord,
  deleteCompanyProfileRecord,
  loadCompanyProfileRecords,
  loadSelectedCompanyProfile,
  replaceCompanyProfileRecords,
  saveCompanyProfileRecord,
} from './localCompanyProfileStorage'

describe('local company profile storage', () => {
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

  it('loads a reusable default company profile when storage is empty', () => {
    expect(loadSelectedCompanyProfile()).toEqual(createDefaultCompanyProfile())
  })

  it('loads localized default company profile text when requested', () => {
    expect(loadSelectedCompanyProfile('zh-CN')).toEqual(createDefaultCompanyProfile('zh-CN'))
  })

  it('creates and loads a reusable company profile library', () => {
    const profile = createDefaultCompanyProfileRecord()
    profile.companyName = 'CX Engineering'
    profile.email = 'sales@example.com'
    profile.phone = '+86 123 4567'

    saveCompanyProfileRecord(profile)

    expect(loadCompanyProfileRecords()).toEqual([
      expect.objectContaining({
        id: profile.id,
        companyName: 'CX Engineering',
        email: 'sales@example.com',
        phone: '+86 123 4567',
      }),
    ])
    expect(loadSelectedCompanyProfile()).toEqual({
      companyName: 'CX Engineering',
      email: 'sales@example.com',
      phone: '+86 123 4567',
    })
  })

  it('migrates the legacy single company profile into the new profile library', () => {
    window.localStorage.setItem('quotation-software:company-profile', JSON.stringify({
      companyName: 'Legacy Company',
      email: 'legacy@example.com',
      phone: '+86 8888',
    }))

    expect(loadCompanyProfileRecords()).toEqual([
      expect.objectContaining({
        companyName: 'Legacy Company',
        email: 'legacy@example.com',
        phone: '+86 8888',
      }),
    ])
    expect(loadSelectedCompanyProfile()).toEqual({
      companyName: 'Legacy Company',
      email: 'legacy@example.com',
      phone: '+86 8888',
    })
  })

  it('deletes company profiles from the reusable library', () => {
    const first = {
      ...createDefaultCompanyProfileRecord(),
      companyName: 'First Company',
    }
    const second = {
      ...createDefaultCompanyProfileRecord(),
      companyName: 'Second Company',
    }

    replaceCompanyProfileRecords([first, second])
    deleteCompanyProfileRecord(first.id)

    expect(loadCompanyProfileRecords()).toEqual([
      expect.objectContaining({
        id: second.id,
        companyName: 'Second Company',
      }),
    ])
  })
})

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
