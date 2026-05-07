import { getDefaultCompanyName } from '../i18n/defaults.js'
import { DEFAULT_LOCALE, type SupportedLocale } from '../i18n/locale.js'
import type {
  CompanyProfile,
  CompanyProfileRecord,
} from '../contracts/reusableLibrary.js'
import {
  deleteReusableLibraryCompanyProfileRecord,
  loadReusableLibraryCompanyProfiles,
  replaceReusableLibraryCompanyProfiles,
  saveReusableLibraryCompanyProfileRecord,
  subscribeReusableLibraryCompanyProfiles,
} from './reusableLibraryStore.js'

export type { CompanyProfile, CompanyProfileRecord } from '../contracts/reusableLibrary.js'

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
  const fallback = createDefaultCompanyProfile(locale)

  if (!isRecord(value)) {
    return fallback
  }

  return {
    companyName: toText(value.companyName).trim().replace(/\s+/g, ' ') || fallback.companyName,
    email: toText(value.email).trim(),
    phone: toText(value.phone).trim().replace(/\s+/g, ' '),
  }
}

export function loadCompanyProfileRecords(locale: SupportedLocale = DEFAULT_LOCALE): CompanyProfileRecord[] {
  const records = loadReusableLibraryCompanyProfiles()

  return records.length > 0
    ? records
    : []
}

export function loadSelectedCompanyProfile(locale: SupportedLocale = DEFAULT_LOCALE): CompanyProfile {
  const record = loadCompanyProfileRecords(locale)[0]

  return record
    ? {
        companyName: record.companyName,
        email: record.email,
        phone: record.phone,
      }
    : createDefaultCompanyProfile(locale)
}

export function saveCompanyProfileRecord(record: CompanyProfileRecord) {
  saveReusableLibraryCompanyProfileRecord(record)
}

export function replaceCompanyProfileRecords(records: CompanyProfileRecord[]) {
  replaceReusableLibraryCompanyProfiles(records)
}

export function deleteCompanyProfileRecord(recordId: string) {
  deleteReusableLibraryCompanyProfileRecord(recordId)
}

export function subscribeCompanyProfileRecords(listener: (records: CompanyProfileRecord[]) => void) {
  return subscribeReusableLibraryCompanyProfiles(listener)
}

export function loadCompanyProfile(locale: SupportedLocale = DEFAULT_LOCALE): CompanyProfile {
  return loadSelectedCompanyProfile(locale)
}

export function saveCompanyProfile(profile: CompanyProfile, locale: SupportedLocale = DEFAULT_LOCALE) {
  const records = loadCompanyProfileRecords(locale)
  const firstRecord = records[0]
  const nextRecord: CompanyProfileRecord = {
    ...(firstRecord ?? createDefaultCompanyProfileRecord(locale)),
    ...normalizeCompanyProfile(profile, locale),
    updatedAt: new Date().toISOString(),
  }

  if (records.length === 0) {
    replaceCompanyProfileRecords([nextRecord])
    return
  }

  const nextRecords = [...records]
  nextRecords[0] = nextRecord
  replaceCompanyProfileRecords(nextRecords)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}
