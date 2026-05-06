<script setup lang="ts">
import { computed } from 'vue'

import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatIsoDate } from '@/shared/utils/formatters'
import type {
  CompanyProfile,
  CompanyProfileRecord,
} from '@/shared/services/localCompanyProfileStorage'
import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'
import { findMatchingCustomerRecord, getCustomerRecordLabel } from '@/features/customers/utils/customerSelection'

import type { QuotationHeader } from '../types'

const props = defineProps<{
  customerRecords: CustomerLibraryRecord[]
  companyProfileRecords: CompanyProfileRecord[]
  selectedCompanyProfileId: string | null
  companyProfileSnapshot: CompanyProfile
}>()

const model = defineModel<QuotationHeader>({ required: true })
const emit = defineEmits<{
  selectCustomer: [record: CustomerLibraryRecord]
  selectCompanyProfile: [record: CompanyProfileRecord]
}>()
const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)

const customerOptionFields = ['customerCompany', 'contactPerson', 'contactDetails']
const companyOptionFields = ['companyName', 'email', 'phone']
const customerFallbackLabel = computed(() => t('customers.list.untitled'))
const companyFallbackLabel = computed(() => t('companyProfiles.list.untitled'))

const customerOptions = computed(() =>
  props.customerRecords.map((record) => ({
    ...record,
    label: getCustomerRecordLabel(record, customerFallbackLabel.value),
  })),
)

const companyProfileOptions = computed(() =>
  props.companyProfileRecords.map((record) => ({
    ...record,
    label: record.companyName || companyFallbackLabel.value,
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
const selectedCompanyProfileRecord = computed(() =>
  props.companyProfileRecords.find((record) => record.id === props.selectedCompanyProfileId) ?? null,
)

function getCustomerLabel(record: CustomerLibraryRecord) {
  return getCustomerRecordLabel(record, customerFallbackLabel.value)
}

function getCompanyLabel(record: CompanyProfileRecord) {
  return record.companyName || companyFallbackLabel.value
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

function handleCompanyProfileSelection(recordId: string | null) {
  if (!recordId) {
    return
  }

  const record = props.companyProfileRecords.find((item) => item.id === recordId)

  if (record) {
    emit('selectCompanyProfile', record)
  }
}
</script>

<template>
  <section class="quote-customer-panel" :aria-label="t('quotations.headerForm.customer')">
    <div class="library-card">
      <div class="library-heading">
        <div>
          <h3>{{ t('quotations.headerForm.savedCompanies') }}</h3>
          <p>{{ t('quotations.headerForm.savedCompaniesHelp') }}</p>
        </div>
        <span class="library-count">{{ companyProfileRecords.length }}</span>
      </div>

      <label class="field">
        <span>{{ t('quotations.headerForm.chooseCompanyProfile') }}</span>
        <Select
          :model-value="selectedCompanyProfileId"
          :options="companyProfileOptions"
          option-label="label"
          option-value="id"
          :filter="companyProfileRecords.length > 6"
          :filter-fields="companyOptionFields"
          :placeholder="t('quotations.headerForm.searchCompanyProfile')"
          :disabled="companyProfileRecords.length === 0"
          class="library-select"
          @update:model-value="handleCompanyProfileSelection"
        >
          <template #value="{ value, placeholder }">
            <div v-if="value && selectedCompanyProfileRecord" class="library-select-value">
              <strong>{{ getCompanyLabel(selectedCompanyProfileRecord) }}</strong>
              <span>{{ selectedCompanyProfileRecord.phone || selectedCompanyProfileRecord.email }}</span>
            </div>
            <span v-else class="library-select-placeholder">{{ placeholder }}</span>
          </template>

          <template #option="{ option }">
            <div class="library-option">
              <div class="library-option-main">
                <strong>{{ getCompanyLabel(option) }}</strong>
                <span>{{ option.phone || t('quotations.headerForm.noCompanyPhone') }}</span>
              </div>
              <div class="library-option-side">
                <span>{{ option.email || t('quotations.headerForm.noCompanyEmail') }}</span>
                <strong>{{ formatIsoDate(option.updatedAt.slice(0, 10), currentLocale) }}</strong>
              </div>
            </div>
          </template>
        </Select>
      </label>

      <div v-if="selectedCompanyProfileRecord" class="library-applied">
        <i class="pi pi-building" aria-hidden="true" />
        <div>
          <strong>{{ t('quotations.headerForm.loadedCompany', { label: getCompanyLabel(selectedCompanyProfileRecord) }) }}</strong>
          <span>{{ t('quotations.headerForm.loadedCompanyHelp') }}</span>
        </div>
      </div>

      <div v-else class="library-hint">
        <i class="pi pi-building-columns" aria-hidden="true" />
        <span v-if="companyProfileRecords.length > 0">{{ t('quotations.headerForm.chooseSavedCompany') }}</span>
        <span v-else>{{ t('quotations.headerForm.createCompanyProfiles') }}</span>
      </div>

      <div class="snapshot-card">
        <span class="snapshot-label">{{ t('quotations.headerForm.activeCompanySnapshot') }}</span>
        <strong>{{ companyProfileSnapshot.companyName }}</strong>
        <span>{{ companyProfileSnapshot.phone || t('quotations.headerForm.noCompanyPhone') }}</span>
        <span>{{ companyProfileSnapshot.email || t('quotations.headerForm.noCompanyEmail') }}</span>
      </div>
    </div>

    <div class="library-card">
      <div class="library-heading">
        <div>
          <h3>{{ t('quotations.headerForm.savedCustomers') }}</h3>
          <p>{{ t('quotations.headerForm.savedCustomersHelp') }}</p>
        </div>
        <span class="library-count">{{ customerRecords.length }}</span>
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
          class="library-select"
          @update:model-value="handleCustomerSelection"
        >
          <template #value="{ value, placeholder }">
            <div v-if="value && selectedCustomerRecord" class="library-select-value">
              <strong>{{ getCustomerLabel(selectedCustomerRecord) }}</strong>
              <span>{{ selectedCustomerRecord.contactPerson || selectedCustomerRecord.contactDetails }}</span>
            </div>
            <span v-else class="library-select-placeholder">{{ placeholder }}</span>
          </template>

          <template #option="{ option }">
            <div class="library-option">
              <div class="library-option-main">
                <strong>{{ getCustomerLabel(option) }}</strong>
                <span>{{ option.contactPerson || t('quotations.headerForm.noContactPerson') }}</span>
              </div>
              <div class="library-option-side">
                <span>{{ option.contactDetails || t('quotations.headerForm.noContactDetails') }}</span>
                <strong>{{ formatIsoDate(option.updatedAt.slice(0, 10), currentLocale) }}</strong>
              </div>
            </div>
          </template>
        </Select>
      </label>

      <div v-if="selectedCustomerRecord" class="library-applied">
        <i class="pi pi-check-circle" aria-hidden="true" />
        <div>
          <strong>{{ t('quotations.headerForm.loaded', { label: getCustomerLabel(selectedCustomerRecord) }) }}</strong>
          <span>{{ t('quotations.headerForm.loadedHelp') }}</span>
        </div>
      </div>

      <div v-else class="library-hint">
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

.library-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.library-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.library-heading h3,
.library-heading p,
.library-applied strong,
.library-applied span,
.library-hint span {
  margin: 0;
}

.library-heading h3 {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 700;
}

.library-heading p,
.library-hint span,
.library-select-placeholder,
.library-select-value span,
.library-option-main span,
.library-option-side span,
.snapshot-card span {
  color: var(--text-muted);
}

.library-heading p,
.library-hint span,
.library-select-value span,
.library-option-main span,
.library-option-side span,
.snapshot-card span {
  font-size: 13px;
}

.library-count {
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

.library-select-value,
.library-option-main,
.snapshot-card {
  display: grid;
  gap: 3px;
}

.library-option {
  display: grid;
  gap: 8px;
  padding: 4px 0;
}

.library-option-main strong,
.library-option-side strong,
.library-applied strong,
.snapshot-card strong {
  color: var(--text-strong);
}

.library-option-side {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.library-option-side span,
.library-option-side strong {
  font-size: 12px;
}

.library-applied,
.library-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 7px 9px;
  border-radius: var(--radius-sm);
}

.library-applied {
  border: 1px solid var(--accent-soft);
  background: var(--accent-surface);
  color: var(--accent);
}

.library-hint {
  border: 1px dashed var(--surface-border-strong);
  background: var(--surface-card);
  color: var(--text-body);
}

.library-applied > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.snapshot-card {
  padding: 9px 10px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  background: var(--surface-card);
}

.snapshot-label {
  font-size: 11px !important;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
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

  .library-option-side {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
