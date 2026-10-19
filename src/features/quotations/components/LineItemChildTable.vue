<script setup lang="ts">
import { useVirtualizer, type Rect, type VirtualItem, type Virtualizer } from '@tanstack/vue-virtual'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, useTemplateRef, type ComponentPublicInstance, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency, formatPercent } from '@/shared/utils/formatters'

import type { ChildRow } from '../utils/lineItemChildRows'
import { calculateCostSalesPercentage } from '../utils/quotationCalculations'
import LineItemDescriptionField from './LineItemDescriptionField.vue'
import {
  calculateQuotationItemSectionUnitCost,
  type QuotationItemPricingDisplay,
} from '../utils/quotationItemPricing'
import type {
  CurrencyCode,
  ExchangeRateTable,
  PricingMethod,
  QuotationItem,
  QuotationItemField,
} from '../types'

type SelectOption<T extends string = string> = {
  label: string
  value: T
}

type RenderedChildRow = {
  row: ChildRow
  key: string | number
  virtualRow: VirtualItem | null
}

const VIRTUAL_CHILD_ROW_THRESHOLD = 24
const VIRTUAL_CHILD_ROW_ESTIMATE_PX = 88
const VIRTUAL_CHILD_TABLE_HEIGHT_PX = 640
const VIRTUAL_CHILD_ROW_OVERSCAN = 7

const props = defineProps<{
  rows: ChildRow[]
  warningRows: ChildRow[]
  currency: CurrencyCode
  currentLocale: SupportedLocale
  exchangeRates: ExchangeRateTable
  costCurrencyOptions: string[]
  pricingMethodOptions: Array<SelectOption<PricingMethod>>
  taxMode: string
  isMixedTaxMode: boolean
  showAmountWithTax: boolean
  isGroupItem: (item: QuotationItem) => boolean
  isSectionExpanded: (itemId: string) => boolean
  isItemIncomplete: (item: QuotationItem) => boolean
  shouldShowPricingMethodSelector: (item: QuotationItem) => boolean
  shouldShowDetailedCostControls: (item: QuotationItem) => boolean
  shouldShowMarkupEditor: (item: QuotationItem) => boolean
  shouldShowManualPriceControls: (item: QuotationItem) => boolean
  shouldShowTaxSummary: (item: QuotationItem) => boolean
  getTextFieldValue: (item: QuotationItem, field: QuotationItemField) => string
  getNumberFieldValue: (item: QuotationItem, field: QuotationItemField, fallback?: number) => number
  getOptionalNumberFieldValue: (
    item: QuotationItem,
    field: QuotationItemField,
  ) => number | null | undefined
  getPricingMethodValue: (item: QuotationItem) => PricingMethod
  getPricing: (itemId: string) => QuotationItemPricingDisplay | undefined
  getMarkupLabel: (item: QuotationItem) => string
  getMarkupUsageLabel: (item: QuotationItem) => string
  getMarkupTooltipLabel: (item: QuotationItem) => string
  getLineMarkupAriaLabel: (item: QuotationItem, itemNumber: string) => string
  getLineManualUnitPriceAriaLabel: (itemNumber: string) => string
  getLinePricingMethodAriaLabel: (itemNumber: string) => string
  getTaxClassValue: (item: QuotationItem) => string
  getTaxClassOptions: (inheritedTaxClassId?: string) => SelectOption[]
  getUnitTaxSummaryLabel: (item: QuotationItem) => string
  getTotalTaxSummaryLabel: (item: QuotationItem) => string
  getUnitSellingPrice: (item: QuotationItem) => number
  getSellingAmount: (item: QuotationItem) => number
  getAmountWithTax: (item: QuotationItem) => number
  getMismatchMessage: (item: QuotationItem) => string
}>()

const emit = defineEmits<{
  toggleSection: [itemId: string]
  setText: [itemId: string, field: QuotationItemField, value: unknown]
  setNumber: [itemId: string, field: QuotationItemField, value: unknown]
  setOptionalNumber: [itemId: string, field: QuotationItemField, value: unknown]
  setPricingMethod: [itemId: string, value: unknown]
  setCurrency: [itemId: string, value: unknown]
  setTaxClass: [itemId: string, value: unknown]
  addChildItem: [itemId: string]
  openCalculationExplanation: [itemId: string, itemNumber: string]
  removeItem: [itemId: string]
  flushField: [itemId: string, field: QuotationItemField]
  requestGoalSeek: [itemId: string]
}>()

const { t } = useI18n()

const virtualScrollRef = useTemplateRef<HTMLDivElement>('virtualScroll')
const shouldVirtualize = computed(() => props.rows.length > VIRTUAL_CHILD_ROW_THRESHOLD)
const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>(
  computed(() => ({
    count: shouldVirtualize.value ? props.rows.length : 0,
    getScrollElement: () => virtualScrollRef.value,
    estimateSize: () => VIRTUAL_CHILD_ROW_ESTIMATE_PX,
    getItemKey: (index) => props.rows[index]?.item.id ?? index,
    gap: 4,
    initialRect: { width: 0, height: VIRTUAL_CHILD_TABLE_HEIGHT_PX },
    measureElement: (element) => {
      const height = element.getBoundingClientRect().height || element.offsetHeight
      return height > 0 ? height : VIRTUAL_CHILD_ROW_ESTIMATE_PX
    },
    observeElementRect: observeVirtualScrollRect,
    overscan: VIRTUAL_CHILD_ROW_OVERSCAN,
  })),
)

const renderedRows = computed<RenderedChildRow[]>(() => {
  if (!shouldVirtualize.value) {
    return props.rows.map((row) => ({
      row,
      key: row.item.id,
      virtualRow: null,
    }))
  }

  const entries: RenderedChildRow[] = []

  for (const virtualRow of rowVirtualizer.value.getVirtualItems()) {
    const row = props.rows[virtualRow.index]

    if (row) {
      entries.push({
        row,
        key: row.item.id,
        virtualRow,
      })
    }
  }

  return entries
})

const virtualSpacerStyle = computed(() =>
  shouldVirtualize.value
    ? { height: `${rowVirtualizer.value.getTotalSize()}px` }
    : undefined,
)

function formatCostSalesPercentage(itemId: string) {
  const pricing = props.getPricing(itemId)

  if (!pricing) {
    return t('common.emptyValue')
  }

  const percentage = calculateCostSalesPercentage(pricing.baseAmount, pricing.subtotal)
  return percentage === null ? t('common.emptyValue') : formatPercent(percentage, props.currentLocale)
}

function getMarkupPlaceholder(itemId: string) {
  const rate = props.getPricing(itemId)?.fallbackMarkupRate
  return rate === undefined
    ? t('quotations.lineItems.markupInheritPlaceholder')
    : t('quotations.lineItems.markupInheritedValue', { rate: formatPercent(rate, props.currentLocale) })
}

function getMarkupHelpLabel(item: QuotationItem) {
  return [
    props.getMarkupLabel(item),
    props.getMarkupUsageLabel(item),
    props.getMarkupTooltipLabel(item),
  ].filter(Boolean).join('\n')
}

function getVirtualRowStyle(virtualRow: VirtualItem | null): CSSProperties | undefined {
  if (!virtualRow) {
    return undefined
  }

  return {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    transform: `translateY(${virtualRow.start}px)`,
  }
}

function measureVirtualRow(ref: Element | ComponentPublicInstance | null) {
  if (ref instanceof HTMLDivElement) {
    rowVirtualizer.value.measureElement(ref)
  }
}

function scrollToItemId(itemId: string) {
  if (!shouldVirtualize.value) {
    return
  }

  const rowIndex = props.rows.findIndex((row) => row.item.id === itemId)

  if (rowIndex < 0) {
    return
  }

  rowVirtualizer.value.scrollToIndex(rowIndex, { align: 'center' })
}

function observeVirtualScrollRect(
  instance: Virtualizer<HTMLDivElement, HTMLDivElement>,
  callback: (rect: Rect) => void,
) {
  const element = instance.scrollElement

  if (!element) {
    return
  }

  const updateRect = () => callback(getVirtualScrollRect(element))
  updateRect()

  const ResizeObserverCtor = element.ownerDocument.defaultView?.ResizeObserver

  if (!ResizeObserverCtor) {
    return
  }

  const observer = new ResizeObserverCtor(updateRect)
  observer.observe(element)

  return () => observer.disconnect()
}

function getVirtualScrollRect(element: HTMLElement): Rect {
  const rect = element.getBoundingClientRect()

  return {
    width: Math.round(element.clientWidth || rect.width || 1024),
    height: Math.round(element.clientHeight || rect.height || VIRTUAL_CHILD_TABLE_HEIGHT_PX),
  }
}

defineExpose({
  scrollToItemId,
})
</script>

<template>
  <div class="child-table-wrap">
    <div class="child-table">
      <div
        ref="virtualScroll"
        :class="shouldVirtualize ? 'ct-virtual-scroll' : 'ct-row-list'"
      >
        <div
          :class="shouldVirtualize ? 'ct-virtual-spacer' : 'ct-row-list-inner'"
          :style="virtualSpacerStyle"
        >
          <div
            v-for="{ row, key, virtualRow } in renderedRows"
            :key="key"
            :ref="virtualRow ? measureVirtualRow : undefined"
            class="ct-row"
            :data-index="virtualRow?.index"
            :data-item-id="row.item.id"
            :data-history-target="`item:${row.item.id}`"
            :data-tax-mode="props.taxMode"
            :class="{
              'ct-row-l2': row.depth === 2 && !props.isGroupItem(row.item),
              'ct-row-section': props.isGroupItem(row.item),
              'ct-row-d3': row.depth === 3,
              'ct-row-incomplete': props.isItemIncomplete(row.item),
            }"
            :style="getVirtualRowStyle(virtualRow)"
          >
            <div class="ct-row-header">
              <div class="ct-num">
                <button
                  v-if="props.isGroupItem(row.item) && row.item.children.length > 0"
                  type="button"
                  class="ct-section-toggle"
                  :aria-expanded="props.isSectionExpanded(row.item.id)"
                  :aria-label="props.isSectionExpanded(row.item.id)
                    ? t('quotations.lineItems.collapseItem')
                    : t('quotations.lineItems.expandItem')"
                  @click="emit('toggleSection', row.item.id)"
                >
                  <i :class="props.isSectionExpanded(row.item.id) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
                </button>
                <span class="ct-num-badge">{{ row.itemNumber }}</span>
              </div>
              <InputText
                class="ct-name"
                :class="{ 'field-missing': !props.getTextFieldValue(row.item, 'name').trim() }"
                :data-history-target="`item:${row.item.id}:name`"
                :model-value="props.getTextFieldValue(row.item, 'name')"
                :aria-label="t('quotations.lineItems.lineItemNameAria', { itemNumber: row.itemNumber })"
                :placeholder="t('quotations.lineItems.namePlaceholder')"
                @update:model-value="emit('setText', row.item.id, 'name', $event)"
                @blur="emit('flushField', row.item.id, 'name')"
              />
              <div class="ct-item">
                <LineItemDescriptionField
                  compact
                  :model-value="props.getTextFieldValue(row.item, 'description')"
                  :history-target="`item:${row.item.id}:description`"
                  :item-number="row.itemNumber"
                  :input-aria-label="t('quotations.lineItems.lineItemDescriptionAria', { itemNumber: row.itemNumber })"
                  :placeholder="t('quotations.lineItems.descriptionPlaceholder')"
                  @update:model-value="emit('setText', row.item.id, 'description', $event)"
                  @blur="emit('flushField', row.item.id, 'description')"
                />
              </div>
              <div class="ct-actions">
                <Button
                  v-tooltip.top="t('quotations.lineItems.calculationExplanation.open')"
                  data-calculation-explanation-action="child"
                  :data-calculation-explanation-item-id="row.item.id"
                  :data-item-id="row.item.id"
                  :data-item-number="row.itemNumber"
                  icon="pi pi-info-circle"
                  severity="secondary"
                  text
                  :aria-label="t('quotations.lineItems.calculationExplanation.openAria', { itemNumber: row.itemNumber })"
                  @click="emit('openCalculationExplanation', row.item.id, row.itemNumber)"
                />
                <Button
                  v-if="row.depth < 3"
                  v-tooltip.top="t('quotations.lineItems.addChild')"
                  class="ct-add-child-action"
                  icon="pi pi-plus"
                  severity="secondary"
                  text
                  :aria-label="t('quotations.lineItems.addChildToLineItemAria', { itemNumber: row.itemNumber })"
                  @click="emit('addChildItem', row.item.id)"
                />
                <Button
                  v-tooltip.top="t('quotations.lineItems.delete')"
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  :aria-label="t('quotations.lineItems.deleteLineItemAria', { itemNumber: row.itemNumber })"
                  @click="emit('removeItem', row.item.id)"
                />
              </div>
            </div>

            <div class="ct-controls">
              <div class="ct-field ct-quantity">
                <span class="ct-field-label">{{ t('quotations.lineItems.childHeaders.qty') }}</span>
                <InputNumber
                  :class="{ 'field-missing': !(props.getNumberFieldValue(row.item, 'quantity') > 0) }"
                  :data-history-target="`item:${row.item.id}:quantity`"
                  :model-value="props.getNumberFieldValue(row.item, 'quantity')"
                  :min="0"
                  :max-fraction-digits="2"
                  :aria-label="t('quotations.lineItems.lineItemQuantityAria', { itemNumber: row.itemNumber })"
                  @update:model-value="emit('setNumber', row.item.id, 'quantity', $event)"
                  @blur="emit('flushField', row.item.id, 'quantity')"
                />
              </div>
              <div class="ct-field ct-unit">
                <span class="ct-field-label">{{ t('quotations.lineItems.childHeaders.unit') }}</span>
                <InputText
                  :class="{ 'field-missing': !props.getTextFieldValue(row.item, 'quantityUnit').trim() }"
                  :data-history-target="`item:${row.item.id}:quantityUnit`"
                  :model-value="props.getTextFieldValue(row.item, 'quantityUnit')"
                  :aria-label="t('quotations.lineItems.lineItemUnitAria', { itemNumber: row.itemNumber })"
                  @update:model-value="emit('setText', row.item.id, 'quantityUnit', $event)"
                  @blur="emit('flushField', row.item.id, 'quantityUnit')"
                />
              </div>
              <div v-if="props.shouldShowPricingMethodSelector(row.item)" class="ct-field ct-pricing-basis">
                <span class="ct-field-label">{{ t('quotations.lineItems.pricingBasis') }}</span>
                <Select
                  :data-history-target="`item:${row.item.id}:pricingMethod`"
                  :model-value="props.getPricingMethodValue(row.item)"
                  :options="props.pricingMethodOptions"
                  option-label="label"
                  option-value="value"
                  :aria-label="props.getLinePricingMethodAriaLabel(row.itemNumber)"
                  @update:model-value="emit('setPricingMethod', row.item.id, $event)"
                />
              </div>
              <template v-if="!props.isGroupItem(row.item) && props.shouldShowDetailedCostControls(row.item)">
                <div class="ct-field ct-unit-cost">
                  <span class="ct-field-label">{{ t('quotations.lineItems.childHeaders.unitCost') }}</span>
                  <InputNumber
                    :class="{ 'field-missing': !(props.getNumberFieldValue(row.item, 'unitCost') > 0) }"
                    :data-history-target="`item:${row.item.id}:unitCost`"
                    :model-value="props.getNumberFieldValue(row.item, 'unitCost')"
                    :locale="props.currentLocale"
                    :aria-label="t('quotations.lineItems.lineItemUnitCostAria', { itemNumber: row.itemNumber })"
                    @update:model-value="emit('setNumber', row.item.id, 'unitCost', $event)"
                    @blur="emit('flushField', row.item.id, 'unitCost')"
                  />
                </div>
                <div class="ct-field ct-cost-currency">
                  <span class="ct-field-label">{{ t('quotations.lineItems.childHeaders.costFx') }}</span>
                  <Select
                    :model-value="row.item.costCurrency"
                    :data-history-target="`item:${row.item.id}:costCurrency`"
                    :options="props.costCurrencyOptions"
                    filter
                    class="cost-fx-select"
                    :aria-label="t('quotations.lineItems.lineItemCostFxAria', { itemNumber: row.itemNumber })"
                    @update:model-value="emit('setCurrency', row.item.id, $event)"
                  />
                </div>
              </template>
              <div v-else-if="props.isGroupItem(row.item)" class="ct-field ct-unit-cost">
                <span class="ct-field-label">{{ t('quotations.lineItems.childHeaders.unitCost') }}</span>
                <span class="ct-derived-cost">
                  {{ formatCurrency(calculateQuotationItemSectionUnitCost(row.item, props.exchangeRates), props.currency, props.currentLocale) }}
                </span>
              </div>
              <div v-if="props.shouldShowMarkupEditor(row.item)" class="ct-field ct-markup">
                <span class="ct-field-heading">
                  <span class="ct-field-label">{{ t(props.isGroupItem(row.item)
                    ? 'quotations.lineItems.childMarkupFallback'
                    : 'quotations.lineItems.markupOverride') }}</span>
                  <span
                    v-if="getMarkupHelpLabel(row.item)"
                    v-tooltip.top.focus="getMarkupHelpLabel(row.item)"
                    :title="getMarkupHelpLabel(row.item)"
                    class="ct-help"
                    tabindex="0"
                    :aria-label="getMarkupHelpLabel(row.item)"
                  >
                    <i class="pi pi-question-circle" aria-hidden="true" />
                  </span>
                </span>
                <div class="ct-markup-input-row">
                  <InputNumber
                    :data-history-target="`item:${row.item.id}:markupRate`"
                    :model-value="props.getOptionalNumberFieldValue(row.item, 'markupRate')"
                    :placeholder="getMarkupPlaceholder(row.item.id)"
                    suffix="%"
                    :min="0"
                    :max="1000"
                    :max-fraction-digits="2"
                    :aria-label="props.getLineMarkupAriaLabel(row.item, row.itemNumber)"
                    @update:model-value="emit('setOptionalNumber', row.item.id, 'markupRate', $event)"
                    @blur="emit('flushField', row.item.id, 'markupRate')"
                  />
                  <Button
                    v-if="!props.isGroupItem(row.item) && props.getNumberFieldValue(row.item, 'unitCost') > 0"
                    v-tooltip.top="t('quotations.goalSeek.openItem')"
                    icon="pi pi-bullseye"
                    severity="secondary"
                    text
                    :aria-label="t('quotations.goalSeek.openItemAria', { itemNumber: row.itemNumber })"
                    @click.stop.prevent="emit('requestGoalSeek', row.item.id)"
                  />
                </div>
              </div>
              <div v-if="props.isMixedTaxMode" class="ct-field ct-tax-class">
                <span class="ct-field-heading">
                  <span class="ct-field-label">{{ t('quotations.lineItems.childHeaders.taxClass') }}</span>
                  <span
                    v-if="props.getUnitTaxSummaryLabel(row.item)"
                    v-tooltip.top.focus="props.getUnitTaxSummaryLabel(row.item)"
                    :title="props.getUnitTaxSummaryLabel(row.item)"
                    class="ct-help"
                    tabindex="0"
                    :aria-label="props.getUnitTaxSummaryLabel(row.item)"
                  >
                    <i class="pi pi-question-circle" aria-hidden="true" />
                  </span>
                </span>
                <Select
                  :data-history-target="`item:${row.item.id}:taxClassId`"
                  :model-value="props.getTaxClassValue(row.item)"
                  :options="props.getTaxClassOptions(row.inheritedTaxClassId)"
                  :placeholder="props.getTaxClassOptions(row.inheritedTaxClassId)[0]?.label"
                  option-label="label"
                  option-value="value"
                  :aria-label="t('quotations.lineItems.lineItemTaxClassAria', { itemNumber: row.itemNumber })"
                  @update:model-value="emit('setTaxClass', row.item.id, $event)"
                />
              </div>
            </div>

            <div class="ct-financials">
              <div class="ct-meta">
                <span>
                  {{ t('quotations.lineItems.totalCost') }}:
                  {{ formatCurrency(props.getPricing(row.item.id)?.baseAmount ?? 0, props.currency, props.currentLocale) }}
                </span>
                <span>
                  {{ t('quotations.lineItems.summaryLabels.costSalesPct') }}:
                  {{ formatCostSalesPercentage(row.item.id) }}
                </span>
              </div>
              <div class="ct-results">
                <div class="ct-result ct-unit-price">
                  <span class="ct-field-label">{{ t('quotations.lineItems.childHeaders.unitPrice') }}</span>
                  <InputNumber
                    v-if="props.shouldShowManualPriceControls(row.item)"
                    :class="{ 'field-missing': !(props.getNumberFieldValue(row.item, 'manualUnitPrice') > 0) }"
                    :data-history-target="`item:${row.item.id}:manualUnitPrice`"
                    :model-value="props.getNumberFieldValue(row.item, 'manualUnitPrice')"
                    mode="currency"
                    :currency="props.currency"
                    :locale="props.currentLocale"
                    :aria-label="props.getLineManualUnitPriceAriaLabel(row.itemNumber)"
                    @update:model-value="emit('setNumber', row.item.id, 'manualUnitPrice', $event)"
                    @blur="emit('flushField', row.item.id, 'manualUnitPrice')"
                  />
                  <span v-else class="ct-amount">
                    {{ formatCurrency(props.getUnitSellingPrice(row.item), props.currency, props.currentLocale) }}
                  </span>
                </div>
                <div class="ct-result ct-selling-amount" :class="{ 'ct-result-total': !props.showAmountWithTax }">
                  <span class="ct-field-label">{{ t('quotations.lineItems.childHeaders.amount') }}</span>
                  <span class="ct-amount">
                    {{ formatCurrency(props.getSellingAmount(row.item), props.currency, props.currentLocale) }}
                  </span>
                </div>
                <div v-if="props.showAmountWithTax" class="ct-result ct-result-total ct-amount-detail">
                  <span class="ct-field-label">{{ t('quotations.lineItems.childHeaders.amountWithTax') }}</span>
                  <span class="ct-amount">
                    {{ formatCurrency(props.getAmountWithTax(row.item), props.currency, props.currentLocale) }}
                  </span>
                  <span
                    v-if="props.isMixedTaxMode && props.shouldShowTaxSummary(row.item)"
                    v-tooltip.top.focus="props.getTotalTaxSummaryLabel(row.item)"
                    :title="props.getTotalTaxSummaryLabel(row.item)"
                    class="ct-help"
                    tabindex="0"
                    :aria-label="props.getTotalTaxSummaryLabel(row.item)"
                  >
                    <i class="pi pi-question-circle" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p
        v-for="row in props.warningRows"
        :key="`warn-${row.item.id}`"
        class="child-warning"
      >
        {{ row.itemNumber }}: {{ props.getMismatchMessage(row.item) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.child-table-wrap {
  container: child-worksheet / inline-size;
  min-width: 0;
  padding: 0 12px 6px 22px;
  background: var(--surface-card);
}

.child-table,
.ct-row-list,
.ct-row-list-inner {
  min-width: 0;
}

.child-table,
.ct-row-list-inner {
  display: grid;
  gap: 4px;
}

.ct-virtual-scroll {
  position: relative;
  height: min(640px, calc(100vh - 220px));
  min-height: 320px;
  overflow: auto;
  contain: layout paint;
  scrollbar-gutter: stable;
}

.ct-virtual-spacer {
  position: relative;
  min-height: 100%;
  width: 100%;
}

.ct-row {
  position: relative;
  display: grid;
  min-width: 0;
  gap: 4px;
  padding: 6px 10px;
  border: 0;
  border-bottom: 1px solid var(--surface-border);
  border-left: 2px solid color-mix(in srgb, var(--accent) 26%, var(--surface-border));
  border-radius: 0;
  background: var(--surface-card);
  scroll-margin-top: 160px;
}

.ct-row:focus-within {
  border-left-color: var(--accent);
}

.ct-row-section {
  border-left-color: color-mix(in srgb, var(--accent) 66%, var(--surface-border));
  background: var(--surface-panel);
}

.ct-row-d3 {
  padding-left: 28px;
  border-left-color: transparent;
}

.ct-row-d3::before {
  content: '';
  position: absolute;
  left: 10px;
  top: 0;
  width: 8px;
  height: 28px;
  border-left: 1px solid var(--surface-border-strong);
  border-bottom: 1px solid var(--surface-border-strong);
}

.ct-row-incomplete {
  border-left-color: var(--warning);
}

.ct-row-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 0.55fr) auto;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.ct-num {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--text-muted);
}

.ct-num-badge {
  font-size: 12px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ct-row-section .ct-num-badge {
  color: var(--accent);
}

.ct-section-toggle {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 24px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
  font-size: 10px;
}

.ct-section-toggle:hover {
  color: var(--accent);
  background: var(--accent-surface);
}

.ct-section-toggle:focus-visible,
.ct-help:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.ct-row .ct-name {
  min-height: 32px;
  padding: 0.35rem 0.5rem;
  border-color: transparent;
  background: transparent;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 650;
}

.ct-row .ct-name:hover {
  border-color: var(--surface-border);
}

.ct-row .ct-name:focus {
  border-color: var(--accent);
  background: var(--surface-card);
}

.ct-item {
  min-width: 0;
  max-width: 180px;
}

.ct-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 6px 8px;
  min-width: 0;
}

.ct-field {
  display: grid;
  align-content: start;
  min-width: 0;
  gap: 3px;
}

.ct-quantity {
  flex: 0 1 64px;
}

.ct-unit {
  flex: 0 1 68px;
}

.ct-pricing-basis {
  flex: 0 1 132px;
}

.ct-unit-cost {
  flex: 0 1 122px;
}

.ct-cost-currency {
  flex: 0 1 84px;
}

.ct-markup {
  flex: 1 1 168px;
}

.ct-tax-class {
  flex: 1 1 132px;
  max-width: 260px;
}

.ct-field-heading {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.ct-field-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
  white-space: nowrap;
}

.ct-row :deep(.p-inputtext),
.ct-row :deep(.p-inputnumber),
.ct-row :deep(.p-select) {
  width: 100%;
  min-width: 0;
}

.ct-field :deep(.p-inputtext),
.ct-field :deep(.p-inputnumber-input),
.ct-result :deep(.p-inputnumber-input) {
  min-height: 32px;
  padding: 0.38rem 0.5rem;
  font-size: 12px;
  font-weight: 500;
}

.ct-field :deep(.p-select) {
  min-height: 32px;
}

.ct-field :deep(.p-select-label) {
  min-width: 0;
  padding: 0.38rem 0.5rem;
  font-size: 12px;
  font-weight: 500;
}

.ct-field :deep(.p-select-dropdown) {
  width: 25px;
}

.ct-field :deep(.p-inputnumber-input),
.ct-result :deep(.p-inputnumber-input) {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.ct-row .field-missing,
.ct-row .field-missing :deep(.p-inputnumber-input) {
  border-color: var(--warning);
  background: color-mix(in srgb, var(--warning-soft) 48%, var(--surface-card));
}

.ct-markup-input-row {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  max-width: 240px;
}

.ct-markup-input-row :deep(.p-inputnumber) {
  flex: 1;
}

.ct-markup-input-row :deep(.p-button) {
  flex-shrink: 0;
  width: 28px;
  height: 30px;
}

.ct-derived-cost {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 32px;
  padding: 0.38rem 0;
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 550;
  font-variant-numeric: tabular-nums;
}

.ct-unit-cost > .ct-field-label,
.ct-markup .ct-field-label {
  color: var(--accent-emphasis);
  font-weight: 700;
}

.ct-unit-cost :deep(.p-inputnumber-input),
.ct-markup :deep(.p-inputnumber-input),
.ct-derived-cost {
  border-color: var(--accent-soft) !important;
  background: var(--accent-surface) !important;
  color: var(--accent-emphasis) !important;
  font-size: 13px;
  font-weight: 700;
}

.ct-derived-cost {
  padding-inline: 8px;
  border: 1px solid var(--accent-soft);
  border-radius: 4px;
}

.ct-markup :deep(.p-inputnumber-input::placeholder) {
  color: var(--accent-emphasis) !important;
  opacity: 1;
}

.ct-unit-cost :deep(.field-missing .p-inputnumber-input) {
  border-color: var(--warning) !important;
}

.ct-help {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: var(--text-subtle);
  cursor: help;
}

.ct-help .pi {
  font-size: 10px;
}

.ct-financials {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 3px 16px;
  min-width: 0;
  padding-top: 2px;
}

.ct-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  color: var(--text-subtle);
  font-size: 11px;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
}

.ct-results {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
  gap: 3px 18px;
  min-width: 0;
}

.ct-result {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  gap: 6px;
  text-align: right;
}

.ct-unit-price {
  max-width: none;
}

.ct-unit-price :deep(.p-inputnumber) {
  width: 130px;
}

.ct-amount {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 600;
  line-height: 24px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ct-result-total .ct-amount {
  font-weight: 750;
  color: var(--accent-emphasis);
}

.ct-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1px;
}

.ct-actions :deep(.p-button) {
  width: 28px;
  height: 28px;
  color: var(--text-subtle);
  border-radius: 4px;
  box-shadow: none;
}

/* Keep row actions quiet despite the app-wide secondary-button fill. */
.ct-actions :deep(.p-button.p-button-secondary) {
  border-color: transparent !important;
  background: transparent !important;
  color: var(--text-muted) !important;
}

.ct-actions :deep(.p-button.p-button-secondary:not(:disabled):hover) {
  background: var(--surface-hover) !important;
  color: var(--text-strong) !important;
}

.ct-actions :deep(.p-button:hover) {
  color: var(--text-strong);
  background: var(--surface-muted);
}

.ct-actions :deep(.p-button-danger:hover) {
  color: var(--danger);
  background: var(--danger-soft);
}
.ct-actions :deep(.p-button.p-button-danger) {
  color: var(--danger);
}

.child-warning {
  margin: 0;
  padding: 7px 12px;
  border-left: 2px solid var(--warning);
  background: var(--warning-soft);
  color: var(--warning);
  font-size: 12px;
  line-height: 1.4;
}

@container child-worksheet (max-width: 780px) {
  .ct-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(180px, 1.6fr);
  }

  .ct-tax-class {
    grid-column: auto;
  }
}

@container child-worksheet (max-width: 600px) {
  .ct-controls {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(150px, 1.6fr);
  }

  .ct-financials {
    align-items: flex-start;
  }

  .ct-results {
    flex-basis: 100%;
    gap: 2px 14px;
  }
}

@container child-worksheet (max-width: 380px) {
  .ct-row {
    padding: 8px;
  }

  .ct-row-d3 {
    padding-left: 20px;
  }

  .ct-row-d3::before {
    left: 7px;
    width: 4px;
  }

  .ct-row-header {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 2px 6px;
  }

  .ct-item {
    grid-column: 2;
    grid-row: 2;
    max-width: none;
  }

  .ct-actions {
    grid-column: 3;
    grid-row: 1 / 3;
    align-self: start;
  }
  .ct-controls {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ct-markup {
    grid-column: 1 / -1;
  }
}
</style>
