<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency } from '@/shared/utils/formatters'

import { useBufferedLineItemFields } from '../composables/useBufferedLineItemFields'
import type {
  CurrencyCode,
  ExchangeRateTable,
  LineItemEntryMode,
  QuotationItem,
  QuotationItemField,
  PricingMethod,
  TotalsConfig,
} from '../types'
import { calculateMajorItemSummary } from '../utils/quotationCalculations'
import { buildChildRows, type ChildRow } from '../utils/lineItemChildRows'
import { getQuotationMarkupCopy } from '../utils/quotationMarkupCopy'
import {
  calculateQuotationItemSectionUnitCost,
  createInheritedMarkupContext,
  getQuotationItemPricingDisplay,
  type InheritedMarkupContext,
  type QuotationItemPricingDisplay,
} from '../utils/quotationItemPricing'
import { getQuotationItemAmountMismatch } from '../utils/quotationItemValidation'
import { createCalculationTotalsConfig, formatTaxRatePercentage } from '../utils/quotationTaxes'

const props = defineProps<{
  item: QuotationItem
  itemIndex: number
  totalItems: number
  currency: CurrencyCode
  lineItemEntryMode: LineItemEntryMode
  globalMarkupRate: number
  totalsConfig: TotalsConfig
  exchangeRates: ExchangeRateTable
  costCurrencyOptions: string[]
  focused?: boolean
  expanded: boolean
}>()

const emit = defineEmits<{
  toggleExpanded: [itemId: string]
  addChildItem: [parentItemId: string]
  removeItem: [itemId: string]
  duplicateRootItem: [itemId: string]
  moveRootItem: [itemId: string, direction: -1 | 1]
  setItemPricingMethod: [itemId: string, pricingMethod: PricingMethod]
  updateItemField: [itemId: string, field: QuotationItemField, value: QuotationItem[QuotationItemField]]
}>()

const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
const isQuickEntryMode = computed(() => props.lineItemEntryMode === 'quick')
const pricingMethodOptions = computed(() => [
  {
    label: t('quotations.lineItems.pricingBasisOptions.manualPrice'),
    value: 'manual_price' as const,
  },
  {
    label: t('quotations.lineItems.pricingBasisOptions.costPlus'),
    value: 'cost_plus' as const,
  },
])
const rootItemNumber = computed(() => String(props.itemIndex + 1))
const isMixedTaxMode = computed(() => props.totalsConfig.taxMode === 'mixed')
const calculationTotalsConfig = computed(() => createCalculationTotalsConfig(props.totalsConfig))
const summary = computed(() =>
  calculateMajorItemSummary(props.item, calculationTotalsConfig.value, props.exchangeRates),
)
const taxClassMap = computed(() => new Map((props.totalsConfig.taxClasses ?? []).map((taxClass) => [taxClass.id, taxClass])))
const explicitTaxClassOptions = computed(() =>
  (props.totalsConfig.taxClasses ?? []).map((taxClass) => ({
    label: taxClass.label,
    value: taxClass.id,
  })),
)
const childRows = computed(() =>
  buildChildRows(
    props.item.children,
    rootItemNumber.value,
    createInheritedMarkupContext(props.item, rootItemNumber.value),
    props.item.taxClassId,
    props.item.id,
  ),
)
const collapsedNestedItemCount = computed(() => childRows.value.length)
const collapsedNestedItemCountLabel = computed(() =>
  collapsedNestedItemCount.value > 99 ? '99+' : String(collapsedNestedItemCount.value),
)
const pricingDisplayByItemId = computed(() => {
  const pricingByItemId = new Map<string, QuotationItemPricingDisplay>()
  collectPricingDisplay(
    pricingByItemId,
    props.item,
    rootItemNumber.value,
    null,
    undefined,
  )
  return pricingByItemId
})
const amountMismatchByItemId = computed(() => {
  const mismatches = new Map<string, ReturnType<typeof getQuotationItemAmountMismatch>>()
  collectAmountMismatch(
    mismatches,
    props.item,
    rootItemNumber.value,
    null,
  )
  return mismatches
})
const collapsedSectionIds = shallowRef(new Set<string>())
const {
  getBufferedFieldValue: getBufferedItemFieldValue,
  queueBufferedField,
  flushBufferedField,
  flushBufferedFields,
} = useBufferedLineItemFields((itemId, field, value) => {
  emit('updateItemField', itemId, field, value)
})

function isGroupItem(item: QuotationItem) {
  return item.children.length > 0
}

function getPricingMethod(item: QuotationItem): PricingMethod {
  return item.pricingMethod === 'manual_price' ? 'manual_price' : 'cost_plus'
}

function isManualPriceItem(item: QuotationItem) {
  return !isGroupItem(item) && getPricingMethod(item) === 'manual_price'
}

function shouldShowPricingMethodSelector(item: QuotationItem) {
  return !isQuickEntryMode.value && !isGroupItem(item)
}

function shouldShowManualPriceControls(item: QuotationItem) {
  return !isGroupItem(item) && (isQuickEntryMode.value || isManualPriceItem(item))
}

function shouldShowDetailedCostControls(item: QuotationItem) {
  return !isGroupItem(item) && !shouldShowManualPriceControls(item)
}

function shouldShowMarkupEditor(item: QuotationItem) {
  if (isGroupItem(item)) {
    return !isQuickEntryMode.value
  }

  return shouldShowDetailedCostControls(item)
}

function getPricingMethodValue(item: QuotationItem) {
  return getPricingMethod(item)
}

function setPricingMethod(itemId: string, value: unknown) {
  if (value !== 'manual_price' && value !== 'cost_plus') {
    return
  }

  flushBufferedFields()
  emit('setItemPricingMethod', itemId, value)
}

function isSectionExpanded(itemId: string) {
  return !collapsedSectionIds.value.has(itemId)
}

function toggleSection(itemId: string) {
  const next = new Set(collapsedSectionIds.value)
  if (next.has(itemId)) next.delete(itemId)
  else next.add(itemId)
  collapsedSectionIds.value = next
}

function getVisibleChildRows() {
  return childRows.value.filter(
    (row) => row.depth < 3 || row.parentItemId === null || isSectionExpanded(row.parentItemId),
  )
}

function getPricing(itemId: string) {
  return pricingDisplayByItemId.value.get(itemId)
}

function getMarkupLabel(item: QuotationItem) {
  const pricing = getPricing(item.id)

  if (!pricing) {
    return ''
  }

  const markupCopy = getQuotationMarkupCopy(item, pricing)
  return t(markupCopy.helperKey, markupCopy.helperArgs)
}

function getMarkupFieldLabel(item: QuotationItem) {
  const pricing = getPricing(item.id)

  if (!pricing) {
    return t('quotations.lineItems.markupOverride')
  }

  return t(getQuotationMarkupCopy(item, pricing).fieldLabelKey)
}

function getMarkupAriaLabel(item: QuotationItem, index: number) {
  return t(
    isGroupItem(item)
      ? 'quotations.lineItems.itemMarkupFallbackAria'
      : 'quotations.lineItems.itemMarkupAria',
    { index },
  )
}

function getLineMarkupAriaLabel(item: QuotationItem, itemNumber: string) {
  return t(
    isGroupItem(item)
      ? 'quotations.lineItems.lineItemMarkupFallbackAria'
      : 'quotations.lineItems.lineItemMarkupAria',
    { itemNumber },
  )
}

function getManualPriceLabel() {
  return t('quotations.lineItems.finalUnitPrice')
}

function getItemManualUnitPriceAriaLabel(index: number) {
  return t('quotations.lineItems.itemFinalUnitPriceAria', { index })
}

function getLineManualUnitPriceAriaLabel(itemNumber: string) {
  return t('quotations.lineItems.lineItemFinalUnitPriceAria', { itemNumber })
}

function getItemPricingMethodAriaLabel(index: number) {
  return t('quotations.lineItems.itemPricingBasisAria', { index })
}

function getLinePricingMethodAriaLabel(itemNumber: string) {
  return t('quotations.lineItems.lineItemPricingBasisAria', { itemNumber })
}

function getUnitSellingPrice(item: QuotationItem) {
  return getPricing(item.id)?.unitSellingPrice ?? 0
}

function getSellingAmount(item: QuotationItem) {
  return getPricing(item.id)?.subtotal ?? 0
}

function getMismatchMessage(item: QuotationItem) {
  const mismatch = amountMismatchByItemId.value.get(item.id)
  if (!mismatch) return ''
  return t('quotations.lineItems.mismatch', {
    expected: formatCurrency(mismatch.expectedTotal, props.currency, currentLocale.value),
    actual: formatCurrency(mismatch.actualTotal, props.currency, currentLocale.value),
  })
}

function shouldShowExpectedTotal(item: QuotationItem) {
  return amountMismatchByItemId.value.get(item.id) !== null
}

function getDefaultTaxClassLabel() {
  return taxClassMap.value.get(props.totalsConfig.defaultTaxClassId ?? '')?.label ?? ''
}

function getTaxClassOptions(inheritedTaxClassId?: string) {
  const inheritedTaxClassLabel = taxClassMap.value.get(inheritedTaxClassId ?? '')?.label
  const fallbackLabel = inheritedTaxClassLabel
    ? t('quotations.lineItems.taxClassInheritOption', { label: inheritedTaxClassLabel })
    : t('quotations.lineItems.taxClassDefaultOption', { label: getDefaultTaxClassLabel() })

  return [
    { label: fallbackLabel, value: '' },
    ...explicitTaxClassOptions.value,
  ]
}

function getTaxClassValue(item: QuotationItem) {
  return item.taxClassId ?? ''
}

function setTaxClass(itemId: string, value: unknown) {
  const nextValue = typeof value === 'string' && value.length > 0 ? value : undefined
  emit('updateItemField', itemId, 'taxClassId', nextValue as QuotationItem[QuotationItemField])
}

function getTaxClassLabel(item: QuotationItem) {
  const pricing = getPricing(item.id)

  if (!pricing) {
    return getDefaultTaxClassLabel()
  }

  if (pricing.hasMixedTaxClasses) {
    return pricing.effectiveTaxRate !== null
      ? formatTaxRatePercentage(pricing.effectiveTaxRate)
      : t('quotations.lineItems.taxClassMixed')
  }

  return taxClassMap.value.get(pricing.taxClassId ?? '')?.label
    ?? (pricing.taxRate !== null ? formatTaxRatePercentage(pricing.taxRate) : getDefaultTaxClassLabel())
}

function getAmountWithTax(item: QuotationItem) {
  return getPricing(item.id)?.totalWithTax ?? 0
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
  emit('updateItemField', itemId, 'costCurrency', value as CurrencyCode)
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

function isItemIncomplete(item: QuotationItem): boolean {
  if (!getTextFieldValue(item, 'name').trim()) return true
  const missingQtyOrUnit = !(getNumberFieldValue(item, 'quantity') > 0) || !getTextFieldValue(item, 'quantityUnit').trim()
  if (item.children.length === 0) {
    if (isManualPriceItem(item)) {
      return missingQtyOrUnit || !(getNumberFieldValue(item, 'manualUnitPrice') > 0)
    }

    return missingQtyOrUnit || !(getNumberFieldValue(item, 'unitCost') > 0)
  }
  return missingQtyOrUnit
}

function countIncompleteItems(item: QuotationItem): number {
  const own = isItemIncomplete(item) ? 1 : 0
  return own + item.children.reduce((sum, child) => sum + countIncompleteItems(child), 0)
}

function collectPricingDisplay(
  pricingByItemId: Map<string, QuotationItemPricingDisplay>,
  item: QuotationItem,
  itemNumber: string,
  inheritedMarkupContext: InheritedMarkupContext | null,
  inheritedTaxClassId?: string,
) {
  pricingByItemId.set(
    item.id,
    getQuotationItemPricingDisplay(
      item,
      props.globalMarkupRate,
      props.exchangeRates,
      calculationTotalsConfig.value,
      inheritedMarkupContext,
      inheritedTaxClassId,
    ),
  )

  const nextInheritedMarkupContext = createInheritedMarkupContext(item, itemNumber, inheritedMarkupContext)
  const nextInheritedTaxClassId = item.taxClassId ?? inheritedTaxClassId

  item.children.forEach((child, index) => {
    collectPricingDisplay(
      pricingByItemId,
      child,
      `${itemNumber}.${index + 1}`,
      nextInheritedMarkupContext,
      nextInheritedTaxClassId,
    )
  })
}

function collectAmountMismatch(
  mismatches: Map<string, ReturnType<typeof getQuotationItemAmountMismatch>>,
  item: QuotationItem,
  itemNumber: string,
  inheritedMarkupContext: InheritedMarkupContext | null,
) {
  mismatches.set(
    item.id,
    getQuotationItemAmountMismatch(
      item,
      props.globalMarkupRate,
      props.exchangeRates,
      inheritedMarkupContext?.rate,
    ),
  )

  const nextInheritedMarkupContext = createInheritedMarkupContext(item, itemNumber, inheritedMarkupContext)

  item.children.forEach((child, index) => {
    collectAmountMismatch(
      mismatches,
      child,
      `${itemNumber}.${index + 1}`,
      nextInheritedMarkupContext,
    )
  })
}
</script>

<template>
  <article
    class="item-card"
    :class="{
      'item-card-focused': props.focused,
      'item-card-incomplete': countIncompleteItems(props.item) > 0,
    }"
    :data-item-id="props.item.id"
  >
    <header class="card-header" :class="{ 'card-header-collapsed': !props.expanded }">
      <button
        type="button"
        class="card-collapse-toggle"
        :aria-expanded="props.expanded"
        :aria-label="props.expanded ? t('quotations.lineItems.collapseItem') : t('quotations.lineItems.expandItem')"
        @click="emit('toggleExpanded', props.item.id)"
      >
        <i :class="props.expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
      </button>
      <span class="item-badge">{{ props.itemIndex + 1 }}</span>
      <InputText
        :class="['item-name-input', { 'field-missing': !getTextFieldValue(props.item, 'name').trim() }]"
        :model-value="getTextFieldValue(props.item, 'name')"
        :aria-label="t('quotations.lineItems.itemNameAria', { index: props.itemIndex + 1 })"
        :placeholder="t('quotations.lineItems.itemNamePlaceholder')"
        @update:model-value="setText(props.item.id, 'name', $event)"
        @blur="flushBufferedField(props.item.id, 'name')"
      />
      <div class="header-actions">
        <Button
          v-tooltip.top="t('quotations.lineItems.moveUp')"
          icon="pi pi-arrow-up"
          severity="secondary"
          text
          rounded
          :disabled="props.itemIndex === 0"
          :aria-label="t('quotations.lineItems.moveItemUpAria', { index: props.itemIndex + 1 })"
          @click="emit('moveRootItem', props.item.id, -1)"
        />
        <Button
          v-tooltip.top="t('quotations.lineItems.moveDown')"
          icon="pi pi-arrow-down"
          severity="secondary"
          text
          rounded
          :disabled="props.itemIndex === props.totalItems - 1"
          :aria-label="t('quotations.lineItems.moveItemDownAria', { index: props.itemIndex + 1 })"
          @click="emit('moveRootItem', props.item.id, 1)"
        />
        <Button
          v-tooltip.top="t('quotations.lineItems.duplicate')"
          icon="pi pi-copy"
          severity="secondary"
          text
          rounded
          :aria-label="t('quotations.lineItems.duplicateItemAria', { index: props.itemIndex + 1 })"
          @click="emit('duplicateRootItem', props.item.id)"
        />
        <Button
          v-tooltip.top="t('quotations.lineItems.delete')"
          icon="pi pi-trash"
          severity="danger"
          text
          rounded
          :aria-label="t('quotations.lineItems.deleteItemAria', { index: props.itemIndex + 1 })"
          @click="emit('removeItem', props.item.id)"
        />
      </div>

      <div v-if="!props.expanded" class="card-header-summary">
        <span
          v-if="collapsedNestedItemCount > 0"
          class="collapsed-nested-indicator"
          :aria-label="t('quotations.lineItems.collapsedNestedItemsAria', { count: collapsedNestedItemCount })"
          :title="t('quotations.lineItems.collapsedNestedItemsAria', { count: collapsedNestedItemCount })"
        >
          <i class="pi pi-sitemap" aria-hidden="true" />
          <strong>{{ collapsedNestedItemCountLabel }}</strong>
        </span>
        <span>{{ t('quotations.lineItems.cost') }} <strong>{{ formatCurrency(summary.baseSubtotal, props.currency, currentLocale) }}</strong></span>
        <span>{{ t('quotations.lineItems.markup') }} <strong>{{ formatCurrency(summary.markupAmount, props.currency, currentLocale) }}</strong></span>
        <span class="summary-selling">{{ t('quotations.lineItems.sellingPrice') }} <strong>{{ formatCurrency(summary.subtotal, props.currency, currentLocale) }}</strong></span>
        <span class="summary-selling">{{ t('quotations.lineItems.amountWithTax') }} <strong>{{ formatCurrency(getAmountWithTax(props.item), props.currency, currentLocale) }}</strong></span>
      </div>
    </header>

    <div v-show="props.expanded" class="item-card-panel">
      <div class="card-body">
        <div class="item-editor-shell">
          <div class="item-editor-main">
            <div class="item-control-grid" :class="{ 'item-control-grid-mixed': isMixedTaxMode }">
              <label class="pf pf-sm">
                <span class="field-label">{{ t('quotations.lineItems.quantity') }}</span>
                <InputNumber
                  :class="{ 'field-missing': !(getNumberFieldValue(props.item, 'quantity') > 0) }"
                  :model-value="getNumberFieldValue(props.item, 'quantity')"
                  :min="0"
                  :max-fraction-digits="2"
                  :aria-label="t('quotations.lineItems.itemQuantityAria', { index: props.itemIndex + 1 })"
                  @update:model-value="setNumber(props.item.id, 'quantity', $event)"
                  @blur="flushBufferedField(props.item.id, 'quantity')"
                />
              </label>
              <label class="pf pf-sm">
                <span class="field-label">{{ t('quotations.lineItems.unit') }}</span>
                <InputText
                  :class="{ 'field-missing': !getTextFieldValue(props.item, 'quantityUnit').trim() }"
                  :model-value="getTextFieldValue(props.item, 'quantityUnit')"
                  :aria-label="t('quotations.lineItems.itemUnitAria', { index: props.itemIndex + 1 })"
                  @update:model-value="setText(props.item.id, 'quantityUnit', $event)"
                  @blur="flushBufferedField(props.item.id, 'quantityUnit')"
                />
              </label>
              <template v-if="!isGroupItem(props.item)">
                <label v-if="shouldShowPricingMethodSelector(props.item)" class="pf pf-md">
                  <span class="field-label">{{ t('quotations.lineItems.pricingBasis') }}</span>
                  <Select
                    :model-value="getPricingMethodValue(props.item)"
                    :options="pricingMethodOptions"
                    option-label="label"
                    option-value="value"
                    :aria-label="getItemPricingMethodAriaLabel(props.itemIndex + 1)"
                    @update:model-value="setPricingMethod(props.item.id, $event)"
                  />
                </label>
                <label v-if="shouldShowManualPriceControls(props.item)" class="pf pf-lg">
                  <span class="field-label">{{ getManualPriceLabel() }}</span>
                  <InputNumber
                    :class="{ 'field-missing': !(getNumberFieldValue(props.item, 'manualUnitPrice') > 0) }"
                    :model-value="getNumberFieldValue(props.item, 'manualUnitPrice')"
                    mode="currency"
                    :currency="props.currency"
                    :locale="currentLocale"
                    :aria-label="getItemManualUnitPriceAriaLabel(props.itemIndex + 1)"
                    @update:model-value="setNumber(props.item.id, 'manualUnitPrice', $event)"
                    @blur="flushBufferedField(props.item.id, 'manualUnitPrice')"
                  />
                </label>
                <template v-if="shouldShowDetailedCostControls(props.item)">
                  <label class="pf pf-lg">
                    <span class="field-label">{{ t('quotations.lineItems.unitCost') }}</span>
                    <InputNumber
                      :class="{ 'field-missing': !(getNumberFieldValue(props.item, 'unitCost') > 0) }"
                      :model-value="getNumberFieldValue(props.item, 'unitCost')"
                      mode="currency"
                      :currency="props.item.costCurrency"
                      :locale="currentLocale"
                      :aria-label="t('quotations.lineItems.itemUnitCostAria', { index: props.itemIndex + 1 })"
                      @update:model-value="setNumber(props.item.id, 'unitCost', $event)"
                      @blur="flushBufferedField(props.item.id, 'unitCost')"
                    />
                  </label>
                  <label class="pf pf-sm">
                    <span class="field-label">{{ t('quotations.lineItems.costFx') }}</span>
                    <Select
                      :model-value="props.item.costCurrency"
                      :options="props.costCurrencyOptions"
                      :aria-label="t('quotations.lineItems.itemCostFxAria', { index: props.itemIndex + 1 })"
                      @update:model-value="setCurrency(props.item.id, $event)"
                    />
                  </label>
                </template>
                <label v-if="shouldShowMarkupEditor(props.item)" class="pf pf-md">
                  <span class="field-label">{{ getMarkupFieldLabel(props.item) }}</span>
                  <InputNumber
                    :model-value="getOptionalNumberFieldValue(props.item, 'markupRate')"
                    :placeholder="t('quotations.lineItems.markupInheritPlaceholder')"
                    suffix="%"
                    :min="0"
                    :max="1000"
                    :max-fraction-digits="2"
                    :aria-label="getMarkupAriaLabel(props.item, props.itemIndex + 1)"
                    @update:model-value="setOptionalNumber(props.item.id, 'markupRate', $event)"
                    @blur="flushBufferedField(props.item.id, 'markupRate')"
                  />
                  <small class="field-hint">{{ getMarkupLabel(props.item) }}</small>
                </label>
              </template>
              <template v-else-if="shouldShowMarkupEditor(props.item)">
                <label class="pf pf-md">
                  <span class="field-label">{{ getMarkupFieldLabel(props.item) }}</span>
                  <InputNumber
                    :model-value="getOptionalNumberFieldValue(props.item, 'markupRate')"
                    :placeholder="t('quotations.lineItems.markupInheritPlaceholder')"
                    suffix="%"
                    :min="0"
                    :max="1000"
                    :max-fraction-digits="2"
                    :aria-label="getMarkupAriaLabel(props.item, props.itemIndex + 1)"
                    @update:model-value="setOptionalNumber(props.item.id, 'markupRate', $event)"
                    @blur="flushBufferedField(props.item.id, 'markupRate')"
                  />
                  <small class="field-hint">{{ getMarkupLabel(props.item) }}</small>
                </label>
              </template>
              <label v-if="isMixedTaxMode" class="pf pf-lg">
                <span class="field-label">{{ t('quotations.lineItems.taxClass') }}</span>
                <Select
                  :model-value="getTaxClassValue(props.item)"
                  :options="getTaxClassOptions()"
                  option-label="label"
                  option-value="value"
                  :aria-label="t('quotations.lineItems.itemTaxClassAria', { index: props.itemIndex + 1 })"
                  @update:model-value="setTaxClass(props.item.id, $event)"
                />
                <small class="field-hint">{{ getTaxClassLabel(props.item) }}</small>
              </label>
            </div>

            <label class="desc-label desc-label-compact">
              <span class="field-label">{{ t('quotations.lineItems.description') }}</span>
              <Textarea
                :model-value="getTextFieldValue(props.item, 'description')"
                :aria-label="t('quotations.lineItems.itemDescriptionAria', { index: props.itemIndex + 1 })"
                rows="1"
                auto-resize
                :placeholder="t('quotations.lineItems.descriptionPlaceholder')"
                @update:model-value="setText(props.item.id, 'description', $event)"
                @blur="flushBufferedField(props.item.id, 'description')"
              />
            </label>
          </div>

          <aside class="item-metric-strip">
            <div class="metric-card">
              <span>{{ t('quotations.lineItems.cost') }}</span>
              <strong>{{ formatCurrency(summary.baseSubtotal, props.currency, currentLocale) }}</strong>
            </div>
            <div class="metric-card" v-if="!isGroupItem(props.item)">
              <span>{{ t('quotations.lineItems.unitSellingPrice') }}</span>
              <strong>{{ formatCurrency(getUnitSellingPrice(props.item), props.currency, currentLocale) }}</strong>
            </div>
            <div class="metric-card" v-else>
              <span>{{ t('quotations.lineItems.markup') }}</span>
              <strong>{{ formatCurrency(summary.markupAmount, props.currency, currentLocale) }}</strong>
            </div>
            <div class="metric-card">
              <span>{{ t('quotations.lineItems.sellingPrice') }}</span>
              <strong>{{ formatCurrency(isGroupItem(props.item) ? summary.subtotal : getSellingAmount(props.item), props.currency, currentLocale) }}</strong>
            </div>
            <div class="metric-card metric-card-primary">
              <span>{{ t('quotations.lineItems.amountWithTax') }}</span>
              <strong>{{ formatCurrency(getAmountWithTax(props.item), props.currency, currentLocale) }}</strong>
            </div>
          </aside>
        </div>

        <div v-if="isGroupItem(props.item) && shouldShowExpectedTotal(props.item)" class="expected-total-row">
          <p class="mismatch-warning">
            {{ getMismatchMessage(props.item) }}
          </p>
          <label class="pf pf-md expected-total-input">
            <span class="field-label">{{ t('quotations.lineItems.sourceTotal') }} <span class="field-label-hint">{{ t('quotations.lineItems.referenceOnly') }}</span></span>
            <InputNumber
              :model-value="getOptionalNumberFieldValue(props.item, 'expectedTotal')"
              mode="currency"
              :currency="props.currency"
              :locale="currentLocale"
              :min="0"
              :aria-label="t('quotations.lineItems.itemSourceTotalAria', { index: props.itemIndex + 1 })"
              @update:model-value="setOptionalNumber(props.item.id, 'expectedTotal', $event)"
              @blur="flushBufferedField(props.item.id, 'expectedTotal')"
            />
          </label>
        </div>
      </div>

      <div v-if="props.item.children.length > 0" class="child-table-wrap">
        <div class="child-table">
          <div class="ct-head" :class="isMixedTaxMode ? 'ct-grid-mixed' : 'ct-grid-single'">
            <span>#</span>
            <span>{{ t('quotations.lineItems.childHeaders.item') }}</span>
            <span>{{ t('quotations.lineItems.childHeaders.qty') }}</span>
            <span>{{ t('quotations.lineItems.childHeaders.unit') }}</span>
            <span>{{ t('quotations.lineItems.childHeaders.unitCost') }}</span>
            <span>{{ t('quotations.lineItems.childHeaders.costFx') }}</span>
            <span>{{ t('quotations.lineItems.childHeaders.markup') }}</span>
            <span v-if="isMixedTaxMode">{{ t('quotations.lineItems.childHeaders.taxClass') }}</span>
            <span>{{ t('quotations.lineItems.childHeaders.unitPrice') }}</span>
            <span>{{ t('quotations.lineItems.childHeaders.amount') }}</span>
            <span>{{ t('quotations.lineItems.childHeaders.amountWithTax') }}</span>
            <span></span>
          </div>

          <div
            v-for="row in getVisibleChildRows()"
            :key="row.item.id"
            class="ct-row"
            :data-item-id="row.item.id"
            :data-tax-mode="props.totalsConfig.taxMode ?? 'single'"
            :class="{
              'ct-grid-mixed': isMixedTaxMode,
              'ct-grid-single': !isMixedTaxMode,
              'ct-row-l2': row.depth === 2 && !isGroupItem(row.item),
              'ct-row-section': isGroupItem(row.item),
              'ct-row-d3': row.depth === 3,
              'ct-row-incomplete': isItemIncomplete(row.item),
            }"
          >
            <span
              class="ct-num"
              :class="{
                'ct-num-l2': row.depth === 2 && !isGroupItem(row.item),
                'ct-num-d3': row.depth === 3,
                'ct-num-section': isGroupItem(row.item),
              }"
            >
              <button
                v-if="isGroupItem(row.item) && row.item.children.length > 0"
                type="button"
                class="ct-section-toggle"
                :aria-expanded="isSectionExpanded(row.item.id)"
                :aria-label="isSectionExpanded(row.item.id) ? t('quotations.lineItems.collapseItem') : t('quotations.lineItems.expandItem')"
                @click="toggleSection(row.item.id)"
              >
                <i :class="isSectionExpanded(row.item.id) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
              </button>
              <span
                class="ct-num-badge"
                :class="{
                  'ct-badge-l2': row.depth === 2 && !isGroupItem(row.item),
                  'ct-badge-section': isGroupItem(row.item),
                  'ct-badge-d3': row.depth === 3,
                }"
              >
                {{ row.itemNumber }}
              </span>
            </span>

            <div class="ct-item">
              <InputText
                :class="{ 'field-missing': !getTextFieldValue(row.item, 'name').trim() }"
                :model-value="getTextFieldValue(row.item, 'name')"
                :aria-label="t('quotations.lineItems.lineItemNameAria', { itemNumber: row.itemNumber })"
                :placeholder="t('quotations.lineItems.namePlaceholder')"
                @update:model-value="setText(row.item.id, 'name', $event)"
                @blur="flushBufferedField(row.item.id, 'name')"
              />
              <Textarea
                :model-value="getTextFieldValue(row.item, 'description')"
                :aria-label="t('quotations.lineItems.lineItemDescriptionAria', { itemNumber: row.itemNumber })"
                rows="1"
                auto-resize
                :placeholder="t('quotations.lineItems.descriptionPlaceholder')"
                @update:model-value="setText(row.item.id, 'description', $event)"
                @blur="flushBufferedField(row.item.id, 'description')"
              />
              <div class="ct-meta">
                <span v-if="shouldShowPricingMethodSelector(row.item)" class="ct-meta-control">
                  <span class="ct-meta-label">{{ t('quotations.lineItems.pricingBasis') }}</span>
                  <Select
                    :model-value="getPricingMethodValue(row.item)"
                    :options="pricingMethodOptions"
                    option-label="label"
                    option-value="value"
                    :aria-label="getLinePricingMethodAriaLabel(row.itemNumber)"
                    @update:model-value="setPricingMethod(row.item.id, $event)"
                  />
                </span>
                <span>{{ t('quotations.lineItems.cost') }}: {{ formatCurrency(getPricing(row.item.id)?.baseAmount ?? 0, props.currency, currentLocale) }}</span>
                <span>{{ t('quotations.lineItems.markup') }}: {{ formatCurrency(getPricing(row.item.id)?.markupAmount ?? 0, props.currency, currentLocale) }}</span>
              </div>
            </div>

            <InputNumber
              :class="{ 'field-missing': !(getNumberFieldValue(row.item, 'quantity') > 0) }"
              :model-value="getNumberFieldValue(row.item, 'quantity')"
              :min="0"
              :max-fraction-digits="2"
              :aria-label="t('quotations.lineItems.lineItemQuantityAria', { itemNumber: row.itemNumber })"
              @update:model-value="setNumber(row.item.id, 'quantity', $event)"
              @blur="flushBufferedField(row.item.id, 'quantity')"
            />

            <InputText
              :class="{ 'field-missing': !getTextFieldValue(row.item, 'quantityUnit').trim() }"
              :model-value="getTextFieldValue(row.item, 'quantityUnit')"
              :aria-label="t('quotations.lineItems.lineItemUnitAria', { itemNumber: row.itemNumber })"
              @update:model-value="setText(row.item.id, 'quantityUnit', $event)"
              @blur="flushBufferedField(row.item.id, 'quantityUnit')"
            />

            <template v-if="!isGroupItem(row.item)">
              <template v-if="shouldShowDetailedCostControls(row.item)">
                <InputNumber
                  :class="{ 'field-missing': !(getNumberFieldValue(row.item, 'unitCost') > 0) }"
                  :model-value="getNumberFieldValue(row.item, 'unitCost')"
                  mode="currency"
                  :currency="row.item.costCurrency"
                  :locale="currentLocale"
                  :aria-label="t('quotations.lineItems.lineItemUnitCostAria', { itemNumber: row.itemNumber })"
                  @update:model-value="setNumber(row.item.id, 'unitCost', $event)"
                  @blur="flushBufferedField(row.item.id, 'unitCost')"
                />
                <Select
                  :model-value="row.item.costCurrency"
                  :options="props.costCurrencyOptions"
                  class="cost-fx-select"
                  :aria-label="t('quotations.lineItems.lineItemCostFxAria', { itemNumber: row.itemNumber })"
                  @update:model-value="setCurrency(row.item.id, $event)"
                />
              </template>
              <template v-else>
                <span class="ct-muted">--</span>
                <span class="ct-muted">--</span>
              </template>
            </template>
            <template v-else>
              <span class="ct-derived-cost">
                {{ formatCurrency(calculateQuotationItemSectionUnitCost(row.item, props.exchangeRates), props.currency, currentLocale) }}
              </span>
              <span class="ct-muted">{{ props.currency }}</span>
            </template>

            <div class="ct-markup">
              <template v-if="shouldShowMarkupEditor(row.item)">
                <InputNumber
                  :model-value="getOptionalNumberFieldValue(row.item, 'markupRate')"
                  :placeholder="t('quotations.lineItems.markupInheritPlaceholder')"
                  suffix="%"
                  :min="0"
                  :max="1000"
                  :max-fraction-digits="2"
                  :aria-label="getLineMarkupAriaLabel(row.item, row.itemNumber)"
                  @update:model-value="setOptionalNumber(row.item.id, 'markupRate', $event)"
                  @blur="flushBufferedField(row.item.id, 'markupRate')"
                />
                <small class="ct-hint">{{ getMarkupLabel(row.item) }}</small>
              </template>
              <span v-else class="ct-muted">--</span>
            </div>

            <div v-if="isMixedTaxMode" class="ct-markup">
              <Select
                :model-value="getTaxClassValue(row.item)"
                :options="getTaxClassOptions(row.inheritedTaxClassId)"
                option-label="label"
                option-value="value"
                :aria-label="t('quotations.lineItems.lineItemTaxClassAria', { itemNumber: row.itemNumber })"
                @update:model-value="setTaxClass(row.item.id, $event)"
              />
              <small class="ct-hint">{{ getTaxClassLabel(row.item) }}</small>
            </div>

            <template v-if="shouldShowManualPriceControls(row.item)">
              <InputNumber
                :class="{ 'field-missing': !(getNumberFieldValue(row.item, 'manualUnitPrice') > 0) }"
                :model-value="getNumberFieldValue(row.item, 'manualUnitPrice')"
                mode="currency"
                :currency="props.currency"
                :locale="currentLocale"
                :aria-label="getLineManualUnitPriceAriaLabel(row.itemNumber)"
                @update:model-value="setNumber(row.item.id, 'manualUnitPrice', $event)"
                @blur="flushBufferedField(row.item.id, 'manualUnitPrice')"
              />
            </template>
            <span v-else class="ct-amount">
              {{ formatCurrency(getUnitSellingPrice(row.item), props.currency, currentLocale) }}
            </span>

            <span class="ct-amount">
              {{ formatCurrency(getSellingAmount(row.item), props.currency, currentLocale) }}
            </span>

            <span class="ct-amount">
              {{ formatCurrency(getAmountWithTax(row.item), props.currency, currentLocale) }}
            </span>

            <span class="ct-actions">
              <Button
                v-if="row.depth < 3"
                v-tooltip.top="t('quotations.lineItems.addChild')"
                icon="pi pi-plus"
                severity="secondary"
                text
                rounded
                :aria-label="t('quotations.lineItems.addChildToLineItemAria', { itemNumber: row.itemNumber })"
                @click="emit('addChildItem', row.item.id)"
              />
              <Button
                v-tooltip.top="t('quotations.lineItems.delete')"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                :aria-label="t('quotations.lineItems.deleteLineItemAria', { itemNumber: row.itemNumber })"
                @click="emit('removeItem', row.item.id)"
              />
            </span>
          </div>

          <p
            v-for="row in childRows.filter((entry) => getMismatchMessage(entry.item))"
            :key="`warn-${row.item.id}`"
            class="child-warning"
          >
            {{ row.itemNumber }}: {{ getMismatchMessage(row.item) }}
          </p>
        </div>
      </div>

      <footer class="card-footer">
        <Button
          class="add-child-button"
          icon="pi pi-plus"
          :label="t('quotations.lineItems.addChildItem')"
          size="small"
          :aria-label="t('quotations.lineItems.addChildItemAria', { index: props.itemIndex + 1 })"
          @click="emit('addChildItem', props.item.id)"
        />
      </footer>
    </div>
  </article>
</template>

<style scoped>
.item-card {
  display: grid;
  min-width: 0;
  border: 1px solid var(--surface-border);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  background: var(--surface-card);
  box-shadow: var(--shadow-control);
  container: line-item-card / inline-size;
  overflow: hidden;
  scroll-margin-top: 160px;
}

.item-card-focused {
  border-color: #6ee7b7;
  box-shadow:
    0 0 0 2px rgb(16 185 129 / 28%),
    var(--shadow-soft);
  animation: item-focus-pulse 1.8s ease-out;
}

.item-card-incomplete {
  border-left-color: #f59e0b;
  border-left-width: 3px;
}

@keyframes item-focus-pulse {
  0% {
    transform: translateY(-2px);
    box-shadow:
      0 0 0 0 rgb(16 185 129 / 34%),
      var(--shadow-soft);
  }

  40% {
    transform: translateY(0);
    box-shadow:
      0 0 0 6px rgb(16 185 129 / 12%),
      var(--shadow-soft);
  }

  100% {
    box-shadow:
      0 0 0 2px rgb(16 185 129 / 22%),
      var(--shadow-soft);
  }
}

.card-header {
  display: grid;
  grid-template-columns: auto 32px minmax(220px, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--surface-border);
  background: linear-gradient(180deg, #f8fafc, var(--surface-panel));
}

.card-header-collapsed {
  border-bottom: none;
}

.card-header-summary {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 3px 16px;
  padding: 4px 2px 1px;
  color: var(--text-muted);
  font-size: 12px;
}

.card-header-summary strong {
  color: var(--text-strong);
}

.collapsed-nested-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-subtle);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.collapsed-nested-indicator i {
  font-size: 11px;
}

.collapsed-nested-indicator strong {
  color: inherit;
  font-size: 12px;
}

.summary-selling {
  font-weight: 700;
}

.summary-selling strong {
  font-size: 13px;
}

.card-collapse-toggle {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
}

.card-collapse-toggle:hover {
  color: var(--text-strong);
  background: var(--surface-hover);
}

.item-card-panel {
  min-width: 0;
}

.item-badge {
  display: inline-grid;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 6px;
  background: var(--accent);
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
}

.item-name-input {
  min-width: 0;
}

.item-name-input :deep(.p-inputtext) {
  border-color: transparent;
  background: var(--surface-card);
  min-height: 38px;
  padding: 0.55rem 0.8rem;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-strong);
}

.header-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  justify-content: flex-end;
}

.card-body {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
}

.field-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
}

.field-label-hint {
  color: var(--text-subtle);
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
}

.field-hint {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.item-editor-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
  align-items: start;
  gap: 8px;
}

.item-editor-main {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.item-control-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 6px;
  align-items: start;
}

.item-control-grid-mixed {
  grid-template-columns: repeat(15, minmax(0, 1fr));
}

.pf {
  display: grid;
  grid-column: span 3;
  gap: 3px;
  min-width: 0;
}

.pf-sm {
  grid-column: span 2;
}

.pf-md,
.pf-lg {
  grid-column: span 3;
}

.pf :deep(.p-inputtext),
.pf :deep(.p-inputnumber),
.pf :deep(.p-inputnumber-input),
.pf :deep(.p-select) {
  min-width: 0;
  width: 100%;
}

.pf :deep(.p-inputtext),
.pf :deep(.p-inputnumber-input) {
  min-height: 36px;
  padding: 0.45rem 0.7rem;
  font-size: 13px;
}

.pf :deep(.p-select-label) {
  min-width: 0;
  padding: 0.45rem 0.7rem;
  font-size: 13px;
}

.desc-label {
  display: grid;
  gap: 3px;
}

.desc-label :deep(.p-textarea) {
  width: 100%;
  white-space: pre-wrap;
}

.desc-label-compact :deep(.p-textarea) {
  min-height: 34px;
  padding: 0.45rem 0.7rem;
  font-size: 13px;
}

.item-metric-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  min-width: 0;
}

.metric-card {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-raised);
}

.metric-card span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
}

.metric-card strong {
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.metric-card-primary {
  border-color: var(--accent-soft);
  background: var(--accent-surface);
}

.metric-card-primary strong,
.metric-card-primary span {
  color: var(--accent);
}

.expected-total-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  background: var(--warning-soft);
}

.expected-total-input {
  grid-column: auto;
}

.mismatch-warning {
  margin: 0;
  color: var(--warning);
  font-size: 12px;
  font-weight: 600;
}

.child-table-wrap {
  overflow-x: auto;
  border-top: 1px solid var(--surface-border);
  border-bottom: 1px solid var(--surface-border);
}

.child-table {
  display: grid;
  min-width: 1048px;
  gap: 0;
  background: var(--surface-card);
}

.ct-head,
.ct-row {
  display: grid;
  gap: 6px;
  align-items: center;
  padding: 4px 8px;
}

.ct-grid-mixed {
  grid-template-columns: 60px minmax(220px, 1.35fr) 62px 72px 108px 88px 108px 120px 98px 98px 98px 62px;
}

.ct-grid-single {
  grid-template-columns: 60px minmax(220px, 1.35fr) 62px 72px 108px 88px 108px 98px 98px 98px 62px;
}

.ct-head {
  min-height: 28px;
  background: #eef3f8;
  border-bottom: 2px solid var(--surface-border);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
}

.ct-row {
  position: relative;
  min-height: 34px;
  align-items: start;
  border-top: 1px solid #e6ebf2;
  border-left: 0;
  background: #fbfcfe;
  scroll-margin-top: 160px;
}

.ct-row::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 4px;
  background: transparent;
}

.ct-row::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: transparent;
  transition: background 220ms cubic-bezier(0.4, 0, 0.2, 1);
}

.ct-row:hover::after {
  background: rgb(0 0 0 / 14%);
}

.ct-row:focus-within::after {
  background: rgb(37 99 235 / 14%);
}

.ct-row-l2::before {
  background: var(--info);
  opacity: 0.72;
}

.ct-row-l2 {
  background: #fbfcfe;
}

.ct-row-section {
  min-height: 58px;
  border-top: 1px solid var(--accent-soft);
  border-bottom: 1px solid var(--accent-soft);
  background: var(--accent-surface);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 70%);
}

.ct-row-section::before {
  width: 6px;
  background: var(--accent);
}

.ct-row-section .ct-item :deep(.p-inputtext:first-child) {
  border-color: rgb(4 120 87 / 18%);
  background: #ffffff;
  font-weight: 700;
}

.ct-row-section .ct-item {
  gap: 4px;
}

.ct-row-section .ct-actions :deep(.p-button:first-child) {
  width: 34px;
  height: 34px;
  border: 1px solid var(--accent-soft);
  background: var(--surface-card);
  color: var(--accent);
  box-shadow: var(--shadow-control);
}

.ct-row-d3 {
  padding-left: 24px;
  border-top: 1px solid var(--surface-border);
  border-left: 0;
  background: var(--surface-card);
  box-shadow:
    inset 18px 0 0 var(--surface-raised),
    inset 21px 0 0 var(--surface-border-strong);
}

.ct-row-d3::before {
  left: 21px;
  width: 2px;
  background: var(--surface-border-strong);
}

.ct-row-incomplete::before {
  background: #f59e0b !important;
  opacity: 0.85;
}

.ct-row-incomplete {
  background: #fffbf0 !important;
}

.field-missing {
  border-color: #f59e0b !important;
  box-shadow: 0 0 0 1px rgb(245 158 11 / 22%) !important;
}

.ct-row :deep(.p-inputtext),
.ct-row :deep(.p-inputnumber),
.ct-row :deep(.p-select) {
  width: 100%;
  min-width: 0;
}

.ct-row :deep(.p-inputnumber-input),
.ct-row :deep(.p-select-label) {
  min-width: 0;
  font-size: 13px;
}

.ct-row :deep(.p-inputtext),
.ct-row :deep(.p-inputnumber-input) {
  min-height: 34px;
  padding: 0.42rem 0.65rem;
  font-size: 13px;
}

.ct-row :deep(.p-select-label) {
  padding: 0.42rem 0.65rem;
}

.cost-fx-select {
  min-width: 102px;
}

.cost-fx-select :deep(.p-select-label) {
  overflow: visible;
  text-overflow: clip;
}

.ct-row :deep(.p-textarea) {
  width: 100%;
  white-space: pre-wrap;
}

.ct-num {
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: start;
  min-height: 30px;
}

.ct-num-section {
  gap: 4px;
}

.ct-section-toggle {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  color: var(--accent);
  background: rgb(4 120 87 / 14%);
  cursor: pointer;
  font-size: 9px;
}

.ct-section-toggle:hover {
  background: rgb(4 120 87 / 25%);
}

.ct-num-d3 {
  position: relative;
  justify-content: flex-end;
  padding-right: 3px;
}

.ct-num-d3::before {
  content: '';
  position: absolute;
  left: -1px;
  bottom: 50%;
  width: 18px;
  height: 14px;
  border-left: 2px solid var(--surface-border-strong);
  border-bottom: 2px solid var(--surface-border-strong);
  border-radius: 0 0 0 4px;
}

.ct-num-badge {
  display: inline-grid;
  min-width: 30px;
  height: 20px;
  place-items: center;
  padding: 0 4px;
  border-radius: 5px;
  background: var(--info-soft);
  color: var(--info);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.ct-badge-section {
  min-width: 34px;
  height: 22px;
  background: var(--accent);
  color: #ffffff;
  box-shadow: 0 8px 16px rgb(4 120 87 / 18%);
}

.ct-badge-l2 {
  background: var(--info-soft);
  color: var(--info);
  border: 1px solid rgb(37 99 235 / 18%);
}

.ct-badge-d3 {
  background: var(--surface-raised);
  color: var(--text-subtle);
  border: 1px solid var(--surface-border);
  font-weight: 700;
}

.ct-item {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.ct-item :deep(.p-inputtext) {
  font-size: 13px;
}

.ct-item :deep(.p-textarea) {
  min-height: 24px;
  padding: 0.38rem 0.6rem;
  font-size: 12px;
}

.ct-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 8px;
  color: var(--text-subtle);
  font-size: 11px;
  font-weight: 500;
}

.ct-meta-control {
  display: grid;
  gap: 2px;
  min-width: 120px;
}

.ct-meta-label {
  color: var(--text-subtle);
  font-size: 10px;
  font-weight: 600;
}

.ct-meta-control :deep(.p-select) {
  min-width: 0;
}

.ct-meta-control :deep(.p-select-label) {
  padding: 0.28rem 0.45rem;
  font-size: 11px;
}

.ct-markup {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.ct-hint {
  color: var(--text-subtle);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
}

.ct-amount {
  align-self: center;
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 700;
  text-align: right;
  justify-self: end;
}

.ct-muted {
  align-self: center;
  color: var(--text-subtle);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  justify-self: center;
}

.ct-derived-cost {
  align-self: center;
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  font-style: italic;
}

.ct-actions {
  display: flex;
  align-self: center;
  justify-content: flex-end;
  gap: 0;
}

.ct-actions :deep(.p-button) {
  width: 26px;
  height: 26px;
}

.ct-row-l2 .ct-actions :deep(.p-button:first-child) {
  border: 1px solid var(--surface-border-strong);
  background: var(--surface-card);
  color: var(--info);
}

.child-warning {
  margin: 0;
  padding: 5px 10px;
  background: var(--warning-soft);
  border-top: 1px solid #fed7aa;
  color: var(--warning);
  font-size: 12px;
  font-weight: 600;
}

.card-footer {
  display: flex;
  align-items: center;
  padding: 7px 12px;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-raised);
}

.add-child-button {
  border-color: transparent;
  background: linear-gradient(135deg, var(--accent), #10b981);
  color: #ffffff;
  box-shadow: 0 10px 22px rgb(4 120 87 / 18%);
}

.add-child-button:hover {
  border-color: transparent;
  background: linear-gradient(135deg, var(--accent-hover), var(--accent));
  color: #ffffff;
}

.add-child-button:focus-visible {
  outline-color: var(--focus-ring);
}


@container line-item-card (max-width: 920px) {
  .item-editor-shell {
    grid-template-columns: 1fr;
  }

  .item-metric-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .expected-total-row {
    grid-template-columns: 1fr;
  }
}

@container line-item-card (max-width: 700px) {
  .item-control-grid,
  .item-control-grid-mixed {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .pf,
  .pf-sm,
  .pf-md,
  .pf-lg {
    grid-column: span 3;
  }

  .item-metric-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@container line-item-card (max-width: 520px) {
  .card-header {
    grid-template-columns: auto 32px minmax(0, 1fr);
  }

  .header-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .item-control-grid,
  .item-control-grid-mixed {
    grid-template-columns: 1fr;
  }

  .pf,
  .pf-sm,
  .pf-md,
  .pf-lg {
    grid-column: 1 / -1;
  }

  .item-metric-strip {
    grid-template-columns: 1fr;
  }
}
</style>
