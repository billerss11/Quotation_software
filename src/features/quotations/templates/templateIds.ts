import type { QuotationTemplateId } from '../types'

export const DEFAULT_QUOTATION_TEMPLATE_ID = 'legacy'

export const QUOTATION_TEMPLATE_IDS = [
  DEFAULT_QUOTATION_TEMPLATE_ID,
  'technical-bid',
  'executive-summary',
  'luminous',
  'signal',
] as const

export type { QuotationTemplateId }

export interface QuotationTemplateOption {
  id: QuotationTemplateId
  labelKey: string
  descriptionKey: string
}

export const QUOTATION_TEMPLATE_OPTIONS: QuotationTemplateOption[] = [
  {
    id: 'legacy',
    labelKey: 'quotations.templates.legacy.label',
    descriptionKey: 'quotations.templates.legacy.description',
  },
  {
    id: 'technical-bid',
    labelKey: 'quotations.templates.technicalBid.label',
    descriptionKey: 'quotations.templates.technicalBid.description',
  },
  {
    id: 'executive-summary',
    labelKey: 'quotations.templates.executiveSummary.label',
    descriptionKey: 'quotations.templates.executiveSummary.description',
  },
  {
    id: 'luminous',
    labelKey: 'quotations.templates.luminous.label',
    descriptionKey: 'quotations.templates.luminous.description',
  },
  {
    id: 'signal',
    labelKey: 'quotations.templates.signal.label',
    descriptionKey: 'quotations.templates.signal.description',
  },
]

export function isQuotationTemplateId(value: unknown): value is QuotationTemplateId {
  return typeof value === 'string' && QUOTATION_TEMPLATE_IDS.includes(value as QuotationTemplateId)
}

export function normalizeQuotationTemplateId(value: unknown): QuotationTemplateId {
  return isQuotationTemplateId(value) ? value : DEFAULT_QUOTATION_TEMPLATE_ID
}
