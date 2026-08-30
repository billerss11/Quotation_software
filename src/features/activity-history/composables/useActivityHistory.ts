import { useI18n } from 'vue-i18n'

import type { QuotationHistoryCommittedEvent } from '@/features/quotations/composables/useQuotationUndoHistory'
import type { QuotationDraft } from '@/features/quotations/types'
import { formatQuotationHistoryChangeSummary } from '@/features/quotations/utils/quotationHistoryChangeSummary'
import type { ActivityHistoryCategory, ActivityHistoryEntry } from '@/shared/contracts/quotationApp'
import { getQuotationRuntime, type QuotationRuntime } from '@/shared/runtime/quotationRuntime'

const HISTORY_VALUE_MAX_CHARACTERS = 160

interface UseActivityHistoryOptions {
  runtime?: QuotationRuntime
}

export function useActivityHistory(options: UseActivityHistoryOptions = {}) {
  const { t } = useI18n()
  const runtime = options.runtime ?? getQuotationRuntime()
  const translateEnglish = (key: string, params?: Record<string, string | number>) => (
    t(key, params ?? {}, { locale: 'en-US' })
  )

  function record(entry: ActivityHistoryEntry) {
    if (!runtime.capabilities.isDesktop) return

    try {
      void runtime.appendActivityHistoryEntry(entry).then((result) => {
        if (!result.ok) warnLoggingFailure(result.error)
      }).catch(warnLoggingFailure)
    } catch (error) {
      warnLoggingFailure(error)
    }
  }

  function recordMessage(
    category: ActivityHistoryCategory,
    context: string,
    messageKey: string,
    params?: Record<string, string | number>,
  ) {
    try {
      record({
        category,
        context,
        message: translateEnglish(messageKey, params),
      })
    } catch (error) {
      warnLoggingFailure(error)
    }
  }

  function recordQuotationHistory(event: QuotationHistoryCommittedEvent, quotation: QuotationDraft) {
    if (event.summary.kind === 'fallback') return

    try {
      const detail = formatQuotationHistoryChangeSummary(
        event.summary,
        translateEnglish,
        HISTORY_VALUE_MAX_CHARACTERS,
      )
      const message = event.action === 'change'
        ? detail
        : translateEnglish(
            event.action === 'undo'
              ? 'quotations.activityHistory.log.undo'
              : 'quotations.activityHistory.log.redo',
            { detail },
          )

      record({
        category: 'quotation',
        context: getQuotationActivityContext(quotation),
        message,
      })
    } catch (error) {
      warnLoggingFailure(error)
    }
  }

  return {
    isAvailable: runtime.capabilities.isDesktop,
    openFolder: () => runtime.openActivityHistoryFolder(),
    record,
    recordMessage,
    recordQuotationHistory,
    translateEnglish,
  }
}

function warnLoggingFailure(error: unknown) {
  console.warn('Could not write activity history.', error)
}

export function getQuotationActivityContext(quotation: Pick<QuotationDraft, 'header'>) {
  const quotationNumber = quotation.header.quotationNumber.trim()
  return quotationNumber ? `Quotation ${quotationNumber}` : 'Quotation (unnumbered)'
}
