import type { SupportedLocale } from '@/shared/i18n/locale'
import { DEFAULT_LOCALE } from '@/shared/i18n/locale'
import { getDefaultQuotationValidityPeriod } from '@/shared/i18n/defaults'
import {
  createDefaultCompanyProfile,
  normalizeCompanyProfile,
  type CompanyProfile,
} from '@/shared/services/localCompanyProfileStorage'

import type { QuotationDraft } from '../types'
import { parseCurrencyCode } from './currencyCodes'
import { createExchangeRates, normalizeExchangeRates } from './exchangeRates'
import { createQuotationItem, normalizeQuotationItems } from './quotationItems'
import { createNextQuotationNumber } from './quotationNumbering'
import { createTaxClass, normalizeTaxConfig, resolveQuotationTaxMode } from './quotationTaxes'

export function createInitialQuotation(
  savedDrafts: QuotationDraft[],
  locale: SupportedLocale,
  options: {
    companyProfileId?: string | null
    companyProfileSnapshot?: CompanyProfile
  } = {},
): QuotationDraft {
  return normalizeQuotationDraft({
    id: crypto.randomUUID(),
    companyProfileId: options.companyProfileId ?? null,
    companyProfileSnapshot: options.companyProfileSnapshot ?? createDefaultCompanyProfile(locale),
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
    lineItemEntryMode: 'detailed',
    totalsConfig: {
      globalMarkupRate: 10,
      discountMode: 'percentage',
      discountValue: 0,
      taxMode: 'single',
      taxClasses: [
        createTaxClass({
          rate: 0,
          label: 'Standard',
        }),
      ],
      defaultTaxClassId: '',
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

  quotation.companyProfileId = typeof quotation.companyProfileId === 'string' && quotation.companyProfileId.trim().length > 0
    ? quotation.companyProfileId.trim()
    : null
  quotation.companyProfileSnapshot = normalizeCompanyProfile(
    quotation.companyProfileSnapshot,
    quotation.header.documentLocale ?? DEFAULT_LOCALE,
  )
  quotation.header.currency = parseCurrencyCode(quotation.header.currency) ?? 'USD'
  quotation.header.revisionNumber = normalizeRevisionNumber(quotation.header.revisionNumber)
  quotation.header.terms = typeof quotation.header.terms === 'string' ? quotation.header.terms : ''
  quotation.header.documentLocale = quotation.header.documentLocale ?? DEFAULT_LOCALE
  quotation.lineItemEntryMode = quotation.lineItemEntryMode === 'quick' ? 'quick' : 'detailed'
  quotation.totalsConfig = normalizeTotalsConfig(quotation.totalsConfig)
  quotation.exchangeRates = normalizeExchangeRates(quotation.exchangeRates, quotation.header.currency)
  quotation.majorItems = normalizeQuotationItems(
    quotation.majorItems,
    quotation.header.currency,
    quotation.header.documentLocale,
  )
  normalizeQuotationItemTaxClasses(
    quotation.majorItems,
    new Set(quotation.totalsConfig.taxClasses?.map((taxClass) => taxClass.id) ?? []),
  )
  quotation.totalsConfig.taxMode = resolveQuotationTaxMode(
    quotation.majorItems,
    quotation.totalsConfig,
    quotation.totalsConfig.taxMode ?? 'single',
  )

  if (ensureAtLeastOneItem && quotation.majorItems.length === 0) {
    quotation.majorItems = [createQuotationItem(quotation.header.currency, {}, quotation.header.documentLocale)]
  }

  return quotation
}

function normalizeRevisionNumber(revisionNumber: unknown) {
  return Number.isInteger(revisionNumber) && Number(revisionNumber) > 0 ? Number(revisionNumber) : 1
}

function normalizeTotalsConfig(quotationTotalsConfig: QuotationDraft['totalsConfig']): QuotationDraft['totalsConfig'] {
  const normalizedTaxConfig = normalizeTaxConfig(quotationTotalsConfig)

  return {
    globalMarkupRate: Number.isFinite(quotationTotalsConfig.globalMarkupRate)
      ? quotationTotalsConfig.globalMarkupRate
      : 0,
    discountMode: quotationTotalsConfig.discountMode === 'fixed' ? 'fixed' : 'percentage',
    discountValue: Number.isFinite(quotationTotalsConfig.discountValue)
      ? quotationTotalsConfig.discountValue
      : 0,
    taxMode: normalizedTaxConfig.taxMode,
    taxClasses: normalizedTaxConfig.taxClasses,
    defaultTaxClassId: normalizedTaxConfig.defaultTaxClassId,
  }
}

function normalizeQuotationItemTaxClasses(items: QuotationDraft['majorItems'], validTaxClassIds: Set<string>) {
  for (const item of items) {
    if (item.taxClassId && !validTaxClassIds.has(item.taxClassId)) {
      item.taxClassId = undefined
    }

    normalizeQuotationItemTaxClasses(item.children, validTaxClassIds)
  }
}
