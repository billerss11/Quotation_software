import type { CustomerLibraryRecord, CustomerRecordFields } from './customerRecords'

import { createCustomerRecordKey, normalizeCustomerRecordFields } from './customerRecords'

export function findMatchingCustomerRecord(
  records: CustomerLibraryRecord[],
  fields: CustomerRecordFields,
): CustomerLibraryRecord | null {
  const targetKey = createCustomerRecordKey(normalizeCustomerRecordFields(fields))

  return records.find((record) => createCustomerRecordKey(record) === targetKey) ?? null
}

export function getCustomerRecordLabel(record: CustomerRecordFields) {
  return record.customerCompany || record.contactPerson || 'Untitled customer'
}
