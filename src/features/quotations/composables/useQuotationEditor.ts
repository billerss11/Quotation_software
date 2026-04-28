import { computed, getCurrentScope, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { Ref, ShallowRef } from 'vue'

import {
  loadLatestQuotationDraft,
  loadSavedQuotations,
  saveQuotationDraft,
} from '@/shared/services/localQuotationStorage'
import {
  loadCustomerLibraryRecords,
  subscribeCustomerLibraryRecords,
} from '@/shared/services/localCustomerLibraryStorage'
import type { CustomerLibraryRecord, CustomerRecordFields } from '@/features/customers/utils/customerRecords'
import { cloneSerializable } from '@/shared/utils/clone'

import type {
  CurrencyCode,
  QuotationItem,
  QuotationItemField,
  QuotationDraft,
} from '../types'
import { calculateMajorItemSummary, calculateQuotationTotals } from '../utils/quotationCalculations'
import { normalizeExchangeRates, rebaseExchangeRates } from '../utils/exchangeRates'
import { clampNumber, MAX_EXCHANGE_RATE, MIN_EXCHANGE_RATE } from '../utils/pricingLimits'
import {
  duplicateQuotationItem,
  findQuotationItem,
  normalizeQuotationItems,
  removeQuotationItem,
} from '../utils/quotationItems'
import { createQuotationItem } from '../utils/quotationItems'
import { createInitialQuotation, normalizeQuotationDraft } from '../utils/quotationDraft'
import { DEFAULT_LOCALE, type SupportedLocale } from '@/shared/i18n/locale'
import {
  getDefaultQuotationChildItemName,
  getDefaultQuotationSiblingItemName,
} from '@/shared/i18n/defaults'

export function useQuotationEditor(uiLocale: Ref<SupportedLocale> = shallowRef(DEFAULT_LOCALE)) {
  const savedDrafts = shallowRef(loadSavedQuotations())
  const customerRecords = shallowRef(loadCustomerLibraryRecords())
  const quotation = ref(createInitialQuotation(savedDrafts.value, uiLocale.value))
  const unsubscribeCustomerLibrary = subscribeCustomerLibraryRecords((records) => {
    customerRecords.value = records
  })

  if (getCurrentScope()) {
    onScopeDispose(unsubscribeCustomerLibrary)
  }

  watch(
    () => quotation.value.header.currency,
    (currency, previousCurrency) => {
      if (
        !previousCurrency ||
        previousCurrency === currency ||
        quotation.value.exchangeRates[currency] === 1
      ) {
        quotation.value.exchangeRates = normalizeExchangeRates(quotation.value.exchangeRates, currency)
        return
      }

      quotation.value.exchangeRates = rebaseExchangeRates(
        quotation.value.exchangeRates,
        previousCurrency,
        currency,
      )
    },
    { immediate: true },
  )

  const itemSummaries = computed(() =>
    quotation.value.majorItems.map((item) =>
      calculateMajorItemSummary(item, quotation.value.totalsConfig, quotation.value.exchangeRates),
    ),
  )

  const totals = computed(() =>
    calculateQuotationTotals(
      quotation.value.majorItems,
      quotation.value.totalsConfig,
      quotation.value.exchangeRates,
    ),
  )
  function createNewQuotation() {
    quotation.value = createInitialQuotation(savedDrafts.value, uiLocale.value)
  }

  function saveCurrentQuotation() {
    saveQuotationDraft(quotation.value)
    savedDrafts.value = loadSavedQuotations()
  }

  function loadLatestQuotation() {
    const latestDraft = loadLatestQuotationDraft()

    if (latestDraft) {
      quotation.value = normalizeQuotationDraft(cloneSerializable(latestDraft))
    }
  }

  function replaceQuotationDraft(nextQuotation: QuotationDraft) {
    quotation.value = normalizeQuotationDraft(cloneSerializable(nextQuotation))
  }

  function applyCustomerRecord(record: CustomerRecordFields | CustomerLibraryRecord) {
    quotation.value.header.customerCompany = record.customerCompany
    quotation.value.header.contactPerson = record.contactPerson
    quotation.value.header.contactDetails = record.contactDetails
  }

  return {
    quotation,
    savedDrafts,
    itemSummaries,
    totals,
    customerRecords,
    createNewQuotation,
    saveCurrentQuotation,
    loadLatestQuotation,
    replaceQuotationDraft,
    createRevision: () => createRevision(quotation.value, savedDrafts),
    replaceLineItems: (items: QuotationItem[]) => {
      quotation.value.majorItems = normalizeQuotationItems(
        items,
        quotation.value.header.currency,
        quotation.value.header.documentLocale,
      )

      if (quotation.value.majorItems.length === 0) {
        quotation.value.majorItems = [
          createQuotationItem(quotation.value.header.currency, {}, uiLocale.value),
        ]
      }
    },
    applyCustomerRecord,
    addRootItem: () =>
      quotation.value.majorItems.push(createQuotationItem(quotation.value.header.currency, {}, uiLocale.value)),
    addChildItem: (parentItemId: string) => addChildItem(quotation.value, parentItemId, uiLocale.value),
    removeItem: (itemId: string) => removeItem(quotation.value, itemId),
    duplicateRootItem: (itemId: string) => duplicateRootItem(quotation.value, itemId, uiLocale.value),
    moveRootItem: (itemId: string, direction: -1 | 1) => moveRootItem(quotation.value, itemId, direction),
    updateItemField: (
      itemId: string,
      field: QuotationItemField,
      value: QuotationItem[QuotationItemField],
    ) => updateItemField(quotation.value, itemId, field, value),
    setLogoDataUrl: (logoDataUrl: string) => {
      quotation.value.branding.logoDataUrl = logoDataUrl
    },
    updateExchangeRate: (currency: CurrencyCode, rate: number) => {
      quotation.value.exchangeRates[currency] = normalizeRate(rate)
    },
  }
}

function addChildItem(quotation: QuotationDraft, parentItemId: string, uiLocale: SupportedLocale) {
  const parent = findQuotationItem(quotation.majorItems, parentItemId)

  if (!parent) {
    return
  }

  parent.children.push(
    createQuotationItem(parent.costCurrency, {
      name: parent.children.length === 0
        ? getDefaultQuotationChildItemName(uiLocale)
        : getDefaultQuotationSiblingItemName(uiLocale),
    }, uiLocale),
  )
}

function removeItem(quotation: QuotationDraft, itemId: string) {
  quotation.majorItems = removeQuotationItem(quotation.majorItems, itemId)

  if (quotation.majorItems.length === 0) {
    quotation.majorItems.push(createQuotationItem(quotation.header.currency, {}, quotation.header.documentLocale))
  }
}

function duplicateRootItem(quotation: QuotationDraft, itemId: string, uiLocale: SupportedLocale) {
  const sourceIndex = quotation.majorItems.findIndex((item) => item.id === itemId)

  if (sourceIndex === -1) {
    return
  }

  const duplicate = duplicateQuotationItem(cloneSerializable(quotation.majorItems[sourceIndex]), true, uiLocale)
  quotation.majorItems.splice(sourceIndex + 1, 0, duplicate)
}

function moveRootItem(quotation: QuotationDraft, itemId: string, direction: -1 | 1) {
  const sourceIndex = quotation.majorItems.findIndex((item) => item.id === itemId)
  const targetIndex = sourceIndex + direction

  if (sourceIndex === -1 || targetIndex < 0 || targetIndex >= quotation.majorItems.length) {
    return
  }

  const [item] = quotation.majorItems.splice(sourceIndex, 1)
  quotation.majorItems.splice(targetIndex, 0, item)
}

function updateItemField(
  quotation: QuotationDraft,
  itemId: string,
  field: QuotationItemField,
  value: QuotationItem[QuotationItemField],
) {
  const item = findQuotationItem(quotation.majorItems, itemId)

  if (item) {
    Object.assign(item, { [field]: value })
  }
}

function createRevision(quotation: QuotationDraft, savedDrafts: ShallowRef<QuotationDraft[]>) {
  saveQuotationDraft(quotation)
  const nextQuotation = cloneSerializable(quotation)
  nextQuotation.id = createId()
  nextQuotation.header.revisionNumber = normalizeRevisionNumber(quotation.header.revisionNumber) + 1
  saveQuotationDraft(nextQuotation)
  savedDrafts.value = loadSavedQuotations()
  Object.assign(quotation, nextQuotation)
}

function normalizeRate(rate: number) {
  return Number.isFinite(rate) && rate > 0 ? clampNumber(rate, MIN_EXCHANGE_RATE, MAX_EXCHANGE_RATE) : 1
}

function createId() {
  return crypto.randomUUID()
}

function normalizeRevisionNumber(revisionNumber: unknown) {
  return Number.isInteger(revisionNumber) && Number(revisionNumber) > 0 ? Number(revisionNumber) : 1
}
