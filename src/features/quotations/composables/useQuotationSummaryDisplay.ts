import { computed } from 'vue'

import type { QuotationTemplateProps } from '../templates/types'
import {
  getQuotationSections,
  getQuotationSummaryItems,
  getQuotationSubtotalLabel,
  resolveQuotationInformationalTotals,
} from '../utils/quotationSummaryDisplay'

export function useQuotationSummaryDisplay(
  props: Pick<QuotationTemplateProps, 'quotation' | 'summaries'>,
  documentT: (key: string) => string,
) {
  const subtotalLabel = computed(() => getQuotationSubtotalLabel(
    props.quotation.outputSettings,
    documentT('quotations.document.subtotal'),
  ))
  const summaryItems = computed(() => {
    const settings = props.quotation.outputSettings
    const needsItemTotals = settings?.showInformationalTotals === true
      && settings.informationalTotals?.some((row) => row.visible && row.source === 'items')
    return needsItemTotals ? getQuotationSummaryItems(props.quotation, props.summaries) : []
  })
  const informationalTotals = computed(() => resolveQuotationInformationalTotals(
    props.quotation.outputSettings,
    getQuotationSections(props.quotation.majorItems, props.summaries),
    summaryItems.value,
  ).filter((row) => row.isVisible))

  return { subtotalLabel, informationalTotals }
}
