import { DEFAULT_LOCALE, normalizeSupportedLocale, type SupportedLocale } from '@/shared/i18n/locale'

export interface AppSettings {
  uiLocale: SupportedLocale
}

const STORAGE_KEY = 'quotation-software:app-settings'

export function createDefaultAppSettings(): AppSettings {
  return {
    uiLocale: DEFAULT_LOCALE,
  }
}

export function loadAppSettings(): AppSettings {
  return loadStoredAppSettings() ?? createDefaultAppSettings()
}

export function loadStoredAppSettings(): AppSettings | null {
  if (!hasLocalStorage()) {
    return null
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    return normalizeAppSettings(JSON.parse(rawValue))
  } catch {
    return null
  }
}

export function saveAppSettings(settings: AppSettings) {
  if (!hasLocalStorage()) {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAppSettings(settings)))
}

function normalizeAppSettings(value: unknown): AppSettings {
  if (!isRecord(value)) {
    return createDefaultAppSettings()
  }

  return {
    uiLocale: normalizeSupportedLocale(value.uiLocale) ?? DEFAULT_LOCALE,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}
