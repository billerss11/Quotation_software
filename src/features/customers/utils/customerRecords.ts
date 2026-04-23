import type { QuotationDraft } from '@/features/quotations/types'

export interface CustomerRecord {
  key: string
  customerCompany: string
  customerName: string
  contactPerson: string
  contactDetails: string
  lastQuotationNumber: string
}

export function extractCustomerRecords(quotations: QuotationDraft[]) {
  const records = new Map<string, CustomerRecord>()

  quotations.forEach((quotation) => {
    const { header } = quotation
    const key = createCustomerRecordKey(
      header.customerCompany,
      header.contactPerson || header.customerName,
      header.contactDetails,
    )

    if (!hasCustomerIdentity(header.customerCompany, header.customerName, header.contactDetails)) {
      return
    }

    records.set(key, {
      key,
      customerCompany: header.customerCompany,
      customerName: header.customerName,
      contactPerson: header.contactPerson,
      contactDetails: header.contactDetails,
      lastQuotationNumber: header.quotationNumber,
    })
  })

  return Array.from(records.values())
}

export function createCustomerRecordKey(company: string, contact: string, contactDetails: string) {
  return [company, contact, contactDetails].map(normalizeKeyPart).join('::')
}

function hasCustomerIdentity(company: string, customerName: string, contactDetails: string) {
  return [company, customerName, contactDetails].some((value) => value.trim().length > 0)
}

function normalizeKeyPart(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}
