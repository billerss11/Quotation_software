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

import type {
  CurrencyCode,
  ExchangeRateTable,
  MajorItemSummary,
  QuotationItem,
  QuotationItemField,
  TotalsConfig,
} from '../types'
import {
  calculateQuotationItemSellingAmount,
  calculateQuotationItemUnitSellingPrice,
  calculateUnitSellingPrice,
  getEffectiveMarkupRate,
} from '../utils/quotationCalculations'
import {
  calculateQuotationItemSectionUnitCost,
  createInheritedMarkupContext,
  getQuotationItemPricingDisplay,
  type InheritedMarkupContext,
} from '../utils/quotationItemPricing'
import {
  getQuotationItemAmountMismatch,
  shouldShowQuotationItemExpectedTotal,
} from '../utils/quotationItemValidation'

interface ChildRow {
  item: QuotationItem
  depth: number
  itemNumber: string
  inheritedMarkupContext: InheritedMarkupContext | null
  inheritedTaxClassId?: string
  parentItemId: string | null
}

const props = defineProps<{
  items: QuotationItem[]
  summaries: MajorItemSummary[]
  currency: CurrencyCode
  globalMarkupRate: number
  totalsConfig: TotalsConfig
  exchangeRates: ExchangeRateTable
  costCurrencyOptions: string[]
}>()

const emit = defineEmits<{
  addRootItem: []
  addChildItem: [parentItemId: string]
  removeItem: [itemId: string]
  duplicateRootItem: [itemId: string]
  moveRootItem: [itemId: string, direction: -1 | 1]
  updateItemField: [itemId: string, field: QuotationItemField, value: QuotationItem[QuotationItemField]]
}>()

const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
const isMixedTaxMode = computed(() => props.totalsConfig.taxMode === 'mixed')

const summaryByItemId = computed(() => new Map(props.summaries.map((s) => [s.itemId, s])))
const taxClassMap = computed(() => new Map((props.totalsConfig.taxClasses ?? []).map((taxClass) => [taxClass.id, taxClass])))
const explicitTaxClassOptions = computed(() =>
  (props.totalsConfig.taxClasses ?? []).map((taxClass) => ({
    label: taxClass.label,
    value: taxClass.id,
  })),
)

function getSummary(itemId: string) {
  return summaryByItemId.value.get(itemId)
}

function isGroupItem(item: QuotationItem) {
  return item.children.length > 0
}

function getChildRows(item: QuotationItem, itemNumber: string): ChildRow[] {
  return flattenChildren(
    item.children,
    itemNumber,
    createInheritedMarkupContext(item, itemNumber),
    item.taxClassId,
    item.id,
  )
}

function flattenChildren(
  children: QuotationItem[],
  parentNumber: string,
  inheritedMarkupContext: InheritedMarkupContext | null,
  inheritedTaxClassId?: string,
  parentItemId: string | null = null,
): ChildRow[] {
  return children.flatMap((child, i) => {
    const itemNumber = `${parentNumber}.${i + 1}`
    const row: ChildRow = {
      item: child,
      depth: itemNumber.split('.').length,
      itemNumber,
      inheritedMarkupContext,
      inheritedTaxClassId,
      parentItemId,
    }
    return [
      row,
      ...flattenChildren(
        child.children,
        itemNumber,
        createInheritedMarkupContext(child, itemNumber, inheritedMarkupContext),
        child.taxClassId ?? inheritedTaxClassId,
        child.id,
      ),
    ]
  })
}

/** Section rows (depth-2 group items): ids here are collapsed — their depth-3 children are hidden. */
const collapsedSectionIds = shallowRef(new Set<string>())

function isSectionExpanded(itemId: string) {
  return !collapsedSectionIds.value.has(itemId)
}

function toggleSection(itemId: string) {
  const next = new Set(collapsedSectionIds.value)
  if (next.has(itemId)) next.delete(itemId)
  else next.add(itemId)
  collapsedSectionIds.value = next
}

function getVisibleChildRows(item: QuotationItem, itemNumber: string): ChildRow[] {
  return getChildRows(item, itemNumber).filter(
    (row) => row.depth < 3 || row.parentItemId === null || isSectionExpanded(row.parentItemId),
  )
}

function getMarkupLabel(item: QuotationItem, inheritedMarkupContext?: InheritedMarkupContext | null) {
  const pricing = getPricingDisplay(item, inheritedMarkupContext)
  const source =
    pricing.markupSource === 'self' ? t('quotations.lineItems.markupSource.self') :
    pricing.markupSource === 'inherited'
      ? t('quotations.lineItems.markupSource.inherited', { source: pricing.markupSourceLabel })
      : t('quotations.lineItems.markupSource.global')
  return t('quotations.lineItems.effectiveMarkup', { rate: pricing.effectiveMarkupRate, source })
}

function getPricingDisplay(
  item: QuotationItem,
  inheritedMarkupContext?: InheritedMarkupContext | null,
  inheritedTaxClassId?: string,
) {
  return getQuotationItemPricingDisplay(
    item,
    props.globalMarkupRate,
    props.exchangeRates,
    props.totalsConfig,
    inheritedMarkupContext,
    inheritedTaxClassId,
  )
}

function getUnitSellingPrice(item: QuotationItem, inheritedMarkupRate?: number) {
  if (isGroupItem(item)) {
    return calculateQuotationItemUnitSellingPrice(item, props.globalMarkupRate, props.exchangeRates, inheritedMarkupRate)
  }
  const rate = getEffectiveMarkupRate(item.markupRate, inheritedMarkupRate ?? props.globalMarkupRate)
  return calculateUnitSellingPrice(item, rate, props.exchangeRates)
}

function getSellingAmount(item: QuotationItem, inheritedMarkupRate?: number) {
  return calculateQuotationItemSellingAmount(item, props.globalMarkupRate, props.exchangeRates, inheritedMarkupRate)
}

function getMismatchMessage(item: QuotationItem, inheritedMarkupRate?: number) {
  const mismatch = getQuotationItemAmountMismatch(item, props.globalMarkupRate, props.exchangeRates, inheritedMarkupRate)
  if (!mismatch) return ''
  return t('quotations.lineItems.mismatch', {
    expected: formatCurrency(mismatch.expectedTotal, props.currency, currentLocale.value),
    actual: formatCurrency(mismatch.actualTotal, props.currency, currentLocale.value),
  })
}

function shouldShowExpectedTotal(item: QuotationItem, inheritedMarkupRate?: number) {
  return shouldShowQuotationItemExpectedTotal(item, props.globalMarkupRate, props.exchangeRates, inheritedMarkupRate)
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

function getTaxClassLabel(item: QuotationItem, inheritedTaxClassId?: string) {
  const pricing = getPricingDisplay(item, null, inheritedTaxClassId)

  if (pricing.hasMixedTaxClasses) {
    return t('quotations.lineItems.taxClassMixed')
  }

  return pricing.taxClassLabel ?? getDefaultTaxClassLabel()
}

function getAmountWithTax(item: QuotationItem, inheritedMarkupContext?: InheritedMarkupContext | null, inheritedTaxClassId?: string) {
  return getPricingDisplay(item, inheritedMarkupContext, inheritedTaxClassId).totalWithTax
}

function setText(itemId: string, field: QuotationItemField, value: unknown) {
  emit('updateItemField', itemId, field, String(value ?? ''))
}

function setNumber(itemId: string, field: QuotationItemField, value: unknown) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  emit('updateItemField', itemId, field, n)
}

function setOptionalNumber(itemId: string, field: QuotationItemField, value: unknown) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : undefined
  emit('updateItemField', itemId, field, n as QuotationItem[QuotationItemField])
}

function setCurrency(itemId: string, value: unknown) {
  emit('updateItemField', itemId, 'costCurrency', value as CurrencyCode)
}

/** Root line-item cards: ids here are shown collapsed (body + child table + footer hidden). */
const collapsedRootIds = shallowRef(new Set<string>())

function isRootCardExpanded(itemId: string) {
  return !collapsedRootIds.value.has(itemId)
}

function toggleRootCard(itemId: string) {
  const next = new Set(collapsedRootIds.value)
  if (next.has(itemId)) next.delete(itemId)
  else next.add(itemId)
  collapsedRootIds.value = next
}

const allCollapsed = computed(
  () => props.items.length > 0 && props.items.every((item) => collapsedRootIds.value.has(item.id)),
)

function collapseAll() {
  collapsedRootIds.value = new Set(props.items.map((item) => item.id))
}

function expandAll() {
  collapsedRootIds.value = new Set()
}
</script>

<template>
  <section class="workbench" :aria-label="t('quotations.lineItems.aria')">

    <!-- Panel heading -->
    <div class="workbench-heading">
      <div>
        <h2 class="heading-title">{{ t('quotations.lineItems.title') }}</h2>
        <p class="heading-sub">{{ t('quotations.lineItems.subtitle') }}</p>
      </div>
      <div class="heading-buttons">
        <Button
          v-if="items.length > 0"
          :icon="allCollapsed ? 'pi pi-expand' : 'pi pi-compress'"
          :label="allCollapsed ? t('quotations.lineItems.expandAll') : t('quotations.lineItems.collapseAll')"
          severity="secondary"
          rounded
          @click="allCollapsed ? expandAll() : collapseAll()"
        />
        <Button icon="pi pi-plus" :label="t('quotations.lineItems.addItem')" rounded :aria-label="t('quotations.lineItems.addRootAria')" @click="emit('addRootItem')" />
      </div>
    </div>

    <!-- Item cards -->
    <div class="items-list">
      <article v-for="(item, itemIndex) in items" :key="item.id" class="item-card" :data-item-id="item.id">

        <!-- Card header: collapse + number badge + name + actions -->
        <header class="card-header" :class="{ 'card-header-collapsed': !isRootCardExpanded(item.id) }">
          <button
            type="button"
            class="card-collapse-toggle"
            :aria-expanded="isRootCardExpanded(item.id)"
            :aria-label="isRootCardExpanded(item.id) ? t('quotations.lineItems.collapseItem') : t('quotations.lineItems.expandItem')"
            @click="toggleRootCard(item.id)"
          >
            <i :class="isRootCardExpanded(item.id) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
          </button>
          <span class="item-badge">{{ itemIndex + 1 }}</span>
          <InputText
            class="item-name-input"
            :model-value="item.name"
            :aria-label="t('quotations.lineItems.itemNameAria', { index: itemIndex + 1 })"
            :placeholder="t('quotations.lineItems.itemNamePlaceholder')"
            @update:model-value="setText(item.id, 'name', $event)"
          />
          <div class="header-actions">
            <Button
              v-tooltip.top="t('quotations.lineItems.moveUp')"
              icon="pi pi-arrow-up"
              severity="secondary"
              text
              rounded
              :disabled="itemIndex === 0"
              :aria-label="t('quotations.lineItems.moveItemUpAria', { index: itemIndex + 1 })"
              @click="emit('moveRootItem', item.id, -1)"
            />
            <Button
              v-tooltip.top="t('quotations.lineItems.moveDown')"
              icon="pi pi-arrow-down"
              severity="secondary"
              text
              rounded
              :disabled="itemIndex === items.length - 1"
              :aria-label="t('quotations.lineItems.moveItemDownAria', { index: itemIndex + 1 })"
              @click="emit('moveRootItem', item.id, 1)"
            />
            <Button
              v-tooltip.top="t('quotations.lineItems.duplicate')"
              icon="pi pi-copy"
              severity="secondary"
              text
              rounded
              :aria-label="t('quotations.lineItems.duplicateItemAria', { index: itemIndex + 1 })"
              @click="emit('duplicateRootItem', item.id)"
            />
            <Button
              v-tooltip.top="t('quotations.lineItems.delete')"
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              :aria-label="t('quotations.lineItems.deleteItemAria', { index: itemIndex + 1 })"
              @click="emit('removeItem', item.id)"
            />
          </div>

          <!-- Collapsed summary: cost / markup / selling price -->
          <div v-if="!isRootCardExpanded(item.id)" class="card-header-summary">
            <span>{{ t('quotations.lineItems.cost') }} <strong>{{ formatCurrency(getSummary(item.id)?.baseSubtotal ?? 0, currency, currentLocale) }}</strong></span>
            <span>{{ t('quotations.lineItems.markup') }} <strong>{{ formatCurrency(getSummary(item.id)?.markupAmount ?? 0, currency, currentLocale) }}</strong></span>
            <span class="summary-selling">{{ t('quotations.lineItems.sellingPrice') }} <strong>{{ formatCurrency(getSummary(item.id)?.subtotal ?? 0, currency, currentLocale) }}</strong></span>
            <span class="summary-selling">{{ t('quotations.lineItems.amountWithTax') }} <strong>{{ formatCurrency(getAmountWithTax(item), currency, currentLocale) }}</strong></span>
          </div>
        </header>

        <div v-show="isRootCardExpanded(item.id)" class="item-card-panel">
        <!-- Card body -->
        <div class="card-body">
          <div class="item-editor-shell">
            <div class="item-editor-main">
              <div class="item-control-grid" :class="{ 'item-control-grid-mixed': isMixedTaxMode }">
                <label class="pf pf-sm">
                  <span class="field-label">{{ t('quotations.lineItems.quantity') }}</span>
                  <InputNumber :model-value="item.quantity" :min="0" :max-fraction-digits="2" :aria-label="t('quotations.lineItems.itemQuantityAria', { index: itemIndex + 1 })" @update:model-value="setNumber(item.id, 'quantity', $event)" />
                </label>
                <label class="pf pf-sm">
                  <span class="field-label">{{ t('quotations.lineItems.unit') }}</span>
                  <InputText :model-value="item.quantityUnit" :aria-label="t('quotations.lineItems.itemUnitAria', { index: itemIndex + 1 })" @update:model-value="setText(item.id, 'quantityUnit', $event)" />
                </label>
                <template v-if="!isGroupItem(item)">
                  <label class="pf pf-lg">
                    <span class="field-label">{{ t('quotations.lineItems.unitCost') }}</span>
                    <InputNumber :model-value="item.unitCost" mode="currency" :currency="item.costCurrency" :locale="currentLocale" :aria-label="t('quotations.lineItems.itemUnitCostAria', { index: itemIndex + 1 })" @update:model-value="setNumber(item.id, 'unitCost', $event)" />
                  </label>
                  <label class="pf pf-sm">
                    <span class="field-label">{{ t('quotations.lineItems.costFx') }}</span>
                    <Select :model-value="item.costCurrency" :options="props.costCurrencyOptions" :aria-label="t('quotations.lineItems.itemCostFxAria', { index: itemIndex + 1 })" @update:model-value="setCurrency(item.id, $event)" />
                  </label>
                  <label class="pf pf-md">
                    <span class="field-label">{{ t('quotations.lineItems.markup') }}</span>
                    <InputNumber :model-value="item.markupRate" suffix="%" :min="0" :max="1000" :max-fraction-digits="2" :aria-label="t('quotations.lineItems.itemMarkupAria', { index: itemIndex + 1 })" @update:model-value="setOptionalNumber(item.id, 'markupRate', $event)" />
                    <small class="field-hint">{{ getMarkupLabel(item) }}</small>
                  </label>
                </template>
                <template v-else>
                  <label class="pf pf-md">
                    <span class="field-label">{{ t('quotations.lineItems.markupOverride') }}</span>
                    <InputNumber :model-value="item.markupRate" suffix="%" :min="0" :max="1000" :max-fraction-digits="2" :aria-label="t('quotations.lineItems.itemMarkupAria', { index: itemIndex + 1 })" @update:model-value="setOptionalNumber(item.id, 'markupRate', $event)" />
                    <small class="field-hint">{{ getMarkupLabel(item) }}</small>
                  </label>
                </template>
                <label v-if="isMixedTaxMode" class="pf pf-lg">
                  <span class="field-label">{{ t('quotations.lineItems.taxClass') }}</span>
                  <Select
                    :model-value="getTaxClassValue(item)"
                    :options="getTaxClassOptions()"
                    option-label="label"
                    option-value="value"
                    :aria-label="t('quotations.lineItems.itemTaxClassAria', { index: itemIndex + 1 })"
                    @update:model-value="setTaxClass(item.id, $event)"
                  />
                  <small class="field-hint">{{ getTaxClassLabel(item) }}</small>
                </label>
              </div>

              <label class="desc-label desc-label-compact">
                <span class="field-label">{{ t('quotations.lineItems.description') }}</span>
                <Textarea
                  :model-value="item.description"
                  :aria-label="t('quotations.lineItems.itemDescriptionAria', { index: itemIndex + 1 })"
                  rows="1"
                  auto-resize
                  :placeholder="t('quotations.lineItems.descriptionPlaceholder')"
                  @update:model-value="setText(item.id, 'description', $event)"
                />
              </label>
            </div>

            <aside class="item-metric-strip">
              <div class="metric-card">
                <span>{{ t('quotations.lineItems.cost') }}</span>
                <strong>{{ formatCurrency(getSummary(item.id)?.baseSubtotal ?? 0, currency, currentLocale) }}</strong>
              </div>
              <div class="metric-card" v-if="!isGroupItem(item)">
                <span>{{ t('quotations.lineItems.unitSellingPrice') }}</span>
                <strong>{{ formatCurrency(getUnitSellingPrice(item) ?? 0, currency, currentLocale) }}</strong>
              </div>
              <div class="metric-card" v-else>
                <span>{{ t('quotations.lineItems.markup') }}</span>
                <strong>{{ formatCurrency(getSummary(item.id)?.markupAmount ?? 0, currency, currentLocale) }}</strong>
              </div>
              <div class="metric-card">
                <span>{{ t('quotations.lineItems.sellingPrice') }}</span>
                <strong>{{ formatCurrency(isGroupItem(item) ? (getSummary(item.id)?.subtotal ?? 0) : getSellingAmount(item), currency, currentLocale) }}</strong>
              </div>
              <div class="metric-card metric-card-primary">
                <span>{{ t('quotations.lineItems.amountWithTax') }}</span>
                <strong>{{ formatCurrency(getAmountWithTax(item), currency, currentLocale) }}</strong>
              </div>
            </aside>
          </div>

          <div v-if="isGroupItem(item) && shouldShowExpectedTotal(item)" class="expected-total-row">
            <p class="mismatch-warning">
              {{ getMismatchMessage(item) }}
            </p>
            <label class="pf pf-md expected-total-input">
              <span class="field-label">{{ t('quotations.lineItems.sourceTotal') }} <span class="field-label-hint">{{ t('quotations.lineItems.referenceOnly') }}</span></span>
              <InputNumber :model-value="item.expectedTotal" mode="currency" :currency="currency" :locale="currentLocale" :min="0" :aria-label="t('quotations.lineItems.itemSourceTotalAria', { index: itemIndex + 1 })" @update:model-value="setOptionalNumber(item.id, 'expectedTotal', $event)" />
            </label>
          </div>

        </div>

        <!-- Child rows table -->
        <div v-if="item.children.length > 0" class="child-table-wrap">
          <div class="child-table">
            <!-- Table header -->
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

            <!-- Table rows -->
            <div
              v-for="row in getVisibleChildRows(item, String(itemIndex + 1))"
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
              }"
            >
              <!-- # -->
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

              <!-- Item name + description -->
              <div class="ct-item">
                <InputText
                  :model-value="row.item.name"
                  :aria-label="t('quotations.lineItems.lineItemNameAria', { itemNumber: row.itemNumber })"
                  :placeholder="t('quotations.lineItems.namePlaceholder')"
                  @update:model-value="setText(row.item.id, 'name', $event)"
                />
                <Textarea
                  :model-value="row.item.description"
                  :aria-label="t('quotations.lineItems.lineItemDescriptionAria', { itemNumber: row.itemNumber })"
                  rows="1"
                  auto-resize
                  :placeholder="t('quotations.lineItems.descriptionPlaceholder')"
                  @update:model-value="setText(row.item.id, 'description', $event)"
                />
                <div class="ct-meta">
                  <span>{{ t('quotations.lineItems.cost') }}: {{ formatCurrency(getPricingDisplay(row.item, row.inheritedMarkupContext, row.inheritedTaxClassId).baseAmount, currency, currentLocale) }}</span>
                  <span>{{ t('quotations.lineItems.markup') }}: {{ formatCurrency(getPricingDisplay(row.item, row.inheritedMarkupContext, row.inheritedTaxClassId).markupAmount, currency, currentLocale) }}</span>
                </div>
              </div>

              <!-- Qty -->
              <InputNumber
                :model-value="row.item.quantity"
                :min="0"
                :max-fraction-digits="2"
                :aria-label="t('quotations.lineItems.lineItemQuantityAria', { itemNumber: row.itemNumber })"
                @update:model-value="setNumber(row.item.id, 'quantity', $event)"
              />

              <!-- Unit -->
              <InputText
                :model-value="row.item.quantityUnit"
                :aria-label="t('quotations.lineItems.lineItemUnitAria', { itemNumber: row.itemNumber })"
                @update:model-value="setText(row.item.id, 'quantityUnit', $event)"
              />

              <!-- Unit cost (leaf only) -->
              <template v-if="!isGroupItem(row.item)">
                <InputNumber
                  :model-value="row.item.unitCost"
                  mode="currency"
                  :currency="row.item.costCurrency"
                  :locale="currentLocale"
                  :aria-label="t('quotations.lineItems.lineItemUnitCostAria', { itemNumber: row.itemNumber })"
                  @update:model-value="setNumber(row.item.id, 'unitCost', $event)"
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
                <span class="ct-derived-cost">
                  {{ formatCurrency(calculateQuotationItemSectionUnitCost(row.item, exchangeRates), currency, currentLocale) }}
                </span>
                <span class="ct-muted">{{ currency }}</span>
              </template>

              <!-- Markup -->
              <div class="ct-markup">
                <InputNumber
                  :model-value="row.item.markupRate"
                  suffix="%"
                  :min="0"
                  :max="1000"
                  :max-fraction-digits="2"
                  :aria-label="t('quotations.lineItems.lineItemMarkupAria', { itemNumber: row.itemNumber })"
                  @update:model-value="setOptionalNumber(row.item.id, 'markupRate', $event)"
                />
                <small class="ct-hint">{{ getMarkupLabel(row.item, row.inheritedMarkupContext) }}</small>
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
                <small class="ct-hint">{{ getTaxClassLabel(row.item, row.inheritedTaxClassId) }}</small>
              </div>

              <!-- Unit price -->
              <span class="ct-amount">
                {{ formatCurrency(getUnitSellingPrice(row.item, row.inheritedMarkupContext?.rate) ?? 0, currency, currentLocale) }}
              </span>

              <!-- Total amount -->
              <span class="ct-amount">
                {{ formatCurrency(getSellingAmount(row.item, row.inheritedMarkupContext?.rate), currency, currentLocale) }}
              </span>

              <span class="ct-amount">
                {{ formatCurrency(getAmountWithTax(row.item, row.inheritedMarkupContext, row.inheritedTaxClassId), currency, currentLocale) }}
              </span>

              <!-- Row actions -->
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

            <!-- Mismatch warnings for child rows -->
            <p
              v-for="row in getChildRows(item, String(itemIndex + 1)).filter((r) => getMismatchMessage(r.item, r.inheritedMarkupContext?.rate))"
              :key="`warn-${row.item.id}`"
              class="child-warning"
            >
              {{ row.itemNumber }}: {{ getMismatchMessage(row.item, row.inheritedMarkupContext?.rate) }}
            </p>
          </div>
        </div>

        <!-- Card footer -->
        <footer class="card-footer">
          <Button
            class="add-child-button"
            icon="pi pi-plus"
            :label="t('quotations.lineItems.addChildItem')"
            size="small"
            :aria-label="t('quotations.lineItems.addChildItemAria', { index: itemIndex + 1 })"
            @click="emit('addChildItem', item.id)"
          />
          <div class="subtotal-bar">
            <span>{{ t('quotations.lineItems.cost') }} <strong>{{ formatCurrency(getSummary(item.id)?.baseSubtotal ?? 0, currency, currentLocale) }}</strong></span>
            <span>{{ t('quotations.lineItems.markup') }} <strong>{{ formatCurrency(getSummary(item.id)?.markupAmount ?? 0, currency, currentLocale) }}</strong></span>
            <span class="subtotal-total">{{ t('quotations.lineItems.sellingPrice') }} <strong>{{ formatCurrency(getSummary(item.id)?.subtotal ?? 0, currency, currentLocale) }}</strong></span>
            <span class="subtotal-total">{{ t('quotations.lineItems.amountWithTax') }} <strong>{{ formatCurrency(getAmountWithTax(item), currency, currentLocale) }}</strong></span>
          </div>
        </footer>
        </div>

      </article>
    </div>

  </section>
</template>

<style scoped>
/* ── Panel ─────────────────────────────────────────────────── */

.workbench {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.workbench-heading {
  position: sticky;
  top: 0;
  z-index: 8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 0 0 10px;
  background: var(--app-bg);
  border-bottom: 1px solid var(--surface-border);
}

.workbench-heading :deep(.p-button) {
  flex: 0 0 auto;
}

.heading-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.heading-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 18px;
}

.heading-sub {
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

.items-list {
  display: grid;
  gap: 12px;
}

/* ── Item card ─────────────────────────────────────────────── */

.item-card {
  display: grid;
  min-width: 0;
  border: 1px solid var(--surface-border);
  border-left: 5px solid var(--accent);
  border-radius: 8px;
  background: var(--surface-card);
  box-shadow: var(--shadow-control);
  overflow: hidden;
  scroll-margin-top: 160px;
}

/* ── Card header ───────────────────────────────────────────── */

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

/* ── Card body ─────────────────────────────────────────────── */

.card-body {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
}

/* Field labels */

.field-label {
  color: var(--text-body);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field-label-hint {
  color: var(--text-subtle);
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
}

.field-hint {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
}

/* Editor shell */

.item-editor-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(300px, 0.9fr);
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
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 6px;
  align-items: start;
}

.item-control-grid-mixed {
  grid-template-columns: repeat(10, minmax(0, 1fr));
}

.pf {
  display: grid;
  grid-column: span 2;
  gap: 3px;
  min-width: 0;
}

.pf-sm {
  grid-column: span 1;
}

.pf-md {
  grid-column: span 2;
}

.pf-lg {
  grid-column: span 2;
}

.pf :deep(.p-inputtext),
.pf :deep(.p-inputnumber-input),
.pf :deep(.p-select) {
  width: 100%;
}

.pf :deep(.p-inputtext),
.pf :deep(.p-inputnumber-input) {
  min-height: 36px;
  padding: 0.45rem 0.7rem;
  font-size: 13px;
}

.pf :deep(.p-select-label) {
  padding: 0.45rem 0.7rem;
  font-size: 13px;
}

/* Description */

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

/* Metric strip */

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
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.metric-card strong {
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 800;
}

.metric-card-primary {
  border-color: var(--accent-soft);
  background: var(--accent-surface);
}

.metric-card-primary strong,
.metric-card-primary span {
  color: var(--accent);
}

/* Expected total row */

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
  font-size: 11px;
  font-weight: 600;
}

/* ── Child table ───────────────────────────────────────────── */

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

/* Table header */

.ct-head {
  min-height: 26px;
  background: #eef3f8;
  border-bottom: 2px solid var(--surface-border);
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* ── Level 2 leaf row (default) ── indigo */

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

/* Level 2 leaf rows are direct children of the root card. */

.ct-row-l2::before {
  background: var(--info);
  opacity: 0.72;
}

.ct-row-l2 {
  background: #fbfcfe;
}

/* Level 2 section rows act as subsection bands for nested children. */

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

/* Level 3 rows sit inside the preceding subsection. */

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

/* Input widths */

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

/* ── Number cell ─────────────────────────────────────────────── */

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

/* Grandchild: indent + L-shaped tree connector */

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

/* ── Number badge ─────────────────────────────────────────────── */

/* Default: depth-2 leaf — indigo */
.ct-num-badge {
  display: inline-grid;
  min-width: 30px;
  height: 20px;
  place-items: center;
  padding: 0 4px;
  border-radius: 5px;
  background: var(--info-soft);
  color: var(--info);
  font-size: 9px;
  font-weight: 800;
  white-space: nowrap;
}

/* Section badge — solid teal, white text */
.ct-badge-section {
  min-width: 34px;
  height: 22px;
  background: var(--accent);
  color: #ffffff;
  box-shadow: 0 8px 16px rgb(4 120 87 / 18%);
}

/* Grandchild badge — light gray, muted text */
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

/* Item cell */

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
  gap: 3px 6px;
  color: var(--text-subtle);
  font-size: 9px;
  font-weight: 700;
}

/* Markup cell */

.ct-markup {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.ct-hint {
  color: var(--text-subtle);
  font-size: 9px;
  font-weight: 600;
  line-height: 1.1;
}

.ct-amount {
  align-self: center;
  color: var(--text-strong);
  font-size: 11px;
  font-weight: 800;
  text-align: right;
  justify-self: end;
}

.ct-muted {
  align-self: center;
  color: var(--text-subtle);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  justify-self: center;
}

.ct-derived-cost {
  align-self: center;
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 700;
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

/* Child warnings */

.child-warning {
  margin: 0;
  padding: 5px 10px;
  background: var(--warning-soft);
  border-top: 1px solid #fed7aa;
  color: var(--warning);
  font-size: 11px;
  font-weight: 600;
}

/* ── Card footer ───────────────────────────────────────────── */

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
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

.subtotal-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 14px;
  color: var(--text-muted);
  font-size: 11px;
}

.subtotal-bar strong {
  color: var(--text-strong);
}

.subtotal-total {
  font-weight: 700;
}

.subtotal-total strong {
  font-size: 13px;
}

@media (max-width: 1320px) {
  .item-editor-shell {
    grid-template-columns: 1fr;
  }

  .item-control-grid,
  .item-control-grid-mixed {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .pf,
  .pf-sm,
  .pf-md,
  .pf-lg {
    grid-column: span 2;
  }

  .item-metric-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .expected-total-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .card-header {
    grid-template-columns: auto 32px minmax(0, 1fr);
  }

  .header-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .item-control-grid,
  .item-control-grid-mixed {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .item-metric-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

</style>
