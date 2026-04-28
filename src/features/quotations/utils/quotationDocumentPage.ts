const CSS_DPI = 96
const MILLIMETERS_PER_INCH = 25.4
const PDF_VIEWPORT_HORIZONTAL_PADDING_PX = 128
const PDF_VIEWPORT_VERTICAL_PADDING_PX = 139

export const QUOTATION_DOCUMENT_PAGE_WIDTH_MM = 210
export const QUOTATION_DOCUMENT_PAGE_HEIGHT_MM = 297

export function getQuotationDocumentPageSizePx() {
  return {
    width: millimetersToCssPixels(QUOTATION_DOCUMENT_PAGE_WIDTH_MM),
    height: millimetersToCssPixels(QUOTATION_DOCUMENT_PAGE_HEIGHT_MM),
  }
}

export function getQuotationPdfViewportSize() {
  const pageSize = getQuotationDocumentPageSizePx()

  return {
    width: pageSize.width + PDF_VIEWPORT_HORIZONTAL_PADDING_PX * 2,
    height: pageSize.height + PDF_VIEWPORT_VERTICAL_PADDING_PX * 2,
  }
}

function millimetersToCssPixels(value: number) {
  return Math.round((value / MILLIMETERS_PER_INCH) * CSS_DPI)
}
