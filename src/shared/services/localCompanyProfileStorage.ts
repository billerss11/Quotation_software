import { getDefaultCompanyName } from '@/shared/i18n/defaults'
import { DEFAULT_LOCALE, type SupportedLocale } from '@/shared/i18n/locale'

export interface CompanyProfile {
  companyName: string
  email: string
  phone: string
}

const STORAGE_KEY = 'quotation-software:company-profile'

export function createDefaultCompanyProfile(locale: SupportedLocale = DEFAULT_LOCALE): CompanyProfile {
  return {
    companyName: getDefaultCompanyName(locale),
    email: '',
    phone: '',
  }
}

export function loadCompanyProfile(locale: SupportedLocale = DEFAULT_LOCALE): CompanyProfile {
  if (!hasLocalStorage()) {
    return createDefaultCompanyProfile(locale)
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return createDefaultCompanyProfile(locale)
  }

  try {
    return normalizeCompanyProfile(JSON.parse(rawValue), locale)
  } catch {
    return createDefaultCompanyProfile(locale)
  }
}

export function saveCompanyProfile(profile: CompanyProfile) {
  if (!hasLocalStorage()) {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeCompanyProfile(profile)))
}

function normalizeCompanyProfile(value: unknown, locale: SupportedLocale = DEFAULT_LOCALE): CompanyProfile {
  if (!isRecord(value)) {
    return createDefaultCompanyProfile(locale)
  }

  return {
    companyName: toText(value.companyName) || getDefaultCompanyName(locale),
    email: toText(value.email),
    phone: toText(value.phone),
  }
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}
