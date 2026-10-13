import type {
  CompanyProfile,
  CompanyProfileRecord,
  LibraryNumberingState,
  ReusableLibraryData,
} from '../contracts/reusableLibrary.js'
import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'
import {
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
let unpersistedSeedData: ReusableLibraryData | null = null
const highestObservedQuotationSequences = new Map<number, number>()

export class ReusableLibraryStorageError extends Error {
  constructor(
    public readonly code: 'quota_exceeded' | 'write_failed',
    message: string,
  ) {
    super(message)
    this.name = 'ReusableLibraryStorageError'
  }
}

export interface ReusableLibraryQuotationNumberAllocation {
  quotationNumber: string
  warning?: ReusableLibraryStorageError
}

export interface ReusableLibraryQuotationNumberTracking {
  persisted: boolean
  warning?: ReusableLibraryStorageError
}

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
    unpersistedSeedData = null
    return cloneRecord(stored)
  }

  if (unpersistedSeedData) {
    return cloneRecord(unpersistedSeedData)
  }

  const seeded = createSeedReusableLibraryData()
  try {
    persistReusableLibraryData(seeded)
  } catch {
    unpersistedSeedData = cloneRecord(seeded)
  }
  return cloneRecord(seeded)
}

export function replaceReusableLibraryData(data: ReusableLibraryData) {
  persistReusableLibraryData(data)
  highestObservedQuotationSequences.clear()
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

export function allocateNextReusableLibraryQuotationNumber(
  date = new Date(),
): ReusableLibraryQuotationNumberAllocation {
  const data = loadReusableLibraryData()
  const year = date.getFullYear()
  const sequence = Math.max(
    getStoredSequenceForYear(data.numbering, year),
    highestObservedQuotationSequences.get(year) ?? 0,
  ) + 1

  data.numbering = {
    lastIssuedYear: year,
    lastIssuedSequence: sequence,
  }

  try {
    persistReusableLibraryData(data)
  } catch (error) {
    return {
      quotationNumber: '',
      warning: createReusableLibraryStorageError(error),
    }
  }

  clearObservedQuotationSequence(year, sequence)

  return {
    quotationNumber: `Q-${year}-${String(sequence).padStart(3, '0')}`,
  }
}

export function trackReusableLibraryQuotationNumber(
  quotationNumber: string,
): ReusableLibraryQuotationNumberTracking {
  const parsed = parseReusableLibraryQuotationNumber(quotationNumber)
  if (!parsed) {
    return { persisted: false }
  }

  const { year } = parsed
  const observedSequence = observeReusableLibraryQuotationNumber(quotationNumber)
  if (observedSequence === null) return { persisted: false }

  const data = loadReusableLibraryData()
  if (isNewerNumberingState(data.numbering, year, observedSequence)) {
    data.numbering = {
      lastIssuedYear: year,
      lastIssuedSequence: observedSequence,
    }
    try {
      persistReusableLibraryData(data)
    } catch (error) {
      return {
        persisted: false,
        warning: createReusableLibraryStorageError(error),
      }
    }

    clearObservedQuotationSequence(year, observedSequence)
    return { persisted: true }
  }

  if (getStoredSequenceForYear(data.numbering, year) >= observedSequence) {
    clearObservedQuotationSequence(year, observedSequence)
  }
  return { persisted: false }
}

export function observeReusableLibraryQuotationNumber(quotationNumber: string) {
  const parsed = parseReusableLibraryQuotationNumber(quotationNumber)
  if (!parsed) return null

  const observed = highestObservedQuotationSequences.get(parsed.year) ?? 0
  const nextObserved = Math.max(observed, parsed.sequence)
  highestObservedQuotationSequences.set(parsed.year, nextObserved)
  return nextObserved
}

function loadStoredReusableLibraryData(): ReusableLibraryData | null {
  const rawValue = window.localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(rawValue)
    return isStoredReusableLibraryData(parsed)
      ? normalizeReusableLibraryData(parsed)
      : null
  } catch {
    return null
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

function parseReusableLibraryQuotationNumber(quotationNumber: string) {
  const match = quotationNumber.match(/^Q-(\d{4})-(\d+)$/)
  if (!match) return null

  const year = Number(match[1])
  const sequence = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(sequence) || sequence < 1) return null

  return { year, sequence }
}

function getStoredSequenceForYear(numbering: LibraryNumberingState, year: number) {
  return numbering.lastIssuedYear === year ? numbering.lastIssuedSequence : 0
}

function isNewerNumberingState(
  numbering: LibraryNumberingState,
  year: number,
  sequence: number,
) {
  return numbering.lastIssuedYear === null
    || year > numbering.lastIssuedYear
    || (year === numbering.lastIssuedYear && sequence > numbering.lastIssuedSequence)
}

function clearObservedQuotationSequence(year: number, persistedSequence: number) {
  const observed = highestObservedQuotationSequences.get(year)
  if (observed !== undefined && persistedSequence >= observed) {
    highestObservedQuotationSequences.delete(year)
  }
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
    throw new ReusableLibraryStorageError(
      'write_failed',
      'Local reusable-library storage is unavailable.',
    )
  }

  const nextData = normalizeReusableLibraryData(cloneRecord(data))
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData))
  } catch (error) {
    throw createReusableLibraryStorageError(error)
  }
  unpersistedSeedData = null
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

function createReusableLibraryStorageError(error: unknown) {
  if (error instanceof ReusableLibraryStorageError) {
    return error
  }

  const message = error instanceof Error ? error.message : ''
  const name = error instanceof Error ? error.name : ''
  const isQuotaError = /quota/i.test(message) || /quota/i.test(name)

  return new ReusableLibraryStorageError(
    isQuotaError ? 'quota_exceeded' : 'write_failed',
    isQuotaError
      ? 'Local reusable-library storage is full.'
      : 'Could not save the reusable library.',
  )
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

function isStoredReusableLibraryData(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && Array.isArray(value.companyProfiles)
    && Array.isArray(value.customers)
    && isRecord(value.numbering)
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
