<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, onUnmounted, shallowRef, toRef, useTemplateRef } from 'vue'

import { useI18n } from 'vue-i18n'

import { loadAppSettings, saveAppSettings, RAIL_WIDTH_MIN, RAIL_WIDTH_MAX } from '@/shared/services/localAppSettingsStorage'

import ExchangeRatePanel from './ExchangeRatePanel.vue'
import FloatingPreviewWindow from './FloatingPreviewWindow.vue'
import LineItemsTable from './LineItemsTable.vue'
import PricingPanel from './PricingPanel.vue'
import QuoteSetupPanel from './QuoteSetupPanel.vue'
import QuotationCommandBar from './QuotationCommandBar.vue'
import QuotationSupportPanels from './QuotationSupportPanels.vue'
import QuotationNavigator from './QuotationNavigator.vue'
import { useQuotationEditor } from '../composables/useQuotationEditor'
import {
  createLineItemsCsvContent,
  createLineItemsCsvTemplateContent,
  formatCsvImportError,
  parseLineItemsCsvContent,
} from '../utils/lineItemsCsv'
import {
  createQuotationFileContent,
  parseQuotationFileContent,
  QuotationFileError,
} from '../utils/quotationFile'
import { sortCurrencyCodes } from '../utils/currencyCodes'
import { createQuotationDocumentFileName } from '../utils/quotationDocumentFileName'
import { decodeTextBuffer } from '@/shared/utils/textEncoding'
import type { SupportedLocale } from '@/shared/i18n/locale'
import type { CompanyProfile } from '@/shared/services/localCompanyProfileStorage'
import { cloneSerializable } from '@/shared/utils/clone'
import { QuotationStorageError } from '@/shared/services/localQuotationStorage'
import type { TaxMode } from '../types'

const props = defineProps<{
  companyProfile: CompanyProfile
  uiLocale: SupportedLocale
}>()
const { t } = useI18n()
const toast = useToast()

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
  addExchangeRate,
  removeExchangeRate,
  addRootItem,
  addChildItem,
  removeItem,
  duplicateRootItem,
  moveRootItem,
  updateItemField,
  setLogoDataUrl,
  createRevision,
  setTaxMode,
} = useQuotationEditor(toRef(props, 'uiLocale'))

const statusMessage = shallowRef('')
const supportPanelsCollapsed = shallowRef(false)
const railWidth = shallowRef(380)
const isResizing = shallowRef(false)
const currentFilePath = shallowRef('')

let resizeStartX = 0
let resizeStartWidth = 0

function onResizeHandleMouseDown(event: MouseEvent) {
  resizeStartX = event.clientX
  resizeStartWidth = railWidth.value
  isResizing.value = true
  window.addEventListener('mousemove', onResizeMouseMove)
  window.addEventListener('mouseup', onResizeMouseUp, { once: true })
}

function onResizeMouseMove(event: MouseEvent) {
  const delta = resizeStartX - event.clientX
  railWidth.value = Math.min(RAIL_WIDTH_MAX, Math.max(RAIL_WIDTH_MIN, resizeStartWidth + delta))
}

function onResizeMouseUp() {
  isResizing.value = false
  window.removeEventListener('mousemove', onResizeMouseMove)
  saveAppSettings({ quotationRailWidth: railWidth.value })
}
const isPreviewWindowOpen = shallowRef(false)
const showSingleTaxModeDialog = shallowRef(false)
const pendingSingleTaxClassId = shallowRef('')
const jsonImportInput = useTemplateRef<HTMLInputElement>('quotationJsonImportInput')
const csvImportInput = useTemplateRef<HTMLInputElement>('quotationCsvImportInput')
const hasNativeFileDialogs = Boolean(window.quotationApp?.saveQuotationFile && window.quotationApp?.openQuotationFile)
const activeCurrencies = computed(() =>
  sortCurrencyCodes(Object.keys(quotation.value.exchangeRates), quotation.value.header.currency),
)
const singleTaxClassOptions = computed(() =>
  (quotation.value.totalsConfig.taxClasses ?? []).map((taxClass) => ({
    label: taxClass.label,
    value: taxClass.id,
  })),
)

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

    replaceLineItems(
      parseLineItemsCsvContent(
        result.content,
        quotation.value.header.currency,
        quotation.value.totalsConfig.taxClasses ?? [],
      ),
    )
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

async function exportCsv() {
  const fileName = createQuotationDocumentFileName(quotation.value, 'csv')
  const content = createLineItemsCsvContent(quotation.value.majorItems, quotation.value.totalsConfig.taxClasses ?? [])

  try {
    const api = getCsvFileSaveApi()

    if (!api) {
      downloadFile(fileName, content, 'text/csv;charset=utf-8')
      statusMessage.value = t('quotations.statuses.downloaded', { name: fileName })
      return
    }

    const result = await api.saveLineItemsCsvFile({
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
    replaceLineItems(
      parseLineItemsCsvContent(
        decodeTextBuffer(await file.arrayBuffer()),
        quotation.value.header.currency,
        quotation.value.totalsConfig.taxClasses ?? [],
      ),
    )
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

function handleTaxModeChange(nextTaxMode: TaxMode) {
  const result = setTaxMode(nextTaxMode)

  if (result === 'requires_tax_class') {
    pendingSingleTaxClassId.value = quotation.value.totalsConfig.defaultTaxClassId ?? singleTaxClassOptions.value[0]?.value ?? ''
    showSingleTaxModeDialog.value = true
    return
  }

  statusMessage.value = nextTaxMode === 'mixed'
    ? t('quotations.statuses.taxModeMixed')
    : t('quotations.statuses.taxModeSingle')
}

function confirmSingleTaxModeSwitch() {
  const result = setTaxMode('single', {
    taxClassId: pendingSingleTaxClassId.value,
  })

  if (result !== 'updated') {
    return
  }

  showSingleTaxModeDialog.value = false
  statusMessage.value = t('quotations.statuses.taxModeSingle')
}

function cancelSingleTaxModeSwitch() {
  showSingleTaxModeDialog.value = false
}

function openPreviewWindow() {
  isPreviewWindowOpen.value = true
}

function handleAddCurrency(currency: string) {
  const result = addExchangeRate(currency)

  if (result === 'added') {
    return
  }

  toast.add({
    severity: result === 'exists' ? 'info' : 'warn',
    summary: t(
      result === 'exists'
        ? 'quotations.exchangeRates.duplicateCurrency'
        : 'quotations.exchangeRates.invalidCurrency',
      { currency: currency.trim().toUpperCase() || currency },
    ),
    life: 4000,
  })
}

function handleRemoveCurrency(currency: string) {
  const result = removeExchangeRate(currency)

  if (result === 'removed') {
    return
  }

  toast.add({
    severity: 'warn',
    summary: t(
      result === 'in_use'
        ? 'quotations.exchangeRates.currencyInUse'
        : 'quotations.exchangeRates.baseCurrencyLocked',
      { currency },
    ),
    life: 4000,
  })
}

async function exportQuotationPdf() {
  try {
    if (!window.quotationApp?.exportQuotationPdf) {
      throw new Error(t('quotations.statuses.fileOperationFailed'))
    }

    const result = await window.quotationApp.exportQuotationPdf({
      ...cloneSerializable({
        quotation: quotation.value,
        summaries: itemSummaries.value,
        totals: totals.value,
        globalMarkupRate: quotation.value.totalsConfig.globalMarkupRate,
        exchangeRates: quotation.value.exchangeRates,
        companyProfile: props.companyProfile,
      }),
      defaultFileName: createQuotationDocumentFileName(quotation.value, 'pdf'),
    })

    if (result.canceled) {
      return
    }

    statusMessage.value = t('quotations.statuses.exportedPdf', { name: getFileName(result.filePath) })
  } catch (error) {
    statusMessage.value = getFileOperationError(error)
  }
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
  return createQuotationDocumentFileName(quotation.value, 'json')
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

function getCsvFileSaveApi() {
  if (!window.quotationApp?.saveLineItemsCsvFile) {
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

function toggleSupportPanels() {
  supportPanelsCollapsed.value = !supportPanelsCollapsed.value
  saveAppSettings({
    quotationSupportPanelsCollapsed: supportPanelsCollapsed.value,
  })
}

onMounted(() => {
  const settings = loadAppSettings()
  supportPanelsCollapsed.value = settings.quotationSupportPanelsCollapsed
  railWidth.value = settings.quotationRailWidth
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('mousemove', onResizeMouseMove)
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
      :status-message="statusMessage"
      :current-file-path="currentFilePath"
      :has-native-file-dialogs="hasNativeFileDialogs"
      @create-new="startNewQuotation"
      @create-revision="startRevision"
      @save="saveDraft"
      @save-as="saveDraftAs"
      @import-csv="importCsv"
      @export-csv="exportCsv"
      @export-csv-template="exportCsvTemplate"
      @import-json="importJson"
      @export-json="exportJson"
      @load-latest="loadDraft"
      @open-preview="openPreviewWindow"
      @export-pdf="exportQuotationPdf"
      @logo-selected="handleLogoSelected"
    />

    <Dialog
      v-model:visible="showSingleTaxModeDialog"
      modal
      :header="t('quotations.totals.singleTaxDialogTitle')"
      :style="{ width: '420px' }"
    >
      <div class="tax-mode-dialog">
        <p>{{ t('quotations.totals.singleTaxDialogMessage') }}</p>
        <label class="tax-mode-dialog-field">
          <span>{{ t('quotations.totals.singleTaxDialogField') }}</span>
          <Select
            v-model="pendingSingleTaxClassId"
            :options="singleTaxClassOptions"
            option-label="label"
            option-value="value"
          />
        </label>
        <div class="tax-mode-dialog-actions">
          <Button severity="secondary" :label="t('quotations.totals.singleTaxDialogCancel')" @click="cancelSingleTaxModeSwitch" />
          <Button :label="t('quotations.totals.singleTaxDialogConfirm')" :disabled="pendingSingleTaxClassId.length === 0" @click="confirmSingleTaxModeSwitch" />
        </div>
      </div>
    </Dialog>

    <div
      class="workbench-layout"
      :class="{ 'workbench-layout--collapsed': supportPanelsCollapsed, 'workbench-layout--resizing': isResizing }"
    >
      <section class="workbench-main" :aria-label="t('quotations.preview.workbenchAria')">
        <LineItemsTable
          :items="quotation.majorItems"
          :summaries="itemSummaries"
          :currency="quotation.header.currency"
          :grand-total="totals.grandTotal"
          :global-markup-rate="quotation.totalsConfig.globalMarkupRate"
          :totals-config="quotation.totalsConfig"
          :exchange-rates="quotation.exchangeRates"
          :cost-currency-options="activeCurrencies"
          :quotation-currency-options="activeCurrencies"
          @add-root-item="addRootItem"
          @add-child-item="addChildItem"
          @remove-item="removeItem"
          @duplicate-root-item="duplicateRootItem"
          @move-root-item="moveRootItem"
          @update-quotation-currency="quotation.header.currency = $event"
          @update-item-field="updateItemField"
        />
      </section>

      <div
        v-show="!supportPanelsCollapsed"
        class="resize-handle"
        aria-hidden="true"
        @mousedown.prevent="onResizeHandleMouseDown"
      />

      <div class="workbench-rail">
        <div class="rail-toggle">
          <Button
            type="button"
            severity="secondary"
            rounded
            text
            :icon="supportPanelsCollapsed ? 'pi pi-angle-double-left' : 'pi pi-angle-double-right'"
            :aria-label="
              supportPanelsCollapsed
                ? t('quotations.workbench.expandSupportPanels')
                : t('quotations.workbench.collapseSupportPanels')
            "
            :aria-expanded="!supportPanelsCollapsed"
            v-tooltip.left="
              supportPanelsCollapsed
                ? t('quotations.workbench.expandSupportPanels')
                : t('quotations.workbench.collapseSupportPanels')
            "
            @click="toggleSupportPanels"
          />
        </div>
        <div
          v-show="!supportPanelsCollapsed"
          class="workbench-support-panels"
          :aria-hidden="supportPanelsCollapsed"
          :style="supportPanelsCollapsed ? undefined : { width: railWidth + 'px' }"
        >
          <QuotationSupportPanels>
            <template #pricing>
              <PricingPanel
                v-model="quotation.totalsConfig"
                :totals="totals"
                :currency="quotation.header.currency"
                @request-tax-mode-change="handleTaxModeChange"
              />
            </template>
            <template #setup>
              <QuoteSetupPanel
                v-model="quotation.header"
                :customer-records="customerRecords"
                :quotation-currency-options="activeCurrencies"
                @select-customer="applyCustomerRecord"
              />
            </template>
            <template #rates>
              <ExchangeRatePanel
                :exchange-rates="quotation.exchangeRates"
                :quotation-currency="quotation.header.currency"
                @update-rate="updateExchangeRate"
                @add-currency="handleAddCurrency"
                @remove-currency="handleRemoveCurrency"
              />
            </template>
            <template #outline>
              <QuotationNavigator :items="quotation.majorItems" />
            </template>
          </QuotationSupportPanels>
        </div>
      </div>
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
      @export-pdf="exportQuotationPdf"
    />
  </div>
</template>

<style scoped>
.quotation-editor {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
  height: calc(100vh - 60px);
  min-width: 1120px;
  min-height: 0;
  overflow: hidden;
}

.workbench-layout {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0;
  min-height: 0;
  overflow: hidden;
}

.workbench-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

.resize-handle {
  position: relative;
  width: 8px;
  flex-shrink: 0;
  cursor: col-resize;
  z-index: 1;
}

.resize-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  width: 2px;
  border-radius: 2px;
  background: var(--surface-border);
  opacity: 0;
  transition: opacity 0.15s;
}

.resize-handle:hover::after,
.workbench-layout--resizing .resize-handle::after {
  opacity: 1;
}

.workbench-layout--resizing {
  cursor: col-resize;
  user-select: none;
}

.workbench-rail {
  display: flex;
  flex-shrink: 0;
  flex-direction: row;
  align-items: stretch;
  min-height: 0;
  max-height: 100%;
}

.rail-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  flex-shrink: 0;
  border-left: 1px solid var(--surface-border);
  background: linear-gradient(
    180deg,
    rgb(248 250 252 / 95%),
    color-mix(in srgb, var(--surface-ground) 88%, white)
  );
}

.workbench-support-panels {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-height: 100%;
  overflow: hidden;
}

.workbench-layout--collapsed .resize-handle {
  display: none;
}

.hidden-import-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.tax-mode-dialog {
  display: grid;
  gap: 14px;
}

.tax-mode-dialog p {
  margin: 0;
  color: var(--text-body);
  line-height: 1.5;
}

.tax-mode-dialog-field {
  display: grid;
  gap: 6px;
  color: var(--text-body);
  font-size: 13px;
  font-weight: 700;
}

.tax-mode-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

</style>
