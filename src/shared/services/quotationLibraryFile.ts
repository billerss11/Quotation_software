import type {
  CompanyProfileRecord,
  ReusableLibraryData,
} from '../contracts/reusableLibrary.js'
import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'
import { createCustomerRecordKey } from '@/features/customers/utils/customerRecords'

import {
  normalizeCompanyProfile,
  normalizeLibraryNumberingState,
} from './reusableLibraryStore.js'

const QUOTATION_LIBRARY_FILE_SCHEMA_VERSION = 2
const LEGACY_QUOTATION_LIBRARY_FILE_SCHEMA_VERSION = 1
const QUOTATION_LIBRARY_FILE_APP = 'quotation-software'

export type QuotationLibraryFileErrorCode =
  | 'invalid_envelope'
  | 'unsupported_schema'
  | 'missing_library'
  | 'invalid_library'
  | 'invalid_company_profile'
  | 'invalid_customer'
  | 'invalid_numbering'
  | 'duplicate_id'
  | 'duplicate_customer'
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
    library: parseLibraryData(library),
  }

  return `${JSON.stringify(envelope, null, 2)}\n`
}

export function parseQuotationLibraryFileContent(content: string) {
  const parsed = parseJsonObject(content)

  if (!hasValidEnvelopeMetadata(parsed)) {
    throw new QuotationLibraryFileError('invalid_envelope')
  }

  return migrateQuotationLibraryFile(parsed)
}

function parseCompanyProfiles(value: unknown): CompanyProfileRecord[] {
  if (!Array.isArray(value)) {
    throw new QuotationLibraryFileError('invalid_library')
  }

  const records = value.map(parseCompanyProfileRecord)
  assertUniqueIds(records)
  return records
}

function parseCustomers(value: unknown): CustomerLibraryRecord[] {
  if (!Array.isArray(value)) {
    throw new QuotationLibraryFileError('invalid_library')
  }

  const records = value.map(parseCustomerLibraryRecord)
  assertUniqueIds(records)
  assertUniqueCustomerIdentities(records)
  return records
}

function parseNumbering(value: unknown) {
  if (!isRecord(value)) {
    throw new QuotationLibraryFileError('invalid_numbering')
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

  return normalizeLibraryNumberingState(value)
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
    !isNonEmptyString(id) ||
    !isIsoDateString(updatedAt) ||
    !isString(companyName) ||
    !isString(email) ||
    !isString(phone)
  ) {
    throw new QuotationLibraryFileError('invalid_company_profile')
  }

  return {
    id: id.trim(),
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
    !isNonEmptyString(id) ||
    !isIsoDateString(updatedAt) ||
    !isString(customerCompany) ||
    !isString(contactPerson) ||
    !isString(contactDetails)
  ) {
    throw new QuotationLibraryFileError('invalid_customer')
  }

  return {
    id: id.trim(),
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

function hasValidEnvelopeMetadata(value: Record<string, unknown>) {
  return (
    value.app === QUOTATION_LIBRARY_FILE_APP
    && isIsoDateString(value.exportedAt)
    && typeof value.schemaVersion === 'number'
    && Number.isInteger(value.schemaVersion)
  )
}

function migrateQuotationLibraryFile(value: Record<string, unknown>) {
  if (
    value.schemaVersion === QUOTATION_LIBRARY_FILE_SCHEMA_VERSION
    || value.schemaVersion === LEGACY_QUOTATION_LIBRARY_FILE_SCHEMA_VERSION
  ) {
    return parseLibraryData(value.library)
  }

  throw new QuotationLibraryFileError('unsupported_schema')
}

function parseLibraryData(value: unknown): ReusableLibraryData {
  if (!isRecord(value)) {
    throw new QuotationLibraryFileError('missing_library')
  }

  return {
    companyProfiles: parseCompanyProfiles(value.companyProfiles),
    customers: parseCustomers(value.customers),
    numbering: parseNumbering(value.numbering),
  }
}

function assertUniqueIds(records: Array<{ id: string }>) {
  const ids = new Set<string>()

  records.forEach((record) => {
    if (ids.has(record.id)) {
      throw new QuotationLibraryFileError('duplicate_id')
    }
    ids.add(record.id)
  })
}

function assertUniqueCustomerIdentities(records: CustomerLibraryRecord[]) {
  const identities = new Set<string>()

  records.forEach((record) => {
    const identity = createCustomerRecordKey(record)
    if (identities.has(identity)) {
      throw new QuotationLibraryFileError('duplicate_customer')
    }
    identities.add(identity)
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0
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
