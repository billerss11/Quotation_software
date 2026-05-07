import { computed, getCurrentScope, onScopeDispose, ref, shallowRef, watch } from 'vue'
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
  QuotationTaxBucket,
  TaxClass,
} from '../types'
import {
  calculateMajorItemSummary,
  calculateQuotationItemUnitSellingPrice,
  calculateQuotationTotals,
  getEffectiveMarkupRate,
} from '../utils/quotationCalculations'
import { parseCurrencyCode } from '../utils/currencyCodes'
import {
  addCurrencyToRateTable,
  normalizeExchangeRates,
  rebaseExchangeRates,
  removeCurrencyFromRateTable,
} from '../utils/exchangeRates'
import { clampNumber, MAX_EXCHANGE_RATE, MIN_EXCHANGE_RATE } from '../utils/pricingLimits'
import {
  duplicateQuotationItem,
  findQuotationItem,
  findQuotationItemPath,
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

export function useQuotationEditor(uiLocale: Ref<SupportedLocale> = shallowRef(DEFAULT_LOCALE)) {
  const savedDrafts = shallowRef(loadSavedQuotations())
  const customerRecords = shallowRef(loadCustomerLibraryRecords())
  const companyProfileRecords = shallowRef(loadCompanyProfileRecords(uiLocale.value))
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

  if (getCurrentScope()) {
    onScopeDispose(unsubscribeCustomerLibrary)
    onScopeDispose(unsubscribeCompanyProfileLibrary)
  }

  watch(
    () => quotation.value.header.currency,
    (currency, previousCurrency) => {
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
  const itemSummaries = computed(() =>
    quotation.value.majorItems.map((item: QuotationItem): MajorItemSummary =>
      calculateMajorItemSummary(item, calculationTotalsConfig.value, quotation.value.exchangeRates),
    ),
  )

  const calculatedTotals = computed(() =>
    calculateQuotationTotals(
      quotation.value.majorItems,
      calculationTotalsConfig.value,
      quotation.value.exchangeRates,
    ),
  )
  const totals = computed(() => ({
    ...calculatedTotals.value,
    taxBuckets: calculatedTotals.value.taxBuckets.map((bucket: QuotationTaxBucket) => ({
      ...bucket,
      label:
        quotation.value.totalsConfig.taxClasses?.find((taxClass: TaxClass) => taxClass.id === bucket.taxClassId)?.label
        ?? bucket.label,
    })),
  }))
  function createNewQuotation() {
    quotation.value = createInitialQuotation(
      savedDrafts.value,
      uiLocale.value,
      {
        ...getInitialCompanyProfileSelection(companyProfileRecords.value, uiLocale.value),
        quotationNumber: allocateNextReusableLibraryQuotationNumber(),
      },
    )
  }

  function saveCurrentQuotation() {
    trackReusableLibraryQuotationNumber(quotation.value.header.quotationNumber)
    saveQuotationDraft(quotation.value)
    savedDrafts.value = upsertSavedDraft(savedDrafts.value, quotation.value)
  }

  function loadLatestQuotation() {
    const latestDraft = loadLatestQuotationDraft()

    if (latestDraft) {
      quotation.value = normalizeQuotationDraft(cloneSerializable(latestDraft))
      trackReusableLibraryQuotationNumber(quotation.value.header.quotationNumber)
    }
  }

  function replaceQuotationDraft(nextQuotation: QuotationDraft) {
    quotation.value = normalizeQuotationDraft(cloneSerializable(nextQuotation))
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
    createNewQuotation,
    saveCurrentQuotation,
    loadLatestQuotation,
    replaceQuotationDraft,
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

      quotation.value.totalsConfig.taxMode = resolveQuotationTaxMode(
        quotation.value.majorItems,
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
    addChildItem: (parentItemId: string) => addChildItem(quotation.value, parentItemId, uiLocale.value),
    removeItem: (itemId: string) => removeItem(quotation.value, itemId),
    duplicateRootItem: (itemId: string) => duplicateRootItem(quotation.value, itemId, uiLocale.value),
    moveRootItem: (itemId: string, direction: -1 | 1) => moveRootItem(quotation.value, itemId, direction),
    updateItemField: (
      itemId: string,
      field: QuotationItemField,
      value: QuotationItem[QuotationItemField],
    ) => updateItemField(quotation.value, itemId, field, value),
    setLineItemEntryMode: (nextMode: LineItemEntryMode) => setLineItemEntryMode(quotation.value, nextMode),
    setItemPricingMethod: (itemId: string, pricingMethod: QuotationItem['pricingMethod']) =>
      setItemPricingMethod(quotation.value, itemId, pricingMethod),
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

function addChildItem(quotation: QuotationDraft, parentItemId: string, uiLocale: SupportedLocale) {
  const parent = findQuotationItem(quotation.majorItems, parentItemId)

  if (!parent) {
    return
  }

  parent.children.push(
    createQuotationItem(parent.costCurrency, {
      ...getNewItemOverrides(quotation.lineItemEntryMode),
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

function collectCostCurrencies(items: QuotationItem[]): Set<string> {
  const usedCurrencies = new Set<string>()

  for (const item of items) {
    usedCurrencies.add(item.costCurrency)

    for (const childCurrency of collectCostCurrencies(item.children)) {
      usedCurrencies.add(childCurrency)
    }
  }

  return usedCurrencies
}

function rebaseQuoteCurrencyFields(quotation: QuotationDraft, conversionRate: number) {
  if (!Number.isFinite(conversionRate) || conversionRate <= 0 || conversionRate === 1) {
    return
  }

  if (quotation.totalsConfig.discountMode === 'fixed') {
    quotation.totalsConfig.discountValue = roundQuoteCurrencyAmount(
      quotation.totalsConfig.discountValue * conversionRate,
    )
  }

  rebaseExpectedTotals(quotation.majorItems, conversionRate)
  rebaseManualUnitPrices(quotation.majorItems, conversionRate)
}

function rebaseExpectedTotals(items: QuotationItem[], conversionRate: number) {
  for (const item of items) {
    if (typeof item.expectedTotal === 'number' && Number.isFinite(item.expectedTotal)) {
      item.expectedTotal = roundQuoteCurrencyAmount(item.expectedTotal * conversionRate)
    }

    rebaseExpectedTotals(item.children, conversionRate)
  }
}

function rebaseManualUnitPrices(items: QuotationItem[], conversionRate: number) {
  for (const item of items) {
    if (typeof item.manualUnitPrice === 'number' && Number.isFinite(item.manualUnitPrice)) {
      item.manualUnitPrice = roundQuoteCurrencyAmount(item.manualUnitPrice * conversionRate)
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

function roundQuoteCurrencyAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
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

  if (nextMode === 'quick') {
    convertLeafItemsToManualPrice(quotation)
  }
}

function convertLeafItemsToManualPrice(quotation: QuotationDraft) {
  collectLeafItems(quotation.majorItems).forEach((item) => {
    item.manualUnitPrice = calculateCurrentItemUnitSellingPrice(quotation, item.id)
    item.pricingMethod = 'manual_price'
  })
}

function setItemPricingMethod(
  quotation: QuotationDraft,
  itemId: string,
  pricingMethod: QuotationItem['pricingMethod'],
) {
  const item = findQuotationItem(quotation.majorItems, itemId)

  if (!item || item.children.length > 0 || !pricingMethod || item.pricingMethod === pricingMethod) {
    return
  }

  if (pricingMethod === 'manual_price') {
    item.manualUnitPrice = calculateCurrentItemUnitSellingPrice(quotation, itemId)
    item.pricingMethod = 'manual_price'
    return
  }

  item.pricingMethod = 'cost_plus'
  item.unitCost = item.unitCost > 0 ? item.unitCost : item.manualUnitPrice ?? 0
  item.costCurrency = item.costCurrency || quotation.header.currency
  item.markupRate ??= 0
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

function collectLeafItems(items: QuotationItem[]): QuotationItem[] {
  return items.flatMap((item) => {
    if (item.children.length === 0) {
      return [item]
    }

    return collectLeafItems(item.children)
  })
}

function resolveLineItemEntryMode(items: QuotationItem[]): LineItemEntryMode {
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

  if (canUseSingleTaxMode(quotation.majorItems, quotation.totalsConfig)) {
    quotation.totalsConfig.taxMode = 'single'
    return 'updated' as const
  }

  if (!options?.taxClassId) {
    return 'requires_tax_class' as const
  }

  if (!(quotation.totalsConfig.taxClasses ?? []).some((taxClass) => taxClass.id === options.taxClassId)) {
    return 'requires_tax_class' as const
  }

  quotation.majorItems = applyTaxClassToQuotationItems(quotation.majorItems, options.taxClassId)
  quotation.totalsConfig.defaultTaxClassId = options.taxClassId
  quotation.totalsConfig.taxMode = 'single'
  return 'updated' as const
}
