import type { SupportedLocale } from '@/shared/i18n/locale'
import { DEFAULT_LOCALE } from '@/shared/i18n/locale'
import { getDefaultQuotationValidityPeriod } from '@/shared/i18n/defaults'

import type { QuotationDraft } from '../types'
import { createExchangeRates, normalizeExchangeRates } from './exchangeRates'
import { createQuotationItem, normalizeQuotationItems } from './quotationItems'
import { createNextQuotationNumber } from './quotationNumbering'

export function createInitialQuotation(savedDrafts: QuotationDraft[], locale: SupportedLocale): QuotationDraft {
  return normalizeQuotationDraft({
    id: crypto.randomUUID(),
    header: {
      quotationNumber: createNextQuotationNumber(savedDrafts.map((draft) => draft.header.quotationNumber)),
      revisionNumber: 1,
      quotationDate: new Date().toISOString().slice(0, 10),
      customerCompany: '',
      contactPerson: '',
      contactDetails: '',
      projectName: '',
      validityPeriod: getDefaultQuotationValidityPeriod(locale),
      currency: 'USD',
      documentLocale: locale,
      notes: '',
      terms: '',
    },
    majorItems: [createQuotationItem('USD', {}, locale)],
    totalsConfig: {
      globalMarkupRate: 10,
      discountMode: 'percentage',
      discountValue: 0,
      taxRate: 13,
    },
    exchangeRates: createExchangeRates('USD'),
    branding: {
      logoDataUrl: '',
      accentColor: '#047857',
    },
  })
}

export function normalizeQuotationDraft(
  quotation: QuotationDraft,
  options: {
    ensureAtLeastOneItem?: boolean
  } = {},
): QuotationDraft {
  const ensureAtLeastOneItem = options.ensureAtLeastOneItem ?? true

  quotation.header.revisionNumber = normalizeRevisionNumber(quotation.header.revisionNumber)
  quotation.header.terms = typeof quotation.header.terms === 'string' ? quotation.header.terms : ''
  quotation.header.documentLocale = quotation.header.documentLocale ?? DEFAULT_LOCALE
  quotation.exchangeRates = normalizeExchangeRates(quotation.exchangeRates, quotation.header.currency)
  quotation.majorItems = normalizeQuotationItems(
    quotation.majorItems,
    quotation.header.currency,
    quotation.header.documentLocale,
  )

  if (ensureAtLeastOneItem && quotation.majorItems.length === 0) {
    quotation.majorItems = [createQuotationItem(quotation.header.currency, {}, quotation.header.documentLocale)]
  }

  return quotation
}

function normalizeRevisionNumber(revisionNumber: unknown) {
  return Number.isInteger(revisionNumber) && Number(revisionNumber) > 0 ? Number(revisionNumber) : 1
}
