import { computed, ref, shallowRef, watch } from 'vue'

import {
  loadLatestQuotationDraft,
  loadSavedQuotations,
  saveQuotationDraft,
} from '@/shared/services/localQuotationStorage'
import { loadCustomerLibraryRecords } from '@/shared/services/localCustomerLibraryStorage'
import type { CustomerLibraryRecord, CustomerRecordFields } from '@/features/customers/utils/customerRecords'
import { cloneSerializable } from '@/shared/utils/clone'

import type {
  CurrencyCode,
  QuotationItem,
  QuotationItemField,
  QuotationDraft,
} from '../types'
import { calculateMajorItemSummary, calculateQuotationTotals } from '../utils/quotationCalculations'
import { createExchangeRates, normalizeExchangeRates, rebaseExchangeRates } from '../utils/exchangeRates'
import {
  createQuotationItem,
  duplicateQuotationItem,
  findQuotationItem,
  normalizeQuotationItems,
  removeQuotationItem,
} from '../utils/quotationItems'
import { createNextQuotationNumber } from '../utils/quotationNumbering'

export function useQuotationEditor() {
  const savedDrafts = shallowRef(loadSavedQuotations())
  const customerRecords = shallowRef(loadCustomerLibraryRecords())
  const quotation = ref(normalizeQuotationDraft(createInitialQuotation(savedDrafts.value)))

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
    quotation.value = normalizeQuotationDraft(createInitialQuotation(savedDrafts.value))
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
    quotation.value.header.customerName = record.customerName
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
    replaceLineItems: (items: QuotationItem[]) => {
      quotation.value.majorItems = normalizeQuotationItems(items, quotation.value.header.currency)

      if (quotation.value.majorItems.length === 0) {
        quotation.value.majorItems = [createQuotationItem(quotation.value.header.currency)]
      }
    },
    applyCustomerRecord,
    addRootItem: () => quotation.value.majorItems.push(createQuotationItem(quotation.value.header.currency)),
    addChildItem: (parentItemId: string) => addChildItem(quotation.value, parentItemId),
    removeItem: (itemId: string) => removeItem(quotation.value, itemId),
    duplicateRootItem: (itemId: string) => duplicateRootItem(quotation.value, itemId),
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

function createInitialQuotation(savedDrafts: QuotationDraft[]): QuotationDraft {
  return {
    id: createId(),
    header: {
      quotationNumber: createNextQuotationNumber(savedDrafts.map((draft) => draft.header.quotationNumber)),
      quotationDate: new Date().toISOString().slice(0, 10),
      customerName: '',
      customerCompany: '',
      contactPerson: '',
      contactDetails: '',
      projectName: '',
      validityPeriod: '30 days',
      currency: 'USD',
      notes: '',
    },
    majorItems: [createQuotationItem('USD')],
    totalsConfig: {
      globalMarkupRate: 10,
      discountMode: 'percentage',
      discountValue: 0,
      taxRate: 13,
    },
    exchangeRates: createExchangeRates('USD'),
    branding: {
      logoDataUrl: '',
      accentColor: '#0f766e',
    },
  }
}

function addChildItem(quotation: QuotationDraft, parentItemId: string) {
  const parent = findQuotationItem(quotation.majorItems, parentItemId)

  if (!parent) {
    return
  }

  parent.children.push(
    createQuotationItem(parent.costCurrency, {
      name: parent.children.length === 0 ? 'New child item' : 'New sibling item',
    }),
  )
}

function removeItem(quotation: QuotationDraft, itemId: string) {
  quotation.majorItems = removeQuotationItem(quotation.majorItems, itemId)

  if (quotation.majorItems.length === 0) {
    quotation.majorItems.push(createQuotationItem(quotation.header.currency))
  }
}

function duplicateRootItem(quotation: QuotationDraft, itemId: string) {
  const sourceIndex = quotation.majorItems.findIndex((item) => item.id === itemId)

  if (sourceIndex === -1) {
    return
  }

  const duplicate = duplicateQuotationItem(cloneSerializable(quotation.majorItems[sourceIndex]))
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

function normalizeRate(rate: number) {
  return Number.isFinite(rate) && rate > 0 ? rate : 1
}

function createId() {
  return crypto.randomUUID()
}

function normalizeQuotationDraft(quotation: QuotationDraft): QuotationDraft {
  quotation.exchangeRates = normalizeExchangeRates(quotation.exchangeRates, quotation.header.currency)
  quotation.majorItems = normalizeQuotationItems(quotation.majorItems, quotation.header.currency)

  if (quotation.majorItems.length === 0) {
    quotation.majorItems = [createQuotationItem(quotation.header.currency)]
  }

  return quotation
}
