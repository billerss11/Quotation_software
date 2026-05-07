<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, nextTick, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import LineItemCard from './LineItemCard.vue'
import SectionHeaderRow from './SectionHeaderRow.vue'

import type {
  CurrencyCode,
  ExchangeRateTable,
  LineItemEntryMode,
  QuotationItem,
  QuotationItemField,
  QuotationRootItem,
  TotalsConfig,
} from '../types'
import { countIncompleteQuotationItems, hasIncompleteQuotationItem } from '../utils/quotationItemCompleteness'
import { isQuotationItem } from '../utils/quotationItems'

const props = defineProps<{
  items: QuotationRootItem[]
  currency: CurrencyCode
  grandTotal: number
  lineItemEntryMode: LineItemEntryMode
  globalMarkupRate: number
  totalsConfig: TotalsConfig
  exchangeRates: ExchangeRateTable
  costCurrencyOptions: string[]
  quotationCurrencyOptions: string[]
  focusedItemId?: string
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
const collapsedRootIds = shallowRef(new Set<string>())

watch(
  () => props.focusedItemId,
  (focusedItemId) => {
    if (!focusedItemId || !collapsedRootIds.value.has(focusedItemId)) {
      return
    }

    const next = new Set(collapsedRootIds.value)
    next.delete(focusedItemId)
    collapsedRootIds.value = next
  },
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
}

function expandAll() {
  collapsedRootIds.value = new Set()
}

const incompleteCount = computed(() =>
  countIncompleteQuotationItems(rootItems.value, props.lineItemEntryMode === 'quick'),
)

const itemsCount = computed(() => rootItems.value.length)

function jumpToFirstIncomplete() {
  const isQuick = props.lineItemEntryMode === 'quick'
  for (const item of rootItems.value) {
    const total = item.children.length === 0
      ? (hasIncompleteQuotationItem(item, isQuick) ? 1 : 0)
      : countIncompleteQuotationItems([item], isQuick)
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
</script>

<template>
  <section class="workbench" :aria-label="t('quotations.lineItems.aria')">
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
            :icon="allCollapsed ? 'pi pi-expand' : 'pi pi-compress'"
            :label="allCollapsed ? t('quotations.lineItems.expandAll') : t('quotations.lineItems.collapseAll')"
            severity="secondary"
            text
            @click="allCollapsed ? expandAll() : collapseAll()"
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
          :global-markup-rate="props.globalMarkupRate"
          :totals-config="props.totalsConfig"
          :exchange-rates="props.exchangeRates"
          :cost-currency-options="props.costCurrencyOptions"
          :focused="props.focusedItemId === entry.row.id"
          :expanded="isRootCardExpanded(entry.row.id)"
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
  gap: 12px;
  min-width: 0;
  padding-bottom: 14px;
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
  padding: 12px 0;
  margin: -2px -16px 0;
  padding-inline: 16px;
  background: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
}

.workbench-heading::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -8px;
  height: 8px;
  background: linear-gradient(180deg, rgb(15 23 42 / 5%), transparent);
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
  border-radius: 999px;
  background: var(--surface-muted);
}

.entry-mode-button {
  min-height: 26px;
  padding: 0 11px;
  border: 0;
  border-radius: 999px;
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
  background: rgb(255 255 255 / 60%);
}

.entry-mode-button-active {
  background: var(--surface-card);
  color: var(--accent);
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
  gap: 10px;
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
