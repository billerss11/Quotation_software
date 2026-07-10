<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
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
      <Textarea
        v-if="props.expanded"
        class="item-description-input"
        :data-history-target="`item:${props.item.id}:description`"
        :model-value="props.descriptionValue"
        :aria-label="t('quotations.lineItems.itemDescriptionAria', { index: props.displayItemNumber })"
        rows="1"
        auto-resize
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
  grid-template-columns: 28px 34px minmax(240px, 1fr) auto;
  align-items: start;
  gap: 7px;
  padding: 7px 9px 7px 11px;
  background:
    linear-gradient(180deg, #ffffff 0, color-mix(in srgb, var(--surface-raised) 46%, white) 100%),
    #ffffff;
  transition: background-color 0.16s ease;
}

.card-header-collapsed {
  border-bottom: none;
  align-items: center;
}

.card-collapse-toggle {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--surface-border));
  border-radius: var(--radius-sm);
  color: var(--accent);
  background: #ffffff;
  cursor: pointer;
  transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.card-collapse-toggle:hover {
  border-color: var(--accent-soft);
  color: var(--accent-hover);
  background: var(--accent-surface);
}

.item-badge {
  display: inline-grid;
  min-width: 30px;
  height: 26px;
  flex-shrink: 0;
  place-items: center;
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, transparent);
  border-radius: var(--radius-sm);
  background: var(--accent-hover);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.item-name-input {
  min-width: 0;
}

.item-text-fields {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.item-name-input {
  border-color: transparent;
  background: transparent;
  min-height: 28px;
  padding: 0.26rem 0.48rem;
  font-size: 14px;
  font-weight: 760;
  color: var(--text-strong);
  box-shadow: none;
}

.item-name-input:hover {
  border-color: var(--surface-border);
  background: color-mix(in srgb, var(--surface-card) 74%, white);
}

.item-name-input:focus {
  background: #ffffff;
}

.item-description-input {
  width: 100%;
  min-height: 26px;
  max-height: 54px;
  padding: 0.25rem 0.48rem;
  border-color: color-mix(in srgb, var(--surface-border) 68%, transparent);
  background: color-mix(in srgb, var(--surface-muted) 68%, white);
  font-size: 12px;
  line-height: 1.25;
  white-space: pre-wrap;
  overflow: auto;
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
  padding: 1px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 70%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--surface-muted) 76%, white);
}

.header-actions :deep(.p-button) {
  width: 25px;
  height: 25px;
  padding: 0;
  border-radius: var(--radius-xs);
}

@container line-item-card (max-width: 520px) {
  .card-header {
    grid-template-columns: 26px 32px minmax(0, 1fr);
  }

  .header-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
}
</style>
