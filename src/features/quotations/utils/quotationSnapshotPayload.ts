import { cloneSerializable } from '@/shared/utils/clone'
import type { QuotationDraft } from '../types'
import { calculateMajorItemSummary, calculateQuotationTotals } from './quotationCalculations'
import { createQuotationDocumentFileName } from './quotationDocumentFileName'
import { getQuotationRootItems } from './quotationItems'

/** Recalculate a detached historical document without touching the live editor. */
export function createQuotationSnapshotPayload(source: QuotationDraft) {
  const quotation = cloneSerializable(source)
  const summaries = getQuotationRootItems(quotation.majorItems).map((item) =>
    calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
  )
  return {
    quotation,
    summaries,
    totals: calculateQuotationTotals(quotation.majorItems, quotation.totalsConfig, quotation.exchangeRates),
    globalMarkupRate: quotation.totalsConfig.globalMarkupRate,
    exchangeRates: quotation.exchangeRates,
    companyProfile: quotation.companyProfileSnapshot,
    defaultFileName: createQuotationDocumentFileName(quotation, 'pdf'),
  }
}
