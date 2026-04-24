import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'
import { dedupeCustomerLibraryRecords, extractCustomerRecords } from '@/features/customers/utils/customerRecords'
import { cloneSerializable } from '@/shared/utils/clone'

import { hasLocalStorage, loadSavedQuotations } from './localQuotationStorage'

const STORAGE_KEY = 'quotation-software:customer-library'

export function loadCustomerLibraryRecords() {
  if (!hasLocalStorage()) {
    return []
  }

  const storedRecords = loadStoredCustomerLibraryRecords()

  if (storedRecords) {
    return storedRecords
  }

  const seededRecords = createSeedCustomerLibraryRecords()

  if (seededRecords.length > 0) {
    persistCustomerLibraryRecords(seededRecords)
  }

  return seededRecords
}

export function saveCustomerLibraryRecord(record: CustomerLibraryRecord) {
  const records = loadCustomerLibraryRecords()
  const nextRecord = cloneSerializable(record)
  const index = records.findIndex((existingRecord) => existingRecord.id === nextRecord.id)

  if (index === -1) {
    records.push(nextRecord)
  } else {
    records[index] = nextRecord
  }

  persistCustomerLibraryRecords(records)
}

export function replaceCustomerLibraryRecords(records: CustomerLibraryRecord[]) {
  persistCustomerLibraryRecords(records)
}

export function deleteCustomerLibraryRecord(recordId: string) {
  const records = loadCustomerLibraryRecords().filter((record) => record.id !== recordId)
  persistCustomerLibraryRecords(records)
}

function loadStoredCustomerLibraryRecords() {
  const rawValue = window.localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    return dedupeCustomerLibraryRecords(JSON.parse(rawValue) as CustomerLibraryRecord[])
  } catch {
    return []
  }
}

function createSeedCustomerLibraryRecords() {
  const updatedAt = new Date().toISOString()

  return extractCustomerRecords(loadSavedQuotations()).map((record) => ({
    id: crypto.randomUUID(),
    updatedAt,
    customerCompany: record.customerCompany,
    customerName: record.customerName,
    contactPerson: record.contactPerson,
    contactDetails: record.contactDetails,
  }))
}

function persistCustomerLibraryRecords(records: CustomerLibraryRecord[]) {
  if (!hasLocalStorage()) {
    return
  }

  const nextRecords = dedupeCustomerLibraryRecords(cloneSerializable(records))
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords))
}
