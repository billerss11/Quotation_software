import type { QuotationDraft } from '@/features/quotations/types'

export interface CustomerRecordFields {
  customerCompany: string
  contactPerson: string
  contactDetails: string
}

export interface CustomerLibraryRecord extends CustomerRecordFields {
  id: string
  updatedAt: string
}

export interface CustomerRecord extends CustomerRecordFields {
  key: string
  lastQuotationNumber: string
}

export function extractCustomerRecords(quotations: QuotationDraft[]) {
  const records = new Map<string, { quotationDate: string; record: CustomerRecord }>()

  quotations.forEach((quotation) => {
    const { header } = quotation
    const fields = normalizeCustomerRecordFields({
      customerCompany: header.customerCompany,
      contactPerson: header.contactPerson,
      contactDetails: header.contactDetails,
    })

    if (!hasCustomerIdentity(fields)) {
      return
    }

    const key = createCustomerRecordKey(fields)
    const nextRecord: CustomerRecord = {
      key,
      ...fields,
      lastQuotationNumber: header.quotationNumber,
    }
    const existingEntry = records.get(key)

    if (!existingEntry || isMoreRecentIsoDate(header.quotationDate, existingEntry.quotationDate)) {
      records.set(key, {
        quotationDate: header.quotationDate,
        record: nextRecord,
      })
    }
  })

  return Array.from(records.values(), (entry) => entry.record)
}

export function dedupeCustomerLibraryRecords(records: CustomerLibraryRecord[]) {
  const uniqueRecords = new Map<string, CustomerLibraryRecord>()

  records.forEach((record) => {
    const normalizedRecord = normalizeCustomerLibraryRecord(record)

    const key = createCustomerRecordKey(normalizedRecord)
    const existingRecord = uniqueRecords.get(key)

    uniqueRecords.set(key, choosePreferredDuplicateRecord(existingRecord, normalizedRecord))
  })

  return Array.from(uniqueRecords.values())
}

export function normalizeCustomerLibraryRecord(record: CustomerLibraryRecord): CustomerLibraryRecord {
  return {
    id: record.id.trim(),
    updatedAt: record.updatedAt.trim(),
    ...normalizeCustomerRecordFields(record),
  }
}

export function normalizeCustomerRecordFields(
  record: CustomerRecordFields,
): CustomerRecordFields {
  return {
    customerCompany: normalizeDisplayPart(record.customerCompany),
    contactPerson: normalizeDisplayPart(record.contactPerson),
    contactDetails: normalizeDisplayPart(record.contactDetails),
  }
}

export function createCustomerRecordKey(record: CustomerRecordFields) {
  return [record.customerCompany, record.contactPerson, record.contactDetails]
    .map(normalizeKeyPart)
    .join('::')
}

function hasCustomerIdentity(record: CustomerRecordFields) {
  return (
    record.customerCompany.length > 0 ||
    record.contactPerson.length > 0 ||
    record.contactDetails.length > 0
  )
}

function normalizeDisplayPart(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeKeyPart(value: string) {
  return normalizeDisplayPart(value).toLowerCase()
}

function isMoreRecentIsoDate(candidate: string, existing: string) {
  return candidate > existing
}

function choosePreferredDuplicateRecord(
  existingRecord: CustomerLibraryRecord | undefined,
  nextRecord: CustomerLibraryRecord,
) {
  if (!existingRecord) {
    return nextRecord
  }

  if (nextRecord.updatedAt > existingRecord.updatedAt) {
    return nextRecord
  }

  if (nextRecord.updatedAt < existingRecord.updatedAt) {
    return existingRecord
  }

  return nextRecord.id < existingRecord.id ? nextRecord : existingRecord
}
