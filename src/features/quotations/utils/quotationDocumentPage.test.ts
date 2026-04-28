import { describe, expect, it } from 'vitest'

import {
  getQuotationDocumentPageSizePx,
  getQuotationPdfViewportSize,
  QUOTATION_DOCUMENT_PAGE_HEIGHT_MM,
  QUOTATION_DOCUMENT_PAGE_WIDTH_MM,
} from './quotationDocumentPage'

describe('quotation document page', () => {
  it('uses canonical A4 paper dimensions', () => {
    expect(QUOTATION_DOCUMENT_PAGE_WIDTH_MM).toBe(210)
    expect(QUOTATION_DOCUMENT_PAGE_HEIGHT_MM).toBe(297)
  })

  it('converts A4 paper dimensions into stable CSS pixels', () => {
    expect(getQuotationDocumentPageSizePx()).toEqual({
      width: 794,
      height: 1123,
    })
  })

  it('creates a PDF viewport wider and taller than the A4 page', () => {
    expect(getQuotationPdfViewportSize()).toEqual({
      width: 1050,
      height: 1401,
    })
  })
})
