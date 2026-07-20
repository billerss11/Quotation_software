import type { QuotationDraft, QuotationItem, QuotationRootItem } from '@/features/quotations/types'
import { isQuotationItem } from '@/features/quotations/utils/quotationItems'

export type GoodsReceiptTemplateId = 'standard' | 'compact'
export type GoodsReceiptSelectionPreset = 'summary' | 'grouped' | 'detailed'
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
  sourceItemNumber: string
  sourceGroupPath: GoodsReceiptGroupPathEntry[]
  sourceDepth: number
  sourceHasChildren: boolean
  selected: boolean
  description: string
  quotedDescription?: string
  quantity: number
  quotedQuantity: number
  unit: string
  quotedUnit?: string
  remarks: string
}

export interface GoodsReceiptGroupPathEntry {
  id: string
  itemNumber: string
  label: string
  depth: number
}

export interface GoodsReceiptPdfGroupRow {
  kind: 'group'
  key: string
  itemNumber: string
  description: string
  depth: number
}

export interface GoodsReceiptPdfLineRow {
  kind: 'line'
  lineId: string
  itemNumber: string
  description: string
  quantity: number
  unit: string
  remarks: string
}

export type GoodsReceiptPdfRow = GoodsReceiptPdfGroupRow | GoodsReceiptPdfLineRow

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
  const lines: GoodsReceiptLineDraft[] = []
  let rootItemNumber = 0

  for (const item of items) {
    if (!isQuotationItem(item)) {
      continue
    }

    rootItemNumber += 1
    collectGoodsReceiptLines(item, String(rootItemNumber), [], lines)
  }

  return lines
}

export function createGoodsReceiptPdfRows(draft: GoodsReceiptDraft): GoodsReceiptPdfRow[] {
  const rows: GoodsReceiptPdfRow[] = []
  let activeGroupPath: GoodsReceiptGroupPathEntry[] = []
  const selectedExportableItemIds = new Set(
    draft.lines
      .filter(isExportableGoodsReceiptLine)
      .map((line) => line.sourceItemId),
  )

  for (const line of draft.lines) {
    if (
      !isExportableGoodsReceiptLine(line)
      || line.sourceGroupPath.some((group) => selectedExportableItemIds.has(group.id))
    ) {
      continue
    }

    const commonPathLength = getCommonGroupPathLength(activeGroupPath, line.sourceGroupPath)

    for (const group of line.sourceGroupPath.slice(commonPathLength)) {
      rows.push({
        kind: 'group',
        key: `group:${group.id}`,
        itemNumber: group.itemNumber,
        description: group.label,
        depth: group.depth,
      })
    }

    rows.push({
      kind: 'line',
      lineId: line.id,
      itemNumber: line.sourceItemNumber,
      description: line.description.trim(),
      quantity: line.quantity,
      unit: line.unit.trim(),
      remarks: line.remarks.trim(),
    })
    activeGroupPath = line.sourceGroupPath
  }

  return rows
}

export function getGoodsReceiptPresetLineIds(
  lines: GoodsReceiptLineDraft[],
  preset: GoodsReceiptSelectionPreset,
) {
  const targetDepth = preset === 'summary' ? 0 : 1

  return new Set(
    lines
      .filter((line) => {
        if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
          return false
        }

        if (preset === 'detailed') {
          return !line.sourceHasChildren
        }

        return line.sourceDepth === targetDepth
          || (!line.sourceHasChildren && line.sourceDepth < targetDepth)
      })
      .map((line) => line.sourceItemId),
  )
}

export function isGoodsReceiptLineCustomized(line: GoodsReceiptLineDraft) {
  return line.description !== (line.quotedDescription ?? line.description)
    || line.quantity !== line.quotedQuantity
    || line.unit !== (line.quotedUnit ?? line.unit)
    || line.remarks.trim().length > 0
}

export function resetGoodsReceiptLineCustomization(line: GoodsReceiptLineDraft) {
  line.description = line.quotedDescription ?? line.description
  line.quantity = line.quotedQuantity
  line.unit = line.quotedUnit ?? line.unit
  line.remarks = ''
}

export function getGoodsReceiptSelectionAfterToggle(
  lines: GoodsReceiptLineDraft[],
  sourceItemId: string,
  selected: boolean,
) {
  const selectedIds = new Set(
    lines.filter((line) => line.selected).map((line) => line.sourceItemId),
  )
  const targetLine = lines.find((line) => line.sourceItemId === sourceItemId)

  if (!targetLine) {
    return selectedIds
  }

  if (!selected) {
    selectedIds.delete(sourceItemId)
    return selectedIds
  }

  const ancestorIds = new Set(targetLine.sourceGroupPath.map((group) => group.id))

  lines.forEach((line) => {
    const isAncestor = ancestorIds.has(line.sourceItemId)
    const isDescendant = line.sourceGroupPath.some((group) => group.id === sourceItemId)

    if (isAncestor || isDescendant) {
      selectedIds.delete(line.sourceItemId)
    }
  })
  selectedIds.add(sourceItemId)

  return selectedIds
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
  const lineRows = rows.filter((row): row is GoodsReceiptPdfLineRow => row.kind === 'line')

  if (lineRows.length === 0) {
    return null
  }

  const unit = lineRows[0].unit.trim()

  if (lineRows.some((row) => row.unit.trim() !== unit)) {
    return null
  }

  return {
    quantity: lineRows.reduce((total, row) => total + row.quantity, 0),
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

function collectGoodsReceiptLines(
  item: QuotationItem,
  itemNumber: string,
  groupPath: GoodsReceiptGroupPathEntry[],
  lines: GoodsReceiptLineDraft[],
) {
  const quantity = normalizeQuantity(item.quantity)
  const sourceHasChildren = item.children.length > 0
  const description = createGoodsReceiptLineDescription(item)
  const unit = item.quantityUnit.trim()

  lines.push({
    id: item.id,
    sourceItemId: item.id,
    sourceItemNumber: itemNumber,
    sourceGroupPath: groupPath,
    sourceDepth: groupPath.length,
    sourceHasChildren,
    selected: !sourceHasChildren && quantity > 0,
    description,
    quotedDescription: description,
    quantity,
    quotedQuantity: quantity,
    unit,
    quotedUnit: unit,
    remarks: '',
  })

  if (!sourceHasChildren) {
    return
  }

  const nextGroupPath = [...groupPath, {
    id: item.id,
    itemNumber,
    label: createGoodsReceiptGroupLabel(item),
    depth: groupPath.length,
  }]

  item.children.forEach((child, index) => {
    collectGoodsReceiptLines(child, `${itemNumber}.${index + 1}`, nextGroupPath, lines)
  })
}

function getCommonGroupPathLength(
  currentPath: GoodsReceiptGroupPathEntry[],
  nextPath: GoodsReceiptGroupPathEntry[],
) {
  const maxCommonLength = Math.min(currentPath.length, nextPath.length)
  let commonLength = 0

  while (commonLength < maxCommonLength && currentPath[commonLength]?.id === nextPath[commonLength]?.id) {
    commonLength += 1
  }

  return commonLength
}

function createGoodsReceiptLineDescription(item: QuotationItem) {
  return [item.name, item.description]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(', ')
}

function createGoodsReceiptGroupLabel(item: QuotationItem) {
  return item.name.trim() || item.description.trim()
}

function normalizeQuantity(quantity: number) {
  return Number.isFinite(quantity) ? Math.max(quantity, 0) : 0
}

function isExportableGoodsReceiptLine(line: GoodsReceiptLineDraft) {
  return line.selected && Number.isFinite(line.quantity) && line.quantity > 0
}
