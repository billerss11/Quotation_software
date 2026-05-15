<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useI18n } from 'vue-i18n'

import type { QuotationItem } from '../types'
import LineItemSummaryMetrics from './LineItemSummaryMetrics.vue'

type SummaryMode = 'totals' | 'unit'

type SummaryModeOption = {
  label: string
  value: SummaryMode
}

type SummaryMetric = {
  label: string
  value: string
  kind: 'default' | 'tax' | 'total'
}

const props = defineProps<{
  item: QuotationItem
  itemIndex: number
  totalItems: number
  displayItemNumber: number
  expanded: boolean
  itemName: string
  itemNameMissing: boolean
  summaryMode: SummaryMode
  summaryModeOptions: SummaryModeOption[]
  summaryMetrics: SummaryMetric[]
  collapsedNestedItemCount: number
  collapsedNestedItemCountLabel: string
}>()

const emit = defineEmits<{
  toggleExpanded: []
  updateItemName: [value: unknown]
  flushItemName: []
  moveRootItem: [direction: -1 | 1]
  duplicateRootItem: []
  openCalculationSheet: []
  removeItem: []
  setSummaryMode: [value: SummaryMode]
}>()

const { t } = useI18n()
</script>

<template>
  <header class="card-header" :class="{ 'card-header-collapsed': !props.expanded }">
    <button
      type="button"
      class="card-collapse-toggle"
      :aria-expanded="props.expanded"
      :aria-label="props.expanded ? t('quotations.lineItems.collapseItem') : t('quotations.lineItems.expandItem')"
      @click="emit('toggleExpanded')"
    >
      <i :class="props.expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
    </button>
    <span class="item-badge">{{ props.displayItemNumber }}</span>
    <InputText
      :class="['item-name-input', { 'field-missing': props.itemNameMissing }]"
      :model-value="props.itemName"
      :aria-label="t('quotations.lineItems.itemNameAria', { index: props.displayItemNumber })"
      :placeholder="t('quotations.lineItems.itemNamePlaceholder')"
      @update:model-value="emit('updateItemName', $event)"
      @blur="emit('flushItemName')"
    />
    <div class="header-actions">
      <Button
        v-tooltip.top="t('quotations.lineItems.moveUp')"
        icon="pi pi-arrow-up"
        severity="secondary"
        text
        rounded
        :disabled="props.itemIndex === 0"
        :aria-label="t('quotations.lineItems.moveItemUpAria', { index: props.displayItemNumber })"
        @click="emit('moveRootItem', -1)"
      />
      <Button
        v-tooltip.top="t('quotations.lineItems.moveDown')"
        icon="pi pi-arrow-down"
        severity="secondary"
        text
        rounded
        :disabled="props.itemIndex === props.totalItems - 1"
        :aria-label="t('quotations.lineItems.moveItemDownAria', { index: props.displayItemNumber })"
        @click="emit('moveRootItem', 1)"
      />
      <Button
        v-tooltip.top="t('quotations.lineItems.duplicate')"
        icon="pi pi-copy"
        severity="secondary"
        text
        rounded
        :aria-label="t('quotations.lineItems.duplicateItemAria', { index: props.displayItemNumber })"
        @click="emit('duplicateRootItem')"
      />
      <Button
        v-tooltip.top="t('quotations.lineItems.calculationSheet.open')"
        data-calculation-sheet-action="root"
        icon="pi pi-calculator"
        severity="secondary"
        text
        rounded
        :aria-label="t('quotations.lineItems.calculationSheet.openAria', { itemNumber: props.displayItemNumber })"
        @click="emit('openCalculationSheet')"
      />
      <Button
        v-tooltip.top="t('quotations.lineItems.delete')"
        icon="pi pi-trash"
        severity="danger"
        text
        rounded
        :aria-label="t('quotations.lineItems.deleteItemAria', { index: props.displayItemNumber })"
        @click="emit('removeItem')"
      />
    </div>

    <LineItemSummaryMetrics
      v-if="!props.expanded"
      variant="collapsed"
      :summary-mode="props.summaryMode"
      :summary-mode-options="props.summaryModeOptions"
      :metrics="props.summaryMetrics"
      :summary-mode-aria-label="t('quotations.lineItems.summaryModeAria')"
      :collapsed-nested-item-count="props.collapsedNestedItemCount"
      :collapsed-nested-item-count-label="props.collapsedNestedItemCountLabel"
      :collapsed-nested-item-aria-label="t('quotations.lineItems.collapsedNestedItemsAria', {
        count: props.collapsedNestedItemCount,
      })"
      @set-summary-mode="emit('setSummaryMode', $event)"
    />
  </header>
</template>

<style scoped>
.card-header {
  display: grid;
  grid-template-columns: auto 30px minmax(220px, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-raised);
  transition: background-color 0.18s ease;
}

.card-header-collapsed {
  border-bottom: none;
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

.item-badge {
  display: inline-grid;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.item-name-input {
  min-width: 0;
}

.item-name-input :deep(.p-inputtext) {
  border-color: transparent;
  background: var(--surface-card);
  min-height: 32px;
  padding: 0.36rem 0.7rem;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-strong);
}

.item-name-input :deep(.p-inputtext:hover) {
  border-color: var(--surface-border);
}

.field-missing {
  border-color: #f59e0b !important;
  box-shadow: 0 0 0 1px rgb(245 158 11 / 22%) !important;
}

.header-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  justify-content: flex-end;
}

@container line-item-card (max-width: 520px) {
  .card-header {
    grid-template-columns: auto 28px minmax(0, 1fr);
  }

  .header-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
}
</style>
