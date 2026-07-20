<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationRootItem } from '@/features/quotations/types'

import GoodsReceiptLineCustomizer from './GoodsReceiptLineCustomizer.vue'
import GoodsReceiptNavigator from './GoodsReceiptNavigator.vue'
import type {
  GoodsReceiptLineDraft,
  GoodsReceiptSelectionPreset,
  GoodsReceiptValidationWarning,
} from '../utils/goodsReceipt'
import {
  getGoodsReceiptPresetLineIds,
  getGoodsReceiptSelectionAfterToggle,
  resetGoodsReceiptLineCustomization,
} from '../utils/goodsReceipt'

const lines = defineModel<GoodsReceiptLineDraft[]>({ required: true })
const props = defineProps<{
  warnings: GoodsReceiptValidationWarning[]
  quotationItems: QuotationRootItem[]
}>()
const { t } = useI18n()

const showIncludedOnly = shallowRef(false)
const activeSourceItemId = shallowRef('')
const selectedLineCount = computed(() => lines.value.filter((line) => line.selected).length)
const hasSelectedLines = computed(() => selectedLineCount.value > 0)
const activeLine = computed(() =>
  lines.value.find((line) => line.sourceItemId === activeSourceItemId.value) ?? null,
)
const activeLineWarnings = computed(() =>
  activeLine.value
    ? props.warnings.filter((warning) => warning.lineId === activeLine.value?.id)
    : [],
)
const selectionPresetOptions = computed<{ label: string, value: GoodsReceiptSelectionPreset }[]>(() => [
  { label: t('goodsReceipts.presets.summary'), value: 'summary' },
  { label: t('goodsReceipts.presets.grouped'), value: 'grouped' },
  { label: t('goodsReceipts.presets.detailed'), value: 'detailed' },
])
const activeSelectionPreset = computed<GoodsReceiptSelectionPreset | null>(() => {
  const selectedIds = new Set(
    lines.value.filter((line) => line.selected).map((line) => line.sourceItemId),
  )

  return selectionPresetOptions.value.find(({ value }) => {
    const presetIds = getGoodsReceiptPresetLineIds(lines.value, value)
    return presetIds.size === selectedIds.size
      && [...presetIds].every((id) => selectedIds.has(id))
  })?.value ?? null
})

function selectPreset(preset: GoodsReceiptSelectionPreset | null | undefined) {
  if (!preset) {
    return
  }

  const selectedIds = getGoodsReceiptPresetLineIds(lines.value, preset)

  lines.value.forEach((line) => {
    line.selected = selectedIds.has(line.sourceItemId)
  })
  closeCustomizerIfInactive()
}

function setLineSelected(sourceItemId: string, selected: boolean) {
  const selectedIds = getGoodsReceiptSelectionAfterToggle(lines.value, sourceItemId, selected)

  lines.value.forEach((line) => {
    line.selected = selectedIds.has(line.sourceItemId)
  })
  closeCustomizerIfInactive()
}

function excludeAll() {
  lines.value.forEach((line) => {
    line.selected = false
  })
  activeSourceItemId.value = ''
}

function openCustomizer(sourceItemId: string) {
  const line = lines.value.find((candidate) => candidate.sourceItemId === sourceItemId)

  if (line?.selected) {
    activeSourceItemId.value = sourceItemId
  }
}

function closeCustomizerIfInactive() {
  if (!activeLine.value?.selected) {
    activeSourceItemId.value = ''
  }
}

function setActiveLineQuantity(value: number) {
  if (activeLine.value) {
    activeLine.value.quantity = value
  }
}

function setActiveLineUnit(value: string) {
  if (activeLine.value) {
    activeLine.value.unit = value
  }
}

function setActiveLineDescription(value: string) {
  if (activeLine.value) {
    activeLine.value.description = value
  }
}

function setActiveLineRemarks(value: string) {
  if (activeLine.value) {
    activeLine.value.remarks = value
  }
}

function resetActiveLine() {
  if (activeLine.value) {
    resetGoodsReceiptLineCustomization(activeLine.value)
  }
}
</script>

<template>
  <section class="goods-receipt-items" :aria-label="t('goodsReceipts.items.aria')">
    <header class="goods-receipt-items-header">
      <div class="goods-receipt-items-heading">
        <h3>{{ t('goodsReceipts.items.title') }}</h3>
        <p>{{ t('goodsReceipts.items.receiptLineCount', selectedLineCount) }}</p>
      </div>

      <div
        class="goods-receipt-selection-actions"
        role="group"
        :aria-label="t('goodsReceipts.items.selectionControlsAria')"
      >
        <label class="goods-receipt-preset-field">
          <span>{{ t('goodsReceipts.presets.label') }}</span>
          <Select
            :model-value="activeSelectionPreset"
            :options="selectionPresetOptions"
            option-label="label"
            option-value="value"
            :placeholder="t('goodsReceipts.presets.custom')"
            @update:model-value="selectPreset"
          />
        </label>
        <Button
          size="small"
          severity="secondary"
          :outlined="!showIncludedOnly"
          icon="pi pi-filter"
          :label="t('goodsReceipts.items.includedOnly')"
          :aria-pressed="showIncludedOnly"
          @click="showIncludedOnly = !showIncludedOnly"
        />
        <Button
          size="small"
          severity="secondary"
          outlined
          :label="t('goodsReceipts.actions.excludeAll')"
          :disabled="!hasSelectedLines"
          @click="excludeAll"
        />
      </div>
    </header>

    <GoodsReceiptNavigator
      :items="props.quotationItems"
      :lines="lines"
      :included-only="showIncludedOnly"
      @edit-line="openCustomizer"
      @set-line-selected="setLineSelected"
    />

    <GoodsReceiptLineCustomizer
      v-if="activeLine"
      :line="activeLine"
      :warnings="activeLineWarnings"
      @update-quantity="setActiveLineQuantity"
      @update-unit="setActiveLineUnit"
      @update-description="setActiveLineDescription"
      @update-remarks="setActiveLineRemarks"
      @reset="resetActiveLine"
      @close="activeSourceItemId = ''"
    />
    <p v-else class="goods-receipt-customizer-hint">
      {{ t('goodsReceipts.customizer.hint') }}
    </p>
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
  align-items: end;
  justify-content: space-between;
  gap: 12px;
}

.goods-receipt-items-heading {
  display: grid;
  flex: 0 0 auto;
  gap: 2px;
}

.goods-receipt-items-heading h3,
.goods-receipt-items-heading p,
.goods-receipt-customizer-hint {
  margin: 0;
}

.goods-receipt-items-heading h3 {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 800;
}

.goods-receipt-items-heading p,
.goods-receipt-customizer-hint {
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.4;
}

.goods-receipt-selection-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: end;
  gap: 6px;
}

.goods-receipt-preset-field {
  display: grid;
  gap: 3px;
  width: min(230px, 100%);
}

.goods-receipt-preset-field > span {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
}

.goods-receipt-preset-field :deep(.p-select) {
  width: 100%;
}

.goods-receipt-customizer-hint {
  padding: 8px 10px;
  border: 1px dashed var(--surface-border);
  border-radius: var(--radius-md);
  text-align: center;
}

@container (max-width: 620px) {
  .goods-receipt-items-header {
    align-items: stretch;
    flex-direction: column;
  }

  .goods-receipt-selection-actions {
    justify-content: flex-start;
  }
}

@container (max-width: 420px) {
  .goods-receipt-preset-field {
    width: 100%;
  }
}
</style>
