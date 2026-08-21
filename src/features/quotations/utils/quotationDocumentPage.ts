const CSS_DPI = 96
const MILLIMETERS_PER_INCH = 25.4
const PDF_VIEWPORT_HORIZONTAL_PADDING_PX = 128
const PDF_VIEWPORT_VERTICAL_PADDING_PX = 139
const LANDSCAPE_MIXED_TAX_COLUMN_THRESHOLD = 5

export const QUOTATION_DOCUMENT_PAGE_WIDTH_MM = 210
export const QUOTATION_DOCUMENT_PAGE_HEIGHT_MM = 297
export type QuotationDocumentOrientation = 'portrait' | 'landscape'

interface QuotationDocumentLayoutInput {
  totalsConfig: {
    globalMarkupRate?: number
    taxMode?: string
    mixedTaxColumns?: readonly unknown[]
  }
}

export function getQuotationDocumentOrientation(
  quotation: QuotationDocumentLayoutInput,
): QuotationDocumentOrientation {
  const visibleColumnCount = quotation.totalsConfig.taxMode === 'mixed'
    ? quotation.totalsConfig.mixedTaxColumns?.length ?? LANDSCAPE_MIXED_TAX_COLUMN_THRESHOLD
    : 0

  return visibleColumnCount >= LANDSCAPE_MIXED_TAX_COLUMN_THRESHOLD ? 'landscape' : 'portrait'
}

export function getQuotationDocumentPageSizePx(
  orientation: QuotationDocumentOrientation = 'portrait',
) {
  const isLandscape = orientation === 'landscape'

  return {
    width: millimetersToCssPixels(
      isLandscape ? QUOTATION_DOCUMENT_PAGE_HEIGHT_MM : QUOTATION_DOCUMENT_PAGE_WIDTH_MM,
    ),
    height: millimetersToCssPixels(
      isLandscape ? QUOTATION_DOCUMENT_PAGE_WIDTH_MM : QUOTATION_DOCUMENT_PAGE_HEIGHT_MM,
    ),
  }
}

export function getQuotationPdfViewportSize(
  orientation: QuotationDocumentOrientation = 'portrait',
) {
  const pageSize = getQuotationDocumentPageSizePx(orientation)

  return {
    width: pageSize.width + PDF_VIEWPORT_HORIZONTAL_PADDING_PX * 2,
    height: pageSize.height + PDF_VIEWPORT_VERTICAL_PADDING_PX * 2,
  }
}

function millimetersToCssPixels(value: number) {
  return Math.round((value / MILLIMETERS_PER_INCH) * CSS_DPI)
}
