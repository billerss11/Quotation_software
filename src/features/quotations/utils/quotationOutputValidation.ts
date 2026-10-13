import type { QuotationDraft } from '../types.js'

export class QuotationOutputError extends Error {
  constructor(
    public readonly code: 'quotation_number_required',
    public readonly fieldPath: 'quotation.header.quotationNumber' = 'quotation.header.quotationNumber',
  ) {
    super('A quotation number is required before saving or exporting.')
    this.name = 'QuotationOutputError'
  }
}

export function assertQuotationReadyForOutput(
  quotation: Pick<QuotationDraft, 'header'>,
) {
  if (!quotation.header.quotationNumber.trim()) {
    throw new QuotationOutputError('quotation_number_required')
  }
}
