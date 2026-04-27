<script setup lang="ts">
import Button from 'primevue/button'
import { nextTick, onMounted, onUnmounted, shallowRef, useTemplateRef } from 'vue'

import CustomerPicker from '@/features/customers/components/CustomerPicker.vue'
import ExchangeRatePanel from './ExchangeRatePanel.vue'
import FloatingPreviewWindow from './FloatingPreviewWindow.vue'
import LineItemsTable from './LineItemsTable.vue'
import QuotationCommandBar from './QuotationCommandBar.vue'
import QuotationHeaderForm from './QuotationHeaderForm.vue'
import QuotationInspector from './QuotationInspector.vue'
import TotalsPanel from './TotalsPanel.vue'
import { useQuotationEditor } from '../composables/useQuotationEditor'
import {
  createLineItemsCsvTemplateContent,
  formatCsvImportError,
  parseLineItemsCsvContent,
} from '../utils/lineItemsCsv'
import { createQuotationFileContent, parseQuotationFileContent } from '../utils/quotationFile'
import { decodeTextBuffer } from '@/shared/utils/textEncoding'

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
  replaceLineItems,
  applyCustomerRecord,
  updateExchangeRate,
  addRootItem,
  addChildItem,
  removeItem,
  duplicateRootItem,
  moveRootItem,
  updateItemField,
  setLogoDataUrl,
} = useQuotationEditor()

const statusMessage = shallowRef('')
const currentFilePath = shallowRef('')
const isPreviewWindowOpen = shallowRef(false)
const jsonImportInput = useTemplateRef<HTMLInputElement>('quotationJsonImportInput')
const csvImportInput = useTemplateRef<HTMLInputElement>('quotationCsvImportInput')
const hasNativeFileDialogs = Boolean(window.quotationApp?.saveQuotationFile && window.quotationApp?.openQuotationFile)

async function saveDraft() {
  try {
    const result = await saveQuotationToFile(currentFilePath.value)

    if (result) {
      currentFilePath.value = result.filePath
      saveCurrentQuotation()
      statusMessage.value = result.usedDownload
        ? `Downloaded ${getFileName(result.filePath)}`
        : `Saved ${getFileName(result.filePath)}`
    }
  } catch (error) {
    statusMessage.value = getFileOperationError(error)
  }
}

async function saveDraftAs() {
  try {
    const result = await saveQuotationToFile('')

    if (result) {
      currentFilePath.value = result.filePath
      saveCurrentQuotation()
      statusMessage.value = result.usedDownload
        ? `Downloaded ${getFileName(result.filePath)}`
        : `Saved as ${getFileName(result.filePath)}`
    }
  } catch (error) {
    statusMessage.value = getFileOperationError(error)
  }
}

async function exportJson() {
  try {
    const result = await saveQuotationToFile('', createDefaultFileName())

    if (result) {
      statusMessage.value = result.usedDownload
        ? `Downloaded ${getFileName(result.filePath)}`
        : `Exported ${getFileName(result.filePath)}`
    }
  } catch (error) {
    statusMessage.value = getFileOperationError(error)
  }
}

async function importJson() {
  try {
    const api = getQuotationFileApi()

    if (!api) {
      jsonImportInput.value?.click()
      statusMessage.value = 'Choose a quotation JSON file'
      return
    }

    const result = await api.openQuotationFile()

    if (result.canceled) {
      return
    }

    replaceQuotationDraft(parseQuotationFileContent(result.content))
    currentFilePath.value = result.filePath
    saveCurrentQuotation()
    statusMessage.value = `Imported ${getFileName(result.filePath)}`
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : 'Could not import quotation file'
  }
}

async function importCsv() {
  try {
    const api = getCsvFileApi()

    if (!api) {
      csvImportInput.value?.click()
      statusMessage.value = 'Choose a line items CSV file'
      return
    }

    const result = await api.openLineItemsCsvFile()

    if (result.canceled) {
      return
    }

    replaceLineItems(parseLineItemsCsvContent(result.content, quotation.value.header.currency))
    saveCurrentQuotation()
    statusMessage.value = `Imported line items from ${getFileName(result.filePath)}`
  } catch (error) {
    statusMessage.value = formatCsvImportError(error)
  }
}

async function exportCsvTemplate() {
  const fileName = 'quotation-line-items-template.csv'
  const content = createLineItemsCsvTemplateContent()

  try {
    const api = getCsvTemplateFileApi()

    if (!api) {
      downloadFile(fileName, content, 'text/csv;charset=utf-8')
      statusMessage.value = `Downloaded ${fileName}`
      return
    }

    const result = await api.saveLineItemsCsvTemplateFile({
      defaultPath: fileName,
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

async function handleJsonImportFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  try {
    replaceQuotationDraft(parseQuotationFileContent(await file.text()))
    currentFilePath.value = file.name
    saveCurrentQuotation()
    statusMessage.value = `Imported ${file.name}`
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : 'Could not import quotation file'
  } finally {
    input.value = ''
  }
}

async function handleCsvImportFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  try {
    replaceLineItems(parseLineItemsCsvContent(decodeTextBuffer(await file.arrayBuffer()), quotation.value.header.currency))
    saveCurrentQuotation()
    statusMessage.value = `Imported line items from ${file.name}`
  } catch (error) {
    statusMessage.value = formatCsvImportError(error)
  } finally {
    input.value = ''
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

async function printQuotation() {
  isPreviewWindowOpen.value = true
  await nextTick()
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
  const content = createQuotationFileContent(quotation.value)
  const api = getQuotationFileApi()

  if (!api) {
    downloadQuotationFile(defaultPath, content)
    return {
      canceled: false as const,
      filePath: defaultPath,
      usedDownload: true,
    }
  }

  const result = await api.saveQuotationFile({
    filePath: filePath || undefined,
    defaultPath,
    content,
  })

  if (result.canceled) {
    return null
  }

  return {
    ...result,
    usedDownload: false,
  }
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

function getQuotationFileApi() {
  if (!window.quotationApp?.saveQuotationFile || !window.quotationApp.openQuotationFile) {
    return null
  }

  return window.quotationApp
}

function getCsvFileApi() {
  if (!window.quotationApp?.openLineItemsCsvFile) {
    return null
  }

  return window.quotationApp
}

function getCsvTemplateFileApi() {
  if (!window.quotationApp?.saveLineItemsCsvTemplateFile) {
    return null
  }

  return window.quotationApp
}

function downloadQuotationFile(fileName: string, content: string) {
  downloadFile(fileName, content, 'application/json')
}

function downloadFile(fileName: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function getFileOperationError(error: unknown) {
  return error instanceof Error ? error.message : 'File operation failed'
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
    <input
      ref="quotationJsonImportInput"
      class="hidden-import-input"
      type="file"
      accept="application/json,.json"
      @change="handleJsonImportFileSelected"
    />
    <input
      ref="quotationCsvImportInput"
      class="hidden-import-input"
      type="file"
      accept="text/csv,.csv"
      @change="handleCsvImportFileSelected"
    />

    <QuotationCommandBar
      :header="quotation.header"
      :totals="totals"
      :status-message="statusMessage"
      :current-file-path="currentFilePath"
      :has-native-file-dialogs="hasNativeFileDialogs"
      @create-new="startNewQuotation"
      @save="saveDraft"
      @save-as="saveDraftAs"
      @import-csv="importCsv"
      @export-csv-template="exportCsvTemplate"
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
          @add-root-item="addRootItem"
          @add-child-item="addChildItem"
          @remove-item="removeItem"
          @duplicate-root-item="duplicateRootItem"
          @move-root-item="moveRootItem"
          @update-item-field="updateItemField"
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
  grid-template-columns: minmax(0, 1fr) clamp(360px, 24vw, 420px);
  gap: 12px;
  align-items: start;
  min-height: 0;
}

.workbench-main {
  min-width: 0;
  min-height: 0;
}

.preview-launcher {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: #ffffff;
}

.preview-launcher :deep(.p-button) {
  justify-content: center;
  width: 100%;
}

.hidden-import-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

@media (max-width: 1280px) {
  .workbench-layout {
    grid-template-columns: 1fr;
  }
}
</style>
