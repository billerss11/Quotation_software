import LegacyQuotationTemplate from './legacy/LegacyQuotationTemplate.vue'
import TechnicalBidQuotationTemplate from './technical-bid/TechnicalBidQuotationTemplate.vue'
import ExecutiveSummaryQuotationTemplate from './executive-summary/ExecutiveSummaryQuotationTemplate.vue'
import LuminousQuotationTemplate from './luminous/LuminousQuotationTemplate.vue'
import {
  DEFAULT_QUOTATION_TEMPLATE_ID,
  QUOTATION_TEMPLATE_OPTIONS,
  normalizeQuotationTemplateId,
} from './templateIds'
import type { QuotationTemplateId } from './templateIds'
import type { QuotationTemplateDefinition } from './types'

export const QUOTATION_TEMPLATE_DEFINITIONS: QuotationTemplateDefinition[] = [
  {
    ...QUOTATION_TEMPLATE_OPTIONS[0],
    component: LegacyQuotationTemplate,
  },
  {
    ...QUOTATION_TEMPLATE_OPTIONS[1],
    component: TechnicalBidQuotationTemplate,
  },
  {
    ...QUOTATION_TEMPLATE_OPTIONS[2],
    component: ExecutiveSummaryQuotationTemplate,
  },
  {
    ...QUOTATION_TEMPLATE_OPTIONS[3],
    component: LuminousQuotationTemplate,
  },
]

const quotationTemplateDefinitionById = new Map<QuotationTemplateId, QuotationTemplateDefinition>(
  QUOTATION_TEMPLATE_DEFINITIONS.map((definition) => [definition.id, definition]),
)

export function getQuotationTemplateDefinition(templateId: unknown): QuotationTemplateDefinition {
  return quotationTemplateDefinitionById.get(normalizeQuotationTemplateId(templateId))
    ?? quotationTemplateDefinitionById.get(DEFAULT_QUOTATION_TEMPLATE_ID)
    ?? QUOTATION_TEMPLATE_DEFINITIONS[0]
}
