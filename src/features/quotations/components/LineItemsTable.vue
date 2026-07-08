<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, nextTick, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CalculationSheetDialog from './CalculationSheetDialog.vue'
import LineItemCard from './LineItemCard.vue'
import SectionHeaderRow from './SectionHeaderRow.vue'

import type {
  CurrencyCode,
  ExchangeRateTable,
  LineItemEntryMode,
  MajorItemSummary,
  QuotationItem,
  QuotationItemField,
  QuotationRootItem,
  TotalsConfig,
} from '../types'
import { countIncompleteQuotationItems, hasIncompleteQuotationItem } from '../utils/quotationItemCompleteness'
import { isQuotationItem } from '../utils/quotationItems'

const LARGE_QUOTE_COLLAPSE_ITEM_THRESHOLD = 80

const props = defineProps<{
  items: QuotationRootItem[]
  quotationNumber?: string
  itemSummaries?: MajorItemSummary[]
  currency: CurrencyCode
  grandTotal: number
  lineItemEntryMode: LineItemEntryMode
  globalMarkupRate: number
  totalsConfig: TotalsConfig
  exchangeRates: ExchangeRateTable
  costCurrencyOptions: string[]
  quotationCurrencyOptions: string[]
  focusedItemId?: string
  focusedItemRequestKey?: number
}>()

const emit = defineEmits<{
  addRootItem: []
  addSectionHeader: []
  addChildItem: [parentItemId: string]
  removeItem: [itemId: string]
  duplicateRootItem: [itemId: string]
  moveRootItem: [itemId: string, direction: -1 | 1]
  updateSectionHeaderTitle: [itemId: string, title: string]
  updateQuotationCurrency: [currency: CurrencyCode]
  updateLineItemEntryMode: [mode: LineItemEntryMode]
  setItemPricingMethod: [itemId: string, pricingMethod: QuotationItem['pricingMethod']]
  updateItemField: [itemId: string, field: QuotationItemField, value: QuotationItem[QuotationItemField]]
}>()

const { t } = useI18n()
const entryModeOptions = computed<{ label: string; value: LineItemEntryMode }[]>(() => [
  { label: t('quotations.lineItems.entryModes.quick'), value: 'quick' },
  { label: t('quotations.lineItems.entryModes.detailed'), value: 'detailed' },
])
const rootItems = computed(() => props.items.filter(isQuotationItem))
const rootRows = computed(() => {
  let itemDisplayIndex = 0

  return props.items.map((row, rootIndex) => ({
    row,
    rootIndex,
    itemDisplayIndex: isQuotationItem(row) ? itemDisplayIndex++ : null,
  }))
})
const summaryByItemId = computed(() =>
  new Map((props.itemSummaries ?? []).map((summary) => [summary.itemId, summary])),
)
const totalQuotationItemCount = computed(() => countQuotationItems(rootItems.value))
const isLargeQuote = computed(() => totalQuotationItemCount.value > LARGE_QUOTE_COLLAPSE_ITEM_THRESHOLD)
const rootIncompleteCounts = computed(() =>
  createRootIncompleteCounts(rootItems.value),
)
const collapsedRootIds = shallowRef(new Set<string>())
const expandAllRequestKey = shallowRef(0)
const collapseAllRequestKey = shallowRef(0)
const isCalculationSheetVisible = shallowRef(false)
const quotationCalculationSheetTitle = computed(() =>
  t('quotations.lineItems.calculationSheet.quotationTitle', {
    quotationNumber: props.quotationNumber?.trim() || 'quotation',
  }),
)
const quotationCalculationSheetFileName = computed(() =>
  `${sanitizeFileNamePart(props.quotationNumber?.trim() || 'quotation')}-calculation-sheet.csv`,
)

watch(
  () => props.items,
  (_items, previousItems) => {
    const nextRootItems = rootItems.value
    const nextRootIds = new Set(nextRootItems.map((item) => item.id))

    if (!previousItems) {
      collapsedRootIds.value = new Set(
        isLargeQuote.value ? nextRootItems.map((item) => item.id) : [],
      )
      return
    }

    const previousRootIds = new Set(previousItems.filter(isQuotationItem).map((item) => item.id))
    const nextCollapsedIds = Array.from(collapsedRootIds.value).filter((id) => nextRootIds.has(id))

    if (isLargeQuote.value) {
      for (const item of nextRootItems) {
        if (!previousRootIds.has(item.id)) {
          nextCollapsedIds.push(item.id)
        }
      }
    }

    collapsedRootIds.value = new Set(nextCollapsedIds)
  },
  { immediate: true },
)

watch(
  () => [props.focusedItemId, props.focusedItemRequestKey] as const,
  async ([focusedItemId]) => {
    if (!focusedItemId) {
      return
    }

    const rootItem = findRootItemForItemId(focusedItemId)
    if (rootItem && collapsedRootIds.value.has(rootItem.id)) {
      const next = new Set(collapsedRootIds.value)
      next.delete(rootItem.id)
      collapsedRootIds.value = next
    }

    await nextTick()
    await nextTick()

    document.querySelector(`[data-item-id="${focusedItemId}"]`)?.scrollIntoView({ block: 'start' })
  },
  { immediate: true },
)

const allCollapsed = computed(
  () => rootItems.value.length > 0 && rootItems.value.every((item) => collapsedRootIds.value.has(item.id)),
)

function setQuotationCurrency(value: unknown) {
  emit('updateQuotationCurrency', value as CurrencyCode)
}

function setEntryMode(mode: LineItemEntryMode) {
  if (mode === props.lineItemEntryMode) return
  emit('updateLineItemEntryMode', mode)
}

function isRootCardExpanded(itemId: string) {
  return !collapsedRootIds.value.has(itemId)
}

function toggleRootCard(itemId: string) {
  const next = new Set(collapsedRootIds.value)
  if (next.has(itemId)) next.delete(itemId)
  else next.add(itemId)
  collapsedRootIds.value = next
}

function collapseAll() {
  collapsedRootIds.value = new Set(rootItems.value.map((item) => item.id))
  collapseAllRequestKey.value += 1
}

function expandAll() {
  collapsedRootIds.value = new Set()
  expandAllRequestKey.value += 1
}

function openCalculationSheet() {
  isCalculationSheetVisible.value = true
}

const incompleteCount = computed(() => rootIncompleteCounts.value.total)

const itemsCount = computed(() => rootItems.value.length)

function jumpToFirstIncomplete() {
  for (const item of rootItems.value) {
    const total = rootIncompleteCounts.value.byItemId.get(item.id)
      ?? (item.children.length === 0
        ? (hasIncompleteQuotationItem(item) ? 1 : 0)
        : countIncompleteQuotationItems([item]))
    if (total > 0) {
      const next = new Set(collapsedRootIds.value)
      next.delete(item.id)
      collapsedRootIds.value = next
      nextTick(() => {
        document.querySelector(`[data-item-id="${item.id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      })
      return
    }
  }
}

function sanitizeFileNamePart(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .trim() || 'quotation'
}

function countQuotationItems(items: QuotationItem[]): number {
  return items.reduce((count, item) => count + 1 + countQuotationItems(item.children), 0)
}

function findRootItemForItemId(itemId: string) {
  return rootItems.value.find((item) => containsItemId(item, itemId)) ?? null
}

function containsItemId(item: QuotationItem, itemId: string): boolean {
  return item.id === itemId || item.children.some((child) => containsItemId(child, itemId))
}

function createRootIncompleteCounts(items: QuotationItem[]) {
  const byItemId = new Map<string, number>()
  let total = 0

  for (const item of items) {
    const itemCount = countIncompleteQuotationItems([item])
    byItemId.set(item.id, itemCount)
    total += itemCount
  }

  return { byItemId, total }
}
</script>

<template>
  <section
    class="workbench"
    :class="{ 'workbench-large-quote': isLargeQuote }"
    :aria-label="t('quotations.lineItems.aria')"
  >
    <div class="workbench-heading">
      <div class="heading-copy">
        <h2 class="heading-title">
          {{ t('quotations.lineItems.title') }}
          <span v-if="itemsCount > 0" class="heading-count">{{ itemsCount }}</span>
        </h2>
        <p class="heading-sub">{{ t('quotations.lineItems.subtitle') }}</p>
      </div>
      <div class="heading-tools">
        <div
          class="entry-mode-toggle"
          role="tablist"
          :aria-label="t('quotations.lineItems.entryModeAria')"
        >
          <button
            v-for="opt in entryModeOptions"
            :key="opt.value"
            class="entry-mode-button"
            :class="{ 'entry-mode-button-active': props.lineItemEntryMode === opt.value }"
            type="button"
            role="tab"
            :aria-selected="props.lineItemEntryMode === opt.value"
            @click="setEntryMode(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>

        <label class="heading-currency">
          <span>{{ t('quotations.commandBar.customerCurrency') }}</span>
          <Select
            :model-value="currency"
            :options="props.quotationCurrencyOptions"
            :aria-label="t('quotations.commandBar.customerCurrencyAria')"
            @update:model-value="setQuotationCurrency"
          />
        </label>

        <button
          v-if="incompleteCount > 0"
          type="button"
          class="incomplete-badge"
          :title="t('quotations.lineItems.jumpToIncomplete')"
          :aria-label="t('quotations.lineItems.jumpToIncomplete')"
          @click="jumpToFirstIncomplete"
        >
          <i class="pi pi-exclamation-triangle" aria-hidden="true" />
          {{ t('quotations.lineItems.incompleteLines', { count: incompleteCount }) }}
        </button>

        <div class="heading-buttons">
          <Button
            v-if="rootItems.length > 0"
            :icon="allCollapsed ? 'pi pi-angle-double-down' : 'pi pi-angle-double-up'"
            :label="allCollapsed ? t('quotations.lineItems.expandAll') : t('quotations.lineItems.collapseAll')"
            severity="secondary"
            text
            @click="allCollapsed ? expandAll() : collapseAll()"
          />
          <Button
            v-if="rootItems.length > 0"
            data-calculation-sheet-action="quotation"
            icon="pi pi-calculator"
            severity="secondary"
            :label="t('quotations.lineItems.calculationSheet.openQuotation')"
            :aria-label="t('quotations.lineItems.calculationSheet.openQuotationAria')"
            @click="openCalculationSheet"
          />
          <Button
            icon="pi pi-plus"
            :label="t('quotations.lineItems.addItem')"
            :aria-label="t('quotations.lineItems.addRootAria')"
            @click="emit('addRootItem')"
          />
          <Button
            icon="pi pi-minus"
            severity="secondary"
            :label="t('quotations.lineItems.addSectionHeader')"
            :aria-label="t('quotations.lineItems.addSectionHeaderAria')"
            @click="emit('addSectionHeader')"
          />
        </div>
      </div>
    </div>

    <CalculationSheetDialog
      v-if="isCalculationSheetVisible"
      :visible="isCalculationSheetVisible"
      :items="rootItems"
      :title="quotationCalculationSheetTitle"
      :export-file-name="quotationCalculationSheetFileName"
      :currency="props.currency"
      :global-markup-rate="props.globalMarkupRate"
      :totals-config="props.totalsConfig"
      :exchange-rates="props.exchangeRates"
      @update:visible="isCalculationSheetVisible = $event"
    />

    <div class="items-list">
      <template v-for="entry in rootRows" :key="entry.row.id">
        <LineItemCard
          v-if="isQuotationItem(entry.row)"
          :item="entry.row"
          :item-index="entry.rootIndex"
          :display-index="entry.itemDisplayIndex ?? entry.rootIndex"
          :total-items="props.items.length"
          :currency="props.currency"
          :line-item-entry-mode="props.lineItemEntryMode"
          :summary="summaryByItemId.get(entry.row.id)"
          :global-markup-rate="props.globalMarkupRate"
          :totals-config="props.totalsConfig"
          :exchange-rates="props.exchangeRates"
          :cost-currency-options="props.costCurrencyOptions"
          :focused="props.focusedItemId === entry.row.id"
          :focused-item-id="props.focusedItemId"
          :focused-item-request-key="props.focusedItemRequestKey"
          :expanded="isRootCardExpanded(entry.row.id)"
          :incomplete-count="rootIncompleteCounts.byItemId.get(entry.row.id) ?? 0"
          :expand-all-request-key="expandAllRequestKey"
          :collapse-all-request-key="collapseAllRequestKey"
          @toggle-expanded="toggleRootCard"
          @add-child-item="emit('addChildItem', $event)"
          @remove-item="emit('removeItem', $event)"
          @duplicate-root-item="emit('duplicateRootItem', $event)"
          @move-root-item="(itemId, direction) => emit('moveRootItem', itemId, direction)"
          @set-item-pricing-method="(itemId, pricingMethod) => emit('setItemPricingMethod', itemId, pricingMethod)"
          @update-item-field="(itemId, field, value) => emit('updateItemField', itemId, field, value)"
        />
        <SectionHeaderRow
          v-else
          :header="entry.row"
          :row-index="entry.rootIndex"
          :total-rows="props.items.length"
          @move-row="(itemId, direction) => emit('moveRootItem', itemId, direction)"
          @remove-row="emit('removeItem', $event)"
          @update-title="(itemId, title) => emit('updateSectionHeaderTitle', itemId, title)"
        />
      </template>
      <div v-if="items.length === 0" class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">
          <i class="pi pi-inbox" />
        </div>
        <h3 class="empty-state-title">{{ t('quotations.lineItems.emptyTitle') }}</h3>
        <p class="empty-state-text">{{ t('quotations.lineItems.emptyDescription') }}</p>
        <Button
          icon="pi pi-plus"
          :label="t('quotations.lineItems.addItem')"
          @click="emit('addRootItem')"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.workbench {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding-bottom: 12px;
}

.workbench-heading {
  position: sticky;
  top: -14px;
  z-index: 8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 14px;
  margin: 0 -14px 2px;
  background:
    linear-gradient(180deg, #ffffff 0, color-mix(in srgb, var(--surface-raised) 70%, white) 100%),
    var(--surface-card);
  border-bottom: 1px solid var(--surface-border-strong);
}

.workbench-heading::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -6px;
  height: 6px;
  background: linear-gradient(180deg, rgb(15 23 42 / 7%), transparent);
  pointer-events: none;
}

.workbench-heading :deep(.p-button) {
  flex: 0 0 auto;
}

.heading-copy {
  min-width: 0;
}

.heading-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.1;
}

.heading-count {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.heading-sub {
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.3;
}

.heading-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.entry-mode-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0;
  padding: 2px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.entry-mode-button {
  min-height: 26px;
  padding: 0 11px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.entry-mode-button:hover:not(.entry-mode-button-active) {
  color: var(--text-body);
  background: rgb(255 255 255 / 74%);
}

.entry-mode-button-active {
  background: var(--surface-card);
  color: var(--accent-hover);
  font-weight: 700;
  box-shadow: var(--shadow-control);
}

.heading-currency {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.heading-currency span {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-left: 2px;
}

.heading-currency :deep(.p-select) {
  min-width: 96px;
  min-height: 28px;
  border-radius: var(--radius-md);
}

.heading-currency :deep(.p-select-label) {
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 600;
}

.incomplete-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border: 1px solid var(--warning-border);
  border-radius: 999px;
  background: var(--warning-soft);
  color: var(--warning);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.13s ease, border-color 0.13s ease, transform 0.13s ease;
  white-space: nowrap;
}

.incomplete-badge:hover {
  background: #ffe4ca;
  border-color: #fdba74;
  transform: translateY(-1px);
}

.incomplete-badge i {
  font-size: 12px;
}

.heading-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-shrink: 0;
}

.heading-buttons :deep(.p-button) {
  min-height: 32px;
  font-size: 13px;
  padding-inline: 0.7rem;
  padding-block: 0.32rem;
  border-radius: var(--radius-md);
}

.items-list {
  display: grid;
  gap: 7px;
}

.workbench-large-quote .items-list {
  gap: 6px;
}

.workbench-large-quote :deep(.item-card),
.workbench-large-quote :deep(.ct-row),
.workbench-large-quote :deep(.child-table-wrap),
.workbench-large-quote :deep(.entry-mode-button),
.workbench-large-quote .incomplete-badge {
  transition: none;
}

.workbench-large-quote :deep(.item-card),
.workbench-large-quote :deep(.ct-row),
.workbench-large-quote :deep(.ct-head) {
  box-shadow: none;
}

.workbench-large-quote :deep(.item-card:hover) {
  box-shadow: none;
  transform: none;
}

.workbench-large-quote :deep(.ct-row:hover) {
  box-shadow: inset 4px 0 0 0 color-mix(in srgb, var(--accent) 24%, transparent);
}

.workbench-large-quote .incomplete-badge:hover {
  transform: none;
}

.empty-state {
  display: grid;
  gap: 10px;
  justify-items: center;
  padding: 56px 24px 64px;
  text-align: center;
}

.empty-state-icon {
  display: inline-grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-subtle);
  font-size: 22px;
}

.empty-state-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 15px;
  font-weight: 700;
}

.empty-state-text {
  max-width: 42ch;
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
  text-wrap: pretty;
}

@media (max-width: 1320px) {
  .heading-tools {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 900px) {
  .heading-tools {
    width: 100%;
    justify-content: flex-start;
  }

  .heading-currency {
    flex: 1 1 160px;
  }
}
</style>
