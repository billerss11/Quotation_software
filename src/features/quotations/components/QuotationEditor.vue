<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { computed, shallowRef, toRef, useTemplateRef } from 'vue'

import { useI18n } from 'vue-i18n'

import ExchangeRatePanel from './ExchangeRatePanel.vue'
import QuotationAnalysisView from './QuotationAnalysisView.vue'
import FloatingPreviewWindow from './FloatingPreviewWindow.vue'
import LineItemsTable from './LineItemsTable.vue'
import PricingPanel from './PricingPanel.vue'
import QuoteSetupPanel from './QuoteSetupPanel.vue'
import QuotationCommandBar from './QuotationCommandBar.vue'
import QuotationSupportPanels from './QuotationSupportPanels.vue'
import QuotationNavigator from './QuotationNavigator.vue'
import { useQuotationEditor } from '../composables/useQuotationEditor'
import { useQuotationFileActions } from '../composables/useQuotationFileActions'
import { useQuotationWorkbench } from '../composables/useQuotationWorkbench'
import { useQuotationWorkspace } from '../composables/useQuotationWorkspace'
import { sortCurrencyCodes } from '../utils/currencyCodes'
import { flushLineItemEditBuffers } from '../utils/lineItemEditBuffers'
import type { SupportedLocale } from '@/shared/i18n/locale'
import type { CompanyProfile } from '@/shared/services/localCompanyProfileStorage'
import { QuotationStorageError } from '@/shared/services/localQuotationStorage'
import { formatCurrency } from '@/shared/utils/formatters'
import type { LineItemEntryMode, TaxMode } from '../types'
import { createQuotationAnalysisDataset } from '../utils/quotationAnalysis'

const props = defineProps<{
  companyProfile: CompanyProfile
  uiLocale: SupportedLocale
}>()
const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
const toast = useToast()
const {
  workspaceMode,
  focusedItemId,
  openEditor,
  openAnalysis,
  focusItemInEditor,
  clearFocusedItem,
} = useQuotationWorkspace()

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
  setLineItemEntryMode,
  setItemPricingMethod,
  setLogoDataUrl,
  createRevision,
  setTaxMode,
} = useQuotationEditor(toRef(props, 'uiLocale'))

const showSingleTaxModeDialog = shallowRef(false)
const pendingSingleTaxClassId = shallowRef('')
const jsonImportInput = useTemplateRef<HTMLInputElement>('quotationJsonImportInput')
const csvImportInput = useTemplateRef<HTMLInputElement>('quotationCsvImportInput')
const activeCurrencies = computed(() =>
  sortCurrencyCodes(Object.keys(quotation.value.exchangeRates), quotation.value.header.currency),
)
const analysis = computed(() =>
  createQuotationAnalysisDataset(quotation.value, itemSummaries.value, totals.value),
)
const singleTaxClassOptions = computed(() =>
  (quotation.value.totalsConfig.taxClasses ?? []).map((taxClass) => ({
    label: taxClass.label,
    value: taxClass.id,
  })),
)

const {
  statusMessage,
  currentFilePath,
  hasNativeFileDialogs,
  saveDraft,
  saveDraftAs,
  exportJson,
  importJson,
  importCsv,
  exportCsvTemplate,
  exportCsv,
  exportQuotationPdf,
  handleJsonImportFileSelected,
  handleCsvImportFileSelected,
  handleLogoSelected,
} = useQuotationFileActions({
  quotation,
  itemSummaries,
  totals,
  companyProfile: toRef(props, 'companyProfile'),
  quotationApp: window.quotationApp,
  flushPendingEdits: flushLineItemEditBuffers,
  saveCurrentQuotation,
  replaceQuotationDraft,
  replaceLineItems,
  setLogoDataUrl,
  jsonImportInput,
  csvImportInput,
  t: translateMessage,
})

const {
  supportPanelsCollapsed,
  railWidth,
  isResizing,
  isPreviewWindowOpen,
  onResizeHandleMouseDown,
  toggleSupportPanels: toggleWorkbenchSupportPanels,
  openPreviewWindow,
  closePreviewWindow,
} = useQuotationWorkbench({
  workspaceMode,
  focusedItemId,
  clearFocusedItem,
  onSaveShortcut: saveDraft,
})

const navigatorCollapsed = shallowRef(false)

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

function handleLineItemEntryModeChange(nextMode: LineItemEntryMode) {
  setLineItemEntryMode(nextMode)
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

function handleAnalysisItemSelection(payload: { itemId: string }) {
  focusItemInEditor(payload.itemId)
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
      :workspace-mode="workspaceMode"
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
      @open-editor="openEditor"
      @open-analysis="openAnalysis"
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
      v-if="workspaceMode === 'editor'"
      class="workbench-layout"
      :class="{ 'workbench-layout--collapsed': supportPanelsCollapsed, 'workbench-layout--resizing': isResizing }"
    >
      <!-- Left navigator panel -->
      <div class="workbench-nav">
        <div class="nav-toggle">
          <Button
            type="button"
            severity="secondary"
            rounded
            text
            :icon="navigatorCollapsed ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'"
            :aria-label="navigatorCollapsed ? t('quotations.workbench.expandNavigator') : t('quotations.workbench.collapseNavigator')"
            :aria-expanded="!navigatorCollapsed"
            v-tooltip.right="navigatorCollapsed ? t('quotations.workbench.expandNavigator') : t('quotations.workbench.collapseNavigator')"
            @click="navigatorCollapsed = !navigatorCollapsed"
          />
        </div>
        <div v-show="!navigatorCollapsed" class="nav-panel">
          <p class="nav-panel-heading">{{ t('quotations.supportPanels.panels.outline') }}</p>
          <QuotationNavigator :items="quotation.majorItems" />
        </div>
      </div>

      <!-- Centre: line items + totals bar -->
      <div class="workbench-center">
        <section class="workbench-main" :aria-label="t('quotations.preview.workbenchAria')">
          <LineItemsTable
            :items="quotation.majorItems"
            :currency="quotation.header.currency"
            :grand-total="totals.grandTotal"
            :line-item-entry-mode="quotation.lineItemEntryMode ?? 'detailed'"
            :global-markup-rate="quotation.totalsConfig.globalMarkupRate"
            :totals-config="quotation.totalsConfig"
            :exchange-rates="quotation.exchangeRates"
            :cost-currency-options="activeCurrencies"
            :quotation-currency-options="activeCurrencies"
            :focused-item-id="focusedItemId"
            @add-root-item="addRootItem"
            @add-child-item="addChildItem"
            @remove-item="removeItem"
            @duplicate-root-item="duplicateRootItem"
            @move-root-item="moveRootItem"
            @update-quotation-currency="quotation.header.currency = $event"
            @update-line-item-entry-mode="handleLineItemEntryModeChange"
            @set-item-pricing-method="setItemPricingMethod"
            @update-item-field="updateItemField"
          />
        </section>

        <footer class="totals-bar" aria-label="Quotation totals">
          <template v-if="(quotation.lineItemEntryMode ?? 'detailed') === 'detailed'">
            <span class="totals-bar-item">
              <span class="totals-bar-label">{{ t('quotations.totals.totalCost') }}</span>
              <strong>{{ formatCurrency(totals.baseSubtotal, quotation.header.currency, currentLocale) }}</strong>
            </span>
            <span class="totals-bar-sep" aria-hidden="true">+</span>
            <span class="totals-bar-item">
              <span class="totals-bar-label">{{ t('quotations.totals.markup') }}</span>
              <strong class="totals-bar-green">{{ formatCurrency(totals.markupAmount, quotation.header.currency, currentLocale) }}</strong>
            </span>
          </template>
          <template v-else>
            <span class="totals-bar-item">
              <span class="totals-bar-label">{{ t('quotations.totals.priceBeforeTax') }}</span>
              <strong>{{ formatCurrency(totals.taxableSubtotal, quotation.header.currency, currentLocale) }}</strong>
            </span>
          </template>
          <span v-if="totals.discountAmount > 0" class="totals-bar-sep" aria-hidden="true">-</span>
          <span v-if="totals.discountAmount > 0" class="totals-bar-item">
            <span class="totals-bar-label">{{ t('quotations.totals.discount') }}</span>
            <strong class="totals-bar-warn">{{ formatCurrency(totals.discountAmount, quotation.header.currency, currentLocale) }}</strong>
          </span>
          <span class="totals-bar-sep" aria-hidden="true">+</span>
          <span class="totals-bar-item">
            <span class="totals-bar-label">{{ t('quotations.totals.taxLine') }}</span>
            <strong>{{ formatCurrency(totals.taxAmount, quotation.header.currency, currentLocale) }}</strong>
          </span>
          <span class="totals-bar-divider" aria-hidden="true" />
          <span class="totals-bar-item totals-bar-total">
            <span class="totals-bar-label">{{ t('quotations.totals.total') }}</span>
            <strong>{{ formatCurrency(totals.grandTotal, quotation.header.currency, currentLocale) }}</strong>
          </span>
        </footer>
      </div>

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
            @click="toggleWorkbenchSupportPanels"
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
          </QuotationSupportPanels>
        </div>
      </div>
    </div>

    <section v-else class="analysis-surface">
      <QuotationAnalysisView
        :analysis="analysis"
        :currency="quotation.header.currency"
        @select-item="handleAnalysisItemSelection"
      />
    </section>

    <FloatingPreviewWindow
      v-if="isPreviewWindowOpen"
      :quotation="quotation"
      :summaries="itemSummaries"
      :totals="totals"
      :global-markup-rate="quotation.totalsConfig.globalMarkupRate"
      :exchange-rates="quotation.exchangeRates"
      :company-profile="props.companyProfile"
      @close="closePreviewWindow"
      @export-pdf="exportQuotationPdf"
    />
  </div>
</template>

<style scoped>
.quotation-editor {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
  height: 100vh;
  padding: 8px 8px 0;
  min-width: 960px;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.workbench-layout {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0;
  min-height: 0;
  overflow: hidden;
}

/* 鈹€鈹€鈹€ Left navigator panel 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */

.workbench-nav {
  display: flex;
  flex-direction: row;
  flex-shrink: 0;
  align-items: stretch;
  min-height: 0;
  border-right: 1px solid var(--surface-border);
}

.nav-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  flex-shrink: 0;
  background: linear-gradient(
    180deg,
    rgb(248 250 252 / 95%),
    color-mix(in srgb, var(--surface-ground) 88%, white)
  );
}

.nav-panel {
  display: flex;
  flex-direction: column;
  width: 200px;
  min-height: 0;
  overflow: auto;
  padding: 6px 8px 8px;
  gap: 6px;
  border-left: 1px solid var(--surface-border);
  background: var(--surface-card);
}

.nav-panel-heading {
  margin: 0;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  flex-shrink: 0;
}

/* 鈹€鈹€鈹€ Centre column (items + totals bar) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */

.workbench-center {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
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

/* 鈹€鈹€鈹€ Totals bar 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */

.totals-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-card);
  font-size: 12px;
  overflow: hidden;
}

.totals-bar-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  white-space: nowrap;
}

.totals-bar-label {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.totals-bar-item strong {
  color: var(--text-strong);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.totals-bar-green {
  color: var(--accent) !important;
}

.totals-bar-warn {
  color: var(--warning) !important;
}

.totals-bar-sep {
  color: var(--text-subtle);
  font-weight: 700;
  font-size: 14px;
  align-self: flex-end;
  padding-bottom: 1px;
}

.totals-bar-divider {
  width: 1px;
  height: 28px;
  background: var(--surface-border);
  margin: 0 4px;
  flex-shrink: 0;
}

.totals-bar-total {
  padding-left: 4px;
}

.totals-bar-total strong {
  color: var(--accent) !important;
  font-size: 15px !important;
  font-weight: 800;
}

.analysis-surface {
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
