<script setup lang="ts">
import Button from 'primevue/button'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import CalculationSheetDialog from './CalculationSheetDialog.vue'
import LineItemCardHeader from './LineItemCardHeader.vue'
import LineItemChildTable from './LineItemChildTable.vue'
import LineItemRootEditor from './LineItemRootEditor.vue'
import LineItemSummaryMetrics from './LineItemSummaryMetrics.vue'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency } from '@/shared/utils/formatters'

import { useLineItemCardFields } from '../composables/useLineItemCardFields'
import { useLineItemCardPricing } from '../composables/useLineItemCardPricing'
import {
  calculateUnitSummaryAmount,
  useLineItemCardSummary,
} from '../composables/useLineItemCardSummary'
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
import { buildChildRows } from '../utils/lineItemChildRows'
import { getQuotationMarkupCopy } from '../utils/quotationMarkupCopy'
import { createInheritedMarkupContext } from '../utils/quotationItemPricing'
import { countIncompleteQuotationItems, isQuotationItemIncomplete } from '../utils/quotationItemCompleteness'
import { createCalculationTotalsConfig, formatTaxRatePercentage } from '../utils/quotationTaxes'

const props = defineProps<{
  item: QuotationItem
  itemIndex: number
  displayIndex?: number
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
const displayItemIndex = computed(() => props.displayIndex ?? props.itemIndex)
const displayItemNumber = computed(() => displayItemIndex.value + 1)
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
const rootItemNumber = computed(() => String(displayItemNumber.value))
const isMixedTaxMode = computed(() => props.totalsConfig.taxMode === 'mixed')
const showAmountWithTax = computed(() => {
  if (isMixedTaxMode.value) return true
  const defaultClass = (props.totalsConfig.taxClasses ?? []).find(
    (tc) => tc.id === props.totalsConfig.defaultTaxClassId,
  ) ?? (props.totalsConfig.taxClasses ?? [])[0]
  return !!(defaultClass && defaultClass.rate > 0)
})
const calculationTotalsConfig = computed(() => createCalculationTotalsConfig(props.totalsConfig))
const summary = computed(() =>
  calculateMajorItemSummary(props.item, calculationTotalsConfig.value, props.exchangeRates),
)
const {
  rootPricingDisplay,
  amountMismatchByItemId,
  getPricing,
} = useLineItemCardPricing({
  item: () => props.item,
  expanded: () => props.expanded,
  rootItemNumber: () => rootItemNumber.value,
  globalMarkupRate: () => props.globalMarkupRate,
  exchangeRates: () => props.exchangeRates,
  totalsConfig: () => calculationTotalsConfig.value,
})
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
const collapsedSectionIds = shallowRef(new Set<string>())
const isCalculationSheetVisible = shallowRef(false)
const {
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
} = useLineItemCardFields({
  updateItemField: (itemId, field, value) => emit('updateItemField', itemId, field, value),
  setItemPricingMethod: (itemId, pricingMethod) => emit('setItemPricingMethod', itemId, pricingMethod),
})
const {
  summaryMode,
  summaryModeOptions,
  activeSummaryMetrics,
  setSummaryMode,
  shouldShowTaxSummary,
} = useLineItemCardSummary({
  item: () => props.item,
  currency: () => props.currency,
  currentLocale: () => currentLocale.value,
  summary: () => summary.value,
  rootPricingDisplay: () => rootPricingDisplay.value,
  showAmountWithTax: () => showAmountWithTax.value,
  getTaxAmount,
  getAmountWithTax,
  translate: (key) => t(key),
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

function openCalculationSheet() {
  isCalculationSheetVisible.value = true
}

function getMarkupLabel(item: QuotationItem) {
  const pricing = getPricing(item.id)

  if (!pricing) {
    return ''
  }

  const markupCopy = getQuotationMarkupCopy(item, pricing)
  const helperArgs = { ...markupCopy.helperArgs }

  if (typeof helperArgs.amount === 'number') {
    helperArgs.amount = formatCurrency(helperArgs.amount, props.currency, currentLocale.value)
  }

  return t(markupCopy.helperKey, helperArgs)
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

function getUnitTaxSummaryLabel(item: QuotationItem) {
  const pricing = getPricing(item.id)

  if (!pricing) {
    return ''
  }

  const taxRate = pricing.effectiveTaxRate ?? pricing.taxRate

  if (taxRate === null) {
    return ''
  }

  return t('quotations.lineItems.unitTaxSummary', {
    amount: formatCurrency(calculateUnitSummaryAmount(pricing.taxAmount, item.quantity), props.currency, currentLocale.value),
    unit: item.quantityUnit.trim() || '-',
    separator: '@',
    rate: formatTaxRatePercentage(taxRate),
  })
}

function getTotalTaxSummaryLabel(item: QuotationItem) {
  const pricing = getPricing(item.id)

  if (!pricing) {
    return ''
  }

  const taxRate = pricing.effectiveTaxRate ?? pricing.taxRate

  if (taxRate === null) {
    return ''
  }

  return t('quotations.lineItems.totalTaxSummary', {
    amount: formatCurrency(pricing.taxAmount, props.currency, currentLocale.value),
    rate: formatTaxRatePercentage(taxRate),
  })
}

function getAmountWithTax(item: QuotationItem) {
  return getPricing(item.id)?.totalWithTax ?? 0
}

function getTaxAmount(item: QuotationItem) {
  return getPricing(item.id)?.taxAmount ?? 0
}

function isItemIncomplete(item: QuotationItem): boolean {
  return isQuotationItemIncomplete(item, isQuickEntryMode.value)
}

function countIncompleteItems(item: QuotationItem): number {
  return countIncompleteQuotationItems([item], isQuickEntryMode.value)
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
    <LineItemCardHeader
      :item="props.item"
      :item-index="props.itemIndex"
      :total-items="props.totalItems"
      :display-item-number="displayItemNumber"
      :expanded="props.expanded"
      :item-name="getTextFieldValue(props.item, 'name')"
      :item-name-missing="!getTextFieldValue(props.item, 'name').trim()"
      :summary-mode="summaryMode"
      :summary-mode-options="summaryModeOptions"
      :summary-metrics="activeSummaryMetrics"
      :collapsed-nested-item-count="collapsedNestedItemCount"
      :collapsed-nested-item-count-label="collapsedNestedItemCountLabel"
      @toggle-expanded="emit('toggleExpanded', props.item.id)"
      @update-item-name="setText(props.item.id, 'name', $event)"
      @flush-item-name="flushBufferedField(props.item.id, 'name')"
      @move-root-item="emit('moveRootItem', props.item.id, $event)"
      @duplicate-root-item="emit('duplicateRootItem', props.item.id)"
      @open-calculation-sheet="openCalculationSheet"
      @remove-item="emit('removeItem', props.item.id)"
      @set-summary-mode="setSummaryMode"
    />

    <div v-show="props.expanded" class="item-card-panel">
      <div class="card-body">
        <LineItemSummaryMetrics
          variant="expanded"
          :summary-mode="summaryMode"
          :summary-mode-options="summaryModeOptions"
          :metrics="activeSummaryMetrics"
          :summary-mode-aria-label="t('quotations.lineItems.summaryModeAria')"
          @set-summary-mode="setSummaryMode"
        />
        <LineItemRootEditor
          :display-item-number="displayItemNumber"
          :currency="props.currency"
          :current-locale="currentLocale"
          :cost-currency="props.item.costCurrency"
          :cost-currency-options="props.costCurrencyOptions"
          :pricing-method-options="pricingMethodOptions"
          :tax-class-options="getTaxClassOptions()"
          :is-group-item="isGroupItem(props.item)"
          :is-mixed-tax-mode="isMixedTaxMode"
          :show-pricing-method-selector="shouldShowPricingMethodSelector(props.item)"
          :show-manual-price-controls="shouldShowManualPriceControls(props.item)"
          :show-detailed-cost-controls="shouldShowDetailedCostControls(props.item)"
          :show-markup-editor="shouldShowMarkupEditor(props.item)"
          :show-expected-total="shouldShowExpectedTotal(props.item)"
          :quantity-value="getNumberFieldValue(props.item, 'quantity')"
          :quantity-unit-value="getTextFieldValue(props.item, 'quantityUnit')"
          :pricing-method-value="getPricingMethodValue(props.item)"
          :manual-unit-price-value="getNumberFieldValue(props.item, 'manualUnitPrice')"
          :unit-cost-value="getNumberFieldValue(props.item, 'unitCost')"
          :markup-rate-value="getOptionalNumberFieldValue(props.item, 'markupRate')"
          :tax-class-value="getTaxClassValue(props.item)"
          :description-value="getTextFieldValue(props.item, 'description')"
          :expected-total-value="getOptionalNumberFieldValue(props.item, 'expectedTotal')"
          :manual-price-label="getManualPriceLabel()"
          :manual-unit-price-aria-label="getItemManualUnitPriceAriaLabel(displayItemNumber)"
          :pricing-method-aria-label="getItemPricingMethodAriaLabel(displayItemNumber)"
          :markup-field-label="getMarkupFieldLabel(props.item)"
          :markup-label="getMarkupLabel(props.item)"
          :markup-aria-label="getMarkupAriaLabel(props.item, displayItemNumber)"
          :unit-tax-summary-label="getUnitTaxSummaryLabel(props.item)"
          :mismatch-message="getMismatchMessage(props.item)"
          @set-text="(field, value) => setText(props.item.id, field, value)"
          @set-number="(field, value) => setNumber(props.item.id, field, value)"
          @set-optional-number="(field, value) => setOptionalNumber(props.item.id, field, value)"
          @set-pricing-method="setPricingMethod(props.item.id, $event)"
          @set-currency="setCurrency(props.item.id, $event)"
          @set-tax-class="setTaxClass(props.item.id, $event)"
          @flush-field="flushBufferedField(props.item.id, $event)"
        />
      </div>

      <LineItemChildTable
        v-if="props.item.children.length > 0"
        :rows="getVisibleChildRows()"
        :warning-rows="childRows.filter((entry) => getMismatchMessage(entry.item))"
        :currency="props.currency"
        :current-locale="currentLocale"
        :exchange-rates="props.exchangeRates"
        :cost-currency-options="props.costCurrencyOptions"
        :pricing-method-options="pricingMethodOptions"
        :tax-mode="props.totalsConfig.taxMode ?? 'single'"
        :is-mixed-tax-mode="isMixedTaxMode"
        :show-amount-with-tax="showAmountWithTax"
        :is-group-item="isGroupItem"
        :is-section-expanded="isSectionExpanded"
        :is-item-incomplete="isItemIncomplete"
        :should-show-pricing-method-selector="shouldShowPricingMethodSelector"
        :should-show-detailed-cost-controls="shouldShowDetailedCostControls"
        :should-show-markup-editor="shouldShowMarkupEditor"
        :should-show-manual-price-controls="shouldShowManualPriceControls"
        :should-show-tax-summary="shouldShowTaxSummary"
        :get-text-field-value="getTextFieldValue"
        :get-number-field-value="getNumberFieldValue"
        :get-optional-number-field-value="getOptionalNumberFieldValue"
        :get-pricing-method-value="getPricingMethodValue"
        :get-pricing="getPricing"
        :get-markup-label="getMarkupLabel"
        :get-line-markup-aria-label="getLineMarkupAriaLabel"
        :get-line-manual-unit-price-aria-label="getLineManualUnitPriceAriaLabel"
        :get-line-pricing-method-aria-label="getLinePricingMethodAriaLabel"
        :get-tax-class-value="getTaxClassValue"
        :get-tax-class-options="getTaxClassOptions"
        :get-unit-tax-summary-label="getUnitTaxSummaryLabel"
        :get-total-tax-summary-label="getTotalTaxSummaryLabel"
        :get-unit-selling-price="getUnitSellingPrice"
        :get-selling-amount="getSellingAmount"
        :get-amount-with-tax="getAmountWithTax"
        :get-mismatch-message="getMismatchMessage"
        @toggle-section="toggleSection"
        @set-text="setText"
        @set-number="setNumber"
        @set-optional-number="setOptionalNumber"
        @set-pricing-method="setPricingMethod"
        @set-currency="setCurrency"
        @set-tax-class="setTaxClass"
        @add-child-item="emit('addChildItem', $event)"
        @remove-item="emit('removeItem', $event)"
        @flush-field="flushBufferedField"
      />

      <footer class="card-footer">
        <Button
          class="add-child-button"
          icon="pi pi-plus"
          :label="t('quotations.lineItems.addChildItem')"
          size="small"
          :aria-label="t('quotations.lineItems.addChildItemAria', { index: displayItemNumber })"
          @click="emit('addChildItem', props.item.id)"
        />
      </footer>
    </div>
  </article>

  <CalculationSheetDialog
    :visible="isCalculationSheetVisible"
    :item="props.item"
    :item-number="rootItemNumber"
    :currency="props.currency"
    :global-markup-rate="props.globalMarkupRate"
    :totals-config="calculationTotalsConfig"
    :exchange-rates="props.exchangeRates"
    @update:visible="isCalculationSheetVisible = $event"
  />
</template>

<style scoped>
.item-card {
  display: grid;
  min-width: 0;
  border: 1px solid var(--surface-border);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
  container: line-item-card / inline-size;
  overflow: hidden;
  scroll-margin-top: 160px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.item-card:hover {
  border-color: var(--accent-soft);
  box-shadow:
    0 0 0 1px var(--accent-soft),
    0 10px 22px rgb(15 23 42 / 8%);
}

.item-card-focused {
  border-color: var(--accent);
  border-left-color: var(--accent);
  box-shadow:
    0 0 0 2px var(--accent-ring),
    var(--shadow-soft);
  animation: item-focus-pulse 1.4s ease-out;
}

.item-card-incomplete {
  border-left-color: #f59e0b;
  border-left-width: 3px;
}

@keyframes item-focus-pulse {
  0% {
    box-shadow:
      0 0 0 0 var(--accent-ring),
      var(--shadow-card);
  }

  40% {
    box-shadow:
      0 0 0 6px rgb(4 120 87 / 8%),
      var(--shadow-card);
  }

  100% {
    box-shadow:
      0 0 0 2px var(--accent-ring),
      var(--shadow-card);
  }
}

@media (prefers-reduced-motion: reduce) {
  .item-card-focused {
    animation: none;
  }
}

.item-card-panel {
  min-width: 0;
  transition: background-color 0.18s ease;
}

.card-body {
  display: grid;
  gap: 8px;
  padding: 10px 14px;
  transition: background-color 0.18s ease;
}

.item-card:hover :deep(.card-header),
.item-card:hover .item-card-panel,
.item-card:hover .card-body {
  background: #dff4ea;
}

.item-card-focused :deep(.card-header),
.item-card-focused .item-card-panel,
.item-card-focused .card-body {
  background: #c6ead8;
}

.card-footer {
  display: flex;
  align-items: center;
  padding: 8px 14px;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-raised);
}

.add-child-button {
  border-color: var(--accent-soft);
  background: var(--surface-card);
  color: var(--accent);
}

.add-child-button:hover {
  border-color: var(--accent);
  background: var(--accent-surface);
  color: var(--accent-hover);
}

.add-child-button:focus-visible {
  outline-color: var(--focus-ring);
}


</style>
