export interface CompanyProfile {
  companyName: string
  email: string
  phone: string
}

const STORAGE_KEY = 'quotation-software:company-profile'

export function createDefaultCompanyProfile(): CompanyProfile {
  return {
    companyName: 'Your Company',
    email: '',
    phone: '',
  }
}

export function loadCompanyProfile(): CompanyProfile {
  if (!hasLocalStorage()) {
    return createDefaultCompanyProfile()
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return createDefaultCompanyProfile()
  }

  try {
    return normalizeCompanyProfile(JSON.parse(rawValue))
  } catch {
    return createDefaultCompanyProfile()
  }
}

export function saveCompanyProfile(profile: CompanyProfile) {
  if (!hasLocalStorage()) {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeCompanyProfile(profile)))
}

function normalizeCompanyProfile(value: unknown): CompanyProfile {
  if (!isRecord(value)) {
    return createDefaultCompanyProfile()
  }

  return {
    companyName: toText(value.companyName) || 'Your Company',
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
