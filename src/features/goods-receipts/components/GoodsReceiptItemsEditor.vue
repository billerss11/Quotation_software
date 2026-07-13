<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { GoodsReceiptLineDraft, GoodsReceiptValidationWarning } from '../utils/goodsReceipt'

const lines = defineModel<GoodsReceiptLineDraft[]>({ required: true })
const props = defineProps<{
  warnings: GoodsReceiptValidationWarning[]
}>()
const { t } = useI18n()

const warningByLineId = computed(() => {
  const warnings = new Map<string, GoodsReceiptValidationWarning[]>()

  props.warnings.forEach((warning) => {
    warnings.set(warning.lineId, [...(warnings.get(warning.lineId) ?? []), warning])
  })

  return warnings
})
const hasSelectedLines = computed(() => lines.value.some((line) => line.selected))
const allLinesSelected = computed(() => lines.value.length > 0 && lines.value.every((line) => line.selected))

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
</script>

<template>
  <section class="goods-receipt-items" :aria-label="t('goodsReceipts.items.aria')">
    <header class="goods-receipt-items-header">
      <h3>{{ t('goodsReceipts.items.title') }}</h3>
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

    <div class="goods-receipt-items-table-wrap">
      <table class="goods-receipt-items-table">
        <thead>
          <tr>
            <th scope="col">{{ t('goodsReceipts.items.table.select') }}</th>
            <th scope="col">{{ t('goodsReceipts.items.table.description') }}</th>
            <th scope="col">{{ t('goodsReceipts.items.table.quantity') }}</th>
            <th scope="col">{{ t('goodsReceipts.items.table.unit') }}</th>
            <th scope="col">{{ t('goodsReceipts.items.table.remarks') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in lines" :key="line.id">
            <td>
              <Checkbox
                v-model="line.selected"
                binary
                :aria-label="t('goodsReceipts.items.selectLineAria', { description: line.description })"
              />
            </td>
            <td>
              <Textarea v-model="line.description" rows="2" auto-resize />
            </td>
            <td>
              <InputNumber
                :model-value="line.quantity"
                :min="0"
                :max-fraction-digits="2"
                @update:model-value="setLineQuantity(line, $event)"
              />
              <small class="goods-receipt-quoted-quantity">
                {{ t('goodsReceipts.items.quotedQuantity', { quantity: line.quotedQuantity, unit: line.unit }) }}
              </small>
              <small
                v-for="warning in warningByLineId.get(line.id) ?? []"
                :key="warning.code"
                class="goods-receipt-line-warning"
              >
                {{ getWarningMessage(warning) }}
              </small>
            </td>
            <td>
              <InputText v-model="line.unit" />
            </td>
            <td>
              <Textarea v-model="line.remarks" rows="2" auto-resize />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.goods-receipt-items {
  display: grid;
  gap: 8px;
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

.goods-receipt-selection-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.goods-receipt-items-table-wrap {
  max-height: 420px;
  overflow: auto;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: #ffffff;
}

.goods-receipt-items-table {
  width: 100%;
  min-width: 820px;
  border-collapse: collapse;
  font-size: 12px;
}

.goods-receipt-items-table th,
.goods-receipt-items-table td {
  padding: 8px;
  border-bottom: 1px solid var(--surface-border);
  text-align: left;
  vertical-align: top;
}

.goods-receipt-items-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface-card);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}

.goods-receipt-items-table th:first-child,
.goods-receipt-items-table td:first-child {
  width: 54px;
  text-align: center;
}

.goods-receipt-items-table th:nth-child(3),
.goods-receipt-items-table td:nth-child(3) {
  width: 150px;
}

.goods-receipt-items-table th:nth-child(4),
.goods-receipt-items-table td:nth-child(4) {
  width: 92px;
}

.goods-receipt-items-table th:nth-child(5),
.goods-receipt-items-table td:nth-child(5) {
  width: 170px;
}

.goods-receipt-items-table :deep(.p-inputtext),
.goods-receipt-items-table :deep(.p-textarea),
.goods-receipt-items-table :deep(.p-inputnumber),
.goods-receipt-items-table :deep(.p-inputnumber-input) {
  width: 100%;
}

.goods-receipt-quoted-quantity,
.goods-receipt-line-warning {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.3;
}

.goods-receipt-quoted-quantity {
  color: var(--text-muted);
}

.goods-receipt-line-warning {
  color: var(--warning);
  font-weight: 700;
}
</style>
