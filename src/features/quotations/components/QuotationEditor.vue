<script setup lang="ts">
import Button from 'primevue/button'
import { onMounted, onUnmounted, shallowRef } from 'vue'

import CustomerPicker from '@/features/customers/components/CustomerPicker.vue'
import ExchangeRatePanel from './ExchangeRatePanel.vue'
import FloatingPreviewWindow from './FloatingPreviewWindow.vue'
import LineItemsTable from './LineItemsTable.vue'
import QuotationCommandBar from './QuotationCommandBar.vue'
import QuotationHeaderForm from './QuotationHeaderForm.vue'
import QuotationInspector from './QuotationInspector.vue'
import TotalsPanel from './TotalsPanel.vue'
import { useQuotationEditor } from '../composables/useQuotationEditor'
import { createQuotationFileContent, parseQuotationFileContent } from '../utils/quotationFile'

const {
  quotation,
  savedDrafts,
  itemSummaries,
  totals,
  customerRecords,
  createNewQuotation,
  saveCurrentQuotation,
  loadLatestQuotation,
  replaceQuotationDraft,
  applyCustomerRecord,
  updateExchangeRate,
  addMajorItem,
  addSubItem,
  addDetailItem,
  removeMajorItem,
  removeSubItem,
  duplicateMajorItem,
  moveMajorItem,
  updateMajorItemField,
  updateSubItemField,
  setLogoDataUrl,
} = useQuotationEditor()

const statusMessage = shallowRef('')
const currentFilePath = shallowRef('')
const isPreviewWindowOpen = shallowRef(false)

async function saveDraft() {
  const result = await saveQuotationToFile(currentFilePath.value)

  if (result) {
    currentFilePath.value = result.filePath
    saveCurrentQuotation()
    statusMessage.value = `Saved ${getFileName(result.filePath)}`
  }
}

async function saveDraftAs() {
  const result = await saveQuotationToFile('')

  if (result) {
    currentFilePath.value = result.filePath
    saveCurrentQuotation()
    statusMessage.value = `Saved as ${getFileName(result.filePath)}`
  }
}

async function exportJson() {
  const result = await saveQuotationToFile('', createDefaultFileName())

  if (result) {
    statusMessage.value = `Exported ${getFileName(result.filePath)}`
  }
}

async function importJson() {
  const result = await window.quotationApp?.openQuotationFile()

  if (!result || result.canceled) {
    return
  }

  try {
    replaceQuotationDraft(parseQuotationFileContent(result.content))
    currentFilePath.value = result.filePath
    saveCurrentQuotation()
    statusMessage.value = `Imported ${getFileName(result.filePath)}`
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : 'Could not import quotation file'
  }
}

function loadDraft() {
  loadLatestQuotation()
  currentFilePath.value = ''
  statusMessage.value = savedDrafts.value.length > 0 ? 'Latest draft loaded' : 'No saved drafts yet'
}

function startNewQuotation() {
  createNewQuotation()
  currentFilePath.value = ''
  statusMessage.value = 'New quotation ready'
}

function printQuotation() {
  window.print()
}

function openPreviewWindow() {
  isPreviewWindowOpen.value = true
}

async function handleLogoSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (file) {
    setLogoDataUrl(await readFileAsDataUrl(file))
    statusMessage.value = 'Logo added to preview'
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsDataURL(file)
  })
}

async function saveQuotationToFile(filePath: string, defaultPath = createDefaultFileName()) {
  const result = await window.quotationApp?.saveQuotationFile({
    filePath: filePath || undefined,
    defaultPath,
    content: createQuotationFileContent(quotation.value),
  })

  if (!result || result.canceled) {
    return null
  }

  return result
}

function handleKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void saveDraft()
  }
}

function createDefaultFileName() {
  const quotationNumber = quotation.value.header.quotationNumber || 'quotation'
  const customer = quotation.value.header.customerCompany || quotation.value.header.customerName
  return `${sanitizeFileName([quotationNumber, customer].filter(Boolean).join('-'))}.json`
}

function sanitizeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/\s+/g, ' ').trim()
}

function getFileName(filePath: string) {
  return filePath.split(/[\\/]/).at(-1) || filePath
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="quotation-editor">
    <QuotationCommandBar
      :header="quotation.header"
      :totals="totals"
      :status-message="statusMessage"
      :current-file-path="currentFilePath"
      @create-new="startNewQuotation"
      @save="saveDraft"
      @save-as="saveDraftAs"
      @import-json="importJson"
      @export-json="exportJson"
      @load-latest="loadDraft"
      @print="printQuotation"
      @logo-selected="handleLogoSelected"
    />

    <div class="workbench-layout">
      <section class="workbench-main" aria-label="Line item workbench">
        <LineItemsTable
          :items="quotation.majorItems"
          :summaries="itemSummaries"
          :currency="quotation.header.currency"
          :global-markup-rate="quotation.totalsConfig.globalMarkupRate"
          :exchange-rates="quotation.exchangeRates"
          @add-major-item="addMajorItem"
          @add-sub-item="addSubItem"
          @add-detail-item="addDetailItem"
          @remove-major-item="removeMajorItem"
          @remove-sub-item="removeSubItem"
          @duplicate-major-item="duplicateMajorItem"
          @move-major-item="moveMajorItem"
          @update-major-item-field="updateMajorItemField"
          @update-sub-item-field="updateSubItemField"
        />
      </section>

      <QuotationInspector @preview-activated="openPreviewWindow">
        <template #totals>
          <TotalsPanel v-model="quotation.totalsConfig" :totals="totals" :currency="quotation.header.currency" />
        </template>
        <template #rates>
          <ExchangeRatePanel
            :exchange-rates="quotation.exchangeRates"
            :quotation-currency="quotation.header.currency"
            @update-rate="updateExchangeRate"
          />
        </template>
        <template #header>
          <CustomerPicker :records="customerRecords" @select-customer="applyCustomerRecord" />
          <QuotationHeaderForm v-model="quotation.header" />
        </template>
        <template #preview>
          <div class="preview-launcher">
            <Button icon="pi pi-external-link" label="Open preview" @click="openPreviewWindow" />
            <Button icon="pi pi-print" label="Print" severity="secondary" outlined @click="printQuotation" />
          </div>
        </template>
      </QuotationInspector>
    </div>

    <FloatingPreviewWindow
      v-if="isPreviewWindowOpen"
      :quotation="quotation"
      :summaries="itemSummaries"
      :totals="totals"
      :global-markup-rate="quotation.totalsConfig.globalMarkupRate"
      :exchange-rates="quotation.exchangeRates"
      @close="isPreviewWindowOpen = false"
      @print="printQuotation"
    />
  </div>
</template>

<style scoped>
.quotation-editor {
  display: grid;
  gap: 12px;
  min-height: calc(100vh - 98px);
}

.workbench-layout {
  display: grid;
  grid-template-columns: minmax(760px, 1fr) 420px;
  gap: 12px;
  align-items: stretch;
  min-height: 0;
}

.workbench-main {
  min-width: 0;
  min-height: 0;
}

.preview-launcher {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: #ffffff;
}

@media print {
  :global(.command-bar),
  .workbench-main,
  .preview-launcher,
  :global(.floating-preview-bar),
  :global(.preview-backdrop),
  :global(.app-sidebar),
  :global(.app-header) {
    display: none;
  }

  .quotation-editor,
  .workbench-layout,
  :global(.quotation-inspector) {
    display: block;
  }

  .workbench-layout {
    grid-template-columns: 1fr;
  }
}
</style>
