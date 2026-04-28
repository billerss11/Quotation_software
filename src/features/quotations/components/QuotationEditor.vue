<script setup lang="ts">
import Button from 'primevue/button'
import { nextTick, onMounted, onUnmounted, shallowRef, toRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import ExchangeRatePanel from './ExchangeRatePanel.vue'
import FloatingPreviewWindow from './FloatingPreviewWindow.vue'
import LineItemsTable from './LineItemsTable.vue'
import QuotationCommandBar from './QuotationCommandBar.vue'
import QuotationHeaderForm from './QuotationHeaderForm.vue'
import QuotationInspector from './QuotationInspector.vue'
import QuotationNavigator from './QuotationNavigator.vue'
import TotalsPanel from './TotalsPanel.vue'
import { useQuotationEditor } from '../composables/useQuotationEditor'
import {
  createLineItemsCsvTemplateContent,
  formatCsvImportError,
  parseLineItemsCsvContent,
} from '../utils/lineItemsCsv'
import {
  createQuotationFileContent,
  parseQuotationFileContent,
  QuotationFileError,
} from '../utils/quotationFile'
import { decodeTextBuffer } from '@/shared/utils/textEncoding'
import type { SupportedLocale } from '@/shared/i18n/locale'
import type { CompanyProfile } from '@/shared/services/localCompanyProfileStorage'
import { QuotationStorageError } from '@/shared/services/localQuotationStorage'

const props = defineProps<{
  companyProfile: CompanyProfile
  uiLocale: SupportedLocale
}>()
const { t } = useI18n()

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
  createRevision,
} = useQuotationEditor(toRef(props, 'uiLocale'))

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
        ? t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : t('quotations.statuses.saved', { name: getFileName(result.filePath) })
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
        ? t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : t('quotations.statuses.savedAs', { name: getFileName(result.filePath) })
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
        ? t('quotations.statuses.downloaded', { name: getFileName(result.filePath) })
        : t('quotations.statuses.exported', { name: getFileName(result.filePath) })
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
      statusMessage.value = t('quotations.statuses.chooseJson')
      return
    }

    const result = await api.openQuotationFile()

    if (result.canceled) {
      return
    }

    replaceQuotationDraft(parseQuotationFileContent(result.content))
    currentFilePath.value = result.filePath
    saveCurrentQuotation()
    statusMessage.value = t('quotations.statuses.imported', { name: getFileName(result.filePath) })
  } catch (error) {
    statusMessage.value = getQuotationFileOperationError(error)
  }
}

async function importCsv() {
  try {
    const api = getCsvFileApi()

    if (!api) {
      csvImportInput.value?.click()
      statusMessage.value = t('quotations.statuses.chooseCsv')
      return
    }

    const result = await api.openLineItemsCsvFile()

    if (result.canceled) {
      return
    }

    replaceLineItems(parseLineItemsCsvContent(result.content, quotation.value.header.currency))
    saveCurrentQuotation()
    statusMessage.value = t('quotations.statuses.importedCsv', { name: getFileName(result.filePath) })
  } catch (error) {
    statusMessage.value = formatCsvImportError(error, translateMessage)
  }
}

async function exportCsvTemplate() {
  const fileName = 'quotation-line-items-template.csv'
  const content = createLineItemsCsvTemplateContent()

  try {
    const api = getCsvTemplateFileApi()

    if (!api) {
      downloadFile(fileName, content, 'text/csv;charset=utf-8')
      statusMessage.value = t('quotations.statuses.downloaded', { name: fileName })
      return
    }

    const result = await api.saveLineItemsCsvTemplateFile({
      defaultPath: fileName,
      content,
    })

    if (result.canceled) {
      return
    }

    statusMessage.value = t('quotations.statuses.exported', { name: getFileName(result.filePath) })
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
    statusMessage.value = t('quotations.statuses.imported', { name: file.name })
  } catch (error) {
    statusMessage.value = getQuotationFileOperationError(error)
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
    statusMessage.value = t('quotations.statuses.importedCsv', { name: file.name })
  } catch (error) {
    statusMessage.value = formatCsvImportError(error, translateMessage)
  } finally {
    input.value = ''
  }
}

function loadDraft() {
  loadLatestQuotation()
  currentFilePath.value = ''
  statusMessage.value = savedDrafts.value.length > 0 ? t('quotations.statuses.latestLoaded') : t('quotations.statuses.noDrafts')
}

function startNewQuotation() {
  createNewQuotation()
  currentFilePath.value = ''
  statusMessage.value = t('quotations.statuses.newReady')
}

function startRevision() {
  try {
    createRevision()
    currentFilePath.value = ''
    statusMessage.value = t('quotations.statuses.revisionReady', { revision: quotation.value.header.revisionNumber })
  } catch (error) {
    statusMessage.value = getStorageOperationError(error)
  }
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
    statusMessage.value = t('quotations.statuses.logoAdded')
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
  const revision = quotation.value.header.revisionNumber && quotation.value.header.revisionNumber > 1
    ? `Rev-${quotation.value.header.revisionNumber}`
    : ''
  const customer = quotation.value.header.customerCompany || quotation.value.header.contactPerson
  return `${sanitizeFileName([quotationNumber, revision, customer].filter(Boolean).join('-'))}.json`
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
  if (error instanceof QuotationStorageError) {
    return getStorageOperationError(error)
  }

  return error instanceof Error ? error.message : t('quotations.statuses.fileOperationFailed')
}

function getQuotationFileOperationError(error: unknown) {
  if (error instanceof QuotationFileError) {
    switch (error.code) {
      case 'missing_quotation':
        return t('quotations.fileErrors.missingQuotation')
      case 'unsupported_currency':
        return t('quotations.fileErrors.unsupportedCurrency')
      case 'invalid_json':
        return t('quotations.fileErrors.invalidJson')
      case 'not_object':
        return t('quotations.fileErrors.notObject')
    }
  }

  return error instanceof Error ? error.message : t('quotations.statuses.importQuotationFailed')
}

function translateMessage(key: string, params?: Record<string, string | number>) {
  return params ? t(key, params) : t(key)
}

function getStorageOperationError(error: unknown) {
  if (error instanceof QuotationStorageError) {
    return error.code === 'quota_exceeded'
      ? t('quotations.statuses.draftStorageQuotaExceeded')
      : t('quotations.statuses.draftStorageFailed')
  }

  return t('quotations.statuses.draftStorageFailed')
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
      @create-revision="startRevision"
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
      <section class="workbench-main" :aria-label="t('quotations.preview.workbenchAria')">
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
          <QuotationHeaderForm
            v-model="quotation.header"
            :customer-records="customerRecords"
            @select-customer="applyCustomerRecord"
          />
        </template>
        <template #preview>
          <div class="preview-launcher">
            <Button icon="pi pi-external-link" :label="t('quotations.previewLauncher.open')" @click="openPreviewWindow" />
            <Button icon="pi pi-print" :label="t('quotations.previewLauncher.print')" severity="secondary" outlined @click="printQuotation" />
          </div>
        </template>
        <template #navigate>
          <QuotationNavigator :items="quotation.majorItems" />
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
      :company-profile="props.companyProfile"
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
  background: var(--surface-card);
  box-shadow: var(--shadow-control);
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
