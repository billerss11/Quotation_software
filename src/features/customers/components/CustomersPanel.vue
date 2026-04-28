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

    <div v-if="statusMessage" class="status-banner">
      <i class="pi pi-info-circle" aria-hidden="true" />
      <span>{{ statusMessage }}</span>
    </div>

    <div class="customer-layout">
      <section class="customer-list-card" :aria-label="t('customers.list.aria')">
        <header class="list-heading">
          <div>
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
            <h3>{{ getCustomerRecordLabel(record, t('customers.list.untitled')) }}</h3>
            <p>{{ record.contactPerson || t('customers.list.noContactPerson') }}</p>
            <span>{{ record.contactDetails || t('customers.list.noContactDetails') }}</span>
            <strong>{{ formatIsoDate(record.updatedAt.slice(0, 10), currentLocale) }}</strong>
          </button>
        </div>

        <div v-else class="empty-library">
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
}

.customer-layout {
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(0, 1.1fr);
  gap: 16px;
}

.status-banner,
.customer-list-card {
  padding: 16px 20px;
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  background: #ffffff;
}

.status-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
  background: var(--accent-surface);
}

.list-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.list-heading h2,
.list-heading p,
.empty-library p,
.empty-library span {
  margin: 0;
}

.list-heading p,
.empty-library span {
  color: #64748b;
}

.customer-grid {
  display: grid;
  gap: 10px;
}

.customer-card {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 14px;
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  background: #ffffff;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.customer-card-active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgb(4 120 87 / 20%);
}

.customer-card h3,
.customer-card p,
.customer-card span,
.customer-card strong {
  margin: 0;
}

.customer-card p,
.customer-card span {
  color: #64748b;
}

.customer-card strong {
  font-size: 12px;
}

.empty-library {
  display: grid;
  gap: 6px;
  padding: 16px 0 4px;
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
