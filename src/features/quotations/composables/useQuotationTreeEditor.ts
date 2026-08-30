import type { ComputedRef, Ref } from 'vue'

import {
  getDefaultQuotationChildItemName,
  getDefaultQuotationSiblingItemName,
} from '@/shared/i18n/defaults'
import type { SupportedLocale } from '@/shared/i18n/locale'
import { cloneSerializable } from '@/shared/utils/clone'

import type {
  QuotationDraft,
  QuotationItem,
  QuotationItemField,
  QuotationRootItem,
} from '../types'
import { parseCurrencyCode } from '../utils/currencyCodes'
import { addCurrencyToRateTable, ensureCurrenciesInRateTable } from '../utils/exchangeRates'
import {
  createQuotationActionSummary,
  createQuotationFieldChangeSummary,
  createQuotationItemAddedRemovedSummary,
  createQuotationItemFieldChangeSummary,
  type QuotationHistoryChangeSummary,
} from '../utils/quotationHistoryChangeSummary'
import {
  createCollectionSpliceMutation,
  createSetValueMutation,
  type QuotationCollectionTarget,
  type QuotationHistoryMutation,
} from '../utils/quotationHistoryCommands'
import {
  collectCostCurrencies,
  createQuotationItem,
  createQuotationSectionHeader,
  duplicateQuotationItem,
  findQuotationItemPath,
  getQuotationRootItems,
  isQuotationItem,
  normalizeQuotationItems,
} from '../utils/quotationItems'
import { resolveQuotationTaxMode } from '../utils/quotationTaxes'

interface QuotationRowLocation {
  item: QuotationRootItem
  index: number
  target: QuotationCollectionTarget
}

interface UseQuotationTreeEditorOptions {
  quotation: Ref<QuotationDraft>
  uiLocale: Ref<SupportedLocale>
  quotationItemById: ComputedRef<Map<string, QuotationItem>>
  executeHistory: (
    mutations: readonly QuotationHistoryMutation[],
    summary?: QuotationHistoryChangeSummary,
  ) => boolean
}

export function useQuotationTreeEditor(options: UseQuotationTreeEditorOptions) {
  const { quotation, uiLocale, quotationItemById, executeHistory } = options

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

    return executeHistory([
      createSetValueMutation({ scope: 'quotation' }, 'majorItems', quotation.value.majorItems, nextItems),
      createSetValueMutation({ scope: 'quotation' }, 'exchangeRates', quotation.value.exchangeRates, nextExchangeRates),
      createSetValueMutation(
        { scope: 'totalsConfig' },
        'taxMode',
        quotation.value.totalsConfig.taxMode,
        nextTaxMode,
        { beforeExists: 'taxMode' in quotation.value.totalsConfig },
      ),
    ])
  }

  function addRootItem() {
    const item = createQuotationItem(
      quotation.value.header.currency,
      {},
      uiLocale.value,
    )
    return executeHistory([
      createCollectionSpliceMutation({ scope: 'rootItems' }, quotation.value.majorItems.length, [], [item]),
    ], createQuotationItemAddedRemovedSummary('itemAdded', item.id, item.name))
  }

  function addSectionHeader() {
    const section = createQuotationSectionHeader(uiLocale.value)
    return executeHistory([
      createCollectionSpliceMutation({ scope: 'rootItems' }, quotation.value.majorItems.length, [], [section]),
    ], createQuotationItemAddedRemovedSummary('itemAdded', section.id, section.title))
  }

  function addChildItem(parentItemId: string) {
    const parent = quotationItemById.value.get(parentItemId)
    if (!parent) {
      return false
    }

    const item = createQuotationItem(parent.costCurrency, {
      name: parent.children.length === 0
        ? getDefaultQuotationChildItemName(uiLocale.value)
        : getDefaultQuotationSiblingItemName(uiLocale.value),
    }, uiLocale.value)
    return executeHistory([
      createCollectionSpliceMutation(
        { scope: 'itemChildren', itemId: parentItemId },
        parent.children.length,
        [],
        [item],
      ),
    ], createQuotationItemAddedRemovedSummary('itemAdded', item.id, item.name))
  }

  function insertLineItem(
    parentItemId: string | null,
    index: number,
    patch: Partial<Omit<QuotationItem, 'id' | 'children'>>,
  ) {
    const parent = parentItemId ? quotationItemById.value.get(parentItemId) : undefined
    if (parentItemId && (!parent || (findQuotationItemPath(quotation.value.majorItems, parentItemId)?.length ?? 3) >= 3)) {
      return null
    }

    const target = parentItemId
      ? { scope: 'itemChildren' as const, itemId: parentItemId }
      : { scope: 'rootItems' as const }
    const targetItems = parent?.children ?? quotation.value.majorItems
    if (!Number.isInteger(index) || index < 0 || index > targetItems.length) {
      return null
    }

    const fallbackCurrency = parent?.costCurrency ?? quotation.value.header.currency
    const item = createQuotationItem(fallbackCurrency, { ...patch, children: [] }, uiLocale.value)
    const nextExchangeRates = addCurrencyToRateTable(
      quotation.value.exchangeRates,
      item.costCurrency,
      quotation.value.header.currency,
    )
    if (!(item.costCurrency in nextExchangeRates)) {
      return null
    }

    const mutations: QuotationHistoryMutation[] = [
      createCollectionSpliceMutation(target, index, [], [item]),
    ]
    if (nextExchangeRates !== quotation.value.exchangeRates) {
      mutations.push(createSetValueMutation(
        { scope: 'quotation' },
        'exchangeRates',
        quotation.value.exchangeRates,
        nextExchangeRates,
      ))
    }
    if (!executeHistory(mutations, createQuotationItemAddedRemovedSummary('itemAdded', item.id, item.name))) {
      return null
    }

    return item.id
  }

  function insertSectionHeader(index: number, title: string) {
    if (!Number.isInteger(index) || index < 0 || index > quotation.value.majorItems.length) {
      return null
    }
    const section = createQuotationSectionHeader(uiLocale.value, { title })
    if (!executeHistory([
      createCollectionSpliceMutation({ scope: 'rootItems' }, index, [], [section]),
    ], createQuotationItemAddedRemovedSummary('itemAdded', section.id, section.title))) {
      return null
    }
    return section.id
  }

  function removeItem(itemId: string) {
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
        [createQuotationItem(quotation.value.header.currency, {}, quotation.value.header.documentLocale)],
      ))
    }

    return executeHistory(
      mutations,
      createQuotationItemAddedRemovedSummary(
        'itemRemoved',
        location.item.id,
        isQuotationItem(location.item) ? location.item.name : location.item.title,
      ),
    )
  }

  function duplicateRootItem(itemId: string) {
    const sourceIndex = quotation.value.majorItems.findIndex((item) => item.id === itemId)
    const sourceItem = quotation.value.majorItems[sourceIndex]
    if (sourceIndex === -1 || !sourceItem || !isQuotationItem(sourceItem)) {
      return false
    }

    const duplicate = duplicateQuotationItem(cloneSerializable(sourceItem), true, uiLocale.value)
    return executeHistory([
      createCollectionSpliceMutation({ scope: 'rootItems' }, sourceIndex + 1, [], [duplicate]),
    ], createQuotationActionSummary(
      'quotations.history.actions.duplicatedItem',
      { item: sourceItem.name },
      `item:${duplicate.id}`,
    ))
  }

  function duplicateItem(itemId: string) {
    const source = findQuotationRowLocation(quotation.value.majorItems, itemId)
    if (!source || !isQuotationItem(source.item)) {
      return null
    }
    const duplicate = duplicateQuotationItem(cloneSerializable(source.item), true, uiLocale.value)
    if (!executeHistory([
      createCollectionSpliceMutation(source.target, source.index + 1, [], [duplicate]),
    ], createQuotationActionSummary(
      'quotations.history.actions.duplicatedItem',
      { item: source.item.name },
      `item:${duplicate.id}`,
    ))) {
      return null
    }
    return duplicate.id
  }

  function moveRootItem(itemId: string, direction: -1 | 1) {
    const sourceIndex = quotation.value.majorItems.findIndex((item) => item.id === itemId)
    const targetIndex = sourceIndex + direction
    if (sourceIndex === -1 || targetIndex < 0 || targetIndex >= quotation.value.majorItems.length) {
      return false
    }

    return moveRootRowToIndex(itemId, direction > 0 ? targetIndex + 1 : targetIndex)
  }

  function moveRootRowToIndex(itemId: string, targetIndex: number) {
    return moveQuotationTreeRow(itemId, null, targetIndex)
  }

  function moveQuotationTreeRow(itemId: string, targetParentId: string | null, targetIndex: number) {
    const source = findQuotationRowLocation(quotation.value.majorItems, itemId)
    if (!source || (!isQuotationItem(source.item) && targetParentId !== null)) {
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

    return executeHistory([
      createCollectionSpliceMutation(source.target, source.index, [source.item], []),
      createCollectionSpliceMutation(target, boundedTargetIndex, [], [source.item]),
    ], createQuotationActionSummary(
      'quotations.history.actions.movedItem',
      { item: isQuotationItem(source.item) ? source.item.name : source.item.title },
      `item:${source.item.id}`,
    ))
  }

  function updateSectionHeaderTitle(itemId: string, title: string) {
    const section = quotation.value.majorItems.find((item) => item.id === itemId)
    if (!section || isQuotationItem(section)) {
      return false
    }

    return executeHistory([
      createSetValueMutation({ scope: 'section', sectionId: itemId }, 'title', section.title, title),
    ], createQuotationFieldChangeSummary(
      `item:${itemId}:sectionTitle`,
      'quotations.history.fields.sectionTitle',
      section.title,
      title,
    ))
  }

  function updateItemField(
    itemId: string,
    field: QuotationItemField,
    value: QuotationItem[QuotationItemField],
  ) {
    const item = quotationItemById.value.get(itemId)
    if (!item) {
      return false
    }

    if (field === 'costCurrency') {
      const nextCurrency = parseCurrencyCode(value)
      if (!nextCurrency) {
        return false
      }

      const mutations: QuotationHistoryMutation[] = [
        createSetValueMutation(
          { scope: 'item', itemId },
          'costCurrency',
          item.costCurrency,
          nextCurrency,
        ),
      ]
      const nextExchangeRates = addCurrencyToRateTable(
        quotation.value.exchangeRates,
        nextCurrency,
        quotation.value.header.currency,
      )
      if (!(nextCurrency in nextExchangeRates)) {
        return false
      }

      if (nextExchangeRates !== quotation.value.exchangeRates) {
        mutations.push(createSetValueMutation(
          { scope: 'quotation' },
          'exchangeRates',
          quotation.value.exchangeRates,
          nextExchangeRates,
        ))
      }

      return executeHistory(
        mutations,
        createQuotationItemFieldChangeSummary(
          itemId,
          item.name,
          'costCurrency',
          item.costCurrency,
          nextCurrency,
        ),
      )
    }

    return executeHistory([
      createSetValueMutation(
        { scope: 'item', itemId },
        field,
        item[field],
        value,
        { beforeExists: field in item, afterExists: value !== undefined },
      ),
    ], createQuotationItemFieldChangeSummary(itemId, item.name, field, item[field], value))
  }

  function updateItemFields(
    itemId: string,
    patch: Partial<Omit<QuotationItem, 'id' | 'children'>>,
  ) {
    const item = quotationItemById.value.get(itemId)
    if (!item) {
      return false
    }

    const mutations: QuotationHistoryMutation[] = []
    for (const field of Object.keys(patch) as Array<keyof typeof patch>) {
      const value = patch[field]
      if (field === 'costCurrency') {
        const nextCurrency = parseCurrencyCode(value)
        if (!nextCurrency) return false
        const nextExchangeRates = addCurrencyToRateTable(
          quotation.value.exchangeRates,
          nextCurrency,
          quotation.value.header.currency,
        )
        if (!(nextCurrency in nextExchangeRates)) return false
        mutations.push(createSetValueMutation({ scope: 'item', itemId }, field, item.costCurrency, nextCurrency))
        if (nextExchangeRates !== quotation.value.exchangeRates) {
          mutations.push(createSetValueMutation(
            { scope: 'quotation' },
            'exchangeRates',
            quotation.value.exchangeRates,
            nextExchangeRates,
          ))
        }
        continue
      }

      mutations.push(createSetValueMutation(
        { scope: 'item', itemId },
        field,
        item[field],
        value,
        { beforeExists: field in item, afterExists: value !== undefined },
      ))
    }

    return executeHistory(mutations, createQuotationActionSummary(
      'quotations.history.actions.updatedItemFields',
      { item: item.name, count: Object.keys(patch).length },
      `item:${itemId}`,
    ))
  }

  return {
    replaceLineItems,
    addRootItem,
    addSectionHeader,
    addChildItem,
    insertLineItem,
    insertSectionHeader,
    removeItem,
    duplicateRootItem,
    duplicateItem,
    moveRootItem,
    moveRootRowToIndex,
    moveQuotationTreeRow,
    updateSectionHeaderTitle,
    updateItemField,
    updateItemFields,
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

    const nested = findQuotationRowLocation(item.children, itemId, { scope: 'itemChildren', itemId: item.id })
    if (nested) {
      return nested
    }
  }

  return null
}

function sameCollectionTarget(left: QuotationCollectionTarget, right: QuotationCollectionTarget) {
  if (left.scope !== right.scope) {
    return false
  }

  return left.scope !== 'itemChildren'
    || (right.scope === 'itemChildren' && left.itemId === right.itemId)
}

function containsQuotationItemId(items: QuotationItem[], itemId: string | null): boolean {
  return Boolean(itemId)
    && items.some((item) => item.id === itemId || containsQuotationItemId(item.children, itemId))
}

function getQuotationSubtreeDepth(item: QuotationItem): number {
  return item.children.length === 0
    ? 1
    : 1 + Math.max(...item.children.map(getQuotationSubtreeDepth))
}
