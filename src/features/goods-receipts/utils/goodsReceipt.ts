import type { QuotationDraft, QuotationItem, QuotationRootItem } from '@/features/quotations/types'
import { isQuotationItem } from '@/features/quotations/utils/quotationItems'

export type GoodsReceiptTemplateId = 'standard' | 'compact'
export const GOODS_RECEIPT_TEMPLATE_IDS: readonly GoodsReceiptTemplateId[] = ['standard', 'compact']

export interface GoodsReceiptDraft {
  grNumber: string
  documentDate: string
  customerReference: string
  deliveryReference: string
  receivingCompany: string
  deliveryAddress: string
  deliveryContact: string
  contactDetails: string
  supplierCompany: string
  supplierContact: string
  projectName: string
  preparedBy: string
  remarks: string
  templateId: GoodsReceiptTemplateId
  lines: GoodsReceiptLineDraft[]
}

export interface GoodsReceiptLineDraft {
  id: string
  sourceItemId: string
  selected: boolean
  description: string
  quantity: number
  quotedQuantity: number
  unit: string
  remarks: string
}

export interface GoodsReceiptPdfRow {
  no: number
  lineId: string
  description: string
  quantity: number
  unit: string
  remarks: string
}

export type GoodsReceiptValidationWarningCode = 'quantity_exceeds_quote' | 'zero_quantity_selected'
export type GoodsReceiptValidationErrorCode = 'negative_quantity' | 'no_exportable_lines'

export interface GoodsReceiptValidationWarning {
  lineId: string
  code: GoodsReceiptValidationWarningCode
}

export interface GoodsReceiptValidationError {
  lineId?: string
  code: GoodsReceiptValidationErrorCode
}

export interface GoodsReceiptValidationResult {
  errors: GoodsReceiptValidationError[]
  warnings: GoodsReceiptValidationWarning[]
}

export interface GoodsReceiptTotalQuantity {
  quantity: number
  unit: string
}

export function createGoodsReceiptDraft(
  quotation: QuotationDraft,
  options: {
    documentDate: string
    templateId?: GoodsReceiptTemplateId
  },
): GoodsReceiptDraft {
  const supplierContact = [quotation.companyProfileSnapshot.email, quotation.companyProfileSnapshot.phone]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' | ')

  return {
    grNumber: createGoodsReceiptNumber(options.documentDate),
    documentDate: options.documentDate,
    customerReference: '',
    deliveryReference: '',
    receivingCompany: quotation.header.customerCompany,
    deliveryAddress: '',
    deliveryContact: quotation.header.contactPerson,
    contactDetails: quotation.header.contactDetails,
    supplierCompany: quotation.companyProfileSnapshot.companyName,
    supplierContact,
    projectName: quotation.header.projectName,
    preparedBy: '',
    remarks: '',
    templateId: normalizeGoodsReceiptTemplateId(options.templateId),
    lines: createGoodsReceiptLineDrafts(quotation.majorItems),
  }
}

export function normalizeGoodsReceiptTemplateId(value: unknown): GoodsReceiptTemplateId {
  return GOODS_RECEIPT_TEMPLATE_IDS.includes(value as GoodsReceiptTemplateId)
    ? value as GoodsReceiptTemplateId
    : 'standard'
}

export function createGoodsReceiptLineDrafts(items: QuotationRootItem[]): GoodsReceiptLineDraft[] {
  return collectLeafQuotationItems(items).map((item) => {
    const quantity = normalizeQuantity(item.quantity)

    return {
      id: item.id,
      sourceItemId: item.id,
      selected: quantity > 0,
      description: createGoodsReceiptLineDescription(item),
      quantity,
      quotedQuantity: quantity,
      unit: item.quantityUnit.trim(),
      remarks: '',
    }
  })
}

export function createGoodsReceiptPdfRows(draft: GoodsReceiptDraft): GoodsReceiptPdfRow[] {
  let nextNumber = 1

  return draft.lines.flatMap((line) => {
    if (!line.selected || !Number.isFinite(line.quantity) || line.quantity <= 0) {
      return []
    }

    return [{
      no: nextNumber++,
      lineId: line.id,
      description: line.description.trim(),
      quantity: line.quantity,
      unit: line.unit.trim(),
      remarks: line.remarks.trim(),
    }]
  })
}

export function validateGoodsReceiptDraft(draft: GoodsReceiptDraft): GoodsReceiptValidationResult {
  const warnings: GoodsReceiptValidationWarning[] = []
  const errors: GoodsReceiptValidationError[] = []

  for (const line of draft.lines) {
    if (!Number.isFinite(line.quantity) || line.quantity < 0) {
      errors.push({
        lineId: line.id,
        code: 'negative_quantity',
      })
      continue
    }

    if (!line.selected) {
      continue
    }

    if (line.quantity === 0) {
      warnings.push({
        lineId: line.id,
        code: 'zero_quantity_selected',
      })
    }

    if (line.quantity > line.quotedQuantity) {
      warnings.push({
        lineId: line.id,
        code: 'quantity_exceeds_quote',
      })
    }
  }

  if (createGoodsReceiptPdfRows(draft).length === 0) {
    errors.push({
      code: 'no_exportable_lines',
    })
  }

  return {
    errors,
    warnings,
  }
}

export function getGoodsReceiptTotalQuantity(rows: GoodsReceiptPdfRow[]): GoodsReceiptTotalQuantity | null {
  if (rows.length === 0) {
    return null
  }

  const unit = rows[0].unit.trim()

  if (rows.some((row) => row.unit.trim() !== unit)) {
    return null
  }

  return {
    quantity: rows.reduce((total, row) => total + row.quantity, 0),
    unit,
  }
}

export function createGoodsReceiptNumber(documentDate: string) {
  const dateStamp = documentDate.replace(/\D/g, '').slice(0, 8)

  return dateStamp.length === 8 ? `GR-${dateStamp}` : 'GR'
}

export function createGoodsReceiptFileName(grNumber: string) {
  const safeBaseName = grNumber
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()

  return `${safeBaseName || 'goods-receipt'}.pdf`
}

function collectLeafQuotationItems(items: QuotationRootItem[] | QuotationItem[]): QuotationItem[] {
  const leaves: QuotationItem[] = []

  for (const item of items) {
    if (!isQuotationItem(item)) {
      continue
    }

    if (item.children.length === 0) {
      leaves.push(item)
      continue
    }

    leaves.push(...collectLeafQuotationItems(item.children))
  }

  return leaves
}

function createGoodsReceiptLineDescription(item: QuotationItem) {
  return [item.name, item.description]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(', ')
}

function normalizeQuantity(quantity: number) {
  return Number.isFinite(quantity) ? Math.max(quantity, 0) : 0
}
