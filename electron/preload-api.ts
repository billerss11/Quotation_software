export type SupportedLocale = 'en-US' | 'zh-CN'
export type CurrencyCode = string
export type DiscountMode = 'percentage' | 'fixed'

export type ExchangeRateTable = Record<string, number>

export interface QuotationHeader {
  quotationNumber: string
  revisionNumber?: number
  quotationDate: string
  customerCompany: string
  contactPerson: string
  contactDetails: string
  projectName: string
  validityPeriod: string
  currency: CurrencyCode
  documentLocale: SupportedLocale
  notes: string
  terms?: string
}

export interface QuotationItem {
  id: string
  name: string
  description: string
  quantity: number
  quantityUnit: string
  unitCost: number
  costCurrency: CurrencyCode
  markupRate?: number
  expectedTotal?: number
  notes?: string
  children: QuotationItem[]
}

export interface TotalsConfig {
  globalMarkupRate: number
  discountMode: DiscountMode
  discountValue: number
  taxRate: number
}

export interface MajorItemSummary {
  itemId: string
  baseSubtotal: number
  markupAmount: number
  subtotal: number
}

export interface QuotationTotals {
  baseSubtotal: number
  markupAmount: number
  subtotalAfterMarkup: number
  discountAmount: number
  taxableSubtotal: number
  taxAmount: number
  grandTotal: number
}

export interface QuotationDraft {
  id: string
  header: QuotationHeader
  majorItems: QuotationItem[]
  totalsConfig: TotalsConfig
  exchangeRates: ExchangeRateTable
  branding: {
    logoDataUrl: string
    accentColor: string
  }
}

export interface CompanyProfile {
  companyName: string
  email: string
  phone: string
}

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
  openLineItemsCsvFile(): Promise<OpenLineItemsCsvFileResult>
  saveLineItemsCsvFile(options: SaveQuotationFileOptions): Promise<SaveQuotationFileResult>
  saveLineItemsCsvTemplateFile(options: SaveQuotationFileOptions): Promise<SaveQuotationFileResult>
  saveCustomerLibraryFile(options: SaveQuotationFileOptions): Promise<SaveQuotationFileResult>
  openCustomerLibraryFile(): Promise<OpenQuotationFileResult>
  exportQuotationPdf(options: ExportQuotationPdfOptions): Promise<SaveQuotationFileResult>
  getQuotationPdfPayload(jobId: string): Promise<QuotationPdfRenderPayload>
  notifyQuotationPdfReady(jobId: string): Promise<void>
}
