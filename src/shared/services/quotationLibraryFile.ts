import type {
  CompanyProfileRecord,
  ReusableLibraryData,
} from '../contracts/reusableLibrary.js'
import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'
import { dedupeCustomerLibraryRecords } from '@/features/customers/utils/customerRecords'

import {
  createDefaultLibraryNumberingState,
  createDefaultReusableLibraryData,
  normalizeCompanyProfile,
  normalizeLibraryNumberingState,
} from './reusableLibraryStore.js'

const QUOTATION_LIBRARY_FILE_SCHEMA_VERSION = 1
const QUOTATION_LIBRARY_FILE_APP = 'quotation-software'

export type QuotationLibraryFileErrorCode =
  | 'invalid_envelope'
  | 'missing_library'
  | 'invalid_company_profile'
  | 'invalid_customer'
  | 'invalid_numbering'
  | 'not_object'
  | 'invalid_json'

interface QuotationLibraryFileEnvelope {
  schemaVersion: number
  app: string
  exportedAt: string
  library: ReusableLibraryData
}

export class QuotationLibraryFileError extends Error {
  constructor(public readonly code: QuotationLibraryFileErrorCode) {
    super(code)
    this.name = 'QuotationLibraryFileError'
  }
}

export function createQuotationLibraryFileContent(library: ReusableLibraryData) {
  const envelope: QuotationLibraryFileEnvelope = {
    schemaVersion: QUOTATION_LIBRARY_FILE_SCHEMA_VERSION,
    app: QUOTATION_LIBRARY_FILE_APP,
    exportedAt: new Date().toISOString(),
    library: normalizeLibraryData(library),
  }

  return `${JSON.stringify(envelope, null, 2)}\n`
}

export function parseQuotationLibraryFileContent(content: string) {
  const parsed = parseJsonObject(content)

  if (!hasValidEnvelope(parsed)) {
    throw new QuotationLibraryFileError('invalid_envelope')
  }

  if (!isRecord(parsed.library)) {
    throw new QuotationLibraryFileError('missing_library')
  }

  return normalizeLibraryData(parsed.library)
}

function normalizeLibraryData(value: unknown): ReusableLibraryData {
  const defaults = createDefaultReusableLibraryData()

  if (!isRecord(value)) {
    return defaults
  }

  return {
    companyProfiles: parseCompanyProfiles(value.companyProfiles),
    customers: parseCustomers(value.customers),
    numbering: parseNumbering(value.numbering),
  }
}

function parseCompanyProfiles(value: unknown): CompanyProfileRecord[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map(parseCompanyProfileRecord)
}

function parseCustomers(value: unknown): CustomerLibraryRecord[] {
  if (!Array.isArray(value)) {
    return []
  }

  return dedupeCustomerLibraryRecords(value.map(parseCustomerLibraryRecord))
}

function parseNumbering(value: unknown) {
  const numbering = normalizeLibraryNumberingState(value)

  if (!isRecord(value)) {
    return createDefaultLibraryNumberingState()
  }

  if (
    value.lastIssuedYear !== null &&
    !(typeof value.lastIssuedYear === 'number' && Number.isInteger(value.lastIssuedYear))
  ) {
    throw new QuotationLibraryFileError('invalid_numbering')
  }

  if (!(typeof value.lastIssuedSequence === 'number' && Number.isInteger(value.lastIssuedSequence) && value.lastIssuedSequence >= 0)) {
    throw new QuotationLibraryFileError('invalid_numbering')
  }

  return numbering
}

function parseCompanyProfileRecord(value: unknown): CompanyProfileRecord {
  if (!isRecord(value)) {
    throw new QuotationLibraryFileError('invalid_company_profile')
  }

  const {
    id,
    updatedAt,
    companyName,
    email,
    phone,
  } = value

  if (
    !isString(id) ||
    !isIsoDateString(updatedAt) ||
    !isString(companyName) ||
    !isString(email) ||
    !isString(phone)
  ) {
    throw new QuotationLibraryFileError('invalid_company_profile')
  }

  return {
    id,
    updatedAt,
    ...normalizeCompanyProfile({
      companyName,
      email,
      phone,
    }),
  }
}

function parseCustomerLibraryRecord(value: unknown): CustomerLibraryRecord {
  if (!isRecord(value)) {
    throw new QuotationLibraryFileError('invalid_customer')
  }

  const {
    id,
    updatedAt,
    customerCompany,
    contactPerson,
    contactDetails,
  } = value

  if (
    !isString(id) ||
    !isIsoDateString(updatedAt) ||
    !isString(customerCompany) ||
    !isString(contactPerson) ||
    !isString(contactDetails)
  ) {
    throw new QuotationLibraryFileError('invalid_customer')
  }

  return {
    id,
    updatedAt,
    customerCompany: customerCompany.trim().replace(/\s+/g, ' '),
    contactPerson: contactPerson.trim().replace(/\s+/g, ' '),
    contactDetails: contactDetails.trim().replace(/\s+/g, ' '),
  }
}

function parseJsonObject(content: string) {
  try {
    const parsed: unknown = JSON.parse(content)

    if (!isRecord(parsed)) {
      throw new QuotationLibraryFileError('not_object')
    }

    return parsed
  } catch (error) {
    if (error instanceof QuotationLibraryFileError) {
      throw error
    }

    throw new QuotationLibraryFileError('invalid_json')
  }
}

function hasValidEnvelope(value: Record<string, unknown>) {
  return (
    value.schemaVersion === QUOTATION_LIBRARY_FILE_SCHEMA_VERSION
    && value.app === QUOTATION_LIBRARY_FILE_APP
    && isIsoDateString(value.exportedAt)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isIsoDateString(value: unknown): value is string {
  if (!isString(value)) {
    return false
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false
  }

  return Number.isNaN(Date.parse(value)) === false && new Date(value).toISOString() === value
}
