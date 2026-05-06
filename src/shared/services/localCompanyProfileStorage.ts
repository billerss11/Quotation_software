import { getDefaultCompanyName } from '../i18n/defaults.js'
import { DEFAULT_LOCALE, type SupportedLocale } from '../i18n/locale.js'

export interface CompanyProfile {
  companyName: string
  email: string
  phone: string
}

export interface CompanyProfileRecord extends CompanyProfile {
  id: string
  updatedAt: string
}

const LEGACY_STORAGE_KEY = 'quotation-software:company-profile'
const STORAGE_KEY = 'quotation-software:company-profiles'
const companyProfileListeners = new Set<(records: CompanyProfileRecord[]) => void>()

export function createDefaultCompanyProfile(locale: SupportedLocale = DEFAULT_LOCALE): CompanyProfile {
  return {
    companyName: getDefaultCompanyName(locale),
    email: '',
    phone: '',
  }
}

export function createDefaultCompanyProfileRecord(locale: SupportedLocale = DEFAULT_LOCALE): CompanyProfileRecord {
  return {
    id: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    ...createDefaultCompanyProfile(locale),
  }
}

export function normalizeCompanyProfile(
  value: unknown,
  locale: SupportedLocale = DEFAULT_LOCALE,
): CompanyProfile {
  if (!isRecord(value)) {
    return createDefaultCompanyProfile(locale)
  }

  return {
    companyName: toText(value.companyName) || getDefaultCompanyName(locale),
    email: toText(value.email),
    phone: toText(value.phone),
  }
}

export function loadCompanyProfileRecords(locale: SupportedLocale = DEFAULT_LOCALE): CompanyProfileRecord[] {
  if (!hasLocalStorage()) {
    return []
  }

  const storedRecords = loadStoredCompanyProfileRecords(locale)

  if (storedRecords) {
    return storedRecords
  }

  const migratedRecords = migrateLegacyCompanyProfile(locale)

  if (migratedRecords.length > 0) {
    persistCompanyProfileRecords(migratedRecords)
  }

  return migratedRecords
}

export function loadSelectedCompanyProfile(locale: SupportedLocale = DEFAULT_LOCALE): CompanyProfile {
  return toCompanyProfile(loadCompanyProfileRecords(locale)[0], locale)
}

export function saveCompanyProfileRecord(record: CompanyProfileRecord, locale: SupportedLocale = DEFAULT_LOCALE) {
  const records = loadCompanyProfileRecords(locale)
  const nextRecord = normalizeCompanyProfileRecord(record, locale)
  const index = records.findIndex((existingRecord) => existingRecord.id === nextRecord.id)

  if (index === -1) {
    records.push(nextRecord)
  } else {
    records[index] = nextRecord
  }

  persistCompanyProfileRecords(records)
}

export function replaceCompanyProfileRecords(
  records: CompanyProfileRecord[],
  locale: SupportedLocale = DEFAULT_LOCALE,
) {
  persistCompanyProfileRecords(records.map((record) => normalizeCompanyProfileRecord(record, locale)))
}

export function deleteCompanyProfileRecord(recordId: string, locale: SupportedLocale = DEFAULT_LOCALE) {
  const records = loadCompanyProfileRecords(locale).filter((record) => record.id !== recordId)
  persistCompanyProfileRecords(records)
}

export function subscribeCompanyProfileRecords(listener: (records: CompanyProfileRecord[]) => void) {
  companyProfileListeners.add(listener)

  return () => {
    companyProfileListeners.delete(listener)
  }
}

// Compatibility wrapper for older callers that still expect singleton semantics.
export function loadCompanyProfile(locale: SupportedLocale = DEFAULT_LOCALE): CompanyProfile {
  return loadSelectedCompanyProfile(locale)
}

// Compatibility wrapper for older callers that still expect singleton semantics.
export function saveCompanyProfile(profile: CompanyProfile, locale: SupportedLocale = DEFAULT_LOCALE) {
  const records = loadCompanyProfileRecords(locale)
  const firstRecord = records[0]
  const nextRecord: CompanyProfileRecord = {
    ...(firstRecord ?? createDefaultCompanyProfileRecord(locale)),
    ...normalizeCompanyProfile(profile, locale),
    updatedAt: new Date().toISOString(),
  }

  if (records.length === 0) {
    persistCompanyProfileRecords([nextRecord])
    return
  }

  records[0] = nextRecord
  persistCompanyProfileRecords(records)
}

function loadStoredCompanyProfileRecords(
  locale: SupportedLocale = DEFAULT_LOCALE,
): CompanyProfileRecord[] | null {
  const rawValue = window.localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed)
      ? normalizeCompanyProfileRecords(parsed, locale)
      : []
  } catch {
    return []
  }
}

function migrateLegacyCompanyProfile(locale: SupportedLocale) {
  const rawValue = window.localStorage.getItem(LEGACY_STORAGE_KEY)

  if (!rawValue) {
    return []
  }

  try {
    const profile = normalizeCompanyProfile(JSON.parse(rawValue), locale)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)

    return [
      {
        ...createDefaultCompanyProfileRecord(locale),
        ...profile,
      },
    ]
  } catch {
    return []
  }
}

function normalizeCompanyProfileRecords(records: unknown[], locale: SupportedLocale) {
  const uniqueRecords = new Map<string, CompanyProfileRecord>()

  records.forEach((record) => {
    const normalizedRecord = normalizeCompanyProfileRecord(record, locale)
    uniqueRecords.set(normalizedRecord.id, normalizedRecord)
  })

  return Array.from(uniqueRecords.values())
}

function normalizeCompanyProfileRecord(
  value: unknown,
  locale: SupportedLocale = DEFAULT_LOCALE,
): CompanyProfileRecord {
  const baseRecord = createDefaultCompanyProfileRecord(locale)
  const profile = normalizeCompanyProfile(value, locale)

  if (!isRecord(value)) {
    return {
      ...baseRecord,
      ...profile,
    }
  }

  const id = toText(value.id).trim() || baseRecord.id
  const updatedAt = isIsoDateString(value.updatedAt) ? value.updatedAt : baseRecord.updatedAt

  return {
    id,
    updatedAt,
    ...profile,
  }
}

function persistCompanyProfileRecords(records: CompanyProfileRecord[]) {
  if (!hasLocalStorage()) {
    return
  }

  const nextRecords = normalizeCompanyProfileRecords(cloneRecords(records), DEFAULT_LOCALE)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords))
  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  companyProfileListeners.forEach((listener) => {
    listener(cloneRecords(nextRecords))
  })
}

function toCompanyProfile(
  record: CompanyProfileRecord | undefined,
  locale: SupportedLocale = DEFAULT_LOCALE,
): CompanyProfile {
  return record
    ? {
        companyName: record.companyName,
        email: record.email,
        phone: record.phone,
      }
    : createDefaultCompanyProfile(locale)
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  return Number.isNaN(Date.parse(value)) === false
}

export function hasLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function cloneRecords(records: CompanyProfileRecord[]) {
  return JSON.parse(JSON.stringify(records)) as CompanyProfileRecord[]
}
