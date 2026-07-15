<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { useI18n } from 'vue-i18n'

import type { GoodsReceiptDraft } from '../utils/goodsReceipt'

const model = defineModel<GoodsReceiptDraft>({ required: true })
const emit = defineEmits<{
  grNumberEdited: []
}>()
const { t } = useI18n()

function updateGrNumber(value: string | undefined) {
  model.value.grNumber = value ?? ''
  emit('grNumberEdited')
}
</script>

<template>
  <section class="goods-receipt-form" :aria-label="t('goodsReceipts.form.aria')">
    <div class="goods-receipt-form-grid">
      <label class="goods-receipt-field">
        <span>{{ t('goodsReceipts.fields.grNumber') }}</span>
        <InputText
          :model-value="model.grNumber"
          @update:model-value="updateGrNumber"
        />
      </label>
      <label class="goods-receipt-field">
        <span>{{ t('goodsReceipts.fields.documentDate') }}</span>
        <input v-model="model.documentDate" class="goods-receipt-date-input" type="date" />
      </label>
      <label class="goods-receipt-field">
        <span>{{ t('goodsReceipts.fields.customerReference') }}</span>
        <InputText v-model="model.customerReference" />
      </label>
      <label class="goods-receipt-field">
        <span>{{ t('goodsReceipts.fields.projectName') }}</span>
        <InputText v-model="model.projectName" />
      </label>
    </div>

    <label class="goods-receipt-field">
      <span>{{ t('goodsReceipts.fields.deliveryReference') }}</span>
      <Textarea v-model="model.deliveryReference" rows="3" auto-resize />
    </label>

    <div class="goods-receipt-form-grid">
      <label class="goods-receipt-field">
        <span>{{ t('goodsReceipts.fields.receivingCompany') }}</span>
        <InputText v-model="model.receivingCompany" />
      </label>
      <label class="goods-receipt-field">
        <span>{{ t('goodsReceipts.fields.deliveryContact') }}</span>
        <InputText v-model="model.deliveryContact" />
      </label>
    </div>

    <label class="goods-receipt-field">
      <span>{{ t('goodsReceipts.fields.deliveryAddress') }}</span>
      <Textarea v-model="model.deliveryAddress" rows="3" auto-resize />
    </label>
    <label class="goods-receipt-field">
      <span>{{ t('goodsReceipts.fields.contactDetails') }}</span>
      <Textarea v-model="model.contactDetails" rows="3" auto-resize />
    </label>

    <div class="goods-receipt-form-grid">
      <label class="goods-receipt-field">
        <span>{{ t('goodsReceipts.fields.supplierCompany') }}</span>
        <InputText v-model="model.supplierCompany" />
      </label>
      <label class="goods-receipt-field">
        <span>{{ t('goodsReceipts.fields.supplierContact') }}</span>
        <InputText v-model="model.supplierContact" />
      </label>
    </div>

    <label class="goods-receipt-field">
      <span>{{ t('goodsReceipts.fields.preparedBy') }}</span>
      <InputText v-model="model.preparedBy" />
    </label>
    <label class="goods-receipt-field">
      <span>{{ t('goodsReceipts.fields.generalRemarks') }}</span>
      <Textarea v-model="model.remarks" rows="3" auto-resize />
    </label>
  </section>
</template>

<style scoped>
.goods-receipt-form {
  display: grid;
  gap: 12px;
}

.goods-receipt-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.goods-receipt-field {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.goods-receipt-field > span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.goods-receipt-field :deep(.p-inputtext),
.goods-receipt-field :deep(.p-textarea),
.goods-receipt-date-input {
  width: 100%;
}

.goods-receipt-date-input {
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  color: var(--text-body);
  font: inherit;
}

@media (max-width: 980px) {
  .goods-receipt-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
