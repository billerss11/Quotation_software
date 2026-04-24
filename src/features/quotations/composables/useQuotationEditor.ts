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
  MajorItemField,
  QuotationDraft,
  QuotationMajorItem,
  QuotationSubItem,
  SubItemField,
} from '../types'
import { calculateMajorItemSummary, calculateQuotationTotals } from '../utils/quotationCalculations'
import { createExchangeRates, normalizeExchangeRates, rebaseExchangeRates } from '../utils/exchangeRates'
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
    applyCustomerRecord,
    addMajorItem: () => quotation.value.majorItems.push(createMajorItem(quotation.value.header.currency)),
    addSubItem: (majorItemId: string) => addSubItem(quotation.value, majorItemId),
    addDetailItem: (majorItemId: string, subItemId: string) =>
      addDetailItem(quotation.value, majorItemId, subItemId),
    removeMajorItem: (majorItemId: string) => removeMajorItem(quotation.value, majorItemId),
    removeSubItem: (majorItemId: string, subItemId: string) =>
      removeSubItem(quotation.value, majorItemId, subItemId),
    duplicateMajorItem: (majorItemId: string) => duplicateMajorItem(quotation.value, majorItemId),
    moveMajorItem: (majorItemId: string, direction: -1 | 1) =>
      moveMajorItem(quotation.value, majorItemId, direction),
    updateMajorItemField: (
      majorItemId: string,
      field: MajorItemField,
      value: QuotationMajorItem[MajorItemField],
    ) => updateMajorItemField(quotation.value, majorItemId, field, value),
    updateSubItemField: (
      majorItemId: string,
      subItemId: string,
      field: SubItemField,
      value: QuotationSubItem[SubItemField],
    ) => updateSubItemField(quotation.value, majorItemId, subItemId, field, value),
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
    majorItems: [createMajorItem('USD')],
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

function createMajorItem(costCurrency: CurrencyCode): QuotationMajorItem {
  return {
    id: createId(),
    type: 'major',
    title: 'New major item',
    description: '',
    quantity: 1,
    unitCost: 0,
    costCurrency,
    notes: '',
    subItems: [],
  }
}

function createSubItem(): QuotationSubItem {
  return {
    id: createId(),
    type: 'sub',
    description: 'New sub-item',
    quantity: 1,
    unitCost: 0,
    costCurrency: 'USD',
    notes: '',
    children: [],
  }
}

function addSubItem(quotation: QuotationDraft, majorItemId: string) {
  const majorItem = findMajorItem(quotation, majorItemId)
  const subItem = createSubItem()

  if (majorItem) {
    subItem.costCurrency = majorItem.costCurrency
    majorItem.subItems.push(subItem)
  }
}

function addDetailItem(quotation: QuotationDraft, majorItemId: string, subItemId: string) {
  const parent = findMajorItem(quotation, majorItemId)?.subItems.find((item) => item.id === subItemId)
  const detailItem = createSubItem()

  if (parent) {
    detailItem.description = 'New detail line'
    detailItem.costCurrency = parent.costCurrency
    parent.children.push(detailItem)
  }
}

function removeMajorItem(quotation: QuotationDraft, majorItemId: string) {
  quotation.majorItems = quotation.majorItems.filter((item) => item.id !== majorItemId)

  if (quotation.majorItems.length === 0) {
    quotation.majorItems.push(createMajorItem(quotation.header.currency))
  }
}

function removeSubItem(quotation: QuotationDraft, majorItemId: string, subItemId: string) {
  const majorItem = findMajorItem(quotation, majorItemId)

  if (majorItem) {
    majorItem.subItems = removeNestedSubItem(majorItem.subItems, subItemId)
  }
}

function duplicateMajorItem(quotation: QuotationDraft, majorItemId: string) {
  const sourceIndex = quotation.majorItems.findIndex((item) => item.id === majorItemId)

  if (sourceIndex === -1) {
    return
  }

  const duplicate = refreshItemIds(cloneSerializable(quotation.majorItems[sourceIndex]))
  quotation.majorItems.splice(sourceIndex + 1, 0, duplicate)
}

function moveMajorItem(quotation: QuotationDraft, majorItemId: string, direction: -1 | 1) {
  const sourceIndex = quotation.majorItems.findIndex((item) => item.id === majorItemId)
  const targetIndex = sourceIndex + direction

  if (sourceIndex === -1 || targetIndex < 0 || targetIndex >= quotation.majorItems.length) {
    return
  }

  const [item] = quotation.majorItems.splice(sourceIndex, 1)
  quotation.majorItems.splice(targetIndex, 0, item)
}

function updateMajorItemField(
  quotation: QuotationDraft,
  majorItemId: string,
  field: MajorItemField,
  value: QuotationMajorItem[MajorItemField],
) {
  const majorItem = findMajorItem(quotation, majorItemId)

  if (majorItem) {
    Object.assign(majorItem, { [field]: value })
  }
}

function updateSubItemField(
  quotation: QuotationDraft,
  majorItemId: string,
  subItemId: string,
  field: SubItemField,
  value: QuotationSubItem[SubItemField],
) {
  const subItem = findNestedSubItem(findMajorItem(quotation, majorItemId)?.subItems ?? [], subItemId)

  if (subItem) {
    Object.assign(subItem, { [field]: value })
  }
}

function refreshItemIds(item: QuotationMajorItem): QuotationMajorItem {
  return {
    ...item,
    id: createId(),
    title: `${item.title} copy`,
    subItems: item.subItems.map((subItem) => ({
      ...refreshSubItemIds(subItem),
    })),
  }
}

function refreshSubItemIds(item: QuotationSubItem): QuotationSubItem {
  return {
    ...item,
    id: createId(),
    children: item.children.map((child) => refreshSubItemIds(child)),
  }
}

function findMajorItem(quotation: QuotationDraft, majorItemId: string) {
  return quotation.majorItems.find((item) => item.id === majorItemId)
}

function findNestedSubItem(items: QuotationSubItem[], subItemId: string): QuotationSubItem | undefined {
  for (const item of items) {
    if (item.id === subItemId) {
      return item
    }

    const child = findNestedSubItem(item.children, subItemId)

    if (child) {
      return child
    }
  }

  return undefined
}

function removeNestedSubItem(items: QuotationSubItem[], subItemId: string): QuotationSubItem[] {
  return items
    .filter((item) => item.id !== subItemId)
    .map((item) => ({
      ...item,
      children: removeNestedSubItem(item.children, subItemId),
    }))
}

function createId() {
  return crypto.randomUUID()
}

function normalizeRate(rate: number) {
  return Number.isFinite(rate) && rate > 0 ? rate : 1
}

function normalizeQuotationDraft(quotation: QuotationDraft): QuotationDraft {
  quotation.exchangeRates = normalizeExchangeRates(quotation.exchangeRates, quotation.header.currency)

  quotation.majorItems.forEach((item) => {
    item.costCurrency ??= quotation.header.currency
    item.subItems.forEach((subItem) => {
      normalizeSubItem(subItem, item.costCurrency)
    })
  })

  return quotation
}

function normalizeSubItem(item: QuotationSubItem, fallbackCurrency: CurrencyCode) {
  item.costCurrency ??= fallbackCurrency
  item.children ??= []
  item.children.forEach((child) => normalizeSubItem(child, item.costCurrency))
}
