<script setup lang="ts">
import { computed } from 'vue'

import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useI18n } from 'vue-i18n'

import type { CompanyProfile, CompanyProfileRecord } from '@/shared/services/localCompanyProfileStorage'
import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'
import { findMatchingCustomerRecord, getCustomerRecordLabel } from '@/features/customers/utils/customerSelection'

import type { QuotationHeader } from '../types'

const props = defineProps<{
  header: QuotationHeader
  customerRecords: CustomerLibraryRecord[]
  companyProfileRecords: CompanyProfileRecord[]
  selectedCompanyProfileId: string | null
  companyProfileSnapshot: CompanyProfile
}>()

const emit = defineEmits<{
  selectCustomer: [record: CustomerLibraryRecord]
  selectCompanyProfile: [record: CompanyProfileRecord]
  updateCompanyProfileField: [field: keyof CompanyProfile, value: string]
  updateHeaderField: [field: keyof QuotationHeader, value: QuotationHeader[keyof QuotationHeader]]
  manageCustomers: []
  manageCompanyProfiles: []
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
    customerCompany: props.header.customerCompany,
    contactPerson: props.header.contactPerson,
    contactDetails: props.header.contactDetails,
  }),
)

const selectedCustomerId = computed(() => selectedCustomerRecord.value?.id ?? null)
const selectedCompanyProfileRecord = computed(() =>
  props.companyProfileRecords.find((r) => r.id === props.selectedCompanyProfileId) ?? null,
)

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

function updateHeaderField<K extends keyof QuotationHeader>(field: K, value: QuotationHeader[K]) {
  emit('updateHeaderField', field, value)
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

      <div class="selector-row">
        <Select
          v-if="companyProfileRecords.length > 0"
          :model-value="selectedCompanyProfileId"
          :options="companyProfileOptions"
          option-label="label"
          option-value="id"
          :filter="companyProfileRecords.length > 6"
          :filter-fields="companyOptionFields"
          :placeholder="t('quotations.headerForm.searchCompanyProfile')"
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
        <div v-else class="empty-library-note">
          <i class="pi pi-info-circle" aria-hidden="true" />
          <span>{{ t('quotations.headerForm.createCompanyProfiles') }}</span>
        </div>
        <Button
          icon="pi pi-cog"
          :label="t('quotations.headerForm.manageCompanyProfiles')"
          severity="secondary"
          text
          size="small"
          @click="emit('manageCompanyProfiles')"
        />
      </div>

      <div class="fields">
        <label class="field" data-history-target="company:companyName">
          <span>{{ t('companyProfiles.editor.companyName') }}</span>
          <InputText :model-value="companyProfileSnapshot.companyName" autocomplete="organization" @update:model-value="emit('updateCompanyProfileField', 'companyName', String($event ?? ''))" />
        </label>
        <label class="field" data-history-target="company:phone">
          <span>{{ t('companyProfiles.editor.contactNumber') }}</span>
          <InputText :model-value="companyProfileSnapshot.phone" type="tel" autocomplete="tel" @update:model-value="emit('updateCompanyProfileField', 'phone', String($event ?? ''))" />
        </label>
        <label class="field" data-history-target="company:email">
          <span>{{ t('companyProfiles.editor.email') }}</span>
          <InputText :model-value="companyProfileSnapshot.email" type="email" autocomplete="email" :spellcheck="false" @update:model-value="emit('updateCompanyProfileField', 'email', String($event ?? ''))" />
        </label>
      </div>
      <p class="company-edit-hint">{{ t('quotations.headerForm.companyEditHint') }}</p>
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

      <div class="selector-row">
        <Select
          v-if="customerRecords.length > 0"
          :model-value="selectedCustomerId"
          :options="customerOptions"
          option-label="label"
          option-value="id"
          :filter="customerRecords.length > 6"
          :filter-fields="customerOptionFields"
          :placeholder="t('quotations.headerForm.searchCustomer')"
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
        <div v-else class="empty-library-note">
          <i class="pi pi-info-circle" aria-hidden="true" />
          <span>{{ t('quotations.headerForm.createCustomers') }}</span>
        </div>
        <Button
          icon="pi pi-cog"
          :label="t('quotations.headerForm.manageCustomers')"
          severity="secondary"
          text
          size="small"
          @click="emit('manageCustomers')"
        />
      </div>

      <div class="fields">
        <label class="field" data-history-target="header:customerCompany">
          <span>{{ t('quotations.headerForm.customerCompany') }}</span>
          <InputText :model-value="props.header.customerCompany" autocomplete="organization" @update:model-value="updateHeaderField('customerCompany', String($event ?? ''))" />
        </label>
        <label class="field" data-history-target="header:contactPerson">
          <span>{{ t('quotations.headerForm.contactPerson') }}</span>
          <InputText :model-value="props.header.contactPerson" autocomplete="name" @update:model-value="updateHeaderField('contactPerson', String($event ?? ''))" />
        </label>
        <label class="field" data-history-target="header:contactDetails">
          <span>{{ t('quotations.headerForm.contactDetails') }}</span>
          <InputText :model-value="props.header.contactDetails" @update:model-value="updateHeaderField('contactDetails', String($event ?? ''))" />
        </label>
      </div>
    </div>
  </section>
</template>

<style scoped>
.customer-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  min-width: 0;
  gap: 24px;
  container-type: inline-size;
}

.party-card {
  display: grid;
  box-sizing: border-box;
  flex: 0 1 100%;
  align-content: start;
  min-width: 0;
  gap: 16px;
}

.party-card + .party-card {
  padding-top: 22px;
  border-top: 1px solid var(--surface-border);
}

.party-card-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  min-width: 0;
  gap: 12px;
}

.party-icon {
  display: none;
}

.party-copy {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.party-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.4;
}

.party-copy p,
.company-edit-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.count-pill {
  color: var(--text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}

.selector-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  min-width: 0;
  gap: 6px;
}

.selector-row :deep(.p-button) {
  justify-self: start;
  min-height: 36px;
  max-width: 100%;
  padding: 6px 0;
  font-size: 12px;
  white-space: normal;
  text-align: left;
  box-shadow: none;
}

.full-width {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.empty-library-note {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.empty-library-note i {
  flex-shrink: 0;
  margin-top: 3px;
  font-size: 12px;
}

.fields {
  display: grid;
  min-width: 0;
  gap: 14px;
}

.field {
  display: grid;
  min-width: 0;
  gap: 6px;
  color: var(--text-body);
  font-size: 12px;
  font-weight: 550;
  line-height: 1.4;
}

.field :deep(.p-inputtext),
.selector-row :deep(.p-select) {
  width: 100%;
  min-width: 0;
  min-height: 36px;
  max-width: 100%;
  font-size: 13px;
  font-weight: 400;
  box-shadow: none;
}

.field :deep(.p-inputtext),
.selector-row :deep(.p-select-label) {
  min-width: 0;
  padding: 8px 10px;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
}

.dim {
  color: var(--text-subtle);
}

.opt {
  display: grid;
  min-width: 0;
  gap: 3px;
  padding: 2px 0;
}

.opt-name {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 550;
}

.opt-sub {
  color: var(--text-muted);
  font-size: 12px;
}

@container (min-width: 620px) {
  .party-card {
    flex: 1 1 calc(50% - 12px);
  }

  .party-card + .party-card {
    padding-top: 0;
    padding-left: 24px;
    border-top: 0;
    border-left: 1px solid var(--surface-border);
  }
}
</style>
