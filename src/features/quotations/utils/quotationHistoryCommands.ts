import { toRaw, type Ref } from 'vue'

import type {
  QuotationDraft,
  QuotationExtraCharge,
  QuotationItem,
  QuotationRootItem,
  TaxClass,
} from '../types'
import { isQuotationItem, isQuotationSectionHeader } from './quotationItems'

export type QuotationValueTarget =
  | { scope: 'quotation' }
  | { scope: 'header' }
  | { scope: 'totalsConfig' }
  | { scope: 'branding' }
  | { scope: 'outputSettings' }
  | { scope: 'exchangeRates' }
  | { scope: 'item'; itemId: string }
  | { scope: 'section'; sectionId: string }
  | { scope: 'taxClass'; taxClassId: string }
  | { scope: 'extraCharge'; extraChargeId: string }

export type QuotationCollectionTarget =
  | { scope: 'rootItems' }
  | { scope: 'itemChildren'; itemId: string }
  | { scope: 'taxClasses' }
  | { scope: 'extraCharges' }

interface ValueState {
  exists: boolean
  value: unknown
}

export interface SetValueMutation {
  type: 'setValue'
  target: QuotationValueTarget
  key: PropertyKey
  before: ValueState
  after: ValueState
}

export interface CollectionSpliceMutation {
  type: 'collectionSplice'
  target: QuotationCollectionTarget
  index: number
  removed: unknown[]
  added: unknown[]
}

export interface ReplaceQuotationMutation {
  type: 'replaceQuotation'
  before: QuotationDraft
  after: QuotationDraft
}

export type QuotationHistoryMutation =
  | SetValueMutation
  | CollectionSpliceMutation
  | ReplaceQuotationMutation

interface CreateSetValueMutationOptions {
  beforeExists?: boolean
  afterExists?: boolean
}

export function createSetValueMutation(
  target: QuotationValueTarget,
  key: PropertyKey,
  beforeValue: unknown,
  afterValue: unknown,
  options: CreateSetValueMutationOptions = {},
): SetValueMutation {
  return {
    type: 'setValue',
    target,
    key,
    before: {
      exists: options.beforeExists ?? true,
      value: cloneHistoryValue(beforeValue),
    },
    after: {
      exists: options.afterExists ?? true,
      value: cloneHistoryValue(afterValue),
    },
  }
}

export function createCollectionSpliceMutation(
  target: QuotationCollectionTarget,
  index: number,
  removed: readonly unknown[],
  added: readonly unknown[],
): CollectionSpliceMutation {
  return {
    type: 'collectionSplice',
    target,
    index,
    removed: removed.map(cloneHistoryValue),
    added: added.map(cloneHistoryValue),
  }
}

export function createReplaceQuotationMutation(
  before: QuotationDraft,
  after: QuotationDraft,
): ReplaceQuotationMutation {
  return {
    type: 'replaceQuotation',
    before: cloneHistoryValue(before),
    after: cloneHistoryValue(after),
  }
}

export function applyQuotationHistoryMutations(
  quotation: Ref<QuotationDraft>,
  mutations: readonly QuotationHistoryMutation[],
  direction: 'forward' | 'inverse',
) {
  const orderedMutations = direction === 'forward' ? mutations : [...mutations].reverse()

  for (const mutation of orderedMutations) {
    applyQuotationHistoryMutation(quotation, mutation, direction)
  }
}

export function isQuotationHistoryMutationNoop(mutation: QuotationHistoryMutation) {
  if (mutation.type === 'setValue') {
    return mutation.before.exists === mutation.after.exists
      && Object.is(mutation.before.value, mutation.after.value)
  }

  if (mutation.type === 'collectionSplice') {
    return mutation.removed.length === 0 && mutation.added.length === 0
  }

  return false
}

function applyQuotationHistoryMutation(
  quotation: Ref<QuotationDraft>,
  mutation: QuotationHistoryMutation,
  direction: 'forward' | 'inverse',
) {
  if (mutation.type === 'replaceQuotation') {
    quotation.value = cloneHistoryValue(direction === 'forward' ? mutation.after : mutation.before)
    return
  }

  if (mutation.type === 'setValue') {
    const target = resolveValueTarget(quotation.value, mutation.target)
    const state = direction === 'forward' ? mutation.after : mutation.before

    if (state.exists) {
      Reflect.set(target, mutation.key, cloneHistoryValue(state.value))
    } else {
      Reflect.deleteProperty(target, mutation.key)
    }
    return
  }

  const collection = resolveCollectionTarget(quotation.value, mutation.target) as unknown[]
  if (direction === 'forward') {
    collection.splice(mutation.index, mutation.removed.length, ...cloneHistoryValue(mutation.added))
  } else {
    collection.splice(mutation.index, mutation.added.length, ...cloneHistoryValue(mutation.removed))
  }
}

function resolveValueTarget(quotation: QuotationDraft, target: QuotationValueTarget): object {
  switch (target.scope) {
    case 'quotation':
      return quotation
    case 'header':
      return quotation.header
    case 'totalsConfig':
      return quotation.totalsConfig
    case 'branding':
      return quotation.branding
    case 'outputSettings':
      if (!quotation.outputSettings) {
        throw new Error('Cannot resolve missing quotation output settings')
      }
      return quotation.outputSettings
    case 'exchangeRates':
      return quotation.exchangeRates
    case 'item': {
      const item = findQuotationItem(quotation.majorItems, target.itemId)
      if (!item) {
        throw new Error(`Cannot resolve quotation item: ${target.itemId}`)
      }
      return item
    }
    case 'section': {
      const section = quotation.majorItems.find(
        (row) => isQuotationSectionHeader(row) && row.id === target.sectionId,
      )
      if (!section) {
        throw new Error(`Cannot resolve quotation section: ${target.sectionId}`)
      }
      return section
    }
    case 'taxClass': {
      const taxClass = quotation.totalsConfig.taxClasses?.find(
        (entry) => entry.id === target.taxClassId,
      )
      if (!taxClass) {
        throw new Error(`Cannot resolve quotation tax class: ${target.taxClassId}`)
      }
      return taxClass
    }
    case 'extraCharge': {
      const charge = quotation.totalsConfig.extraCharges?.find(
        (entry) => entry.id === target.extraChargeId,
      )
      if (!charge) {
        throw new Error(`Cannot resolve quotation extra charge: ${target.extraChargeId}`)
      }
      return charge
    }
  }
}

function resolveCollectionTarget(
  quotation: QuotationDraft,
  target: QuotationCollectionTarget,
): QuotationRootItem[] | QuotationItem[] | TaxClass[] | QuotationExtraCharge[] {
  switch (target.scope) {
    case 'rootItems':
      return quotation.majorItems
    case 'itemChildren': {
      const item = findQuotationItem(quotation.majorItems, target.itemId)
      if (!item) {
        throw new Error(`Cannot resolve child collection for quotation item: ${target.itemId}`)
      }
      return item.children
    }
    case 'taxClasses':
      if (!quotation.totalsConfig.taxClasses) {
        throw new Error('Cannot resolve missing quotation tax classes')
      }
      return quotation.totalsConfig.taxClasses
    case 'extraCharges':
      if (!quotation.totalsConfig.extraCharges) {
        throw new Error('Cannot resolve missing quotation extra charges')
      }
      return quotation.totalsConfig.extraCharges
  }
}

function findQuotationItem(rows: readonly QuotationRootItem[] | readonly QuotationItem[], itemId: string): QuotationItem | null {
  for (const row of rows) {
    if (!isQuotationItem(row)) {
      continue
    }

    if (row.id === itemId) {
      return row
    }

    const nestedItem = findQuotationItem(row.children, itemId)
    if (nestedItem) {
      return nestedItem
    }
  }

  return null
}

function cloneHistoryValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  return structuredClone(toRaw(value))
}
