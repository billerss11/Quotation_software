<script setup lang="ts">
import { computed } from 'vue'

import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useI18n } from 'vue-i18n'

import type { CompanyProfile, CompanyProfileRecord } from '@/shared/services/localCompanyProfileStorage'
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

const { t } = useI18n()

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
  props.companyProfileRecords.find((r) => r.id === props.selectedCompanyProfileId) ?? null,
)

const snapshotLine = computed(() => {
  const s = props.companyProfileSnapshot
  const parts = [s.phone, s.email].filter(Boolean)
  return parts.length > 0 ? parts[0] : ''
})

function getCustomerLabel(record: CustomerLibraryRecord) {
  return getCustomerRecordLabel(record, customerFallbackLabel.value)
}

function getCompanyLabel(record: CompanyProfileRecord) {
  return record.companyName || companyFallbackLabel.value
}

function handleCustomerSelection(recordId: string | null) {
  if (!recordId) return
  const record = props.customerRecords.find((r) => r.id === recordId)
  if (record) emit('selectCustomer', record)
}

function handleCompanyProfileSelection(recordId: string | null) {
  if (!recordId) return
  const record = props.companyProfileRecords.find((r) => r.id === recordId)
  if (record) emit('selectCompanyProfile', record)
}
</script>

<template>
  <section class="customer-panel" :aria-label="t('quotations.headerForm.customer')">

    <!-- Sender / company profile -->
    <div class="panel-section">
      <div class="section-header">
        <span class="section-label">{{ t('quotations.headerForm.savedCompanies') }}</span>
        <span v-if="companyProfileRecords.length > 0" class="count-pill">{{ companyProfileRecords.length }}</span>
      </div>

      <Select
        :model-value="selectedCompanyProfileId"
        :options="companyProfileOptions"
        option-label="label"
        option-value="id"
        :filter="companyProfileRecords.length > 6"
        :filter-fields="companyOptionFields"
        :placeholder="t('quotations.headerForm.searchCompanyProfile')"
        :disabled="companyProfileRecords.length === 0"
        class="full-width"
        @update:model-value="handleCompanyProfileSelection"
      >
        <template #value="{ value, placeholder }">
          <span v-if="value && selectedCompanyProfileRecord">{{ getCompanyLabel(selectedCompanyProfileRecord) }}</span>
          <span v-else class="dim">{{ placeholder }}</span>
        </template>
        <template #option="{ option }">
          <div class="opt">
            <span class="opt-name">{{ getCompanyLabel(option) }}</span>
            <span class="opt-sub">{{ option.phone || option.email || '' }}</span>
          </div>
        </template>
      </Select>

      <div class="snapshot-line">
        <span class="snapshot-name">{{ companyProfileSnapshot.companyName }}</span>
        <span v-if="snapshotLine" class="snapshot-detail">· {{ snapshotLine }}</span>
      </div>
    </div>

    <div class="divider" />

    <!-- Customer -->
    <div class="panel-section">
      <div class="section-header">
        <span class="section-label">{{ t('quotations.headerForm.customer') }}</span>
        <span v-if="customerRecords.length > 0" class="count-pill">{{ customerRecords.length }}</span>
      </div>

      <Select
        :model-value="selectedCustomerId"
        :options="customerOptions"
        option-label="label"
        option-value="id"
        :filter="customerRecords.length > 6"
        :filter-fields="customerOptionFields"
        :placeholder="customerRecords.length > 0 ? t('quotations.headerForm.searchCustomer') : t('quotations.headerForm.createCustomers')"
        :disabled="customerRecords.length === 0"
        class="full-width"
        @update:model-value="handleCustomerSelection"
      >
        <template #value="{ value, placeholder }">
          <span v-if="value && selectedCustomerRecord">{{ getCustomerLabel(selectedCustomerRecord) }}</span>
          <span v-else class="dim">{{ placeholder }}</span>
        </template>
        <template #option="{ option }">
          <div class="opt">
            <span class="opt-name">{{ getCustomerLabel(option) }}</span>
            <span class="opt-sub">{{ option.contactPerson || option.contactDetails || '' }}</span>
          </div>
        </template>
      </Select>

      <div class="fields">
        <label class="field">
          <span>{{ t('quotations.headerForm.customerCompany') }}</span>
          <InputText v-model="model.customerCompany" autocomplete="organization" />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.contactPerson') }}</span>
          <InputText v-model="model.contactPerson" autocomplete="name" />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.contactDetails') }}</span>
          <InputText v-model="model.contactDetails" />
        </label>
      </div>
    </div>

  </section>
</template>

<style scoped>
.customer-panel {
  display: grid;
  gap: 0;
}

.panel-section {
  display: grid;
  gap: 8px;
  padding: 12px 0;
}

.divider {
  height: 1px;
  background: var(--surface-border);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-label {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.count-pill {
  display: inline-grid;
  min-width: 18px;
  height: 16px;
  place-items: center;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.full-width {
  width: 100%;
}

.dim {
  color: var(--text-subtle);
}

.opt {
  display: grid;
  gap: 2px;
  padding: 2px 0;
}

.opt-name {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 600;
}

.opt-sub {
  color: var(--text-muted);
  font-size: 12px;
}

.snapshot-line {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: baseline;
}

.snapshot-name {
  color: var(--text-body);
  font-size: 12px;
  font-weight: 600;
}

.snapshot-detail {
  color: var(--text-muted);
  font-size: 12px;
}

.fields {
  display: grid;
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
</style>
