<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatIsoDate } from '@/shared/utils/formatters'
import type { CustomerLibraryRecord } from '../utils/customerRecords'
import { getCustomerRecordLabel } from '../utils/customerSelection'

const props = defineProps<{
  records: CustomerLibraryRecord[]
  selectedRecordId: string | null
}>()

const emit = defineEmits<{
  select: [recordId: string]
}>()

const { t, locale } = useI18n()
const searchQuery = shallowRef('')
const currentLocale = computed(() => locale.value as SupportedLocale)
const sortedRecords = computed(() =>
  [...props.records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
)
const visibleRecords = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()

  if (!query) {
    return sortedRecords.value
  }

  return sortedRecords.value.filter((record) =>
    [record.customerCompany, record.contactPerson, record.contactDetails]
      .some((value) => value.toLocaleLowerCase().includes(query)),
  )
})
</script>

<template>
  <section class="record-list" :aria-label="t('customers.list.aria')">
    <header class="list-heading">
      <div>
        <h2>{{ t('customers.list.title') }}</h2>
        <p>{{ t('customers.list.description') }}</p>
      </div>
      <span class="record-count">{{ t('customers.toolbar.recordCount', { count: records.length }) }}</span>
    </header>

    <label v-if="records.length > 6" class="search-field">
      <span class="visually-hidden">{{ t('customers.list.search') }}</span>
      <InputText
        v-model="searchQuery"
        type="search"
        :placeholder="t('customers.list.search')"
        :aria-label="t('customers.list.search')"
      />
    </label>

    <div v-if="visibleRecords.length > 0" class="record-grid">
      <button
        v-for="record in visibleRecords"
        :key="record.id"
        type="button"
        class="record-card"
        :class="{ 'record-card-active': record.id === selectedRecordId }"
        :aria-pressed="record.id === selectedRecordId"
        @click="emit('select', record.id)"
      >
        <span class="record-main">
          <strong>{{ getCustomerRecordLabel(record, t('customers.list.untitled')) }}</strong>
          <span>{{ record.contactPerson || t('customers.list.noContactPerson') }}</span>
          <span>{{ record.contactDetails || t('customers.list.noContactDetails') }}</span>
        </span>
        <time :datetime="record.updatedAt">{{ formatIsoDate(record.updatedAt.slice(0, 10), currentLocale) }}</time>
      </button>
    </div>

    <div v-else class="empty-state">
      <i class="pi pi-address-book" aria-hidden="true" />
      <strong>{{ records.length === 0 ? t('customers.list.emptyTitle') : t('customers.list.noResults') }}</strong>
      <span>{{ records.length === 0 ? t('customers.list.emptyDescription') : t('customers.list.noResultsHint') }}</span>
    </div>
  </section>
</template>

<style scoped>
.record-list {
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: 320px;
  padding: 18px 20px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.list-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.list-heading div { display: grid; gap: 3px; }
.list-heading h2 { margin: 0; color: var(--text-strong); font-size: 14px; }
.list-heading p { margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.45; }
.record-count { color: var(--accent); font-size: 12px; font-weight: 700; white-space: nowrap; }
.search-field :deep(.p-inputtext) { width: 100%; }
.record-grid { display: grid; gap: 8px; max-height: 60vh; overflow-y: auto; }
.record-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.record-card:hover { border-color: var(--surface-border-strong); background: var(--surface-raised); }
.record-card-active { border-color: var(--accent); background: var(--accent-surface); }
.record-main { display: grid; gap: 2px; min-width: 0; }
.record-main strong, .record-main span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.record-main strong { color: var(--text-strong); font-size: 13px; }
.record-main span, time { color: var(--text-muted); font-size: 12px; }
time { font-size: 11px; font-weight: 600; white-space: nowrap; }
.empty-state { display: grid; place-items: center; gap: 8px; min-height: 220px; color: var(--text-muted); text-align: center; }
.empty-state i { color: var(--accent); font-size: 24px; }
.empty-state strong { color: var(--text-strong); font-size: 14px; }
.empty-state span { max-width: 36ch; font-size: 13px; line-height: 1.5; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
