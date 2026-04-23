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
    <div class="form-grid">
      <label class="field">
        <span>Quotation number</span>
        <InputText v-model="model.quotationNumber" />
      </label>
      <label class="field">
        <span>Quotation date</span>
        <InputText v-model="model.quotationDate" type="date" />
      </label>
      <label class="field">
        <span>Customer name</span>
        <InputText v-model="model.customerName" />
      </label>
      <label class="field">
        <span>Customer company</span>
        <InputText v-model="model.customerCompany" />
      </label>
      <label class="field">
        <span>Contact person</span>
        <InputText v-model="model.contactPerson" />
      </label>
      <label class="field">
        <span>Contact details</span>
        <InputText v-model="model.contactDetails" />
      </label>
      <label class="field">
        <span>Project name</span>
        <InputText v-model="model.projectName" />
      </label>
      <label class="field">
        <span>Validity period</span>
        <InputText v-model="model.validityPeriod" />
      </label>
      <label class="field">
        <span>Currency</span>
        <Select v-model="model.currency" :options="currencyOptions" />
      </label>
      <label class="field field-wide">
        <span>Notes / remarks</span>
        <Textarea v-model="model.notes" rows="3" auto-resize />
      </label>
    </div>
  </section>
</template>

<style scoped>
.header-form {
  padding: 20px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: #ffffff;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.field {
  display: grid;
  gap: 7px;
  min-width: 0;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.field-wide {
  grid-column: span 2;
}

.field :deep(.p-inputtext),
.field :deep(.p-select),
.field :deep(.p-textarea) {
  width: 100%;
}
</style>
