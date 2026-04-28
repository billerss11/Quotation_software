export type SupportedLocale = 'en-US' | 'zh-CN'

export const DEFAULT_LOCALE: SupportedLocale = 'en-US'
export const SUPPORTED_LOCALES: SupportedLocale[] = ['en-US', 'zh-CN']

export function normalizeSupportedLocale(value: unknown): SupportedLocale | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()

  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en-US'
  }

  if (normalized === 'zh' || normalized.startsWith('zh-')) {
    return 'zh-CN'
  }

  return null
}

export function resolveInitialLocale(savedLocale?: unknown, systemLocale?: unknown): SupportedLocale {
  return normalizeSupportedLocale(savedLocale) ?? normalizeSupportedLocale(systemLocale) ?? DEFAULT_LOCALE
}
