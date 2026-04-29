import type { QuotationDraft } from '../types'

export function createQuotationDocumentFileName(quotation: QuotationDraft, extension: 'csv' | 'json' | 'pdf') {
  const quotationNumber = quotation.header.quotationNumber || 'quotation'
  const revision = quotation.header.revisionNumber && quotation.header.revisionNumber > 1
    ? `Rev-${quotation.header.revisionNumber}`
    : ''
  const customer = quotation.header.customerCompany || quotation.header.contactPerson
  const fileStem = sanitizeFileName([quotationNumber, revision, customer].filter(Boolean).join('-')) || 'quotation'

  return `${fileStem}.${extension}`
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/^[-.\s]+|[-.\s]+$/g, '')
    .trim()
}
