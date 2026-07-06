import type { Component } from 'vue'

import type { CompanyProfile } from '@/shared/contracts/reusableLibrary'

import type {
  ExchangeRateTable,
  MajorItemSummary,
  QuotationDraft,
  QuotationTotals,
} from '../types'
import type { QuotationTemplateId } from './templateIds'

export interface QuotationTemplateProps {
  quotation: QuotationDraft
  summaries: MajorItemSummary[]
  totals: QuotationTotals
  globalMarkupRate: number
  exchangeRates: ExchangeRateTable
  companyProfile: CompanyProfile
}

export interface QuotationTemplateDefinition {
  id: QuotationTemplateId
  labelKey: string
  descriptionKey: string
  component: Component
}
