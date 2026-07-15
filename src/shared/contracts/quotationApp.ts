import type {
  QuotationDraft,
  ExchangeRateTable,
  MajorItemSummary,
  QuotationOutputItemDetailLevel,
  QuotationOutputSettings,
  QuotationRootItem,
  TaxMode,
  QuotationTotals,
} from '../../features/quotations/types.js'
import type { CompanyProfile } from './reusableLibrary.js'

export interface SaveQuotationFileOptions {
  filePath?: string
  defaultPath?: string
  content: string
}

export type SaveQuotationFileResult =
  | {
      canceled: true
    }
  | {
      canceled: false
      filePath: string
    }

export type OpenQuotationFileResult =
  | {
      canceled: true
    }
  | {
      canceled: false
      filePath: string
      content: string
    }

export type OpenLineItemsCsvFileResult = OpenQuotationFileResult
export type OpenLibraryFileResult = OpenQuotationFileResult

export interface QuotationAgentSummary {
  quotationId: string
  quotationNumber: string
  projectName: string
  customerCompany: string
  currency: string
  topLevelItemCount: number
  itemCount: number
  outputItemDetailLevel: QuotationOutputItemDetailLevel
  subtotalAfterMarkup: number
  taxAmount: number
  grandTotal: number
  exchangeRates: ExchangeRateTable
}

export type QuotationAgentAction =
  | 'importQuotationFile'
  | 'importQuotationContent'
  | 'importLineItemsCsvFile'
  | 'importLineItemsCsvContent'
  | 'uploadLogo'
  | 'exportPdfToFile'
  | 'setBaseCurrency'
  | 'setTaxMode'
  | 'setOutputItemDetailLevel'
  | 'setMixedTaxDocumentColumns'

export interface QuotationAgentSetTaxModeOptions {
  taxClassId?: string
}

export interface QuotationAgentActionResult {
  ok: boolean
  action: QuotationAgentAction
  currentFilePath: string
  statusMessage: string
  summary: QuotationAgentSummary
  warnings: string[]
  filePath?: string
  error?: string
}

export interface QuotationAgentSnapshot {
  currentFilePath: string
  statusMessage: string
  summary: QuotationAgentSummary
  quotation: QuotationDraft
  itemSummaries: MajorItemSummary[]
  totals: QuotationTotals
}

export interface QuotationAgentApi {
  importQuotationFile(filePath: string): Promise<QuotationAgentActionResult>
  importQuotationContent(content: string, filePath?: string): Promise<QuotationAgentActionResult>
  importLineItemsCsvFile(filePath: string): Promise<QuotationAgentActionResult>
  importLineItemsCsvContent(content: string, filePath?: string): Promise<QuotationAgentActionResult>
  uploadLogo(logoDataUrl: string): Promise<QuotationAgentActionResult>
  exportPdfToFile(filePath: string): Promise<QuotationAgentActionResult>
  setBaseCurrency(currency: string, exchangeRates?: ExchangeRateTable): Promise<QuotationAgentActionResult>
  setTaxMode(mode: TaxMode, options?: QuotationAgentSetTaxModeOptions): Promise<QuotationAgentActionResult>
  setOutputItemDetailLevel(level: QuotationOutputItemDetailLevel): Promise<QuotationAgentActionResult>
  setMixedTaxDocumentColumns(columns: readonly string[]): Promise<QuotationAgentActionResult>
  getQuotationSummary(): QuotationAgentSummary
  getTotals(): QuotationTotals
  getLineItems(): QuotationRootItem[]
  getOutputSettings(): QuotationOutputSettings
  getQuotationSnapshot(): QuotationAgentSnapshot
}

export interface QuotationPdfRenderPayload {
  quotation: QuotationDraft
  summaries: MajorItemSummary[]
  totals: QuotationTotals
  globalMarkupRate: number
  exchangeRates: ExchangeRateTable
  companyProfile: CompanyProfile
  defaultFileName: string
}

export interface ExportQuotationPdfOptions extends QuotationPdfRenderPayload {
  filePath?: string
}

export type GoodsReceiptTemplateId = 'standard' | 'compact'

export interface GoodsReceiptGroupPathPdfPayload {
  id: string
  itemNumber: string
  label: string
  depth: number
}

export interface GoodsReceiptLinePdfPayload {
  id: string
  sourceItemId: string
  sourceItemNumber: string
  sourceGroupPath: GoodsReceiptGroupPathPdfPayload[]
  sourceDepth: number
  sourceHasChildren: boolean
  selected: boolean
  description: string
  quantity: number
  quotedQuantity: number
  unit: string
  remarks: string
}

export interface GoodsReceiptDraftPdfPayload {
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
  lines: GoodsReceiptLinePdfPayload[]
}

export interface GoodsReceiptPdfRenderPayload {
  draft: GoodsReceiptDraftPdfPayload
  branding: {
    logoDataUrl: string
    accentColor: string
  }
  defaultFileName: string
}

export interface ExportGoodsReceiptPdfOptions extends GoodsReceiptPdfRenderPayload {
  filePath?: string
}

export interface QuotationAppApi {
  getVersion(): Promise<string>
  saveQuotationFile(options: SaveQuotationFileOptions): Promise<SaveQuotationFileResult>
  openQuotationFile(): Promise<OpenQuotationFileResult>
  openQuotationFileFromPath(filePath: string): Promise<OpenQuotationFileResult>
  openDevAutoImportQuotationFile(): Promise<OpenQuotationFileResult>
  openLineItemsCsvFile(): Promise<OpenLineItemsCsvFileResult>
  openLineItemsCsvFileFromPath(filePath: string): Promise<OpenLineItemsCsvFileResult>
  saveLineItemsCsvFile(options: SaveQuotationFileOptions): Promise<SaveQuotationFileResult>
  saveLineItemsCsvTemplateFile(options: SaveQuotationFileOptions): Promise<SaveQuotationFileResult>
  saveLibraryFile(options: SaveQuotationFileOptions): Promise<SaveQuotationFileResult>
  openLibraryFile(): Promise<OpenLibraryFileResult>
  exportQuotationPdf(options: ExportQuotationPdfOptions): Promise<SaveQuotationFileResult>
  exportGoodsReceiptPdf(options: ExportGoodsReceiptPdfOptions): Promise<SaveQuotationFileResult>
  getQuotationPdfPayload(jobId: string): Promise<QuotationPdfRenderPayload>
  notifyQuotationPdfReady(jobId: string): Promise<void>
  getGoodsReceiptPdfPayload(jobId: string): Promise<GoodsReceiptPdfRenderPayload>
  notifyGoodsReceiptPdfReady(jobId: string): Promise<void>
}
