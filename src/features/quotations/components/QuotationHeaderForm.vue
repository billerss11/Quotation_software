<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'

import type { CurrencyCode, QuotationHeader } from '../types'

const model = defineModel<QuotationHeader>({ required: true })

const currencyOptions: CurrencyCode[] = ['USD', 'EUR', 'CNY', 'GBP']
</script>

<template>
  <section class="header-form" aria-label="Quotation header">
    <div class="form-section">
      <h2 class="section-title">Quotation details</h2>
      <div class="field-stack">
        <label class="field">
          <span>Quotation number</span>
          <InputText v-model="model.quotationNumber" />
        </label>
        <label class="field">
          <span>Quotation date</span>
          <InputText v-model="model.quotationDate" type="date" />
        </label>
        <label class="field">
          <span>Project name</span>
          <InputText v-model="model.projectName" />
        </label>
      </div>
    </div>

    <div class="form-section">
      <h2 class="section-title">Customer</h2>
      <div class="field-stack">
        <label class="field">
          <span>Customer company</span>
          <InputText v-model="model.customerCompany" />
        </label>
        <label class="field">
          <span>Customer name</span>
          <InputText v-model="model.customerName" />
        </label>
        <label class="field">
          <span>Contact person</span>
          <InputText v-model="model.contactPerson" />
        </label>
        <label class="field">
          <span>Contact details</span>
          <InputText v-model="model.contactDetails" />
        </label>
      </div>
    </div>

    <div class="form-section">
      <h2 class="section-title">Terms</h2>
      <div class="field-stack">
        <label class="field">
          <span>Validity period</span>
          <InputText v-model="model.validityPeriod" />
        </label>
        <label class="field">
          <span>Currency</span>
          <Select v-model="model.currency" :options="currencyOptions" />
        </label>
        <label class="field">
          <span>Notes / remarks</span>
          <Textarea v-model="model.notes" rows="4" auto-resize />
        </label>
      </div>
    </div>
  </section>
</template>

<style scoped>
.header-form {
  display: grid;
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-card);
  box-shadow: var(--shadow-control);
}

.form-section {
  display: grid;
  gap: 12px;
}

.form-section + .form-section {
  padding-top: 18px;
  border-top: 1px solid var(--surface-border);
}

.section-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 800;
}

.field-stack {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.field {
  display: grid;
  gap: 7px;
  min-width: 0;
  color: var(--text-body);
  font-size: 13px;
  font-weight: 700;
}

.field :deep(.p-inputtext),
.field :deep(.p-select),
.field :deep(.p-textarea) {
  width: 100%;
  min-width: 0;
}

.field :deep(.p-inputtext),
.field :deep(.p-select-label),
.field :deep(.p-textarea) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.field :deep(.p-textarea) {
  min-height: 96px;
  resize: vertical;
}
</style>
