<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useI18n } from 'vue-i18n'

import type { QuotationItem } from '../types'
import LineItemDescriptionField from './LineItemDescriptionField.vue'
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
  descriptionValue: string
  summaryMode: SummaryMode
  summaryModeOptions: SummaryModeOption[]
  summaryMetrics: SummaryMetric[]
  collapsedNestedItemCount: number
  collapsedNestedItemCountLabel: string
  hasChildItems: boolean
  itemLevelsExpanded: boolean
}>()

const emit = defineEmits<{
  toggleExpanded: []
  updateItemName: [value: unknown]
  flushItemName: []
  updateItemDescription: [value: unknown]
  flushItemDescription: []
  moveRootItem: [direction: -1 | 1]
  duplicateRootItem: []
  openCalculationSheet: []
  openCalculationExplanation: []
  toggleItemLevels: []
  removeItem: []
  setSummaryMode: [value: SummaryMode]
}>()

const { t } = useI18n()
</script>

<template>
  <header
    class="card-header"
    :class="{ 'card-header-collapsed': !props.expanded }"
    :data-item-focus-anchor="props.item.id"
  >
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
    <div class="item-text-fields">
      <InputText
        :class="['item-name-input', { 'field-missing': props.itemNameMissing }]"
        :data-history-target="`item:${props.item.id}:name`"
        :model-value="props.itemName"
        :aria-label="t('quotations.lineItems.itemNameAria', { index: props.displayItemNumber })"
        :placeholder="t('quotations.lineItems.itemNamePlaceholder')"
        @update:model-value="emit('updateItemName', $event)"
        @blur="emit('flushItemName')"
      />
      <LineItemDescriptionField
        v-if="props.expanded"
        class="item-description-field"
        :model-value="props.descriptionValue"
        :history-target="`item:${props.item.id}:description`"
        :item-number="String(props.displayItemNumber)"
        :input-aria-label="t('quotations.lineItems.itemDescriptionAria', { index: props.displayItemNumber })"
        :placeholder="t('quotations.lineItems.descriptionPlaceholder')"
        @update:model-value="emit('updateItemDescription', $event)"
        @blur="emit('flushItemDescription')"
      />
    </div>
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
        v-if="props.hasChildItems"
        v-tooltip.top="props.itemLevelsExpanded
          ? t('quotations.lineItems.collapseItemLevels')
          : t('quotations.lineItems.expandItemLevels')"
        :icon="props.itemLevelsExpanded ? 'pi pi-angle-double-up' : 'pi pi-angle-double-down'"
        severity="secondary"
        text
        rounded
        :aria-label="props.itemLevelsExpanded
          ? t('quotations.lineItems.collapseItemLevelsAria', { index: props.displayItemNumber })
          : t('quotations.lineItems.expandItemLevelsAria', { index: props.displayItemNumber })"
        @click="emit('toggleItemLevels')"
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
        v-tooltip.top="t('quotations.lineItems.calculationExplanation.open')"
        data-calculation-explanation-action="root"
        icon="pi pi-info-circle"
        severity="secondary"
        text
        rounded
        :aria-label="t('quotations.lineItems.calculationExplanation.openAria', { itemNumber: props.displayItemNumber })"
        @click="emit('openCalculationExplanation')"
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
  grid-template-columns: 28px 38px minmax(180px, 1fr) auto;
  grid-template-rows: 30px auto;
  align-items: start;
  gap: 5px 7px;
  padding: 8px 9px 7px;
  background:
    linear-gradient(125deg, var(--surface-card) 0, color-mix(in srgb, var(--accent-surface) 22%, var(--surface-card)) 100%),
    var(--surface-card);
  transition: background-color 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

.card-header-collapsed {
  border-bottom: none;
  align-items: center;
}

.card-collapse-toggle {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--surface-border));
  border-radius: 9px;
  color: var(--accent);
  background: var(--surface-card);
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 74%);
  transition:
    transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
    background-color 200ms cubic-bezier(0.32, 0.72, 0, 1),
    border-color 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.card-collapse-toggle:hover {
  border-color: var(--accent-soft);
  color: var(--accent-hover);
  background: var(--accent-surface);
}

.card-collapse-toggle:active {
  transform: scale(0.93);
}

.item-badge {
  display: inline-grid;
  min-width: 36px;
  height: 28px;
  flex-shrink: 0;
  place-items: center;
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, transparent);
  border-radius: 9px;
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  color: var(--text-on-accent);
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.item-name-input {
  min-width: 0;
}

.item-text-fields {
  display: contents;
}

.item-name-input {
  grid-column: 3;
  grid-row: 1;
  border-color: transparent;
  background: transparent;
  min-height: 28px;
  padding: 0.18rem 0.42rem;
  font-size: 14px;
  font-weight: 760;
  color: var(--text-strong);
  box-shadow: none;
}

.item-name-input:hover {
  border-color: var(--surface-border);
  background: color-mix(in srgb, var(--surface-card) 74%, var(--surface-raised));
}

.item-name-input:focus {
  background: var(--surface-card);
}

.item-description-field {
  grid-column: 1 / -1;
  grid-row: 2;
  width: 100%;
}

.item-description-field :deep(.description-field-textarea) {
  min-height: 42px;
  max-height: 96px;
  padding: 0.42rem 0.5rem;
  padding-right: 2.1rem;
  border-color: color-mix(in srgb, var(--surface-border) 68%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--surface-card) 84%, var(--surface-muted));
  font-size: 12px;
  line-height: 1.35;
  white-space: pre-wrap;
  overflow: auto;
  box-shadow: inset 0 1px 2px rgb(15 23 42 / 3%);
}

.field-missing {
  border-color: #f59e0b !important;
  box-shadow: 0 0 0 1px rgb(245 158 11 / 22%) !important;
}

.header-actions {
  display: flex;
  gap: 1px;
  flex-shrink: 0;
  justify-content: flex-end;
  align-self: start;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--surface-border) 62%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-muted) 60%, var(--surface-card));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 76%);
}

.header-actions :deep(.p-button) {
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: var(--radius-xs);
}

.header-actions :deep(.p-button) {
  transition:
    transform 180ms cubic-bezier(0.32, 0.72, 0, 1),
    background-color 180ms cubic-bezier(0.32, 0.72, 0, 1);
}

.header-actions :deep(.p-button:hover) {
  transform: translateY(-1px);
}

@container line-item-card (max-width: 380px) {
  .card-header {
    grid-template-columns: 26px 32px minmax(0, 1fr);
  }

  .header-actions {
    grid-column: 1 / -1;
    grid-row: 3;
    justify-content: flex-start;
  }

  .item-description-field {
    grid-column: 1 / -1;
  }
}
</style>
