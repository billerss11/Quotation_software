<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed, nextTick, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationRootItem } from '@/features/quotations/types'

import GoodsReceiptNavigator from './GoodsReceiptNavigator.vue'
import type { GoodsReceiptLineDraft, GoodsReceiptValidationWarning } from '../utils/goodsReceipt'

const lines = defineModel<GoodsReceiptLineDraft[]>({ required: true })
const props = defineProps<{
  warnings: GoodsReceiptValidationWarning[]
  quotationItems: QuotationRootItem[]
}>()
const { t } = useI18n()
const lineListRef = useTemplateRef<HTMLDivElement>('lineList')

const warningByLineId = computed(() => {
  const warnings = new Map<string, GoodsReceiptValidationWarning[]>()

  props.warnings.forEach((warning) => {
    warnings.set(warning.lineId, [...(warnings.get(warning.lineId) ?? []), warning])
  })

  return warnings
})
const hasSelectedLines = computed(() => lines.value.some((line) => line.selected))
const allLinesSelected = computed(() => lines.value.length > 0 && lines.value.every((line) => line.selected))
const selectedLineCount = computed(() => lines.value.filter((line) => line.selected).length)
const expandedLineIds = shallowRef(new Set<string>())
const focusedSourceItemId = shallowRef('')

function selectAll() {
  lines.value.forEach((line) => {
    line.selected = true
  })
}

function unselectAll() {
  lines.value.forEach((line) => {
    line.selected = false
  })
}

function setLineQuantity(line: GoodsReceiptLineDraft, value: unknown) {
  line.quantity = typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getWarningMessage(warning: GoodsReceiptValidationWarning) {
  return t(`goodsReceipts.warnings.${warning.code}`)
}

function toggleLineDetails(lineId: string) {
  const nextIds = new Set(expandedLineIds.value)

  if (nextIds.has(lineId)) {
    nextIds.delete(lineId)
  } else {
    nextIds.add(lineId)
  }

  expandedLineIds.value = nextIds
}

function isLineExpanded(lineId: string) {
  return expandedLineIds.value.has(lineId)
}

function getLineSummary(description: string) {
  return description.trim() || t('goodsReceipts.items.unnamedLine')
}

async function scrollToLine(sourceItemId: string) {
  focusedSourceItemId.value = sourceItemId
  await nextTick()

  const target = [...(lineListRef.value?.querySelectorAll<HTMLElement>('[data-source-item-id]') ?? [])]
    .find((element) => element.dataset.sourceItemId === sourceItemId)

  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target?.focus({ preventScroll: true })
}
</script>

<template>
  <section class="goods-receipt-items" :aria-label="t('goodsReceipts.items.aria')">
    <header class="goods-receipt-items-header">
      <div class="goods-receipt-items-heading">
        <h3>{{ t('goodsReceipts.items.title') }}</h3>
        <p>
          {{ t('goodsReceipts.items.selectedCount', {
            selected: selectedLineCount,
            total: lines.length,
          }) }}
        </p>
      </div>
      <div class="goods-receipt-selection-actions">
        <Button
          size="small"
          severity="secondary"
          outlined
          :label="t('goodsReceipts.actions.selectAll')"
          :disabled="allLinesSelected"
          @click="selectAll"
        />
        <Button
          size="small"
          severity="secondary"
          outlined
          :label="t('goodsReceipts.actions.unselectAll')"
          :disabled="!hasSelectedLines"
          @click="unselectAll"
        />
      </div>
    </header>

    <GoodsReceiptNavigator
      :items="props.quotationItems"
      :lines="lines"
      @select-line="scrollToLine"
    />

    <div ref="lineList" class="goods-receipt-line-list">
      <article
        v-for="(line, index) in lines"
        :key="line.id"
        class="goods-receipt-line-row"
        :class="{
          'is-selected': line.selected,
          'is-focused': focusedSourceItemId === line.sourceItemId,
        }"
        :data-source-item-id="line.sourceItemId"
        tabindex="-1"
      >
        <div class="goods-receipt-line-main">
          <label class="goods-receipt-line-selector" :for="`goods-receipt-line-${index}`">
            <span class="goods-receipt-line-number">{{ index + 1 }}</span>
            <span class="goods-receipt-checkbox-target">
              <Checkbox
                v-model="line.selected"
                binary
                :input-id="`goods-receipt-line-${index}`"
                :aria-label="t('goodsReceipts.items.selectLineAria', { description: line.description })"
              />
            </span>
          </label>

          <div class="goods-receipt-line-summary">
            <label class="goods-receipt-line-description" :for="`goods-receipt-line-${index}`">
              {{ getLineSummary(line.description) }}
            </label>
            <small
              v-for="warning in warningByLineId.get(line.id) ?? []"
              :key="warning.code"
              class="goods-receipt-line-warning"
            >
              {{ getWarningMessage(warning) }}
            </small>
          </div>

          <label class="goods-receipt-compact-field goods-receipt-quantity-field">
            <span>{{ t('goodsReceipts.items.table.quantity') }}</span>
            <span class="goods-receipt-quantity-input">
              <InputNumber
                :model-value="line.quantity"
                :min="0"
                :max-fraction-digits="2"
                @update:model-value="setLineQuantity(line, $event)"
              />
            </span>
            <small>{{ t('goodsReceipts.items.quotedQuantity', { quantity: line.quotedQuantity, unit: line.unit }) }}</small>
          </label>

          <label class="goods-receipt-compact-field goods-receipt-unit-field">
            <span>{{ t('goodsReceipts.items.table.unit') }}</span>
            <InputText v-model="line.unit" />
          </label>

          <Button
            size="small"
            severity="secondary"
            text
            rounded
            class="goods-receipt-line-edit-button"
            :icon="isLineExpanded(line.id) ? 'pi pi-chevron-up' : 'pi pi-pencil'"
            :aria-label="t(isLineExpanded(line.id) ? 'goodsReceipts.actions.hideLineDetails' : 'goodsReceipts.actions.editLineDetails')"
            :aria-expanded="isLineExpanded(line.id)"
            v-tooltip.left="t(isLineExpanded(line.id) ? 'goodsReceipts.actions.hideLineDetails' : 'goodsReceipts.actions.editLineDetails')"
            @click="toggleLineDetails(line.id)"
          />
        </div>

        <div v-if="isLineExpanded(line.id)" class="goods-receipt-line-details">
          <label class="goods-receipt-detail-field">
            <span>{{ t('goodsReceipts.items.table.description') }}</span>
            <Textarea v-model="line.description" rows="3" />
          </label>
          <label class="goods-receipt-detail-field">
            <span>{{ t('goodsReceipts.items.table.remarks') }}</span>
            <Textarea v-model="line.remarks" rows="3" />
          </label>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.goods-receipt-items {
  display: grid;
  gap: 8px;
  container-type: inline-size;
}

.goods-receipt-items-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.goods-receipt-items-header h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 800;
}

.goods-receipt-items-heading {
  display: grid;
  gap: 2px;
}

.goods-receipt-items-heading p {
  margin: 0;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.goods-receipt-selection-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.goods-receipt-line-list {
  display: grid;
  max-height: min(52vh, 520px);
  overflow: auto;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-card);
}

.goods-receipt-line-row {
  border-bottom: 1px solid var(--surface-border);
  background: #ffffff;
  transition: background-color 120ms ease, box-shadow 120ms ease;
}

.goods-receipt-line-row:last-child {
  border-bottom: 0;
}

.goods-receipt-line-row.is-selected {
  background: color-mix(in srgb, var(--accent) 5%, #ffffff);
  box-shadow: inset 3px 0 0 var(--accent);
}

.goods-receipt-line-row.is-focused {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

.goods-receipt-line-main {
  display: grid;
  grid-template-columns: 44px minmax(180px, 1fr) 128px 82px 34px;
  grid-template-areas: 'selector summary quantity unit action';
  align-items: start;
  gap: 10px;
  padding: 10px 8px;
}

.goods-receipt-line-selector {
  grid-area: selector;
  display: grid;
  justify-items: center;
  gap: 4px;
  min-height: 44px;
  cursor: pointer;
}

.goods-receipt-line-number {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
}

.goods-receipt-checkbox-target {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
}

.goods-receipt-line-selector:hover .goods-receipt-checkbox-target {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--surface-border));
  background: color-mix(in srgb, var(--accent) 7%, #ffffff);
}

.goods-receipt-line-summary {
  grid-area: summary;
  display: grid;
  gap: 4px;
  min-width: 0;
}

.goods-receipt-line-description {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  cursor: pointer;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.goods-receipt-compact-field {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.goods-receipt-compact-field > span,
.goods-receipt-detail-field > span {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
}

.goods-receipt-compact-field small,
.goods-receipt-line-warning {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.3;
}

.goods-receipt-quantity-field {
  grid-area: quantity;
}

.goods-receipt-unit-field {
  grid-area: unit;
}

.goods-receipt-line-edit-button {
  grid-area: action;
}

.goods-receipt-line-main :deep(.p-inputtext),
.goods-receipt-line-main :deep(.p-inputnumber),
.goods-receipt-line-main :deep(.p-inputnumber-input),
.goods-receipt-line-details :deep(.p-textarea) {
  width: 100%;
}

.goods-receipt-line-warning {
  color: var(--warning);
  font-weight: 700;
}

.goods-receipt-line-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 0 10px 12px 62px;
}

.goods-receipt-detail-field {
  display: grid;
  gap: 5px;
  min-width: 0;
}

@container (max-width: 580px) {
  .goods-receipt-line-main {
    grid-template-columns: 44px minmax(0, 1fr) 88px 34px;
    grid-template-areas:
      'selector summary summary action'
      '. quantity unit .';
  }

  .goods-receipt-line-details {
    grid-template-columns: 1fr;
    padding-left: 62px;
  }
}
</style>
