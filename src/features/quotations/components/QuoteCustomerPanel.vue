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

const companySnapshotName = computed(() =>
  props.companyProfileSnapshot.companyName || companyFallbackLabel.value,
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
  <section class="customer-panel" :aria-label="t('quotations.headerForm.parties')">
    <div class="party-card party-card-company">
      <div class="party-card-header">
        <span class="party-icon">
          <i class="pi pi-building" aria-hidden="true" />
        </span>
        <div class="party-copy">
          <h2 class="party-title">{{ t('quotations.headerForm.senderCompany') }}</h2>
          <p>{{ t('quotations.headerForm.senderCompanyHint') }}</p>
        </div>
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

      <div class="snapshot-card">
        <span class="snapshot-kicker">{{ t('quotations.headerForm.activeCompanySnapshot') }}</span>
        <strong>{{ companySnapshotName }}</strong>
        <span v-if="snapshotLine">{{ snapshotLine }}</span>
      </div>
    </div>

    <div class="party-card party-card-customer">
      <div class="party-card-header">
        <span class="party-icon">
          <i class="pi pi-user" aria-hidden="true" />
        </span>
        <div class="party-copy">
          <h2 class="party-title">{{ t('quotations.headerForm.buyerCustomer') }}</h2>
          <p>{{ t('quotations.headerForm.buyerCustomerHint') }}</p>
        </div>
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
  gap: 12px;
}

.party-card {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
  box-shadow: var(--shadow-control);
}

.party-card-company {
  border-left: 3px solid var(--accent);
}

.party-card-customer {
  border-left: 3px solid color-mix(in srgb, var(--accent) 55%, #2563eb);
}

.party-card-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 9px;
}

.party-icon {
  display: inline-grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid var(--accent-soft);
  border-radius: var(--radius-md);
  background: var(--accent-surface);
  color: var(--accent);
}

.party-icon i {
  font-size: 13px;
}

.party-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.party-copy p {
  margin: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.party-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.2;
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

.snapshot-card {
  display: grid;
  gap: 2px;
  padding: 9px 10px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
}

.snapshot-card strong,
.snapshot-card span {
  overflow: hidden;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snapshot-card strong {
  color: var(--text-body);
  font-size: 12px;
  font-weight: 700;
}

.snapshot-card span {
  color: var(--text-muted);
  font-size: 11px;
}

.snapshot-kicker {
  color: var(--accent) !important;
  font-size: 10px !important;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.fields {
  display: grid;
  gap: 9px;
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
