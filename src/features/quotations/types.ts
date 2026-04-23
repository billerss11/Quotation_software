export type CurrencyCode = 'USD' | 'EUR' | 'CNY' | 'GBP'

export type DiscountMode = 'percentage' | 'fixed'

export type ExchangeRateTable = Record<CurrencyCode, number>

export interface QuotationHeader {
  quotationNumber: string
  quotationDate: string
  customerName: string
  customerCompany: string
  contactPerson: string
  contactDetails: string
  projectName: string
  validityPeriod: string
  currency: CurrencyCode
  notes: string
}

export interface PricingLine {
  id: string
  description: string
  quantity: number
  unitCost: number
  costCurrency: CurrencyCode
  markupRate?: number
  notes?: string
}

export interface QuotationSubItem extends PricingLine {
  type: 'sub'
}

export interface QuotationMajorItem extends PricingLine {
  type: 'major'
  title: string
  subItems: QuotationSubItem[]
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
  majorItems: QuotationMajorItem[]
  totalsConfig: TotalsConfig
  exchangeRates: ExchangeRateTable
  branding: {
    logoDataUrl: string
    accentColor: string
  }
}

export type MajorItemField =
  | 'title'
  | 'description'
  | 'quantity'
  | 'unitCost'
  | 'costCurrency'
  | 'markupRate'
  | 'notes'

export type SubItemField = 'description' | 'quantity' | 'unitCost' | 'costCurrency' | 'markupRate' | 'notes'
