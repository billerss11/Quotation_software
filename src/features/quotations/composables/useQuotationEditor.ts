import { computed, getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue'
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
  ExchangeRateTable,
  MixedTaxDocumentColumn,
  MajorItemSummary,
  QuotationExtraCharge,
  QuotationHeader,
  QuotationItem,
  QuotationItemField,
  QuotationDraft,
  QuotationOutputItemDetailLevel,
  QuotationRootItem,
  QuotationTaxBucket,
  QuotationTemplateId,
  TaxClass,
  TotalsConfig,
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
} from '../utils/exchangeRates'
import { clampNumber, MAX_EXCHANGE_RATE, MIN_EXCHANGE_RATE } from '../utils/pricingLimits'
import {
  collectCostCurrencies,
  createQuotationSectionHeader,
  duplicateQuotationItem,
  findQuotationItemPath,
  getQuotationRootItems,
  isQuotationItem,
  normalizeQuotationItems,
} from '../utils/quotationItems'
import { createQuotationItem } from '../utils/quotationItems'
import { createInitialQuotation, normalizeQuotationDraft } from '../utils/quotationDraft'
import { DEFAULT_LOCALE, type SupportedLocale } from '@/shared/i18n/locale'
import {
  getDefaultQuotationChildItemName,
  getDefaultQuotationSiblingItemName,
} from '@/shared/i18n/defaults'
import {
  canUseSingleTaxMode,
  createCalculationTotalsConfig,
  resolveQuotationTaxMode,
} from '../utils/quotationTaxes'
import type { TaxMode } from '../types'
import { useQuotationUndoHistory } from './useQuotationUndoHistory'
import {
  createQuotationFieldChangeSummary,
  createQuotationItemAddedRemovedSummary,
  createQuotationItemFieldChangeSummary,
} from '../utils/quotationHistoryChangeSummary'
import {
  createCollectionSpliceMutation,
  createReplaceQuotationMutation,
  createSetValueMutation,
  type QuotationCollectionTarget,
  type QuotationHistoryMutation,
} from '../utils/quotationHistoryCommands'

const HEADER_HISTORY_LABEL_KEYS: Partial<Record<keyof QuotationHeader, string>> = {
  quotationNumber: 'quotations.history.fields.quotationNumber',
  quotationDate: 'quotations.history.fields.quotationDate',
  customerCompany: 'quotations.history.fields.customerCompany',
  contactPerson: 'quotations.history.fields.contactPerson',
  contactDetails: 'quotations.history.fields.contactDetails',
  projectName: 'quotations.history.fields.projectName',
  validityPeriod: 'quotations.history.fields.validityPeriod',
  currency: 'quotations.history.fields.currency',
  documentLocale: 'quotations.history.fields.documentLocale',
  notes: 'quotations.history.fields.notes',
  terms: 'quotations.history.fields.terms',
}

const TOTALS_HISTORY_LABEL_KEYS: Partial<Record<keyof TotalsConfig, string>> = {
  globalMarkupRate: 'quotations.history.fields.globalMarkupRate',
  taxMode: 'quotations.history.fields.taxMode',
  taxRate: 'quotations.history.fields.taxRate',
}

interface QuotationRowLocation {
  item: QuotationRootItem
  index: number
  target: QuotationCollectionTarget
}

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

  if (getCurrentScope()) {
    onScopeDispose(unsubscribeCustomerLibrary)
    onScopeDispose(unsubscribeCompanyProfileLibrary)
  }

  quotation.value.exchangeRates = normalizeExchangeRates(
    quotation.value.exchangeRates,
    quotation.value.header.currency,
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
  })

  function replaceQuotationValue(nextQuotation: QuotationDraft) {
    const normalizedQuotation = normalizeQuotationDraft(cloneSerializable(nextQuotation))
    undoHistory.execute([
      createReplaceQuotationMutation(quotation.value, normalizedQuotation),
    ])
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
    undoHistory.execute([
      createSetValueMutation(
        { scope: 'header' },
        'customerCompany',
        quotation.value.header.customerCompany,
        record.customerCompany,
      ),
      createSetValueMutation(
        { scope: 'header' },
        'contactPerson',
        quotation.value.header.contactPerson,
        record.contactPerson,
      ),
      createSetValueMutation(
        { scope: 'header' },
        'contactDetails',
        quotation.value.header.contactDetails,
        record.contactDetails,
      ),
    ], createQuotationFieldChangeSummary(
      'header:customerCompany',
      'quotations.history.fields.customerCompany',
      quotation.value.header.customerCompany,
      record.customerCompany,
    ))
  }

  function applyCompanyProfile(record: CompanyProfileRecord) {
    undoHistory.execute([
      createSetValueMutation(
        { scope: 'quotation' },
        'companyProfileId',
        quotation.value.companyProfileId,
        record.id,
      ),
      createSetValueMutation(
        { scope: 'quotation' },
        'companyProfileSnapshot',
        quotation.value.companyProfileSnapshot,
        toCompanyProfileSnapshot(record),
      ),
    ])
  }

  function replaceLineItems(items: QuotationItem[]) {
    let nextItems: QuotationRootItem[] = normalizeQuotationItems(
      items,
      quotation.value.header.currency,
      quotation.value.header.documentLocale,
    )
    if (nextItems.length === 0) {
      nextItems = [createQuotationItem(quotation.value.header.currency, {}, uiLocale.value)]
    }

    const nextExchangeRates = ensureCurrenciesInRateTable(
      quotation.value.exchangeRates,
      collectCostCurrencies(nextItems),
      quotation.value.header.currency,
    )
    const nextTaxMode = resolveQuotationTaxMode(
      getQuotationRootItems(nextItems),
      quotation.value.totalsConfig,
      quotation.value.totalsConfig.taxMode ?? 'single',
    )
    const nextEntryMode = resolveLineItemEntryMode(nextItems)

    undoHistory.execute([
      createSetValueMutation(
        { scope: 'quotation' },
        'majorItems',
        quotation.value.majorItems,
        nextItems,
      ),
      createSetValueMutation(
        { scope: 'quotation' },
        'exchangeRates',
        quotation.value.exchangeRates,
        nextExchangeRates,
      ),
      createSetValueMutation(
        { scope: 'totalsConfig' },
        'taxMode',
        quotation.value.totalsConfig.taxMode,
        nextTaxMode,
        { beforeExists: 'taxMode' in quotation.value.totalsConfig },
      ),
      createSetValueMutation(
        { scope: 'quotation' },
        'lineItemEntryMode',
        quotation.value.lineItemEntryMode,
        nextEntryMode,
        { beforeExists: 'lineItemEntryMode' in quotation.value },
      ),
    ])
  }

  function addRootItem() {
    const item = createQuotationItem(
      quotation.value.header.currency,
      getNewItemOverrides(quotation.value.lineItemEntryMode),
      uiLocale.value,
    )
    undoHistory.execute([
      createCollectionSpliceMutation(
        { scope: 'rootItems' },
        quotation.value.majorItems.length,
        [],
        [item],
      ),
    ], createQuotationItemAddedRemovedSummary('itemAdded', item.id, item.name))
  }

  function addSectionHeader() {
    const section = createQuotationSectionHeader(uiLocale.value)
    undoHistory.execute([
      createCollectionSpliceMutation(
        { scope: 'rootItems' },
        quotation.value.majorItems.length,
        [],
        [section],
      ),
    ], createQuotationItemAddedRemovedSummary('itemAdded', section.id, section.title))
  }

  function addChildItemAction(parentItemId: string) {
    const parent = quotationItemById.value.get(parentItemId)
    if (!parent) {
      return false
    }

    const item = createQuotationItem(parent.costCurrency, {
      ...getNewItemOverrides(quotation.value.lineItemEntryMode),
      name: parent.children.length === 0
        ? getDefaultQuotationChildItemName(uiLocale.value)
        : getDefaultQuotationSiblingItemName(uiLocale.value),
    }, uiLocale.value)
    return undoHistory.execute([
      createCollectionSpliceMutation(
        { scope: 'itemChildren', itemId: parentItemId },
        parent.children.length,
        [],
        [item],
      ),
    ], createQuotationItemAddedRemovedSummary('itemAdded', item.id, item.name))
  }

  function removeItemAction(itemId: string) {
    const location = findQuotationRowLocation(quotation.value.majorItems, itemId)
    if (!location) {
      return false
    }

    const mutations: QuotationHistoryMutation[] = [
      createCollectionSpliceMutation(location.target, location.index, [location.item], []),
    ]
    if (location.target.scope === 'rootItems' && quotation.value.majorItems.length === 1) {
      mutations.push(createCollectionSpliceMutation(
        { scope: 'rootItems' },
        0,
        [],
        [createQuotationItem(
          quotation.value.header.currency,
          {},
          quotation.value.header.documentLocale,
        )],
      ))
    }

    return undoHistory.execute(
      mutations,
      createQuotationItemAddedRemovedSummary(
        'itemRemoved',
        location.item.id,
        isQuotationItem(location.item) ? location.item.name : location.item.title,
      ),
    )
  }

  function duplicateRootItemAction(itemId: string) {
    const sourceIndex = quotation.value.majorItems.findIndex((item) => item.id === itemId)
    const sourceItem = quotation.value.majorItems[sourceIndex]
    if (sourceIndex === -1 || !sourceItem || !isQuotationItem(sourceItem)) {
      return false
    }

    const duplicate = duplicateQuotationItem(cloneSerializable(sourceItem), true, uiLocale.value)
    return undoHistory.execute([
      createCollectionSpliceMutation(
        { scope: 'rootItems' },
        sourceIndex + 1,
        [],
        [duplicate],
      ),
    ], createQuotationItemAddedRemovedSummary('itemAdded', duplicate.id, duplicate.name))
  }

  function moveRootItemAction(itemId: string, direction: -1 | 1) {
    const sourceIndex = quotation.value.majorItems.findIndex((item) => item.id === itemId)
    const targetIndex = sourceIndex + direction
    if (sourceIndex === -1 || targetIndex < 0 || targetIndex >= quotation.value.majorItems.length) {
      return false
    }

    return moveRootRow(itemId, direction > 0 ? targetIndex + 1 : targetIndex)
  }

  function moveRootRow(itemId: string, targetIndex: number) {
    return moveQuotationRow(itemId, null, targetIndex)
  }

  function moveQuotationRow(itemId: string, targetParentId: string | null, targetIndex: number) {
    const source = findQuotationRowLocation(quotation.value.majorItems, itemId)
    if (!source) {
      return false
    }

    if (!isQuotationItem(source.item) && targetParentId !== null) {
      return false
    }

    if (isQuotationItem(source.item)) {
      if (targetParentId === itemId || containsQuotationItemId(source.item.children, targetParentId)) {
        return false
      }

      const targetParentPath = targetParentId
        ? findQuotationItemPath(quotation.value.majorItems, targetParentId)
        : null
      if (targetParentId && (!targetParentPath || targetParentPath.length + getQuotationSubtreeDepth(source.item) > 3)) {
        return false
      }
    }

    const target = targetParentId
      ? { scope: 'itemChildren' as const, itemId: targetParentId }
      : { scope: 'rootItems' as const }
    const targetLength = targetParentId
      ? quotationItemById.value.get(targetParentId)?.children.length
      : quotation.value.majorItems.length
    if (targetLength === undefined) {
      return false
    }

    let boundedTargetIndex = Math.max(0, Math.min(targetIndex, targetLength))
    if (sameCollectionTarget(source.target, target) && source.index < boundedTargetIndex) {
      boundedTargetIndex -= 1
    }
    if (sameCollectionTarget(source.target, target) && source.index === boundedTargetIndex) {
      return false
    }

    return undoHistory.execute([
      createCollectionSpliceMutation(source.target, source.index, [source.item], []),
      createCollectionSpliceMutation(target, boundedTargetIndex, [], [source.item]),
    ])
  }

  function updateSectionHeaderTitleAction(itemId: string, title: string) {
    const section = quotation.value.majorItems.find((item) => item.id === itemId)
    if (!section || isQuotationItem(section)) {
      return false
    }

    return undoHistory.execute([
      createSetValueMutation({ scope: 'section', sectionId: itemId }, 'title', section.title, title),
    ], createQuotationFieldChangeSummary(
      `item:${itemId}:sectionTitle`,
      'quotations.history.fields.sectionTitle',
      section.title,
      title,
    ))
  }

  function updateItemFieldAction(
    itemId: string,
    field: QuotationItemField,
    value: QuotationItem[QuotationItemField],
  ) {
    const item = quotationItemById.value.get(itemId)
    if (!item) {
      return false
    }

    return undoHistory.execute([
      createSetValueMutation(
        { scope: 'item', itemId },
        field,
        item[field],
        value,
        { beforeExists: field in item, afterExists: value !== undefined },
      ),
    ], createQuotationItemFieldChangeSummary(itemId, item.name, field, item[field], value))
  }

  function updateHeaderField<K extends keyof QuotationHeader>(field: K, value: QuotationHeader[K]) {
    if (field === 'currency') {
      return setQuotationCurrency(String(value))
    }

    return undoHistory.execute([
      createSetValueMutation(
        { scope: 'header' },
        field,
        quotation.value.header[field],
        value,
        { beforeExists: field in quotation.value.header, afterExists: value !== undefined },
      ),
    ], createQuotationFieldChangeSummary(
      `header:${String(field)}`,
      HEADER_HISTORY_LABEL_KEYS[field] ?? 'quotations.history.fields.projectName',
      quotation.value.header[field],
      value,
    ))
  }

  function setTemplateId(templateId: QuotationTemplateId) {
    return executeQuotationField('templateId', templateId)
  }

  function setOutputItemDetailLevel(itemDetailLevel: QuotationOutputItemDetailLevel) {
    return executeQuotationField('outputSettings', { itemDetailLevel })
  }

  function setLineItemEntryModeAction(nextMode: LineItemEntryMode) {
    return executeQuotationField('lineItemEntryMode', nextMode)
  }

  function executeQuotationField<K extends keyof QuotationDraft>(field: K, value: QuotationDraft[K]) {
    return undoHistory.execute([
      createSetValueMutation(
        { scope: 'quotation' },
        field,
        quotation.value[field],
        value,
        { beforeExists: field in quotation.value, afterExists: value !== undefined },
      ),
    ])
  }

  function setLogoDataUrlAction(logoDataUrl: string) {
    return undoHistory.execute([
      createSetValueMutation(
        { scope: 'branding' },
        'logoDataUrl',
        quotation.value.branding.logoDataUrl,
        logoDataUrl,
      ),
    ])
  }

  function updateExchangeRateAction(currency: string, rate: number) {
    const nextRate = normalizeRate(rate)
    return undoHistory.execute([
      createSetValueMutation(
        { scope: 'exchangeRates' },
        currency,
        quotation.value.exchangeRates[currency],
        nextRate,
        { beforeExists: currency in quotation.value.exchangeRates },
      ),
    ], createQuotationFieldChangeSummary(
      `exchangeRate:${currency}`,
      'quotations.history.fields.exchangeRate',
      quotation.value.exchangeRates[currency],
      nextRate,
    ))
  }

  function addExchangeRateAction(currency: string): 'added' | 'exists' | 'invalid' {
    const normalizedCurrency = parseCurrencyCode(currency)
    if (!normalizedCurrency) return 'invalid'
    if (normalizedCurrency in quotation.value.exchangeRates) return 'exists'

    const nextRate = addCurrencyToRateTable(
      quotation.value.exchangeRates,
      normalizedCurrency,
      quotation.value.header.currency,
    )[normalizedCurrency] ?? 1

    undoHistory.execute([
      createSetValueMutation(
        { scope: 'exchangeRates' },
        normalizedCurrency,
        undefined,
        nextRate,
        { beforeExists: false },
      ),
    ], createQuotationFieldChangeSummary(
      `exchangeRate:${normalizedCurrency}`,
      'quotations.history.fields.exchangeRate',
      undefined,
      nextRate,
    ))
    return 'added'
  }

  function removeExchangeRateAction(currency: string): 'removed' | 'in_use' | 'base_currency' {
    if (currency === quotation.value.header.currency) return 'base_currency'
    if (collectCostCurrencies(quotation.value.majorItems).has(currency)) return 'in_use'
    if (!(currency in quotation.value.exchangeRates)) return 'removed'

    const previousRate = quotation.value.exchangeRates[currency]
    undoHistory.execute([
      createSetValueMutation(
        { scope: 'exchangeRates' },
        currency,
        previousRate,
        undefined,
        { afterExists: false },
      ),
    ], createQuotationFieldChangeSummary(
      `exchangeRate:${currency}`,
      'quotations.history.fields.exchangeRate',
      previousRate,
      undefined,
    ))
    return 'removed'
  }

  function setQuotationCurrency(currency: string, suppliedRates?: ExchangeRateTable) {
    const nextCurrency = parseCurrencyCode(currency)
    if (!nextCurrency) {
      return false
    }

    const previousCurrency = quotation.value.header.currency
    if (previousCurrency === nextCurrency && !suppliedRates) {
      return false
    }

    let nextExchangeRates = previousCurrency === nextCurrency
      ? normalizeExchangeRates(quotation.value.exchangeRates, nextCurrency)
      : rebaseExchangeRates(quotation.value.exchangeRates, previousCurrency, nextCurrency)
    if (suppliedRates) {
      nextExchangeRates = normalizeExchangeRates({
        ...nextExchangeRates,
        ...suppliedRates,
        [nextCurrency]: 1,
      }, nextCurrency)
    }

    const conversionRate = previousCurrency === nextCurrency
      ? 1
      : nextExchangeRates[previousCurrency] ?? 1
    const mutations: QuotationHistoryMutation[] = [
      createSetValueMutation(
        { scope: 'header' },
        'currency',
        previousCurrency,
        nextCurrency,
      ),
      createSetValueMutation(
        { scope: 'quotation' },
        'exchangeRates',
        quotation.value.exchangeRates,
        nextExchangeRates,
      ),
      ...createCurrencyRebaseMutations(quotation.value, conversionRate),
    ]

    return undoHistory.execute(mutations, createQuotationFieldChangeSummary(
      'header:currency',
      'quotations.history.fields.currency',
      previousCurrency,
      nextCurrency,
    ))
  }

  function setItemPricingMethodAction(
    itemId: string,
    pricingMethod: QuotationItem['pricingMethod'],
  ) {
    const item = quotationItemById.value.get(itemId)
    if (!item || item.children.length > 0 || !pricingMethod || item.pricingMethod === pricingMethod) {
      return false
    }

    const mutations: QuotationHistoryMutation[] = []
    if (pricingMethod === 'manual_price') {
      mutations.push(
        createSetValueMutation(
          { scope: 'item', itemId },
          'manualUnitPrice',
          item.manualUnitPrice,
          calculateCurrentItemUnitSellingPrice(quotation.value, itemId),
          { beforeExists: 'manualUnitPrice' in item },
        ),
        createSetValueMutation(
          { scope: 'item', itemId },
          'pricingMethod',
          item.pricingMethod,
          'manual_price',
          { beforeExists: 'pricingMethod' in item },
        ),
      )
    } else {
      const hasStoredCost = item.unitCost > 0
      mutations.push(
        createSetValueMutation(
          { scope: 'item', itemId },
          'pricingMethod',
          item.pricingMethod,
          'cost_plus',
          { beforeExists: 'pricingMethod' in item },
        ),
        createSetValueMutation(
          { scope: 'item', itemId },
          'unitCost',
          item.unitCost,
          hasStoredCost ? item.unitCost : item.manualUnitPrice ?? 0,
        ),
        createSetValueMutation(
          { scope: 'item', itemId },
          'costCurrency',
          item.costCurrency,
          item.costCurrency || quotation.value.header.currency,
        ),
      )
      if (!hasStoredCost && item.markupRate === undefined) {
        mutations.push(createSetValueMutation(
          { scope: 'item', itemId },
          'markupRate',
          undefined,
          0,
          { beforeExists: false },
        ))
      }
    }

    return undoHistory.execute(
      mutations,
      createQuotationItemFieldChangeSummary(
        itemId,
        item.name,
        'pricingMethod',
        item.pricingMethod,
        pricingMethod,
      ),
    )
  }

  function setTaxModeAction(
    nextTaxMode: TaxMode,
    options?: { taxClassId?: string },
  ) {
    const currentMode = quotation.value.totalsConfig.taxMode ?? 'single'
    if (nextTaxMode === 'mixed') {
      undoHistory.execute([
        createSetValueMutation(
          { scope: 'totalsConfig' },
          'taxMode',
          quotation.value.totalsConfig.taxMode,
          'mixed',
          { beforeExists: 'taxMode' in quotation.value.totalsConfig },
        ),
      ], createQuotationFieldChangeSummary(
        'totals:taxMode',
        'quotations.history.fields.taxMode',
        currentMode,
        'mixed',
      ))
      return 'updated' as const
    }

    if (canUseSingleTaxMode(getQuotationRootItems(quotation.value.majorItems), quotation.value.totalsConfig)) {
      undoHistory.execute([
        createSetValueMutation(
          { scope: 'totalsConfig' },
          'taxMode',
          quotation.value.totalsConfig.taxMode,
          'single',
          { beforeExists: 'taxMode' in quotation.value.totalsConfig },
        ),
      ], createQuotationFieldChangeSummary(
        'totals:taxMode',
        'quotations.history.fields.taxMode',
        currentMode,
        'single',
      ))
      return 'updated' as const
    }

    const taxClassId = options?.taxClassId
    if (!taxClassId || !(quotation.value.totalsConfig.taxClasses ?? []).some((entry) => entry.id === taxClassId)) {
      return 'requires_tax_class' as const
    }

    const mutations = collectQuotationItems(quotation.value.majorItems).map((item) =>
      createSetValueMutation(
        { scope: 'item' as const, itemId: item.id },
        'taxClassId',
        item.taxClassId,
        taxClassId,
        { beforeExists: 'taxClassId' in item },
      ),
    )
    mutations.push(
      createSetValueMutation(
        { scope: 'totalsConfig' },
        'defaultTaxClassId',
        quotation.value.totalsConfig.defaultTaxClassId,
        taxClassId,
        { beforeExists: 'defaultTaxClassId' in quotation.value.totalsConfig },
      ),
      createSetValueMutation(
        { scope: 'totalsConfig' },
        'taxMode',
        quotation.value.totalsConfig.taxMode,
        'single',
        { beforeExists: 'taxMode' in quotation.value.totalsConfig },
      ),
    )
    undoHistory.execute(mutations, createQuotationFieldChangeSummary(
      'totals:taxMode',
      'quotations.history.fields.taxMode',
      currentMode,
      'single',
    ))
    return 'updated' as const
  }

  function updateTotalsField<K extends keyof TotalsConfig>(field: K, value: TotalsConfig[K]) {
    return undoHistory.execute([
      createSetValueMutation(
        { scope: 'totalsConfig' },
        field,
        quotation.value.totalsConfig[field],
        value,
        { beforeExists: field in quotation.value.totalsConfig, afterExists: value !== undefined },
      ),
    ], createQuotationFieldChangeSummary(
      `totals:${String(field)}`,
      TOTALS_HISTORY_LABEL_KEYS[field] ?? 'quotations.history.fields.globalMarkupRate',
      quotation.value.totalsConfig[field],
      value,
    ))
  }

  function updateTaxClassField(
    taxClassId: string,
    field: 'label' | 'rate',
    value: TaxClass[typeof field],
  ) {
    const taxClass = quotation.value.totalsConfig.taxClasses?.find((entry) => entry.id === taxClassId)
    if (!taxClass) return false
    return undoHistory.execute([
      createSetValueMutation({ scope: 'taxClass', taxClassId }, field, taxClass[field], value),
    ])
  }

  function addTaxClass(taxClass: TaxClass) {
    const taxClasses = quotation.value.totalsConfig.taxClasses ?? []
    const mutations: QuotationHistoryMutation[] = []
    if (!quotation.value.totalsConfig.taxClasses) {
      mutations.push(createSetValueMutation(
        { scope: 'totalsConfig' },
        'taxClasses',
        undefined,
        [],
        { beforeExists: false },
      ))
    }
    mutations.push(createCollectionSpliceMutation(
      { scope: 'taxClasses' },
      taxClasses.length,
      [],
      [taxClass],
    ))
    if (!quotation.value.totalsConfig.defaultTaxClassId && taxClasses.length === 0) {
      mutations.push(createSetValueMutation(
        { scope: 'totalsConfig' },
        'defaultTaxClassId',
        quotation.value.totalsConfig.defaultTaxClassId,
        taxClass.id,
        { beforeExists: 'defaultTaxClassId' in quotation.value.totalsConfig },
      ))
    }
    return undoHistory.execute(mutations)
  }

  function removeTaxClass(taxClassId: string) {
    const taxClasses = quotation.value.totalsConfig.taxClasses
    if (!taxClasses || taxClasses.length <= 1) return false
    const index = taxClasses.findIndex((entry) => entry.id === taxClassId)
    if (index === -1) return false
    const mutations: QuotationHistoryMutation[] = [
      createCollectionSpliceMutation({ scope: 'taxClasses' }, index, [taxClasses[index]], []),
    ]
    if (quotation.value.totalsConfig.defaultTaxClassId === taxClassId) {
      const nextDefault = taxClasses[index === 0 ? 1 : 0]?.id
      mutations.push(createSetValueMutation(
        { scope: 'totalsConfig' },
        'defaultTaxClassId',
        taxClassId,
        nextDefault,
      ))
    }
    return undoHistory.execute(mutations)
  }

  function addExtraCharge(charge: QuotationExtraCharge) {
    const charges = quotation.value.totalsConfig.extraCharges ?? []
    const mutations: QuotationHistoryMutation[] = []
    if (!quotation.value.totalsConfig.extraCharges) {
      mutations.push(createSetValueMutation(
        { scope: 'totalsConfig' },
        'extraCharges',
        undefined,
        [],
        { beforeExists: false },
      ))
    }
    mutations.push(createCollectionSpliceMutation(
      { scope: 'extraCharges' },
      charges.length,
      [],
      [charge],
    ))
    return undoHistory.execute(mutations)
  }

  function removeExtraCharge(extraChargeId: string) {
    const charges = quotation.value.totalsConfig.extraCharges
    const index = charges?.findIndex((entry) => entry.id === extraChargeId) ?? -1
    if (!charges || index === -1) return false
    return undoHistory.execute([
      createCollectionSpliceMutation({ scope: 'extraCharges' }, index, [charges[index]], []),
    ])
  }

  function updateExtraChargeField(
    extraChargeId: string,
    field: 'label' | 'amount',
    value: QuotationExtraCharge[typeof field],
  ) {
    const charge = quotation.value.totalsConfig.extraCharges?.find((entry) => entry.id === extraChargeId)
    if (!charge) return false
    return undoHistory.execute([
      createSetValueMutation({ scope: 'extraCharge', extraChargeId }, field, charge[field], value),
    ])
  }

  function applyItemGoalSeek(updates: Array<{ itemId: string; markupRate: number }>) {
    const mutations = updates.flatMap(({ itemId, markupRate }) => {
      const item = quotationItemById.value.get(itemId)
      return item
        ? [createSetValueMutation(
            { scope: 'item' as const, itemId },
            'markupRate',
            item.markupRate,
            markupRate,
            { beforeExists: 'markupRate' in item },
          )]
        : []
    })
    return undoHistory.execute(mutations)
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
    replaceLineItems,
    setTaxMode: (nextTaxMode: TaxMode, options?: { taxClassId?: string }) =>
      setTaxModeAction(nextTaxMode, options),
    applyCustomerRecord,
    applyCompanyProfile,
    addRootItem,
    addSectionHeader,
    addChildItem: addChildItemAction,
    removeItem: removeItemAction,
    duplicateRootItem: duplicateRootItemAction,
    moveRootItem: moveRootItemAction,
    moveRootRowToIndex: moveRootRow,
    moveQuotationTreeRow: (
      itemId: string,
      targetParentId: string | null,
      targetIndex: number,
      _dropMode: 'before' | 'inside' | 'after',
    ) => moveQuotationRow(itemId, targetParentId, targetIndex),
    updateSectionHeaderTitle: updateSectionHeaderTitleAction,
    updateItemField: updateItemFieldAction,
    updateHeaderField,
    setTemplateId,
    setOutputItemDetailLevel,
    setQuotationCurrency,
    setLineItemEntryMode: setLineItemEntryModeAction,
    setItemPricingMethod: (itemId: string, pricingMethod: QuotationItem['pricingMethod']) =>
      setItemPricingMethodAction(itemId, pricingMethod),
    setLogoDataUrl: setLogoDataUrlAction,
    updateExchangeRate: updateExchangeRateAction,
    addExchangeRate: addExchangeRateAction,
    removeExchangeRate: removeExchangeRateAction,
    updateTotalsField,
    updateTaxClassField,
    addTaxClass,
    removeTaxClass,
    addExtraCharge,
    removeExtraCharge,
    updateExtraChargeField,
    setMixedTaxDocumentColumns: (columns: MixedTaxDocumentColumn[]) =>
      updateTotalsField('mixedTaxColumns', columns),
    applyItemGoalSeek,
    applyQuotationGoalSeek: (markupRate: number) => updateTotalsField('globalMarkupRate', markupRate),
  }
}

function findQuotationRowLocation(
  rows: QuotationRootItem[] | QuotationItem[],
  itemId: string,
  target: QuotationCollectionTarget = { scope: 'rootItems' },
): QuotationRowLocation | null {
  for (let index = 0; index < rows.length; index += 1) {
    const item = rows[index] as QuotationRootItem
    if (item.id === itemId) {
      return { item, index, target }
    }

    if (!isQuotationItem(item)) {
      continue
    }

    const nested = findQuotationRowLocation(
      item.children,
      itemId,
      { scope: 'itemChildren', itemId: item.id },
    )
    if (nested) {
      return nested
    }
  }

  return null
}

function sameCollectionTarget(
  left: QuotationCollectionTarget,
  right: QuotationCollectionTarget,
) {
  if (left.scope !== right.scope) {
    return false
  }

  return left.scope !== 'itemChildren'
    || (right.scope === 'itemChildren' && left.itemId === right.itemId)
}

function containsQuotationItemId(items: QuotationItem[], itemId: string | null): boolean {
  if (!itemId) {
    return false
  }

  return items.some((item) => item.id === itemId || containsQuotationItemId(item.children, itemId))
}

function getQuotationSubtreeDepth(item: QuotationItem): number {
  if (item.children.length === 0) {
    return 1
  }

  return 1 + Math.max(...item.children.map(getQuotationSubtreeDepth))
}

function collectQuotationItems(rows: QuotationRootItem[] | QuotationItem[]): QuotationItem[] {
  return rows.flatMap((row) => {
    if (!isQuotationItem(row)) {
      return []
    }

    return [row, ...collectQuotationItems(row.children)]
  })
}

function createCurrencyRebaseMutations(
  quotation: QuotationDraft,
  conversionRate: number,
): QuotationHistoryMutation[] {
  if (!Number.isFinite(conversionRate) || conversionRate <= 0 || conversionRate === 1) {
    return []
  }

  const mutations: QuotationHistoryMutation[] = []
  for (const charge of quotation.totalsConfig.extraCharges ?? []) {
    mutations.push(createSetValueMutation(
      { scope: 'extraCharge', extraChargeId: charge.id },
      'amount',
      charge.amount,
      roundMoney(charge.amount * conversionRate),
    ))
  }

  for (const item of collectQuotationItems(quotation.majorItems)) {
    if (typeof item.expectedTotal === 'number' && Number.isFinite(item.expectedTotal)) {
      mutations.push(createSetValueMutation(
        { scope: 'item', itemId: item.id },
        'expectedTotal',
        item.expectedTotal,
        roundMoney(item.expectedTotal * conversionRate),
      ))
    }
    if (typeof item.manualUnitPrice === 'number' && Number.isFinite(item.manualUnitPrice)) {
      mutations.push(createSetValueMutation(
        { scope: 'item', itemId: item.id },
        'manualUnitPrice',
        item.manualUnitPrice,
        roundMoney(item.manualUnitPrice * conversionRate),
      ))
    }
  }

  return mutations
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
