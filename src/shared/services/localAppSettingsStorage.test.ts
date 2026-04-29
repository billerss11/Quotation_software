import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDefaultAppSettings, loadAppSettings, saveAppSettings } from './localAppSettingsStorage'

describe('local app settings storage', () => {
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

  it('loads reusable default app settings when storage is empty', () => {
    expect(loadAppSettings()).toEqual(createDefaultAppSettings())
  })

  it('saves and loads the UI locale', () => {
    saveAppSettings({
      uiLocale: 'zh-CN',
    })

    expect(loadAppSettings()).toEqual({
      uiLocale: 'zh-CN',
      quotationSupportPanelsCollapsed: false,
      quotationRailWidth: 380,
    })
  })

  it('saves and loads quotation support panel collapse preference', () => {
    saveAppSettings({
      quotationSupportPanelsCollapsed: true,
    })

    expect(loadAppSettings().quotationSupportPanelsCollapsed).toBe(true)
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
