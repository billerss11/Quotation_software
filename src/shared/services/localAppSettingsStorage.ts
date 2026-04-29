import { DEFAULT_LOCALE, normalizeSupportedLocale, type SupportedLocale } from '@/shared/i18n/locale'

export interface AppSettings {
  uiLocale: SupportedLocale
  /** When true, quotation workbench hides the right support rail for a wider line-items area. */
  quotationSupportPanelsCollapsed: boolean
  /** Width in pixels of the right support-panels rail (clamped 260–560). */
  quotationRailWidth: number
}

const STORAGE_KEY = 'quotation-software:app-settings'

export const RAIL_WIDTH_MIN = 260
export const RAIL_WIDTH_MAX = 560
export const RAIL_WIDTH_DEFAULT = 380

export function createDefaultAppSettings(): AppSettings {
  return {
    uiLocale: DEFAULT_LOCALE,
    quotationSupportPanelsCollapsed: false,
    quotationRailWidth: RAIL_WIDTH_DEFAULT,
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

export function saveAppSettings(patch: Partial<AppSettings>) {
  if (!hasLocalStorage()) {
    return
  }

  const merged: unknown = {
    ...(loadStoredAppSettings() ?? createDefaultAppSettings()),
    ...patch,
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAppSettings(merged)))
}

function normalizeAppSettings(value: unknown): AppSettings {
  const defaults = createDefaultAppSettings()

  if (!isRecord(value)) {
    return defaults
  }

  return {
    uiLocale: normalizeSupportedLocale(value.uiLocale) ?? defaults.uiLocale,
    quotationSupportPanelsCollapsed:
      typeof value.quotationSupportPanelsCollapsed === 'boolean'
        ? value.quotationSupportPanelsCollapsed
        : defaults.quotationSupportPanelsCollapsed,
    quotationRailWidth:
      typeof value.quotationRailWidth === 'number' && Number.isFinite(value.quotationRailWidth)
        ? Math.min(RAIL_WIDTH_MAX, Math.max(RAIL_WIDTH_MIN, value.quotationRailWidth))
        : defaults.quotationRailWidth,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}
