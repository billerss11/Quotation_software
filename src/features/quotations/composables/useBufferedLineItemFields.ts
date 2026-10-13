import type { QuotationItem, QuotationItemField } from '../types'
import { useBufferedFieldValues } from './useBufferedFieldValues'

type BufferedFieldCommit = (
  itemId: string,
  field: QuotationItemField,
  value: QuotationItem[QuotationItemField],
) => void

export function useBufferedLineItemFields(
  onCommit: BufferedFieldCommit,
  commitDelayMs?: number,
) {
  const buffer = useBufferedFieldValues((key, value) => {
    const [itemId, field] = JSON.parse(key) as [string, QuotationItemField]
    onCommit(itemId, field, value as QuotationItem[QuotationItemField])
  }, commitDelayMs)

  function getBufferedFieldKey(itemId: string, field: QuotationItemField) {
    return JSON.stringify([itemId, field])
  }

  function getBufferedFieldValue<T>(itemId: string, field: QuotationItemField, fallback: T) {
    return buffer.getBufferedValue(getBufferedFieldKey(itemId, field), fallback)
  }

  function queueBufferedField(itemId: string, field: QuotationItemField, value: QuotationItem[QuotationItemField]) {
    buffer.queueBufferedValue(getBufferedFieldKey(itemId, field), value)
  }

  function flushBufferedField(itemId: string, field: QuotationItemField) {
    buffer.flushBufferedValue(getBufferedFieldKey(itemId, field))
  }

  return {
    getBufferedFieldValue,
    queueBufferedField,
    flushBufferedField,
    flushBufferedFields: buffer.flushBufferedValues,
    dispose: buffer.dispose,
  }
}
