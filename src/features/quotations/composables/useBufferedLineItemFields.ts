import { getCurrentScope, onScopeDispose, shallowReactive } from 'vue'

import type { QuotationItem, QuotationItemField } from '../types'
import { registerLineItemEditBuffer } from '../utils/lineItemEditBuffers'

const BUFFER_COMMIT_DELAY_MS = 160

type BufferedFieldCommit = (
  itemId: string,
  field: QuotationItemField,
  value: QuotationItem[QuotationItemField],
) => void

export function useBufferedLineItemFields(
  onCommit: BufferedFieldCommit,
  commitDelayMs = BUFFER_COMMIT_DELAY_MS,
) {
  const pendingFieldValues = shallowReactive<Record<string, QuotationItem[QuotationItemField]>>({})
  const pendingFieldTimers = new Map<string, ReturnType<typeof window.setTimeout>>()
  const unregisterEditBuffer = registerLineItemEditBuffer(flushBufferedFields)

  if (getCurrentScope()) {
    onScopeDispose(dispose)
  }

  function getBufferedFieldKey(itemId: string, field: QuotationItemField) {
    return `${itemId}:${field}`
  }

  function hasBufferedField(itemId: string, field: QuotationItemField) {
    return Object.prototype.hasOwnProperty.call(pendingFieldValues, getBufferedFieldKey(itemId, field))
  }

  function getBufferedFieldValue<T>(itemId: string, field: QuotationItemField, fallback: T) {
    return hasBufferedField(itemId, field)
      ? pendingFieldValues[getBufferedFieldKey(itemId, field)] as T
      : fallback
  }

  function queueBufferedField(itemId: string, field: QuotationItemField, value: QuotationItem[QuotationItemField]) {
    const key = getBufferedFieldKey(itemId, field)
    pendingFieldValues[key] = value

    const existingTimer = pendingFieldTimers.get(key)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    pendingFieldTimers.set(key, setTimeout(() => {
      flushBufferedField(itemId, field)
    }, commitDelayMs))
  }

  function flushBufferedField(itemId: string, field: QuotationItemField) {
    if (!hasBufferedField(itemId, field)) {
      return
    }

    const key = getBufferedFieldKey(itemId, field)
    const existingTimer = pendingFieldTimers.get(key)

    if (existingTimer) {
      clearTimeout(existingTimer)
      pendingFieldTimers.delete(key)
    }

    const nextValue = pendingFieldValues[key]
    delete pendingFieldValues[key]
    onCommit(itemId, field, nextValue)
  }

  function flushBufferedFields() {
    Object.keys(pendingFieldValues).forEach((key) => {
      const separatorIndex = key.indexOf(':')
      const itemId = key.slice(0, separatorIndex)
      const field = key.slice(separatorIndex + 1) as QuotationItemField
      flushBufferedField(itemId, field)
    })
  }

  function dispose() {
    flushBufferedFields()
    unregisterEditBuffer()
  }

  return {
    getBufferedFieldValue,
    queueBufferedField,
    flushBufferedField,
    flushBufferedFields,
    dispose,
  }
}
