<script setup lang="ts">
import { computed } from 'vue'

import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { SUPPORTED_LOCALES } from '@/shared/i18n/locale'
import { formatIsoDate } from '@/shared/utils/formatters'
import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'
import { findMatchingCustomerRecord, getCustomerRecordLabel } from '@/features/customers/utils/customerSelection'

import type { CurrencyCode, QuotationHeader } from '../types'

const props = defineProps<{
  customerRecords: CustomerLibraryRecord[]
  quotationCurrencyOptions: string[]
}>()

const model = defineModel<QuotationHeader>({ required: true })
const emit = defineEmits<{
  selectCustomer: [record: CustomerLibraryRecord]
}>()
const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)

const documentLocaleOptions = computed<{ label: string; value: SupportedLocale }[]>(() =>
  SUPPORTED_LOCALES.map((value) => ({
    label: t(`common.locales.${value}`),
    value,
  })),
)
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
  <section class="quote-setup-panel" :aria-label="t('quotations.headerForm.aria')">
    <div class="form-section">
      <h2 class="section-title">{{ t('quotations.headerForm.quotationDetails') }}</h2>
      <div class="field-stack">
        <label class="field">
          <span>{{ t('quotations.headerForm.quotationNumber') }}</span>
          <InputText v-model="model.quotationNumber" />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.revision') }}</span>
          <InputNumber v-model="model.revisionNumber" :min="1" :max-fraction-digits="0" prefix="Rev. " />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.quotationDate') }}</span>
          <InputText v-model="model.quotationDate" type="date" />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.projectName') }}</span>
          <InputText v-model="model.projectName" />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.documentLanguage') }}</span>
          <Select v-model="model.documentLocale" :options="documentLocaleOptions" option-label="label" option-value="value" />
        </label>
      </div>
    </div>

    <div class="form-section">
      <h2 class="section-title">{{ t('quotations.headerForm.customer') }}</h2>
      <div class="customer-section">
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

        <div class="customer-fields-grid">
          <label class="field">
            <span>{{ t('quotations.headerForm.customerCompany') }}</span>
            <InputText v-model="model.customerCompany" />
          </label>
          <label class="field">
            <span>{{ t('quotations.headerForm.contactPerson') }}</span>
            <InputText v-model="model.contactPerson" />
          </label>
          <label class="field field-wide">
            <span>{{ t('quotations.headerForm.contactDetails') }}</span>
            <InputText v-model="model.contactDetails" />
          </label>
        </div>
      </div>
    </div>

    <div class="form-section">
      <h2 class="section-title">{{ t('quotations.headerForm.terms') }}</h2>
      <div class="field-stack">
        <label class="field">
          <span>{{ t('quotations.headerForm.validityPeriod') }}</span>
          <InputText v-model="model.validityPeriod" />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.currency') }}</span>
          <Select v-model="model.currency" :options="props.quotationCurrencyOptions" />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.notes') }}</span>
          <Textarea v-model="model.notes" rows="3" auto-resize />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.termsAndConditions') }}</span>
          <Textarea v-model="model.terms" rows="5" auto-resize />
        </label>
      </div>
    </div>
  </section>
</template>

<style scoped>
.quote-setup-panel {
  display: grid;
  gap: 8px;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.form-section {
  display: grid;
  gap: 6px;
}

.form-section + .form-section {
  padding-top: 8px;
  border-top: 1px solid var(--surface-border);
}

.section-title {
  margin: 0;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.field-stack {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}

.customer-section {
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid #dbe5ef;
  border-radius: 8px;
  background:
    radial-gradient(circle at top right, rgb(4 120 87 / 0.08), transparent 180px),
    #f8fbfc;
}

.customer-library,
.customer-fields-grid {
  display: grid;
  gap: 6px;
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
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
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
  gap: 4px;
  min-width: 0;
  color: var(--text-body);
  font-size: 12px;
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
  min-height: 72px;
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
