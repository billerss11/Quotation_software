<script setup lang="ts">
import { computed } from 'vue'

import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatIsoDate } from '@/shared/utils/formatters'
import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'
import { findMatchingCustomerRecord, getCustomerRecordLabel } from '@/features/customers/utils/customerSelection'

import type { QuotationHeader } from '../types'

const props = defineProps<{
  customerRecords: CustomerLibraryRecord[]
}>()

const model = defineModel<QuotationHeader>({ required: true })
const emit = defineEmits<{
  selectCustomer: [record: CustomerLibraryRecord]
}>()
const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)

const customerOptionFields = ['customerCompany', 'contactPerson', 'contactDetails']
const customerFallbackLabel = computed(() => t('customers.list.untitled'))
const customerOptions = computed(() =>
  props.customerRecords.map((record) => ({
    ...record,
    label: getCustomerRecordLabel(record, customerFallbackLabel.value),
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

function getCustomerLabel(record: CustomerLibraryRecord) {
  return getCustomerRecordLabel(record, customerFallbackLabel.value)
}

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
  <section class="quote-customer-panel" :aria-label="t('quotations.headerForm.customer')">
    <div class="customer-library">
      <div class="customer-library-heading">
        <div>
          <h3>{{ t('quotations.headerForm.savedCustomers') }}</h3>
          <p>{{ t('quotations.headerForm.savedCustomersHelp') }}</p>
        </div>
        <span class="customer-count">{{ customerRecords.length }}</span>
      </div>

      <label class="field">
        <span>{{ t('quotations.headerForm.chooseFromLibrary') }}</span>
        <Select
          :model-value="selectedCustomerId"
          :options="customerOptions"
          option-label="label"
          option-value="id"
          :filter="customerRecords.length > 6"
          :filter-fields="customerOptionFields"
          :placeholder="t('quotations.headerForm.searchCustomer')"
          :disabled="customerRecords.length === 0"
          class="customer-select"
          @update:model-value="handleCustomerSelection"
        >
          <template #value="{ value, placeholder }">
            <div v-if="value && selectedCustomerRecord" class="customer-select-value">
              <strong>{{ getCustomerLabel(selectedCustomerRecord) }}</strong>
              <span>{{ selectedCustomerRecord.contactPerson || selectedCustomerRecord.contactDetails }}</span>
            </div>
            <span v-else class="customer-select-placeholder">{{ placeholder }}</span>
          </template>

          <template #option="{ option }">
            <div class="customer-option">
              <div class="customer-option-main">
                <strong>{{ getCustomerLabel(option) }}</strong>
                <span>{{ option.contactPerson || t('quotations.headerForm.noContactPerson') }}</span>
              </div>
              <div class="customer-option-side">
                <span>{{ option.contactDetails || t('quotations.headerForm.noContactDetails') }}</span>
                <strong>{{ formatIsoDate(option.updatedAt.slice(0, 10), currentLocale) }}</strong>
              </div>
            </div>
          </template>
        </Select>
      </label>

      <div v-if="selectedCustomerRecord" class="customer-applied">
        <i class="pi pi-check-circle" aria-hidden="true" />
        <div>
          <strong>{{ t('quotations.headerForm.loaded', { label: getCustomerLabel(selectedCustomerRecord) }) }}</strong>
          <span>{{ t('quotations.headerForm.loadedHelp') }}</span>
        </div>
      </div>

      <div v-else class="customer-hint">
        <i class="pi pi-user-plus" aria-hidden="true" />
        <span v-if="customerRecords.length > 0">{{ t('quotations.headerForm.chooseSavedCustomer') }}</span>
        <span v-else>{{ t('quotations.headerForm.createCustomers') }}</span>
      </div>
    </div>

    <div class="customer-fields">
      <h2 class="section-title">{{ t('quotations.headerForm.customer') }}</h2>
      <div class="customer-fields-grid">
        <label class="field">
          <span>{{ t('quotations.headerForm.customerCompany') }}</span>
          <InputText v-model="model.customerCompany" autocomplete="organization" />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.contactPerson') }}</span>
          <InputText v-model="model.contactPerson" autocomplete="name" />
        </label>
        <label class="field field-wide">
          <span>{{ t('quotations.headerForm.contactDetails') }}</span>
          <InputText v-model="model.contactDetails" />
        </label>
      </div>
    </div>
  </section>
</template>

<style scoped>
.quote-customer-panel {
  display: grid;
  gap: 14px;
}

.section-title {
  margin: 0;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.customer-library {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.customer-library-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
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
  font-size: 13px;
  font-weight: 700;
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
  min-width: 28px;
  height: 24px;
  place-items: center;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
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
  gap: 6px;
  padding: 7px 9px;
  border-radius: var(--radius-sm);
}

.customer-applied {
  border: 1px solid var(--accent-soft);
  background: var(--accent-surface);
  color: var(--accent);
}

.customer-hint {
  border: 1px dashed var(--surface-border-strong);
  background: var(--surface-card);
  color: var(--text-body);
}

.customer-applied > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.customer-fields {
  display: grid;
  gap: 8px;
}

.customer-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.field {
  display: grid;
  gap: 4px;
  min-width: 0;
  color: var(--text-body);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field :deep(.p-inputtext),
.field :deep(.p-select) {
  width: 100%;
  min-width: 0;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}

.field :deep(.p-inputtext),
.field :deep(.p-select-label) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.field-wide {
  grid-column: 1 / -1;
}

@media (max-width: 760px) {
  .customer-fields-grid {
    grid-template-columns: 1fr;
  }

  .field-wide {
    grid-column: auto;
  }
}
</style>
