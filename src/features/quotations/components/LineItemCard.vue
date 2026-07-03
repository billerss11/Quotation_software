<script setup lang="ts">
import Button from 'primevue/button'
import { computed, shallowRef, watch } from 'vue'
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
  MajorItemSummary,
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

const LARGE_NESTED_CHILD_ROW_THRESHOLD = 24

const props = defineProps<{
  item: QuotationItem
  itemIndex: number
  displayIndex?: number
  totalItems: number
  currency: CurrencyCode
  lineItemEntryMode: LineItemEntryMode
  summary?: MajorItemSummary
  globalMarkupRate: number
  totalsConfig: TotalsConfig
  exchangeRates: ExchangeRateTable
  costCurrencyOptions: string[]
  focused?: boolean
  focusedItemId?: string
  focusedItemRequestKey?: number
  expanded: boolean
  incompleteCount?: number
  expandAllRequestKey?: number
  collapseAllRequestKey?: number
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
  props.summary ?? calculateMajorItemSummary(props.item, calculationTotalsConfig.value, props.exchangeRates),
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
  props.expanded
    ? buildChildRows(
        props.item.children,
        rootItemNumber.value,
        createInheritedMarkupContext(props.item, rootItemNumber.value),
        props.item.taxClassId,
        props.item.id,
      )
    : [],
)
const collapsedNestedItemCount = computed(() => countDescendantItems(props.item.children))
const collapsedNestedItemCountLabel = computed(() =>
  collapsedNestedItemCount.value > 99 ? '99+' : String(collapsedNestedItemCount.value),
)
const cardIncompleteCount = computed(() => props.incompleteCount ?? countIncompleteItems(props.item))
const visibleChildRows = computed(() =>
  childRows.value.filter(
    (row) => row.depth < 3 || row.parentItemId === null || isSectionExpanded(row.parentItemId),
  ),
)
const warningChildRows = computed(() =>
  props.expanded
    ? visibleChildRows.value.filter((entry) => getMismatchMessage(entry.item))
    : [],
)
const collapsedSectionIds = shallowRef(new Set<string>())
const nestedSectionIds = computed(() => collectNestedGroupItemIds(props.item.children))
const autoCollapsedNestedItemId = shallowRef<string | null>(null)
const nestedExpansionUserControlled = shallowRef(false)
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

watch(
  () => ({
    childRowCount: childRows.value.length,
    itemId: props.item.id,
    sectionIds: nestedSectionIds.value,
  }),
  (nextState, previousState) => {
    if (previousState && previousState.itemId !== nextState.itemId) {
      collapsedSectionIds.value = new Set()
      autoCollapsedNestedItemId.value = null
      nestedExpansionUserControlled.value = false
    }

    const activeSectionIds = new Set(nextState.sectionIds)
    collapsedSectionIds.value = new Set(
      Array.from(collapsedSectionIds.value).filter((id) => activeSectionIds.has(id)),
    )

    if (nestedExpansionUserControlled.value) {
      return
    }

    if (nextState.childRowCount <= LARGE_NESTED_CHILD_ROW_THRESHOLD) {
      if (autoCollapsedNestedItemId.value === nextState.itemId) {
        collapsedSectionIds.value = new Set()
        autoCollapsedNestedItemId.value = null
      }
      return
    }

    if (autoCollapsedNestedItemId.value === nextState.itemId) {
      return
    }

    collapsedSectionIds.value = new Set(nextState.sectionIds)
    autoCollapsedNestedItemId.value = nextState.itemId
    revealFocusedNestedItem()
  },
  { immediate: true },
)

watch(
  () => props.expandAllRequestKey,
  (nextRequestKey, previousRequestKey) => {
    if (nextRequestKey === undefined || nextRequestKey === previousRequestKey) {
      return
    }

    collapsedSectionIds.value = new Set()
    autoCollapsedNestedItemId.value = null
    nestedExpansionUserControlled.value = true
  },
)

watch(
  () => props.collapseAllRequestKey,
  (nextRequestKey, previousRequestKey) => {
    if (nextRequestKey === undefined || nextRequestKey === previousRequestKey) {
      return
    }

    collapsedSectionIds.value = new Set(nestedSectionIds.value)
    autoCollapsedNestedItemId.value = null
    nestedExpansionUserControlled.value = true
  },
)

watch(
  () => [props.focusedItemId, props.focusedItemRequestKey, props.expanded] as const,
  () => revealFocusedNestedItem(),
  { immediate: true },
)

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
  nestedExpansionUserControlled.value = true
}

function openCalculationSheet() {
  isCalculationSheetVisible.value = true
}

function getMarkupLabel(item: QuotationItem) {
  const markupCopy = getMarkupCopy(item)

  if (!markupCopy) {
    return ''
  }

  return t(markupCopy.helperKey, formatMarkupCopyArgs(markupCopy.helperArgs))
}

function getMarkupUsageLabel(item: QuotationItem) {
  const markupCopy = getMarkupCopy(item)

  if (!markupCopy?.statusKey) {
    return ''
  }

  return t(markupCopy.statusKey, markupCopy.statusArgs ?? {})
}

function getMarkupTooltipLabel(item: QuotationItem) {
  const markupCopy = getMarkupCopy(item)

  if (!markupCopy?.tooltipKey) {
    return ''
  }

  return t(markupCopy.tooltipKey, markupCopy.tooltipArgs ?? {})
}

function getMarkupCopy(item: QuotationItem) {
  const pricing = getPricing(item.id)

  if (!pricing) {
    return null
  }

  return getQuotationMarkupCopy(item, pricing)
}

function formatMarkupCopyArgs(args: Record<string, number | string>) {
  const formattedArgs = { ...args }

  if (typeof formattedArgs.amount === 'number') {
    formattedArgs.amount = formatCurrency(formattedArgs.amount, props.currency, currentLocale.value)
  }

  return formattedArgs
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

function countDescendantItems(items: QuotationItem[]): number {
  return items.reduce((count, item) => count + 1 + countDescendantItems(item.children), 0)
}

function collectNestedGroupItemIds(items: QuotationItem[]): string[] {
  const ids: string[] = []
  appendNestedGroupItemIds(items, ids)
  return ids
}

function appendNestedGroupItemIds(items: QuotationItem[], ids: string[]) {
  for (const item of items) {
    if (item.children.length === 0) {
      continue
    }

    ids.push(item.id)
    appendNestedGroupItemIds(item.children, ids)
  }
}

function revealFocusedNestedItem() {
  const focusedItemId = props.focusedItemId
  if (!focusedItemId || !props.expanded || focusedItemId === props.item.id) {
    return
  }

  const ancestorIds = findNestedAncestorGroupIdsForItemId(props.item.children, focusedItemId)
  if (ancestorIds === null || ancestorIds.length === 0) {
    return
  }

  const next = new Set(collapsedSectionIds.value)
  let changed = false

  for (const ancestorId of ancestorIds) {
    if (next.delete(ancestorId)) {
      changed = true
    }
  }

  if (changed) {
    collapsedSectionIds.value = next
  }
}

function findNestedAncestorGroupIdsForItemId(items: QuotationItem[], itemId: string): string[] | null {
  for (const item of items) {
    if (item.id === itemId) {
      return []
    }

    const childAncestorIds = findNestedAncestorGroupIdsForItemId(item.children, itemId)
    if (childAncestorIds !== null) {
      return item.children.length > 0 ? [item.id, ...childAncestorIds] : childAncestorIds
    }
  }

  return null
}

</script>

<template>
  <article
    class="item-card"
    :class="{
      'item-card-focused': props.focused,
      'item-card-incomplete': cardIncompleteCount > 0,
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
      :description-value="getTextFieldValue(props.item, 'description')"
      :summary-mode="summaryMode"
      :summary-mode-options="summaryModeOptions"
      :summary-metrics="activeSummaryMetrics"
      :collapsed-nested-item-count="collapsedNestedItemCount"
      :collapsed-nested-item-count-label="collapsedNestedItemCountLabel"
      @toggle-expanded="emit('toggleExpanded', props.item.id)"
      @update-item-name="setText(props.item.id, 'name', $event)"
      @flush-item-name="flushBufferedField(props.item.id, 'name')"
      @update-item-description="setText(props.item.id, 'description', $event)"
      @flush-item-description="flushBufferedField(props.item.id, 'description')"
      @move-root-item="emit('moveRootItem', props.item.id, $event)"
      @duplicate-root-item="emit('duplicateRootItem', props.item.id)"
      @open-calculation-sheet="openCalculationSheet"
      @remove-item="emit('removeItem', props.item.id)"
      @set-summary-mode="setSummaryMode"
    />

    <div v-if="props.expanded" class="item-card-panel">
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
          :expected-total-value="getOptionalNumberFieldValue(props.item, 'expectedTotal')"
          :manual-price-label="getManualPriceLabel()"
          :manual-unit-price-aria-label="getItemManualUnitPriceAriaLabel(displayItemNumber)"
          :pricing-method-aria-label="getItemPricingMethodAriaLabel(displayItemNumber)"
          :markup-field-label="getMarkupFieldLabel(props.item)"
          :markup-label="getMarkupLabel(props.item)"
          :markup-usage-label="getMarkupUsageLabel(props.item)"
          :markup-tooltip-label="getMarkupTooltipLabel(props.item)"
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
        :rows="visibleChildRows"
        :warning-rows="warningChildRows"
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
        :get-markup-usage-label="getMarkupUsageLabel"
        :get-markup-tooltip-label="getMarkupTooltipLabel"
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
    v-if="isCalculationSheetVisible"
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
  border: 1px solid color-mix(in srgb, var(--surface-border) 76%, #94a3b8);
  border-radius: var(--radius-md);
  background:
    linear-gradient(90deg, var(--accent) 0 4px, transparent 4px),
    linear-gradient(180deg, #ffffff 0, color-mix(in srgb, var(--surface-raised) 62%, white) 100%);
  box-shadow: 0 1px 2px rgb(15 23 42 / 5%);
  container: line-item-card / inline-size;
  overflow: visible;
  scroll-margin-top: 160px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.item-card:hover {
  border-color: color-mix(in srgb, var(--accent) 36%, var(--surface-border));
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent),
    0 8px 20px rgb(15 23 42 / 7%);
}

.item-card-focused {
  border-color: var(--accent);
  box-shadow:
    0 0 0 2px var(--accent-ring),
    0 8px 20px rgb(15 23 42 / 8%);
  animation: item-focus-pulse 1.4s ease-out;
}

.item-card-incomplete {
  background:
    linear-gradient(90deg, #f59e0b 0 4px, transparent 4px),
    linear-gradient(180deg, #ffffff 0, color-mix(in srgb, var(--warning-soft) 45%, white) 100%);
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
  border-radius: 0 0 calc(var(--radius-md) - 1px) calc(var(--radius-md) - 1px);
  background: color-mix(in srgb, var(--surface-muted) 44%, white);
  transition: background-color 0.16s ease;
}

.card-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
  padding: 8px 10px 7px 14px;
  border-top: 1px solid color-mix(in srgb, var(--surface-border) 70%, transparent);
  transition: background-color 0.16s ease;
}

.item-card:hover :deep(.card-header),
.item-card:hover .item-card-panel,
.item-card:hover .card-body {
  background-color: color-mix(in srgb, var(--accent-surface) 42%, white);
}

.item-card-focused :deep(.card-header),
.item-card-focused .item-card-panel,
.item-card-focused .card-body {
  background-color: color-mix(in srgb, var(--accent-surface) 64%, white);
}

.card-footer {
  display: flex;
  align-items: center;
  padding: 6px 10px 8px 14px;
  border-top: 1px solid color-mix(in srgb, var(--surface-border) 76%, transparent);
  background: color-mix(in srgb, var(--surface-raised) 70%, white);
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
