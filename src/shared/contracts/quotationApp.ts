import type { QuotationDraft, ExchangeRateTable, MajorItemSummary, QuotationTotals } from '../../features/quotations/types.js'
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

export interface QuotationAgentImportResult {
  ok: boolean
  currentFilePath: string
  statusMessage: string
}

export interface QuotationAgentApi {
  importQuotationFile(filePath: string): Promise<QuotationAgentImportResult>
  importLineItemsCsvFile(filePath: string): Promise<QuotationAgentImportResult>
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

export interface ExportQuotationPdfOptions extends QuotationPdfRenderPayload {}

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
  getQuotationPdfPayload(jobId: string): Promise<QuotationPdfRenderPayload>
  notifyQuotationPdfReady(jobId: string): Promise<void>
}
