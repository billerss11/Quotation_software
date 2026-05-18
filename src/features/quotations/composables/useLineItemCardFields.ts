import type { CurrencyCode, PricingMethod, QuotationItem, QuotationItemField } from '../types'
import { useBufferedLineItemFields } from './useBufferedLineItemFields'

type UpdateItemField = (
  itemId: string,
  field: QuotationItemField,
  value: QuotationItem[QuotationItemField],
) => void

type SetItemPricingMethod = (itemId: string, pricingMethod: PricingMethod) => void

interface UseLineItemCardFieldsOptions {
  updateItemField: UpdateItemField
  setItemPricingMethod: SetItemPricingMethod
}

export function useLineItemCardFields(options: UseLineItemCardFieldsOptions) {
  const {
    getBufferedFieldValue: getBufferedItemFieldValue,
    queueBufferedField,
    flushBufferedField,
    flushBufferedFields,
  } = useBufferedLineItemFields(options.updateItemField)

  function setPricingMethod(itemId: string, value: unknown) {
    if (value !== 'manual_price' && value !== 'cost_plus') {
      return
    }

    flushBufferedFields()
    options.setItemPricingMethod(itemId, value)
  }

  function setText(itemId: string, field: QuotationItemField, value: unknown) {
    queueBufferedField(itemId, field, String(value ?? ''))
  }

  function setNumber(itemId: string, field: QuotationItemField, value: unknown) {
    const nextValue = typeof value === 'number' && Number.isFinite(value) ? value : 0
    queueBufferedField(itemId, field, nextValue)
  }

  function setOptionalNumber(itemId: string, field: QuotationItemField, value: unknown) {
    const nextValue = typeof value === 'number' && Number.isFinite(value) ? value : undefined
    queueBufferedField(itemId, field, nextValue as QuotationItem[QuotationItemField])
  }

  function setCurrency(itemId: string, value: unknown) {
    options.updateItemField(itemId, 'costCurrency', value as CurrencyCode)
  }

  function setTaxClass(itemId: string, value: unknown) {
    const nextValue = typeof value === 'string' && value.length > 0 ? value : undefined
    options.updateItemField(itemId, 'taxClassId', nextValue as QuotationItem[QuotationItemField])
  }

  function getBufferedFieldValue<T>(item: QuotationItem, field: QuotationItemField, fallback: T) {
    return getBufferedItemFieldValue(item.id, field, fallback)
  }

  function getTextFieldValue(item: QuotationItem, field: QuotationItemField) {
    return getBufferedFieldValue(item, field, String(item[field] ?? ''))
  }

  function getNumberFieldValue(item: QuotationItem, field: QuotationItemField, fallback = 0) {
    const currentValue = item[field]

    return getBufferedFieldValue(
      item,
      field,
      typeof currentValue === 'number' && Number.isFinite(currentValue) ? currentValue : fallback,
    )
  }

  function getOptionalNumberFieldValue(item: QuotationItem, field: QuotationItemField) {
    const currentValue = item[field]

    return getBufferedFieldValue(
      item,
      field,
      typeof currentValue === 'number' && Number.isFinite(currentValue) ? currentValue : undefined,
    )
  }

  return {
    flushBufferedField,
    setPricingMethod,
    setText,
    setNumber,
    setOptionalNumber,
    setCurrency,
    setTaxClass,
    getTextFieldValue,
    getNumberFieldValue,
    getOptionalNumberFieldValue,
  }
}
