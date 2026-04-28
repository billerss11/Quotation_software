import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createDefaultCompanyProfile,
  loadCompanyProfile,
  saveCompanyProfile,
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
    expect(loadCompanyProfile()).toEqual(createDefaultCompanyProfile())
  })

  it('loads localized default company profile text when requested', () => {
    expect(loadCompanyProfile('zh-CN')).toEqual(createDefaultCompanyProfile('zh-CN'))
  })

  it('saves and loads the reusable company contact fields', () => {
    saveCompanyProfile({
      companyName: 'CX Engineering',
      email: 'sales@example.com',
      phone: '+86 123 4567',
    })

    expect(loadCompanyProfile()).toEqual({
      companyName: 'CX Engineering',
      email: 'sales@example.com',
      phone: '+86 123 4567',
    })
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
    clear() {
      store.clear()
    },
  }
}
