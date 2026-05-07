import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'

import {
  deleteReusableLibraryCustomerRecord,
  loadReusableLibraryCustomers,
  replaceReusableLibraryCustomers,
  saveReusableLibraryCustomerRecord,
  subscribeReusableLibraryCustomers,
} from './reusableLibraryStore.js'

export function loadCustomerLibraryRecords(): CustomerLibraryRecord[] {
  return loadReusableLibraryCustomers()
}

export function saveCustomerLibraryRecord(record: CustomerLibraryRecord) {
  saveReusableLibraryCustomerRecord(record)
}

export function replaceCustomerLibraryRecords(records: CustomerLibraryRecord[]) {
  replaceReusableLibraryCustomers(records)
}

export function deleteCustomerLibraryRecord(recordId: string) {
  deleteReusableLibraryCustomerRecord(recordId)
}

export function subscribeCustomerLibraryRecords(listener: (records: CustomerLibraryRecord[]) => void) {
  return subscribeReusableLibraryCustomers(listener)
}
