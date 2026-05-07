import type {
  CompanyProfile,
  CompanyProfileRecord,
  LibraryNumberingState,
  ReusableLibraryData,
} from '../contracts/reusableLibrary.js'
import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'
import {
  createCustomerRecordKey,
  dedupeCustomerLibraryRecords,
  extractCustomerRecords,
} from '@/features/customers/utils/customerRecords'
import { loadSavedQuotations, hasLocalStorage as hasQuotationLocalStorage } from './localQuotationStorage.js'

const STORAGE_KEY = 'quotation-software:reusable-library-cache'
const LEGACY_COMPANY_STORAGE_KEY = 'quotation-software:company-profiles'
const LEGACY_SINGLE_COMPANY_STORAGE_KEY = 'quotation-software:company-profile'
const LEGACY_CUSTOMER_STORAGE_KEY = 'quotation-software:customer-library'

const companyProfileListeners = new Set<(records: CompanyProfileRecord[]) => void>()
const customerLibraryListeners = new Set<(records: CustomerLibraryRecord[]) => void>()
const reusableLibraryListeners = new Set<(data: ReusableLibraryData) => void>()

export function createDefaultLibraryNumberingState(): LibraryNumberingState {
  return {
    lastIssuedYear: null,
    lastIssuedSequence: 0,
  }
}

export function createDefaultReusableLibraryData(): ReusableLibraryData {
  return {
    companyProfiles: [],
    customers: [],
    numbering: createDefaultLibraryNumberingState(),
  }
}

export function loadReusableLibraryData(): ReusableLibraryData {
  if (!hasReusableLibraryLocalStorage()) {
    return createDefaultReusableLibraryData()
  }

  const stored = loadStoredReusableLibraryData()

  if (stored) {
    return stored
  }

  const seeded = createSeedReusableLibraryData()
  persistReusableLibraryData(seeded)
  return seeded
}

export function replaceReusableLibraryData(data: ReusableLibraryData) {
  persistReusableLibraryData(data)
}

export function loadReusableLibraryCompanyProfiles() {
  return loadReusableLibraryData().companyProfiles
}

export function loadReusableLibraryCustomers() {
  return loadReusableLibraryData().customers
}

export function saveReusableLibraryCompanyProfileRecord(record: CompanyProfileRecord) {
  const data = loadReusableLibraryData()
  const nextRecord = normalizeCompanyProfileRecord(record)
  const index = data.companyProfiles.findIndex((existingRecord) => existingRecord.id === nextRecord.id)

  if (index === -1) {
    data.companyProfiles.push(nextRecord)
  } else {
    data.companyProfiles[index] = nextRecord
  }

  persistReusableLibraryData(data)
}

export function replaceReusableLibraryCompanyProfiles(records: CompanyProfileRecord[]) {
  const data = loadReusableLibraryData()
  data.companyProfiles = dedupeCompanyProfileRecords(records)
  persistReusableLibraryData(data)
}

export function deleteReusableLibraryCompanyProfileRecord(recordId: string) {
  const data = loadReusableLibraryData()
  data.companyProfiles = data.companyProfiles.filter((record) => record.id !== recordId)
  persistReusableLibraryData(data)
}

export function saveReusableLibraryCustomerRecord(record: CustomerLibraryRecord) {
  const data = loadReusableLibraryData()
  const nextRecord = cloneRecord(record)
  const index = data.customers.findIndex((existingRecord) => existingRecord.id === nextRecord.id)

  if (index === -1) {
    data.customers.push(nextRecord)
  } else {
    data.customers[index] = nextRecord
  }

  data.customers = dedupeCustomerLibraryRecords(data.customers)
  persistReusableLibraryData(data)
}

export function replaceReusableLibraryCustomers(records: CustomerLibraryRecord[]) {
  const data = loadReusableLibraryData()
  data.customers = dedupeCustomerLibraryRecords(records)
  persistReusableLibraryData(data)
}

export function deleteReusableLibraryCustomerRecord(recordId: string) {
  const data = loadReusableLibraryData()
  data.customers = data.customers.filter((record) => record.id !== recordId)
  persistReusableLibraryData(data)
}

export function subscribeReusableLibraryData(listener: (data: ReusableLibraryData) => void) {
  reusableLibraryListeners.add(listener)

  return () => {
    reusableLibraryListeners.delete(listener)
  }
}

export function subscribeReusableLibraryCompanyProfiles(listener: (records: CompanyProfileRecord[]) => void) {
  companyProfileListeners.add(listener)

  return () => {
    companyProfileListeners.delete(listener)
  }
}

export function subscribeReusableLibraryCustomers(listener: (records: CustomerLibraryRecord[]) => void) {
  customerLibraryListeners.add(listener)

  return () => {
    customerLibraryListeners.delete(listener)
  }
}

export function allocateNextReusableLibraryQuotationNumber(date = new Date()) {
  const data = loadReusableLibraryData()
  const year = date.getFullYear()
  const sequence = data.numbering.lastIssuedYear === year
    ? data.numbering.lastIssuedSequence + 1
    : 1

  data.numbering = {
    lastIssuedYear: year,
    lastIssuedSequence: sequence,
  }
  persistReusableLibraryData(data)

  return `Q-${year}-${String(sequence).padStart(3, '0')}`
}

export function trackReusableLibraryQuotationNumber(quotationNumber: string) {
  const match = quotationNumber.match(/^Q-(\d{4})-(\d+)$/)

  if (!match) {
    return
  }

  const nextYear = Number(match[1])
  const nextSequence = Number(match[2])

  if (!Number.isInteger(nextYear) || !Number.isInteger(nextSequence)) {
    return
  }

  const data = loadReusableLibraryData()
  const { lastIssuedYear, lastIssuedSequence } = data.numbering

  if (
    lastIssuedYear === null ||
    nextYear > lastIssuedYear ||
    (nextYear === lastIssuedYear && nextSequence > lastIssuedSequence)
  ) {
    data.numbering = {
      lastIssuedYear: nextYear,
      lastIssuedSequence: nextSequence,
    }
    persistReusableLibraryData(data)
  }
}

function loadStoredReusableLibraryData(): ReusableLibraryData | null {
  const rawValue = window.localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    return normalizeReusableLibraryData(JSON.parse(rawValue))
  } catch {
    return createDefaultReusableLibraryData()
  }
}

function createSeedReusableLibraryData(): ReusableLibraryData {
  return normalizeReusableLibraryData({
    companyProfiles: loadLegacyCompanyProfiles(),
    customers: loadLegacyCustomerLibraryRecords(),
    numbering: createSeedNumberingState(),
  })
}

function loadLegacyCompanyProfiles(): CompanyProfileRecord[] {
  const legacyRecordsRaw = window.localStorage.getItem(LEGACY_COMPANY_STORAGE_KEY)

  if (legacyRecordsRaw) {
    try {
      const parsed = JSON.parse(legacyRecordsRaw)
      if (Array.isArray(parsed)) {
        return dedupeCompanyProfileRecords(parsed)
      }
    } catch {
      return []
    }
  }

  const legacySingleRaw = window.localStorage.getItem(LEGACY_SINGLE_COMPANY_STORAGE_KEY)

  if (!legacySingleRaw) {
    return []
  }

  try {
    return [
      {
        id: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
        ...normalizeCompanyProfile(JSON.parse(legacySingleRaw)),
      },
    ]
  } catch {
    return []
  }
}

function loadLegacyCustomerLibraryRecords(): CustomerLibraryRecord[] {
  const rawValue = window.localStorage.getItem(LEGACY_CUSTOMER_STORAGE_KEY)

  if (rawValue) {
    try {
      const parsed = JSON.parse(rawValue)
      if (Array.isArray(parsed)) {
        return dedupeCustomerLibraryRecords(parsed as CustomerLibraryRecord[])
      }
    } catch {
      return []
    }
  }

  return extractCustomerRecords(loadSavedQuotations()).map((record) => ({
    id: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    customerCompany: record.customerCompany,
    contactPerson: record.contactPerson,
    contactDetails: record.contactDetails,
  }))
}

function createSeedNumberingState(): LibraryNumberingState {
  return loadSavedQuotations().reduce<LibraryNumberingState>((state, quotation) => {
    const match = quotation.header.quotationNumber.match(/^Q-(\d{4})-(\d+)$/)

    if (!match) {
      return state
    }

    const nextYear = Number(match[1])
    const nextSequence = Number(match[2])

    if (
      state.lastIssuedYear === null ||
      nextYear > state.lastIssuedYear ||
      (nextYear === state.lastIssuedYear && nextSequence > state.lastIssuedSequence)
    ) {
      return {
        lastIssuedYear: nextYear,
        lastIssuedSequence: nextSequence,
      }
    }

    return state
  }, createDefaultLibraryNumberingState())
}

function normalizeReusableLibraryData(value: unknown): ReusableLibraryData {
  const defaults = createDefaultReusableLibraryData()

  if (!isRecord(value)) {
    return defaults
  }

  const companyProfiles = Array.isArray(value.companyProfiles)
    ? dedupeCompanyProfileRecords(value.companyProfiles)
    : defaults.companyProfiles
  const customers = Array.isArray(value.customers)
    ? dedupeCustomerLibraryRecords(value.customers as CustomerLibraryRecord[])
    : defaults.customers
  const numbering = normalizeLibraryNumberingState(value.numbering)

  return {
    companyProfiles,
    customers,
    numbering,
  }
}

export function normalizeLibraryNumberingState(value: unknown): LibraryNumberingState {
  if (!isRecord(value)) {
    return createDefaultLibraryNumberingState()
  }

  const lastIssuedYear = typeof value.lastIssuedYear === 'number' && Number.isInteger(value.lastIssuedYear)
    ? value.lastIssuedYear
    : null
  const lastIssuedSequence = typeof value.lastIssuedSequence === 'number' && Number.isInteger(value.lastIssuedSequence) && value.lastIssuedSequence >= 0
    ? value.lastIssuedSequence
    : 0

  return {
    lastIssuedYear,
    lastIssuedSequence,
  }
}

function persistReusableLibraryData(data: ReusableLibraryData) {
  if (!hasReusableLibraryLocalStorage()) {
    return
  }

  const nextData = normalizeReusableLibraryData(cloneRecord(data))
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData))
  reusableLibraryListeners.forEach((listener) => {
    listener(cloneRecord(nextData))
  })
  companyProfileListeners.forEach((listener) => {
    listener(cloneRecord(nextData.companyProfiles))
  })
  customerLibraryListeners.forEach((listener) => {
    listener(cloneRecord(nextData.customers))
  })
}

function dedupeCompanyProfileRecords(records: unknown[]): CompanyProfileRecord[] {
  const uniqueRecords = new Map<string, CompanyProfileRecord>()

  records.forEach((record) => {
    const normalizedRecord = normalizeCompanyProfileRecord(record)
    uniqueRecords.set(normalizedRecord.id, normalizedRecord)
  })

  return Array.from(uniqueRecords.values())
}

export function normalizeCompanyProfile(value: unknown): CompanyProfile {
  if (!isRecord(value)) {
    return {
      companyName: '',
      email: '',
      phone: '',
    }
  }

  return {
    companyName: toText(value.companyName).trim().replace(/\s+/g, ' '),
    email: toText(value.email).trim(),
    phone: toText(value.phone).trim().replace(/\s+/g, ' '),
  }
}

function normalizeCompanyProfileRecord(value: unknown): CompanyProfileRecord {
  const profile = normalizeCompanyProfile(value)
  const fallback: CompanyProfileRecord = {
    id: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    ...profile,
  }

  if (!isRecord(value)) {
    return fallback
  }

  return {
    id: toText(value.id).trim() || fallback.id,
    updatedAt: isIsoDateString(value.updatedAt) ? value.updatedAt : fallback.updatedAt,
    ...profile,
  }
}

function hasReusableLibraryLocalStorage() {
  return hasQuotationLocalStorage()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false
  }

  return Number.isNaN(Date.parse(value)) === false && new Date(value).toISOString() === value
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
