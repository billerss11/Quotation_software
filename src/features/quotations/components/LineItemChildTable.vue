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
const VIRTUAL_CHILD_ROW_ESTIMATE_PX = 240
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
    useAnimationFrameWithResizeObserver: true,
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
      <div class="ct-head">
        <strong>{{ t('itemWorkspace.childItems') }}</strong>
        <span>{{ t('itemWorkspace.childItemsHint') }}</span>
      </div>
      <div ref="virtualScroll" :class="shouldVirtualize ? 'ct-virtual-scroll' : 'ct-row-list'">
        <div :class="shouldVirtualize ? 'ct-virtual-spacer' : 'ct-row-list-inner'" :style="virtualSpacerStyle">
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
            <div class="ct-identity">
              <span
                class="ct-num"
                :class="{
                'ct-num-l2': row.depth === 2 && !props.isGroupItem(row.item),
                'ct-num-d3': row.depth === 3,
                'ct-num-section': props.isGroupItem(row.item),
                }"
                >
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
                <span
                  class="ct-num-badge"
                  :class="{
                  'ct-badge-l2': row.depth === 2 && !props.isGroupItem(row.item),
                  'ct-badge-section': props.isGroupItem(row.item),
                  'ct-badge-d3': row.depth === 3,
                  }"
                  >
                  {{ row.itemNumber }}
                </span>
              </span>
              <div class="ct-item">
                <InputText
                  :class="{ 'field-missing': !props.getTextFieldValue(row.item, 'name').trim() }"
                  :data-history-target="`item:${row.item.id}:name`"
                  :model-value="props.getTextFieldValue(row.item, 'name')"
                  :aria-label="t('quotations.lineItems.lineItemNameAria', { itemNumber: row.itemNumber })"
                  :placeholder="t('quotations.lineItems.namePlaceholder')"
                  @update:model-value="emit('setText', row.item.id, 'name', $event)"
                  @blur="emit('flushField', row.item.id, 'name')"
                  />
                <LineItemDescriptionField
                  :model-value="props.getTextFieldValue(row.item, 'description')"
                  :history-target="`item:${row.item.id}:description`"
                  :item-number="row.itemNumber"
                  :input-aria-label="t('quotations.lineItems.lineItemDescriptionAria', { itemNumber: row.itemNumber })"
                  :placeholder="t('quotations.lineItems.descriptionPlaceholder')"
                  @update:model-value="emit('setText', row.item.id, 'description', $event)"
                  @blur="emit('flushField', row.item.id, 'description')"
                  />
              </div>
              <span class="ct-actions">
                <Button
                  v-tooltip.top="t('quotations.lineItems.calculationExplanation.open')"
                  data-calculation-explanation-action="child"
                  :data-calculation-explanation-item-id="row.item.id"
                  :data-item-id="row.item.id"
                  :data-item-number="row.itemNumber"
                  icon="pi pi-info-circle"
                  severity="secondary"
                  text
                  rounded
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

            <div class="ct-controls">
              <label class="ct-field ct-quantity">
                <span class="ct-field-label">{{ t('quotations.lineItems.quantity') }}</span>
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
              </label>
              <label class="ct-field ct-unit">
                <span class="ct-field-label">{{ t('quotations.lineItems.unit') }}</span>
                <InputText
                  :class="{ 'field-missing': !props.getTextFieldValue(row.item, 'quantityUnit').trim() }"
                  :data-history-target="`item:${row.item.id}:quantityUnit`"
                  :model-value="props.getTextFieldValue(row.item, 'quantityUnit')"
                  :aria-label="t('quotations.lineItems.lineItemUnitAria', { itemNumber: row.itemNumber })"
                  @update:model-value="emit('setText', row.item.id, 'quantityUnit', $event)"
                  @blur="emit('flushField', row.item.id, 'quantityUnit')"
                  />
              </label>
              <label v-if="props.shouldShowPricingMethodSelector(row.item)" class="ct-field ct-pricing-basis">
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
              </label>
              <div v-if="props.shouldShowDetailedCostControls(row.item)" class="ct-cost-fields">
                <label class="ct-field">
                  <span class="ct-field-label">{{ t('quotations.lineItems.unitCost') }}</span>
                  <InputNumber
                    :class="{ 'field-missing': !(props.getNumberFieldValue(row.item, 'unitCost') > 0) }"
                    :data-history-target="`item:${row.item.id}:unitCost`"
                    :model-value="props.getNumberFieldValue(row.item, 'unitCost')"
                    :locale="props.currentLocale"
                    :aria-label="t('quotations.lineItems.lineItemUnitCostAria', { itemNumber: row.itemNumber })"
                    @update:model-value="emit('setNumber', row.item.id, 'unitCost', $event)"
                    @blur="emit('flushField', row.item.id, 'unitCost')"
                    />
                </label>
                <label class="ct-field">
                  <span class="ct-field-label">{{ t('quotations.lineItems.costFx') }}</span>
                  <Select
                    :model-value="row.item.costCurrency"
                    :data-history-target="`item:${row.item.id}:costCurrency`"
                    :options="props.costCurrencyOptions"
                    filter
                    class="cost-fx-select"
                    :aria-label="t('quotations.lineItems.lineItemCostFxAria', { itemNumber: row.itemNumber })"
                    @update:model-value="emit('setCurrency', row.item.id, $event)"
                    />
                </label>
              </div>
              <label v-if="props.shouldShowManualPriceControls(row.item)" class="ct-field ct-manual-price">
                <span class="ct-field-label">{{ t('quotations.lineItems.childHeaders.unitPrice') }}</span>
                <InputNumber
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
              </label>
              <div v-if="props.shouldShowMarkupEditor(row.item)" class="ct-field ct-markup">
                <template v-if="props.shouldShowMarkupEditor(row.item)">
                  <span class="ct-field-label">{{ t('quotations.lineItems.childHeaders.markup') }}</span>
                  <span class="ct-markup-input-row">
                    <InputNumber
                      :data-history-target="`item:${row.item.id}:markupRate`"
                      :model-value="props.getOptionalNumberFieldValue(row.item, 'markupRate')"
                      :placeholder="t('quotations.lineItems.markupInheritPlaceholder')"
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
                  </span>
                  <span class="ct-hint-row">
                    <small class="ct-hint">{{ props.getMarkupLabel(row.item) }}</small>
                    <span
                      v-if="props.getMarkupTooltipLabel(row.item)"
                      v-tooltip.top="props.getMarkupTooltipLabel(row.item)"
                      class="ct-help"
                      tabindex="0"
                      :aria-label="props.getMarkupTooltipLabel(row.item)"
                      >
                      <i class="pi pi-question-circle" aria-hidden="true" />
                    </span>
                  </span>
                  <small v-if="props.getMarkupUsageLabel(row.item)" class="ct-hint ct-hint-usage">
                    {{ props.getMarkupUsageLabel(row.item) }}
                  </small>
                </template>
                <span v-else class="ct-muted">--</span>
              </div>
              <label v-if="props.isMixedTaxMode" class="ct-field ct-tax">
                <span class="ct-field-label">{{ t('quotations.lineItems.taxClass') }}</span>
                <Select
                  :data-history-target="`item:${row.item.id}:taxClassId`"
                  :model-value="props.getTaxClassValue(row.item)"
                  :options="props.getTaxClassOptions(row.inheritedTaxClassId)"
                  option-label="label"
                  option-value="value"
                  :aria-label="t('quotations.lineItems.lineItemTaxClassAria', { itemNumber: row.itemNumber })"
                  @update:model-value="emit('setTaxClass', row.item.id, $event)"
                  />
                <small class="ct-hint">{{ props.getUnitTaxSummaryLabel(row.item) }}</small>
              </label>
            </div>

            <div class="ct-results">
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
              <span v-if="props.isGroupItem(row.item)" class="ct-result">
                <span>{{ t('quotations.lineItems.unitCost') }}</span>
                <strong class="ct-derived-cost">{{ formatCurrency(calculateQuotationItemSectionUnitCost(row.item, props.exchangeRates), props.currency, props.currentLocale) }}</strong>
              </span>
              <span v-if="!props.shouldShowManualPriceControls(row.item)" class="ct-result">
                <span>{{ t('quotations.lineItems.childHeaders.unitPrice') }}</span>
                <strong class="ct-amount">{{ formatCurrency(props.getUnitSellingPrice(row.item), props.currency, props.currentLocale) }}</strong>
              </span>
              <span class="ct-result">
                <span>{{ t('quotations.lineItems.childHeaders.amount') }}</span>
                <strong class="ct-amount">{{ formatCurrency(props.getSellingAmount(row.item), props.currency, props.currentLocale) }}</strong>
              </span>
              <div v-if="props.showAmountWithTax" class="ct-result ct-amount-detail">
                <span>{{ t('quotations.lineItems.childHeaders.amountWithTax') }}</span>
                <strong class="ct-amount">{{ formatCurrency(props.getAmountWithTax(row.item), props.currency, props.currentLocale) }}</strong>
                <small v-if="props.isMixedTaxMode && props.shouldShowTaxSummary(row.item)" class="ct-hint ct-amount-hint">{{ props.getTotalTaxSummaryLabel(row.item) }}</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p v-for="row in props.warningRows" :key="`warn-${row.item.id}`" class="child-warning">
        {{ row.itemNumber }}: {{ props.getMismatchMessage(row.item) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.child-table-wrap {
  min-width: 0;
  padding: 0 16px;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-card);
}

.child-table {
  display: grid;
  min-width: 0;
}

.ct-head {
  position: sticky;
  top: var(--line-items-child-header-top, 54px);
  z-index: 7;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-card);
  color: var(--text-muted);
  font-size: 12px;
}

.ct-head strong {
  color: var(--text-body);
  font-weight: 600;
}

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
  gap: 14px;
  min-width: 0;
  padding: 16px 0;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-card);
  scroll-margin-top: calc(var(--line-items-child-header-top, 54px) + 64px);
}

.ct-row:last-child {
  border-bottom: 0;
}

.ct-identity {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr) auto;
  align-items: start;
  gap: 10px;
}

.ct-row-d3 {
  padding-left: 18px;
}

.ct-row-d3::before {
  position: absolute;
  left: 3px;
  top: 16px;
  bottom: 16px;
  width: 1px;
  content: '';
  background: var(--surface-border-strong);
}

.ct-row-incomplete::before {
  position: absolute;
  left: -8px;
  top: 16px;
  bottom: 16px;
  width: 2px;
  content: '';
  background: var(--warning);
}

.ct-num {
  display: flex;
  align-items: center;
  gap: 3px;
  min-height: 34px;
}

.ct-num-badge {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ct-section-toggle {
  display: inline-grid;
  place-items: center;
  flex: 0 0 22px;
  width: 22px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
  font-size: 10px;
}

.ct-section-toggle:hover {
  background: var(--surface-hover);
}

.ct-item {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.ct-item > :deep(.p-inputtext) {
  border-color: transparent;
  font-weight: 600;
}

.ct-item > :deep(.p-inputtext:hover) {
  border-color: var(--surface-border);
}

.ct-controls {
  display: grid;
  grid-template-columns: minmax(76px, 0.65fr) minmax(80px, 0.65fr) minmax(180px, 1.2fr) minmax(255px, 2fr) minmax(145px, 1.2fr);
  align-items: start;
  gap: 12px;
  min-width: 0;
}

.ct-field {
  display: grid;
  align-content: start;
  gap: 6px;
  min-width: 0;
}

.ct-field-label {
  color: var(--text-body);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}

.ct-cost-fields {
  display: grid;
  grid-template-columns: minmax(130px, 1fr) 105px;
  gap: 8px;
  min-width: 0;
}

.ct-tax {
  grid-column: 3 / 5;
  max-width: 280px;
}

.ct-row :deep(.p-inputtext),
.ct-row :deep(.p-inputnumber),
.ct-row :deep(.p-select) {
  width: 100%;
  min-width: 0;
}

.ct-row :deep(.p-inputtext),
.ct-row :deep(.p-inputnumber-input) {
  min-height: 34px;
  padding: 0.4rem 0.55rem;
  font-size: 13px;
  font-weight: 500;
  background: var(--surface-card);
}

.ct-row :deep(.p-select-label) {
  min-width: 0;
  padding: 0.4rem 0.55rem;
  font-size: 13px;
}

.ct-row :deep(.p-select) {
  min-height: 34px;
  background: var(--surface-card);
}

.ct-row :deep(.description-field-textarea) {
  min-height: 36px;
  max-height: 96px;
  background: var(--surface-card);
  font-size: 12px;
}

.field-missing {
  border-color: var(--warning) !important;
  box-shadow: 0 0 0 1px var(--warning-border) !important;
}

.ct-markup-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ct-markup-input-row :deep(.p-inputnumber) {
  flex: 1;
}

.ct-markup-input-row :deep(.p-button) {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
}

.ct-hint-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ct-hint {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.ct-help {
  display: inline-flex;
  color: var(--text-subtle);
  cursor: help;
  font-size: 12px;
}

.ct-help:focus-visible,
.ct-section-toggle:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.ct-results {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  justify-content: flex-end;
  gap: 10px 24px;
  padding-top: 10px;
  border-top: 1px solid var(--surface-border);
}

.ct-meta {
  display: flex;
  flex: 1 1 220px;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
}

.ct-result {
  display: grid;
  gap: 4px;
  min-width: 0;
  color: var(--text-muted);
  font-size: 11px;
  text-align: right;
}

.ct-result > span {
  line-height: 1.4;
}

.ct-amount,
.ct-derived-cost {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.ct-amount-detail .ct-amount {
  color: var(--accent);
}

.ct-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.ct-actions :deep(.p-button) {
  width: 28px;
  height: 28px;
}

.ct-muted {
  color: var(--text-subtle);
  font-size: 12px;
}

.child-warning {
  margin: 0;
  padding: 10px 0;
  color: var(--warning);
  font-size: 12px;
}

@container line-item-card (max-width: 1050px) {
  .ct-controls {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .ct-quantity,
  .ct-unit {
    grid-column: span 1;
  }

  .ct-pricing-basis,
  .ct-markup,
  .ct-manual-price,
  .ct-tax {
    grid-column: span 2;
    max-width: none;
  }

  .ct-cost-fields {
    grid-column: span 4;
  }
}

@container line-item-card (max-width: 620px) {
  .child-table-wrap {
    padding-inline: 12px;
  }

  .ct-identity {
    grid-template-columns: 46px minmax(0, 1fr);
    gap: 6px;
  }

  .ct-actions {
    grid-column: 2;
    justify-content: flex-end;
  }

  .ct-controls {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ct-pricing-basis,
  .ct-markup,
  .ct-manual-price,
  .ct-tax {
    grid-column: span 1;
  }

  .ct-cost-fields {
    grid-column: 1 / -1;
  }

  .ct-row-d3 {
    padding-left: 10px;
  }

  .ct-results {
    gap: 12px 16px;
  }

  .ct-meta {
    flex-basis: 100%;
  }
}
</style>
