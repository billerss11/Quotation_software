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
  addChildItem: []
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
    :class="{ 'card-header-collapsed': !props.expanded, 'card-header-expanded': props.expanded }"
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
        compact
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
        v-if="props.expanded"
        v-tooltip.top="t('quotations.lineItems.addChildItem')"
        icon="pi pi-plus"
        severity="secondary"
        text
        :aria-label="t('quotations.lineItems.addChildItemAria', { index: props.displayItemNumber })"
        @click="emit('addChildItem')"
      />
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
  scroll-margin-top: calc(var(--line-items-child-header-top, 54px) + 36px);
  display: grid;
  grid-template-columns: 24px 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 6px;
  padding: 6px 10px;
  background: var(--surface-raised);
}
.card-collapse-toggle {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
}
.card-collapse-toggle:hover {
  color: var(--accent);
  background: var(--surface-hover);
}
.card-collapse-toggle:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.item-badge {
  display: inline-grid;
  place-items: center;
  height: 28px;
  min-width: 28px;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--accent);
  color: var(--text-on-accent);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.item-text-fields {
  display: contents;
}
.item-name-input {
  grid-column: 3;
  grid-row: 1;
  min-width: 0;
  width: 100%;
  min-height: 30px;
  padding: 5px 8px;
  border-color: transparent;
  background: transparent;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 650;
  box-shadow: none;
}
.item-name-input:hover {
  border-color: var(--surface-border);
}
.item-name-input:focus {
  background: var(--surface-card);
}
.item-description-field {
  grid-column: 3 / -1;
  grid-row: 2;
  min-width: 0;
  width: 100%;
}
.field-missing {
  border-color: var(--warning) !important;
}
.header-actions {
  display: flex;
  grid-column: 4;
  grid-row: 1;
  align-items: center;
  gap: 2px;
  padding-left: 8px;
  border-left: 1px solid var(--surface-border);
}
.header-actions :deep(.p-button) {
  width: 26px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  box-shadow: none;
}
.header-actions :deep(.p-button:hover) {
  background: var(--surface-hover);
}
/* Override the app-wide secondary-button fill only in this action strip. */
.header-actions :deep(.p-button.p-button-secondary) {
  border-color: transparent !important;
  background: transparent !important;
  color: var(--text-muted) !important;
}
.header-actions :deep(.p-button.p-button-secondary:not(:disabled):hover) {
  background: var(--surface-hover) !important;
  color: var(--text-strong) !important;
}
.header-actions :deep(.p-button.p-button-danger) {
  color: var(--danger);
}
.header-actions :deep(.p-button.p-button-danger:hover) {
  background: var(--danger-soft);
}
@container line-item-card (min-width: 900px) {
  .card-header-expanded {
    grid-template-columns: 24px 28px minmax(0, 1.65fr) minmax(100px, 1fr) auto;
  }
  .card-header-expanded .item-description-field {
    grid-column: 4;
    grid-row: 1;
  }
  .card-header-expanded .header-actions {
    grid-column: 5;
  }
}
@container line-item-card (max-width: 640px) {
  .card-header {
    grid-template-columns: 24px 28px minmax(0, 1fr);
  }
  .header-actions {
    grid-column: 3;
    grid-row: 2;
    justify-self: end;
    padding-left: 0;
    border-left: 0;
  }
  .item-description-field {
    grid-column: 1 / -1;
    grid-row: 3;
  }
}
</style>
