<script setup lang="ts">
import Button from 'primevue/button'
import { shallowRef, useTemplateRef } from 'vue'

import { useCustomerLibrary } from '../composables/useCustomerLibrary'
import { createCustomerLibraryFileContent, parseCustomerLibraryFileContent } from '../utils/customerLibraryFile'
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

const statusMessage = shallowRef('')
const importInput = useTemplateRef<HTMLInputElement>('customerLibraryImportInput')
const hasNativeFileDialogs = Boolean(
  window.quotationApp?.saveCustomerLibraryFile && window.quotationApp?.openCustomerLibraryFile,
)

function handleSave() {
  saveDraft()
  statusMessage.value = `Saved ${draft.value.customerCompany || draft.value.customerName || 'customer record'}`
}

function handleDelete() {
  const deletedLabel = draft.value.customerCompany || draft.value.customerName || 'customer record'
  deleteSelectedRecord()
  statusMessage.value = `Deleted ${deletedLabel}`
}

function handleCreateRecord() {
  startNewRecord()
  statusMessage.value = 'New customer record ready'
}

async function handleImportJson() {
  try {
    const api = getCustomerLibraryFileApi()

    if (!api) {
      importInput.value?.click()
      statusMessage.value = 'Choose a customer library JSON file'
      return
    }

    const result = await api.openCustomerLibraryFile()

    if (result.canceled) {
      return
    }

    const importedRecords = parseCustomerLibraryFileContent(result.content)
    replaceAllRecords([...records.value, ...importedRecords])
    statusMessage.value = `Imported ${getFileName(result.filePath)}`
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
    statusMessage.value = `Imported ${file.name}`
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
      statusMessage.value = `Downloaded ${defaultPath}`
      return
    }

    const result = await api.saveCustomerLibraryFile({
      defaultPath,
      content,
    })

    if (result.canceled) {
      return
    }

    statusMessage.value = `Exported ${getFileName(result.filePath)}`
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
  return error instanceof Error ? error.message : 'Customer library file operation failed'
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
      <section class="customer-list-card" aria-label="Customer library records">
        <header class="list-heading">
          <div>
            <h2>Records</h2>
            <p>Select a record to edit it, or create a new one.</p>
          </div>
          <Button icon="pi pi-plus" label="New" text @click="handleCreateRecord" />
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
            <h3>{{ record.customerCompany || record.customerName || 'Untitled Customer' }}</h3>
            <p>{{ record.contactPerson || record.customerName || 'No contact person' }}</p>
            <span>{{ record.contactDetails || 'No contact details' }}</span>
            <strong>{{ record.updatedAt.slice(0, 10) }}</strong>
          </button>
        </div>

        <div v-else class="empty-library">
          <p>No customer library records yet.</p>
          <span>Create a new record or import a shared JSON file.</span>
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
  gap: 6px;
  width: 100%;
  padding: 16px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: #f8fafc;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.customer-card h3,
.customer-card p {
  margin: 0;
}

.customer-card-active,
.customer-card:hover {
  border-color: var(--accent-soft);
  background: var(--accent-surface);
}

.customer-card span {
  color: #64748b;
}

.customer-card strong {
  color: var(--accent);
}

.empty-library {
  display: grid;
  gap: 4px;
}

.empty-library p {
  color: var(--text-strong);
  font-weight: 800;
}

.hidden-import-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
</style>
