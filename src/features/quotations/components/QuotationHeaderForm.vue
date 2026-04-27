<script setup lang="ts">
import { computed } from 'vue'

import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'

import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'
import { findMatchingCustomerRecord, getCustomerRecordLabel } from '@/features/customers/utils/customerSelection'

import type { CurrencyCode, QuotationHeader } from '../types'

const props = defineProps<{
  customerRecords: CustomerLibraryRecord[]
}>()

const model = defineModel<QuotationHeader>({ required: true })

const emit = defineEmits<{
  selectCustomer: [record: CustomerLibraryRecord]
}>()

const currencyOptions: CurrencyCode[] = ['USD', 'EUR', 'CNY', 'GBP']
const customerOptionFields = ['customerCompany', 'contactPerson', 'contactDetails']
const customerOptions = computed(() =>
  props.customerRecords.map((record) => ({
    ...record,
    label: getCustomerRecordLabel(record),
  })),
)

const selectedCustomerRecord = computed(() =>
  findMatchingCustomerRecord(props.customerRecords, {
    customerCompany: model.value.customerCompany,
    contactPerson: model.value.contactPerson,
    contactDetails: model.value.contactDetails,
  }),
)

const selectedCustomerId = computed(() => selectedCustomerRecord.value?.id ?? null)

function handleCustomerSelection(recordId: string | null) {
  if (!recordId) {
    return
  }

  const record = props.customerRecords.find((item) => item.id === recordId)

  if (record) {
    emit('selectCustomer', record)
  }
}
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
          <span>Revision</span>
          <InputNumber v-model="model.revisionNumber" :min="1" :max-fraction-digits="0" prefix="Rev. " />
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
      <div class="customer-section">
        <div class="customer-library">
          <div class="customer-library-heading">
            <div>
              <h3>Saved customers</h3>
              <p>Pick one to fill the fields below, then edit anything you need.</p>
            </div>
            <span class="customer-count">{{ customerRecords.length }}</span>
          </div>

          <label class="field">
            <span>Choose from library</span>
            <Select
              :model-value="selectedCustomerId"
              :options="customerOptions"
              option-label="label"
              option-value="id"
              :filter="customerRecords.length > 6"
              :filter-fields="customerOptionFields"
              placeholder="Search company, contact person, or contact details"
              :disabled="customerRecords.length === 0"
              class="customer-select"
              @update:model-value="handleCustomerSelection"
            >
              <template #value="{ value, placeholder }">
                <div v-if="value && selectedCustomerRecord" class="customer-select-value">
                  <strong>{{ getCustomerRecordLabel(selectedCustomerRecord) }}</strong>
                  <span>{{ selectedCustomerRecord.contactPerson || selectedCustomerRecord.contactDetails }}</span>
                </div>
                <span v-else class="customer-select-placeholder">{{ placeholder }}</span>
              </template>

              <template #option="{ option }">
                <div class="customer-option">
                  <div class="customer-option-main">
                    <strong>{{ getCustomerRecordLabel(option) }}</strong>
                    <span>{{ option.contactPerson || 'No contact person' }}</span>
                  </div>
                  <div class="customer-option-side">
                    <span>{{ option.contactDetails || 'No contact details' }}</span>
                    <strong>{{ option.updatedAt.slice(0, 10) }}</strong>
                  </div>
                </div>
              </template>
            </Select>
          </label>

          <div v-if="selectedCustomerRecord" class="customer-applied">
            <i class="pi pi-check-circle" aria-hidden="true" />
            <div>
              <strong>{{ getCustomerRecordLabel(selectedCustomerRecord) }} loaded</strong>
              <span>Customer library values are now in the fields below.</span>
            </div>
          </div>

          <div v-else class="customer-hint">
            <i class="pi pi-user-plus" aria-hidden="true" />
            <span v-if="customerRecords.length > 0">Choose a saved customer to fill the fields below instantly.</span>
            <span v-else>Create customers in the Customers tab to reuse them here.</span>
          </div>
        </div>

        <div class="customer-fields-grid">
          <label class="field">
            <span>Customer company</span>
            <InputText v-model="model.customerCompany" />
          </label>
          <label class="field">
            <span>Contact person</span>
            <InputText v-model="model.contactPerson" />
          </label>
          <label class="field field-wide">
            <span>Contact details</span>
            <InputText v-model="model.contactDetails" />
          </label>
        </div>
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
        <label class="field">
          <span>Terms & Conditions</span>
          <Textarea v-model="model.terms" rows="6" auto-resize />
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

.customer-section {
  display: grid;
  gap: 16px;
  padding: 16px;
  border: 1px solid #dbe5ef;
  border-radius: 12px;
  background:
    radial-gradient(circle at top right, rgb(4 120 87 / 0.08), transparent 180px),
    #f8fbfc;
}

.customer-library,
.customer-fields-grid {
  display: grid;
  gap: 12px;
}

.customer-library-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.customer-library-heading h3,
.customer-library-heading p,
.customer-applied strong,
.customer-applied span,
.customer-hint span {
  margin: 0;
}

.customer-library-heading h3 {
  color: var(--text-strong);
  font-size: 15px;
}

.customer-library-heading p,
.customer-hint span,
.customer-select-placeholder,
.customer-select-value span,
.customer-option-main span,
.customer-option-side span {
  color: var(--text-muted);
}

.customer-library-heading p,
.customer-hint span,
.customer-select-value span,
.customer-option-main span,
.customer-option-side span {
  font-size: 13px;
}

.customer-count {
  display: inline-grid;
  min-width: 32px;
  height: 32px;
  place-items: center;
  padding: 0 10px;
  border-radius: 999px;
  background: rgb(4 120 87 / 0.12);
  color: #065f46;
  font-size: 13px;
  font-weight: 800;
}

.customer-select-value,
.customer-option-main {
  display: grid;
  gap: 3px;
}

.customer-option {
  display: grid;
  gap: 8px;
  padding: 4px 0;
}

.customer-option-main strong,
.customer-option-side strong,
.customer-applied strong {
  color: var(--text-strong);
}

.customer-option-side {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.customer-option-side span,
.customer-option-side strong {
  font-size: 12px;
}

.customer-applied,
.customer-hint {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
}

.customer-applied {
  border: 1px solid rgb(4 120 87 / 0.18);
  background: rgb(4 120 87 / 0.08);
  color: #065f46;
}

.customer-hint {
  border: 1px dashed #cbd5e1;
  background: #ffffff;
  color: var(--text-body);
}

.customer-applied > div,
.customer-fields-grid {
  min-width: 0;
}

.customer-applied > div {
  display: grid;
  gap: 4px;
}

.customer-fields-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

.field-wide {
  grid-column: 1 / -1;
}

@media (max-width: 760px) {
  .customer-section,
  .field-stack,
  .customer-fields-grid {
    grid-template-columns: 1fr;
  }

  .field-wide {
    grid-column: auto;
  }
}
</style>
