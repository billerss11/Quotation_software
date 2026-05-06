<script setup lang="ts">
import Button from 'primevue/button'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatIsoDate } from '@/shared/utils/formatters'

import { useCustomerLibrary } from '../composables/useCustomerLibrary'
import {
  createCustomerLibraryFileContent,
  CustomerLibraryFileError,
  parseCustomerLibraryFileContent,
} from '../utils/customerLibraryFile'
import { getCustomerRecordLabel } from '../utils/customerSelection'
import CustomerLibraryEditor from './CustomerLibraryEditor.vue'
import CustomerLibraryToolbar from './CustomerLibraryToolbar.vue'

const {
  records,
  draft,
  selectedRecordId,
  hasSelectedRecord,
  selectRecord,
  startNewRecord,
  saveDraft,
  deleteSelectedRecord,
  replaceAllRecords,
} = useCustomerLibrary()

const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
const statusMessage = shallowRef('')
const importInput = useTemplateRef<HTMLInputElement>('customerLibraryImportInput')
const hasNativeFileDialogs = Boolean(
  window.quotationApp?.saveCustomerLibraryFile && window.quotationApp?.openCustomerLibraryFile,
)

function getDraftLabel() {
  return draft.value.customerCompany || draft.value.contactPerson || t('customers.list.untitled')
}

function handleSave() {
  saveDraft()
  statusMessage.value = t('customers.statuses.saved', { name: getDraftLabel() })
}

function handleDelete() {
  const deletedLabel = getDraftLabel()
  deleteSelectedRecord()
  statusMessage.value = t('customers.statuses.deleted', { name: deletedLabel })
}

function handleCreateRecord() {
  startNewRecord()
  statusMessage.value = t('customers.statuses.newReady')
}

async function handleImportJson() {
  try {
    const api = getCustomerLibraryFileApi()

    if (!api) {
      importInput.value?.click()
      statusMessage.value = t('customers.statuses.chooseJson')
      return
    }

    const result = await api.openCustomerLibraryFile()

    if (result.canceled) {
      return
    }

    const importedRecords = parseCustomerLibraryFileContent(result.content)
    replaceAllRecords([...records.value, ...importedRecords])
    statusMessage.value = t('customers.statuses.imported', { name: getFileName(result.filePath) })
  } catch (error) {
    statusMessage.value = getFileOperationError(error)
  }
}

async function handleImportFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  try {
    const importedRecords = parseCustomerLibraryFileContent(await file.text())
    replaceAllRecords([...records.value, ...importedRecords])
    statusMessage.value = t('customers.statuses.imported', { name: file.name })
  } catch (error) {
    statusMessage.value = getFileOperationError(error)
  } finally {
    input.value = ''
  }
}

async function handleExportJson() {
  try {
    const content = createCustomerLibraryFileContent(records.value)
    const defaultPath = createDefaultFileName()
    const api = getCustomerLibraryFileApi()

    if (!api) {
      downloadCustomerLibraryFile(defaultPath, content)
      statusMessage.value = t('customers.statuses.downloaded', { name: defaultPath })
      return
    }

    const result = await api.saveCustomerLibraryFile({
      defaultPath,
      content,
    })

    if (result.canceled) {
      return
    }

    statusMessage.value = t('customers.statuses.exported', { name: getFileName(result.filePath) })
  } catch (error) {
    statusMessage.value = getFileOperationError(error)
  }
}

function createDefaultFileName() {
  return `customer-library-${new Date().toISOString().slice(0, 10)}.json`
}

function getCustomerLibraryFileApi() {
  if (!window.quotationApp?.saveCustomerLibraryFile || !window.quotationApp.openCustomerLibraryFile) {
    return null
  }

  return window.quotationApp
}

function downloadCustomerLibraryFile(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function getFileName(filePath: string) {
  return filePath.split(/[\\/]/).at(-1) || filePath
}

function getFileOperationError(error: unknown) {
  if (error instanceof CustomerLibraryFileError) {
    switch (error.code) {
      case 'invalid_envelope':
        return t('customers.fileErrors.invalidEnvelope')
      case 'missing_customers':
        return t('customers.fileErrors.missingCustomers')
      case 'invalid_record':
        return t('customers.fileErrors.invalidRecord')
      case 'invalid_json':
        return t('customers.fileErrors.invalidJson')
      case 'not_object':
        return t('customers.fileErrors.notObject')
    }
  }

  return error instanceof Error ? error.message : t('customers.statuses.fileOperationFailed')
}
</script>

<template>
  <section class="customers-panel">
    <input
      ref="customerLibraryImportInput"
      class="hidden-import-input"
      type="file"
      accept="application/json,.json"
      @change="handleImportFileSelected"
    />

    <CustomerLibraryToolbar
      :record-count="records.length"
      @create-record="handleCreateRecord"
      @import-json="handleImportJson"
      @export-json="handleExportJson"
    />

    <div v-if="statusMessage" class="status-banner" aria-live="polite">
      <i class="pi pi-info-circle" aria-hidden="true" />
      <span>{{ statusMessage }}</span>
    </div>

    <div class="customer-layout">
      <section class="customer-list-card" :aria-label="t('customers.list.aria')">
        <header class="list-heading">
          <div class="list-heading-copy">
            <h2>{{ t('customers.list.title') }}</h2>
            <p>{{ t('customers.list.description') }}</p>
          </div>
          <Button icon="pi pi-plus" :label="t('customers.list.new')" text @click="handleCreateRecord" />
        </header>

        <div v-if="records.length > 0" class="customer-grid">
          <button
            v-for="record in records"
            :key="record.id"
            class="customer-card"
            :class="{ 'customer-card-active': record.id === selectedRecordId }"
            type="button"
            @click="selectRecord(record.id)"
          >
            <div class="customer-card-main">
              <h3>{{ getCustomerRecordLabel(record, t('customers.list.untitled')) }}</h3>
              <p>{{ record.contactPerson || t('customers.list.noContactPerson') }}</p>
              <p>{{ record.contactDetails || t('customers.list.noContactDetails') }}</p>
            </div>
            <span class="customer-card-side">{{ formatIsoDate(record.updatedAt.slice(0, 10), currentLocale) }}</span>
          </button>
        </div>

        <div v-else class="empty-library">
          <span class="empty-library-icon" aria-hidden="true">
            <i class="pi pi-address-book" />
          </span>
          <p>{{ t('customers.list.emptyTitle') }}</p>
          <span>{{ t('customers.list.emptyDescription') }}</span>
        </div>
      </section>

      <CustomerLibraryEditor
        v-model="draft"
        :can-delete="hasSelectedRecord"
        @save="handleSave"
        @delete="handleDelete"
      />
    </div>
  </section>
</template>

<style scoped>
.customers-panel {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.customer-layout {
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(0, 1.1fr);
  gap: 16px;
  min-width: 0;
}

.status-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border: 1px solid var(--accent-soft);
  border-radius: var(--radius-md);
  background: var(--accent-surface);
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
}

.customer-list-card {
  display: grid;
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
  min-height: 0;
}

.list-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.list-heading-copy {
  display: grid;
  gap: 3px;
}

.list-heading-copy h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 700;
}

.list-heading-copy p {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.customer-grid {
  display: grid;
  gap: 8px;
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 2px;
}

.customer-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.customer-card:hover {
  border-color: var(--surface-border-strong);
  background: var(--surface-raised);
}

.customer-card-active {
  border-color: var(--accent);
  background: var(--accent-surface);
}

.customer-card-active:hover {
  background: var(--accent-surface);
}

.customer-card-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.customer-card h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-card p,
.customer-card-side {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-card-side {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-subtle);
}

.empty-library {
  display: grid;
  gap: 8px;
  justify-items: center;
  padding: 32px 16px 16px;
  text-align: center;
}

.empty-library-icon {
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-subtle);
  font-size: 18px;
}

.empty-library p {
  margin: 0;
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 700;
}

.empty-library span {
  color: var(--text-muted);
  font-size: 12px;
  max-width: 36ch;
  text-wrap: pretty;
}

.hidden-import-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

@media (max-width: 1100px) {
  .customer-layout {
    grid-template-columns: 1fr;
  }
}
</style>
