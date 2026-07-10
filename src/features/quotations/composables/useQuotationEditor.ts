import { computed, getCurrentScope, nextTick, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

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
import {
  createDefaultCompanyProfile,
  loadCompanyProfileRecords,
  subscribeCompanyProfileRecords,
  type CompanyProfile,
  type CompanyProfileRecord,
} from '@/shared/services/localCompanyProfileStorage'
import {
  allocateNextReusableLibraryQuotationNumber,
  trackReusableLibraryQuotationNumber,
} from '@/shared/services/reusableLibraryStore'
import { cloneSerializable } from '@/shared/utils/clone'

import type {
  LineItemEntryMode,
  MajorItemSummary,
  QuotationItem,
  QuotationItemField,
  QuotationDraft,
  QuotationRootItem,
  QuotationTaxBucket,
  TaxClass,
} from '../types'
import {
  calculateExtraChargesTotal,
  calculateMajorItemSummary,
  calculateQuotationItemUnitSellingPrice,
  calculateQuotationTotalsFromSummaries,
  getEffectiveMarkupRate,
} from '../utils/quotationCalculations'
import { roundMoney } from '../utils/moneyMath'
import { parseCurrencyCode } from '../utils/currencyCodes'
import {
  addCurrencyToRateTable,
  ensureCurrenciesInRateTable,
  normalizeExchangeRates,
  rebaseExchangeRates,
  removeCurrencyFromRateTable,
} from '../utils/exchangeRates'
import { clampNumber, MAX_EXCHANGE_RATE, MIN_EXCHANGE_RATE } from '../utils/pricingLimits'
import {
  collectCostCurrencies,
  createQuotationSectionHeader,
  duplicateQuotationItem,
  findQuotationItemPath,
  getQuotationRootItems,
  isQuotationItem,
  isQuotationSectionHeader,
  moveQuotationRootRowToIndex,
  moveQuotationTreeRow as moveQuotationTreeRowInTree,
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
import {
  applyTaxClassToQuotationItems,
  canUseSingleTaxMode,
  createCalculationTotalsConfig,
  resolveQuotationTaxMode,
} from '../utils/quotationTaxes'
import type { TaxMode } from '../types'
import { useQuotationUndoHistory } from './useQuotationUndoHistory'
import {
  createQuotationItemFieldChangeSummary,
  type QuotationHistoryChangeSummary,
} from '../utils/quotationHistoryChangeSummary'

export function useQuotationEditor(uiLocale: Ref<SupportedLocale> = shallowRef(DEFAULT_LOCALE)) {
  const savedDrafts = shallowRef(loadSavedQuotations())
  const customerRecords = shallowRef(loadCustomerLibraryRecords())
  const companyProfileRecords = shallowRef(loadCompanyProfileRecords())
  const quotation = ref(createInitialQuotation(
    savedDrafts.value,
    uiLocale.value,
    {
      ...getInitialCompanyProfileSelection(companyProfileRecords.value, uiLocale.value),
      quotationNumber: allocateNextReusableLibraryQuotationNumber(),
    },
  ))
  const unsubscribeCustomerLibrary = subscribeCustomerLibraryRecords((records) => {
    customerRecords.value = records
  })
  const unsubscribeCompanyProfileLibrary = subscribeCompanyProfileRecords((records) => {
    companyProfileRecords.value = records
  })
  let isReplacingQuotation = false

  if (getCurrentScope()) {
    onScopeDispose(unsubscribeCustomerLibrary)
    onScopeDispose(unsubscribeCompanyProfileLibrary)
  }

  watch(
    () => quotation.value.header.currency,
    (currency, previousCurrency) => {
      if (isReplacingQuotation) {
        return
      }

      if (
        !previousCurrency ||
        previousCurrency === currency
      ) {
        quotation.value.exchangeRates = normalizeExchangeRates(quotation.value.exchangeRates, currency)
        return
      }

      const rebasedExchangeRates = rebaseExchangeRates(
        quotation.value.exchangeRates,
        previousCurrency,
        currency,
      )

      rebaseQuoteCurrencyFields(quotation.value, rebasedExchangeRates[previousCurrency] ?? 1)
      quotation.value.exchangeRates = rebasedExchangeRates
    },
    { immediate: true },
  )

  const calculationTotalsConfig = computed(() => createCalculationTotalsConfig(quotation.value.totalsConfig))
  const summaryTotalsConfig = computed(() => ({
    globalMarkupRate: quotation.value.totalsConfig.globalMarkupRate,
  }))
  const quotationItems = computed(() => getQuotationRootItems(quotation.value.majorItems))
  const quotationItemById = computed(() => createQuotationItemLookup(quotation.value.majorItems))
  const itemSummaries = computed(() =>
    quotationItems.value.map((item: QuotationItem): MajorItemSummary =>
      calculateMajorItemSummary(item, summaryTotalsConfig.value, quotation.value.exchangeRates),
    ),
  )

  const calculatedTotals = computed(() =>
    calculateQuotationTotalsFromSummaries(
      quotationItems.value,
      itemSummaries.value,
      calculationTotalsConfig.value,
      quotation.value.exchangeRates,
    ),
  )
  const extraChargesTotal = computed(() => calculateExtraChargesTotal(quotation.value.totalsConfig.extraCharges))
  const totals = computed(() => {
    const lineTotals = calculatedTotals.value

    return {
      ...lineTotals,
      grandTotal: roundMoney(lineTotals.grandTotal + extraChargesTotal.value),
      taxBuckets: lineTotals.taxBuckets.map((bucket: QuotationTaxBucket) => ({
        ...bucket,
        label:
          quotation.value.totalsConfig.taxClasses?.find((taxClass: TaxClass) => taxClass.id === bucket.taxClassId)?.label
          ?? bucket.label,
      })),
    }
  })
  const undoHistory = useQuotationUndoHistory({
    quotation,
    restoreQuotation: restoreQuotationHistorySnapshot,
  })

  function replaceQuotationValue(nextQuotation: QuotationDraft) {
    isReplacingQuotation = true
    quotation.value = normalizeQuotationDraft(cloneSerializable(nextQuotation))
    void nextTick(() => {
      isReplacingQuotation = false
    })
  }

  function restoreQuotationHistorySnapshot(nextQuotation: QuotationDraft) {
    const summary = applySingleItemFieldRestore(quotation.value.majorItems, nextQuotation.majorItems)
    if (summary) {
      return summary
    }

    replaceQuotationValue(nextQuotation)
    return null
  }

  function createNewQuotation() {
    replaceQuotationValue(createInitialQuotation(
      savedDrafts.value,
      uiLocale.value,
      {
        ...getInitialCompanyProfileSelection(companyProfileRecords.value, uiLocale.value),
        quotationNumber: allocateNextReusableLibraryQuotationNumber(),
      },
    ))
  }

  function saveCurrentQuotation() {
    trackReusableLibraryQuotationNumber(quotation.value.header.quotationNumber)
    saveQuotationDraft(quotation.value)
    savedDrafts.value = upsertSavedDraft(savedDrafts.value, quotation.value)
  }

  function loadLatestQuotation() {
    const latestDraft = loadLatestQuotationDraft()

    if (latestDraft) {
      replaceQuotationValue(latestDraft)
      trackReusableLibraryQuotationNumber(quotation.value.header.quotationNumber)
    }
  }

  function replaceQuotationDraft(nextQuotation: QuotationDraft) {
    replaceQuotationValue(nextQuotation)
    trackReusableLibraryQuotationNumber(quotation.value.header.quotationNumber)
  }

  function applyCustomerRecord(record: CustomerRecordFields | CustomerLibraryRecord) {
    quotation.value.header.customerCompany = record.customerCompany
    quotation.value.header.contactPerson = record.contactPerson
    quotation.value.header.contactDetails = record.contactDetails
  }

  function applyCompanyProfile(record: CompanyProfileRecord) {
    quotation.value.companyProfileId = record.id
    quotation.value.companyProfileSnapshot = toCompanyProfileSnapshot(record)
  }

  return {
    quotation,
    savedDrafts,
    itemSummaries,
    totals,
    customerRecords,
    companyProfileRecords,
    canUndoQuotationChange: undoHistory.canUndo,
    canRedoQuotationChange: undoHistory.canRedo,
    createNewQuotation,
    saveCurrentQuotation,
    loadLatestQuotation,
    replaceQuotationDraft,
    undoLastQuotationChange: undoHistory.undo,
    redoLastQuotationChange: undoHistory.redo,
    resetQuotationChangeHistory: undoHistory.reset,
    replaceLineItems: (items: QuotationItem[]) => {
      quotation.value.majorItems = normalizeQuotationItems(
        items,
        quotation.value.header.currency,
        quotation.value.header.documentLocale,
      )
      quotation.value.exchangeRates = ensureCurrenciesInRateTable(
        quotation.value.exchangeRates,
        collectCostCurrencies(quotation.value.majorItems),
        quotation.value.header.currency,
      )

      if (quotation.value.majorItems.length === 0) {
        quotation.value.majorItems = [
          createQuotationItem(quotation.value.header.currency, {}, uiLocale.value),
        ]
      }

      quotation.value.totalsConfig.taxMode = resolveQuotationTaxMode(
        getQuotationRootItems(quotation.value.majorItems),
        quotation.value.totalsConfig,
        quotation.value.totalsConfig.taxMode ?? 'single',
      )
      quotation.value.lineItemEntryMode = resolveLineItemEntryMode(quotation.value.majorItems)
    },
    setTaxMode: (nextTaxMode: TaxMode, options?: { taxClassId?: string }) =>
      setTaxMode(quotation.value, nextTaxMode, options),
    applyCustomerRecord,
    applyCompanyProfile,
    addRootItem: () =>
      quotation.value.majorItems.push(createQuotationItem(
        quotation.value.header.currency,
        getNewItemOverrides(quotation.value.lineItemEntryMode),
        uiLocale.value,
      )),
    addSectionHeader: () =>
      quotation.value.majorItems.push(createQuotationSectionHeader(uiLocale.value)),
    addChildItem: (parentItemId: string) =>
      addChildItem(quotationItemById.value, quotation.value.lineItemEntryMode, parentItemId, uiLocale.value),
    removeItem: (itemId: string) => removeItem(quotation.value, itemId),
    duplicateRootItem: (itemId: string) => duplicateRootItem(quotation.value, itemId, uiLocale.value),
    moveRootItem: (itemId: string, direction: -1 | 1) => moveRootItem(quotation.value, itemId, direction),
    moveRootRowToIndex: (itemId: string, targetIndex: number) =>
      moveRootRowToIndex(quotation.value, itemId, targetIndex),
    moveQuotationTreeRow: (
      itemId: string,
      targetParentId: string | null,
      targetIndex: number,
      dropMode: 'before' | 'inside' | 'after',
    ) => moveQuotationTreeRow(quotation.value, itemId, targetParentId, targetIndex, dropMode),
    updateSectionHeaderTitle: (itemId: string, title: string) => updateSectionHeaderTitle(quotation.value, itemId, title),
    updateItemField: (
      itemId: string,
      field: QuotationItemField,
      value: QuotationItem[QuotationItemField],
    ) => updateItemField(quotationItemById.value, itemId, field, value),
    setLineItemEntryMode: (nextMode: LineItemEntryMode) => setLineItemEntryMode(quotation.value, nextMode),
    setItemPricingMethod: (itemId: string, pricingMethod: QuotationItem['pricingMethod']) =>
      setItemPricingMethod(quotation.value, quotationItemById.value, itemId, pricingMethod),
    setLogoDataUrl: (logoDataUrl: string) => {
      quotation.value.branding.logoDataUrl = logoDataUrl
    },
    updateExchangeRate: (currency: string, rate: number) => {
      quotation.value.exchangeRates[currency] = normalizeRate(rate)
    },
    addExchangeRate: (currency: string): 'added' | 'exists' | 'invalid' => {
      const normalizedCurrency = parseCurrencyCode(currency)

      if (!normalizedCurrency) {
        return 'invalid'
      }

      if (normalizedCurrency in quotation.value.exchangeRates) {
        return 'exists'
      }

      quotation.value.exchangeRates = addCurrencyToRateTable(
        quotation.value.exchangeRates,
        normalizedCurrency,
        quotation.value.header.currency,
      )

      return 'added'
    },
    removeExchangeRate: (currency: string): 'removed' | 'in_use' | 'base_currency' => {
      if (currency === quotation.value.header.currency) {
        return 'base_currency'
      }

      if (collectCostCurrencies(quotation.value.majorItems).has(currency)) {
        return 'in_use'
      }

      quotation.value.exchangeRates = removeCurrencyFromRateTable(
        quotation.value.exchangeRates,
        currency,
        quotation.value.header.currency,
      )

      return 'removed'
    },
  }
}

function getInitialCompanyProfileSelection(
  records: CompanyProfileRecord[],
  locale: SupportedLocale,
): {
  companyProfileId: string | null
  companyProfileSnapshot: CompanyProfile
} {
  const firstRecord = records[0]

  if (!firstRecord) {
    return {
      companyProfileId: null,
      companyProfileSnapshot: createDefaultCompanyProfile(locale),
    }
  }

  return {
    companyProfileId: firstRecord.id,
    companyProfileSnapshot: toCompanyProfileSnapshot(firstRecord),
  }
}

function toCompanyProfileSnapshot(record: CompanyProfileRecord): CompanyProfile {
  return {
    companyName: record.companyName,
    email: record.email,
    phone: record.phone,
  }
}

function createQuotationItemLookup(items: QuotationRootItem[]): Map<string, QuotationItem> {
  const itemById = new Map<string, QuotationItem>()
  addQuotationItemsToLookup(items, itemById)
  return itemById
}

function addQuotationItemsToLookup(items: QuotationRootItem[] | QuotationItem[], itemById: Map<string, QuotationItem>) {
  for (const item of items) {
    if (!isQuotationItem(item)) {
      continue
    }

    itemById.set(item.id, item)
    addQuotationItemsToLookup(item.children, itemById)
  }
}

function addChildItem(
  quotationItemById: Map<string, QuotationItem>,
  lineItemEntryMode: QuotationDraft['lineItemEntryMode'],
  parentItemId: string,
  uiLocale: SupportedLocale,
) {
  const parent = quotationItemById.get(parentItemId)

  if (!parent) {
    return
  }

  parent.children.push(
    createQuotationItem(parent.costCurrency, {
      ...getNewItemOverrides(lineItemEntryMode),
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
  const sourceItem = quotation.majorItems[sourceIndex]

  if (sourceIndex === -1 || !sourceItem || !isQuotationItem(sourceItem)) {
    return
  }

  const duplicate = duplicateQuotationItem(cloneSerializable(sourceItem), true, uiLocale)
  quotation.majorItems.splice(sourceIndex + 1, 0, duplicate)
}

function moveRootItem(quotation: QuotationDraft, itemId: string, direction: -1 | 1) {
  const sourceIndex = quotation.majorItems.findIndex((item) => item.id === itemId)
  const targetIndex = sourceIndex + direction

  if (sourceIndex === -1 || targetIndex < 0 || targetIndex >= quotation.majorItems.length) {
    return
  }

  moveQuotationRootRowToIndex(quotation.majorItems, itemId, direction > 0 ? targetIndex + 1 : targetIndex)
}

function moveRootRowToIndex(quotation: QuotationDraft, itemId: string, targetIndex: number) {
  moveQuotationRootRowToIndex(quotation.majorItems, itemId, targetIndex)
}

function moveQuotationTreeRow(
  quotation: QuotationDraft,
  itemId: string,
  targetParentId: string | null,
  targetIndex: number,
  dropMode: 'before' | 'inside' | 'after',
) {
  moveQuotationTreeRowInTree(quotation.majorItems, itemId, targetParentId, targetIndex, dropMode)
}

function updateItemField(
  quotationItemById: Map<string, QuotationItem>,
  itemId: string,
  field: QuotationItemField,
  value: QuotationItem[QuotationItemField],
) {
  const item = quotationItemById.get(itemId)

  if (item) {
    Object.assign(item, { [field]: value })
  }
}

const TARGETED_ITEM_RESTORE_FIELDS: readonly QuotationItemField[] = [
  'name',
  'description',
  'quantity',
  'quantityUnit',
  'pricingMethod',
  'manualUnitPrice',
  'unitCost',
  'costCurrency',
  'markupRate',
  'taxClassId',
  'expectedTotal',
  'notes',
]

function applySingleItemFieldRestore(
  currentItems: QuotationRootItem[],
  targetItems: QuotationRootItem[],
): QuotationHistoryChangeSummary | null {
  const change: {
    item: QuotationItem
    field: QuotationItemField
    value: QuotationItem[QuotationItemField]
    targetItemName: string
  }[] = []

  if (!collectSingleItemFieldRestoreChange(currentItems, targetItems, change)) {
    return null
  }

  const [singleChange] = change
  if (!singleChange || change.length !== 1) {
    return null
  }

  const summary = createQuotationItemFieldChangeSummary(
    singleChange.item.id,
    singleChange.targetItemName || singleChange.item.name,
    singleChange.field,
    singleChange.item[singleChange.field],
    singleChange.value,
  )

  Object.assign(singleChange.item, {
    [singleChange.field]: singleChange.value,
  })
  return summary
}

function collectSingleItemFieldRestoreChange(
  currentItems: QuotationRootItem[] | QuotationItem[],
  targetItems: QuotationRootItem[] | QuotationItem[],
  changes: Array<{
    item: QuotationItem
    field: QuotationItemField
    value: QuotationItem[QuotationItemField]
    targetItemName: string
  }>,
) {
  if (currentItems.length !== targetItems.length || changes.length > 1) {
    return false
  }

  for (let index = 0; index < currentItems.length; index += 1) {
    const currentItem = currentItems[index]
    const targetItem = targetItems[index]

    if (!currentItem || !targetItem) {
      return false
    }

    const currentIsQuotationItem = isQuotationItem(currentItem)
    const targetIsQuotationItem = isQuotationItem(targetItem)

    if (!currentIsQuotationItem || !targetIsQuotationItem) {
      if (
        currentIsQuotationItem !== targetIsQuotationItem
        || !isQuotationSectionHeader(currentItem)
        || !isQuotationSectionHeader(targetItem)
        || currentItem.id !== targetItem.id
        || currentItem.title !== targetItem.title
      ) {
        return false
      }
      continue
    }

    if (currentItem.id !== targetItem.id || currentItem.children.length !== targetItem.children.length) {
      return false
    }

    for (const field of TARGETED_ITEM_RESTORE_FIELDS) {
      if (Object.is(currentItem[field], targetItem[field])) {
        continue
      }

      changes.push({
        item: currentItem,
        field,
        value: targetItem[field],
        targetItemName: targetItem.name,
      })

      if (changes.length > 1) {
        return false
      }
    }

    if (!collectSingleItemFieldRestoreChange(currentItem.children, targetItem.children, changes)) {
      return false
    }
  }

  return true
}

function updateSectionHeaderTitle(quotation: QuotationDraft, itemId: string, title: string) {
  const sectionHeader = quotation.majorItems.find((item) => item.id === itemId)

  if (sectionHeader && !isQuotationItem(sectionHeader)) {
    sectionHeader.title = title
  }
}

function rebaseQuoteCurrencyFields(quotation: QuotationDraft, conversionRate: number) {
  if (!Number.isFinite(conversionRate) || conversionRate <= 0 || conversionRate === 1) {
    return
  }

  rebaseExtraCharges(quotation, conversionRate)
  rebaseExpectedTotals(quotation.majorItems, conversionRate)
  rebaseManualUnitPrices(quotation.majorItems, conversionRate)
}

function rebaseExtraCharges(quotation: QuotationDraft, conversionRate: number) {
  for (const charge of quotation.totalsConfig.extraCharges ?? []) {
    charge.amount = roundMoney(charge.amount * conversionRate)
  }
}

function rebaseExpectedTotals(items: QuotationRootItem[], conversionRate: number) {
  for (const item of items) {
    if (!isQuotationItem(item)) {
      continue
    }

    if (typeof item.expectedTotal === 'number' && Number.isFinite(item.expectedTotal)) {
      item.expectedTotal = roundMoney(item.expectedTotal * conversionRate)
    }

    rebaseExpectedTotals(item.children, conversionRate)
  }
}

function rebaseManualUnitPrices(items: QuotationRootItem[], conversionRate: number) {
  for (const item of items) {
    if (!isQuotationItem(item)) {
      continue
    }

    if (typeof item.manualUnitPrice === 'number' && Number.isFinite(item.manualUnitPrice)) {
      item.manualUnitPrice = roundMoney(item.manualUnitPrice * conversionRate)
    }

    rebaseManualUnitPrices(item.children, conversionRate)
  }
}

function upsertSavedDraft(savedDrafts: QuotationDraft[], nextDraft: QuotationDraft) {
  const index = savedDrafts.findIndex((draft) => draft.id === nextDraft.id)
  const normalizedDraft = normalizeQuotationDraft(cloneSerializable(nextDraft), {
    ensureAtLeastOneItem: false,
  })

  if (index === -1) {
    return [...savedDrafts, normalizedDraft]
  }

  return savedDrafts.map((draft, draftIndex) => (draftIndex === index ? normalizedDraft : draft))
}

function normalizeRate(rate: number) {
  return Number.isFinite(rate) && rate > 0 ? clampNumber(rate, MIN_EXCHANGE_RATE, MAX_EXCHANGE_RATE) : 1
}

function getNewItemOverrides(lineItemEntryMode: QuotationDraft['lineItemEntryMode']) {
  if (lineItemEntryMode === 'quick') {
    return {
      pricingMethod: 'manual_price' as const,
      manualUnitPrice: 0,
    }
  }

  return {
    pricingMethod: 'cost_plus' as const,
  }
}

function setLineItemEntryMode(quotation: QuotationDraft, nextMode: LineItemEntryMode) {
  quotation.lineItemEntryMode = nextMode
}

function setItemPricingMethod(
  quotation: QuotationDraft,
  quotationItemById: Map<string, QuotationItem>,
  itemId: string,
  pricingMethod: QuotationItem['pricingMethod'],
) {
  const item = quotationItemById.get(itemId)

  if (!item || item.children.length > 0 || !pricingMethod || item.pricingMethod === pricingMethod) {
    return
  }

  if (pricingMethod === 'manual_price') {
    item.manualUnitPrice = calculateCurrentItemUnitSellingPrice(quotation, itemId)
    item.pricingMethod = 'manual_price'
    return
  }

  item.pricingMethod = 'cost_plus'
  const hasStoredCost = item.unitCost > 0
  item.unitCost = hasStoredCost ? item.unitCost : item.manualUnitPrice ?? 0
  item.costCurrency = item.costCurrency || quotation.header.currency
  if (!hasStoredCost) {
    item.markupRate ??= 0
  }
}

function calculateCurrentItemUnitSellingPrice(quotation: QuotationDraft, itemId: string) {
  const path = findQuotationItemPath(quotation.majorItems, itemId)
  const item = path?.at(-1)

  if (!path || !item) {
    return 0
  }

  const inheritedMarkupRate = getAncestorMarkupRate(path, quotation.totalsConfig.globalMarkupRate)
  return calculateQuotationItemUnitSellingPrice(
    item,
    quotation.totalsConfig.globalMarkupRate,
    quotation.exchangeRates,
    inheritedMarkupRate,
  )
}

function getAncestorMarkupRate(path: QuotationItem[], globalMarkupRate: number) {
  if (path.length <= 1) {
    return undefined
  }

  return path
    .slice(0, -1)
    .reduce(
      (currentMarkupRate, item) => getEffectiveMarkupRate(item.markupRate, currentMarkupRate),
      globalMarkupRate,
    )
}

function collectLeafItems(items: QuotationRootItem[]): QuotationItem[] {
  return items.flatMap((item) => {
    if (!isQuotationItem(item)) {
      return []
    }

    if (item.children.length === 0) {
      return [item]
    }

    return collectLeafItems(item.children)
  })
}

function resolveLineItemEntryMode(items: QuotationRootItem[]): LineItemEntryMode {
  const leafItems = collectLeafItems(items)

  if (leafItems.length > 0 && leafItems.every((item) => item.pricingMethod === 'manual_price')) {
    return 'quick'
  }

  return 'detailed'
}

function setTaxMode(
  quotation: QuotationDraft,
  nextTaxMode: TaxMode,
  options?: {
    taxClassId?: string
  },
) {
  if (nextTaxMode === 'mixed') {
    quotation.totalsConfig.taxMode = 'mixed'
    return 'updated' as const
  }

  if (canUseSingleTaxMode(getQuotationRootItems(quotation.majorItems), quotation.totalsConfig)) {
    quotation.totalsConfig.taxMode = 'single'
    return 'updated' as const
  }

  if (!options?.taxClassId) {
    return 'requires_tax_class' as const
  }

  if (!(quotation.totalsConfig.taxClasses ?? []).some((taxClass) => taxClass.id === options.taxClassId)) {
    return 'requires_tax_class' as const
  }

  quotation.majorItems = applyTaxClassToRootRows(quotation.majorItems, options.taxClassId)
  quotation.totalsConfig.defaultTaxClassId = options.taxClassId
  quotation.totalsConfig.taxMode = 'single'
  return 'updated' as const
}

function applyTaxClassToRootRows(items: QuotationRootItem[], taxClassId: string): QuotationRootItem[] {
  return items.map((item) => {
    if (!isQuotationItem(item)) {
      return item
    }

    return applyTaxClassToQuotationItems([item], taxClassId)[0] as QuotationItem
  })
}
