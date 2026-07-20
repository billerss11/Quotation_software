<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { GoodsReceiptLineDraft, GoodsReceiptValidationWarning } from '../utils/goodsReceipt'
import { isGoodsReceiptLineCustomized } from '../utils/goodsReceipt'

const props = defineProps<{
  line: GoodsReceiptLineDraft
  warnings: GoodsReceiptValidationWarning[]
}>()
const emit = defineEmits<{
  updateQuantity: [value: number]
  updateUnit: [value: string]
  updateDescription: [value: string]
  updateRemarks: [value: string]
  reset: []
  close: []
}>()
const { t } = useI18n()

const customized = computed(() => isGoodsReceiptLineCustomized(props.line))

function updateQuantity(value: unknown) {
  emit('updateQuantity', typeof value === 'number' && Number.isFinite(value) ? value : 0)
}

function getWarningMessage(warning: GoodsReceiptValidationWarning) {
  return t(`goodsReceipts.warnings.${warning.code}`)
}
</script>

<template>
  <section
    class="goods-receipt-customizer"
    :aria-labelledby="`goods-receipt-customizer-title-${props.line.id}`"
  >
    <header class="goods-receipt-customizer-header">
      <div class="goods-receipt-customizer-heading">
        <h4 :id="`goods-receipt-customizer-title-${props.line.id}`">
          {{ t('goodsReceipts.customizer.title', { itemNumber: props.line.sourceItemNumber }) }}
        </h4>
        <p>{{ props.line.description || t('goodsReceipts.items.unnamedLine') }}</p>
      </div>

      <div class="goods-receipt-customizer-actions">
        <Tag
          v-if="customized"
          severity="info"
          :value="t('goodsReceipts.customizer.customized')"
        />
        <Button
          size="small"
          severity="secondary"
          outlined
          :label="t('goodsReceipts.customizer.reset')"
          :disabled="!customized"
          @click="emit('reset')"
        />
        <Button
          size="small"
          severity="secondary"
          text
          rounded
          icon="pi pi-times"
          :aria-label="t('goodsReceipts.customizer.close')"
          @click="emit('close')"
        />
      </div>
    </header>

    <div class="goods-receipt-customizer-fields">
      <label class="goods-receipt-customizer-field">
        <span>{{ t('goodsReceipts.items.table.quantity') }}</span>
        <InputNumber
          :model-value="props.line.quantity"
          :min="0"
          :max-fraction-digits="2"
          @update:model-value="updateQuantity"
        />
        <small>
          {{ t('goodsReceipts.items.quotedQuantity', {
            quantity: props.line.quotedQuantity,
            unit: props.line.quotedUnit ?? props.line.unit,
          }) }}
        </small>
      </label>

      <label class="goods-receipt-customizer-field">
        <span>{{ t('goodsReceipts.items.table.unit') }}</span>
        <InputText
          :model-value="props.line.unit"
          @update:model-value="emit('updateUnit', String($event ?? ''))"
        />
      </label>

      <label class="goods-receipt-customizer-field is-wide">
        <span>{{ t('goodsReceipts.items.table.description') }}</span>
        <Textarea
          :model-value="props.line.description"
          rows="3"
          @update:model-value="emit('updateDescription', String($event ?? ''))"
        />
      </label>

      <label class="goods-receipt-customizer-field is-wide">
        <span>{{ t('goodsReceipts.items.table.remarks') }}</span>
        <Textarea
          :model-value="props.line.remarks"
          rows="3"
          @update:model-value="emit('updateRemarks', String($event ?? ''))"
        />
      </label>
    </div>

    <div v-if="props.warnings.length > 0" class="goods-receipt-customizer-warnings" aria-live="polite">
      <span v-for="warning in props.warnings" :key="warning.code">
        {{ getWarningMessage(warning) }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.goods-receipt-customizer {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--surface-border));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--accent) 4%, var(--surface-card));
}

.goods-receipt-customizer-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.goods-receipt-customizer-heading {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.goods-receipt-customizer-heading h4,
.goods-receipt-customizer-heading p {
  margin: 0;
}

.goods-receipt-customizer-heading h4 {
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 800;
}

.goods-receipt-customizer-heading p {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goods-receipt-customizer-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
}

.goods-receipt-customizer-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(110px, 0.55fr);
  gap: 10px;
}

.goods-receipt-customizer-field {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.goods-receipt-customizer-field.is-wide {
  grid-column: 1 / -1;
}

.goods-receipt-customizer-field > span {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
}

.goods-receipt-customizer-field small {
  color: var(--text-muted);
  font-size: 9px;
}

.goods-receipt-customizer-field :deep(.p-inputnumber),
.goods-receipt-customizer-field :deep(.p-inputnumber-input),
.goods-receipt-customizer-field :deep(.p-inputtext),
.goods-receipt-customizer-field :deep(.p-textarea) {
  width: 100%;
}

.goods-receipt-customizer-warnings {
  display: grid;
  gap: 2px;
  color: var(--warning);
  font-size: 10px;
  font-weight: 700;
}

@container (max-width: 460px) {
  .goods-receipt-customizer-header {
    align-items: stretch;
    flex-direction: column;
  }

  .goods-receipt-customizer-actions {
    flex-wrap: wrap;
  }

  .goods-receipt-customizer-fields {
    grid-template-columns: 1fr;
  }

  .goods-receipt-customizer-field.is-wide {
    grid-column: auto;
  }
}
</style>
