import { describe, expect, it } from 'vitest'

import {
  getQuotationDocumentOrientation,
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

  it('swaps the A4 dimensions for a landscape quotation', () => {
    expect(getQuotationDocumentPageSizePx('landscape')).toEqual({
      width: 1123,
      height: 794,
    })
    expect(getQuotationPdfViewportSize('landscape')).toEqual({
      width: 1379,
      height: 1072,
    })
  })

  it('uses landscape when a mixed-tax quotation shows five or more tax columns', () => {
    expect(getQuotationDocumentOrientation({
      totalsConfig: {
        globalMarkupRate: 0,
        taxMode: 'mixed',
        mixedTaxColumns: ['taxRate', 'unitPrice', 'unitTax', 'netAmount', 'grossAmount'],
      },
    })).toBe('landscape')

    expect(getQuotationDocumentOrientation({
      totalsConfig: {
        globalMarkupRate: 0,
        taxMode: 'mixed',
        mixedTaxColumns: ['taxRate', 'unitPrice', 'netAmount', 'grossAmount'],
      },
    })).toBe('portrait')
  })

  it('creates a PDF viewport wider and taller than the A4 page', () => {
    expect(getQuotationPdfViewportSize()).toEqual({
      width: 1050,
      height: 1401,
    })
  })
})
