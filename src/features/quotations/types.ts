import type { SupportedLocale } from '@/shared/i18n/locale'

export type CurrencyCode = 'USD' | 'EUR' | 'CNY' | 'GBP'

export type DiscountMode = 'percentage' | 'fixed'

export type ExchangeRateTable = Record<CurrencyCode, number>

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

export interface PricingLine {
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
}

export interface QuotationItem extends PricingLine {
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

export type QuotationItemField =
  | 'name'
  | 'description'
  | 'quantity'
  | 'quantityUnit'
  | 'unitCost'
  | 'costCurrency'
  | 'markupRate'
  | 'expectedTotal'
  | 'notes'

export type QuotationMajorItem = QuotationItem
export type QuotationSubItem = QuotationItem
export type MajorItemField = QuotationItemField
export type SubItemField = QuotationItemField
