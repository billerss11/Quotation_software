import type { SupportedLocale } from '../../shared/i18n/locale.js'
import type { CompanyProfile } from '../../shared/contracts/reusableLibrary.js'

export type CurrencyCode = string
export type QuotationTemplateId = 'legacy' | 'technical-bid' | 'executive-summary'

export type DiscountMode = 'percentage' | 'fixed'
export type TaxMode = 'single' | 'mixed'
export type PricingMethod = 'cost_plus' | 'manual_price'
export type LineItemEntryMode = 'detailed' | 'quick'
export type MixedTaxDocumentColumn = 'taxRate' | 'unitPrice' | 'unitTax' | 'taxAmount' | 'netAmount' | 'grossAmount'

export type ExchangeRateTable = Record<string, number>

export interface TaxClass {
  id: string
  label: string
  rate: number
}

export interface QuotationExtraCharge {
  id: string
  label: string
  amount: number
}

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
  pricingMethod?: PricingMethod
  manualUnitPrice?: number
  unitCost: number
  costCurrency: CurrencyCode
  markupRate?: number
  taxClassId?: string
  expectedTotal?: number
  notes?: string
}

export interface QuotationItem extends PricingLine {
  children: QuotationItem[]
}

export interface QuotationSectionHeader {
  id: string
  kind: 'section_header'
  title: string
}

export type QuotationRootItem = QuotationItem | QuotationSectionHeader

export interface TotalsConfig {
  globalMarkupRate: number
  discountMode: DiscountMode
  discountValue: number
  extraCharges?: QuotationExtraCharge[]
  taxMode?: TaxMode
  taxClasses?: TaxClass[]
  defaultTaxClassId?: string
  mixedTaxColumns?: MixedTaxDocumentColumn[]
  taxRate?: number
}

export interface QuotationTaxBucket {
  taxClassId: string
  label: string
  rate: number
  taxableSubtotal: number
  taxAmount: number
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
  taxBuckets: QuotationTaxBucket[]
}

export interface QuotationDraft {
  id: string
  templateId: QuotationTemplateId
  companyProfileId: string | null
  companyProfileSnapshot: CompanyProfile
  header: QuotationHeader
  majorItems: QuotationRootItem[]
  lineItemEntryMode?: LineItemEntryMode
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
  | 'pricingMethod'
  | 'manualUnitPrice'
  | 'unitCost'
  | 'costCurrency'
  | 'markupRate'
  | 'taxClassId'
  | 'expectedTotal'
  | 'notes'

export type QuotationMajorItem = QuotationItem
export type QuotationSubItem = QuotationItem
export type MajorItemField = QuotationItemField
export type SubItemField = QuotationItemField
