export type GoodsReceiptTemplateId = 'standard' | 'compact'
export type GoodsReceiptSelectionPreset = 'summary' | 'grouped' | 'detailed'

export interface GoodsReceiptGroupPathEntry {
  id: string
  itemNumber: string
  label: string
  depth: number
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

export interface GoodsReceiptDraft {
  quotationId: string
  quotationNumber: string
  quotationDate: string
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

export interface GoodsReceiptRecord {
  id: string
  exportedAt: string
  filePath: string
  draft: GoodsReceiptDraft
}
