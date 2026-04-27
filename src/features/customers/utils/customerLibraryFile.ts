import type { CustomerLibraryRecord } from './customerRecords'

import { dedupeCustomerLibraryRecords } from './customerRecords'

const CUSTOMER_LIBRARY_FILE_SCHEMA_VERSION = 1
const CUSTOMER_LIBRARY_FILE_APP = 'quotation-software'

interface CustomerLibraryFileEnvelope {
  schemaVersion: number
  app: string
  exportedAt: string
  customers: CustomerLibraryRecord[]
}

export function createCustomerLibraryFileContent(customers: CustomerLibraryRecord[]) {
  const envelope: CustomerLibraryFileEnvelope = {
    schemaVersion: CUSTOMER_LIBRARY_FILE_SCHEMA_VERSION,
    app: CUSTOMER_LIBRARY_FILE_APP,
    exportedAt: new Date().toISOString(),
    customers: dedupeCustomerLibraryRecords(customers),
  }

  return `${JSON.stringify(envelope, null, 2)}\n`
}

export function parseCustomerLibraryFileContent(content: string) {
  const parsed = parseJsonObject(content)

  if (!hasValidEnvelope(parsed)) {
    throw new Error('Customer library file has an invalid envelope.')
  }

  const customers = parsed.customers

  if (!Array.isArray(customers)) {
    throw new Error('Customer library file is missing customer data.')
  }

  return dedupeCustomerLibraryRecords(customers.map(parseCustomerLibraryRecord))
}

function parseCustomerLibraryRecord(value: unknown): CustomerLibraryRecord {
  if (!isRecord(value)) {
    throw new Error('Customer library file contains an invalid customer record.')
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
    throw new Error('Customer library file contains an invalid customer record.')
  }

  return {
    id,
    updatedAt,
    customerCompany,
    contactPerson,
    contactDetails,
  }
}

function parseJsonObject(content: string) {
  try {
    const parsed: unknown = JSON.parse(content)

    if (!isRecord(parsed)) {
      throw new Error('Customer library file must contain a JSON object.')
    }

    return parsed
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Customer library file')) {
      throw error
    }

    throw new Error('Customer library file is not valid JSON.')
  }
}

function hasValidEnvelope(value: Record<string, unknown>) {
  return (
    value.schemaVersion === CUSTOMER_LIBRARY_FILE_SCHEMA_VERSION &&
    value.app === CUSTOMER_LIBRARY_FILE_APP &&
    isIsoDateString(value.exportedAt)
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
