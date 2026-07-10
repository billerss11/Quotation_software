<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, shallowRef, toRef, useTemplateRef, watch } from 'vue'

import { useI18n } from 'vue-i18n'

import ExchangeRatePanel from './ExchangeRatePanel.vue'
import GoalSeekDialog from './GoalSeekDialog.vue'
import LineItemsTable from './LineItemsTable.vue'
import PricingPanel from './PricingPanel.vue'
import QuoteCustomerPanel from './QuoteCustomerPanel.vue'
import QuoteInfoPanel from './QuoteInfoPanel.vue'
import QuotationCommandBar from './QuotationCommandBar.vue'
import QuotationSupportPanels from './QuotationSupportPanels.vue'
import QuotationNavigator from './QuotationNavigator.vue'
import QuotationUndoRedoNotice from './QuotationUndoRedoNotice.vue'
import { useQuotationAgentApi } from '../composables/useQuotationAgentApi'
import { useQuotationEditor } from '../composables/useQuotationEditor'
import { useQuotationFileActions } from '../composables/useQuotationFileActions'
import { useQuotationWorkbench } from '../composables/useQuotationWorkbench'
import { useQuotationWorkspace } from '../composables/useQuotationWorkspace'
import type { QuotationHistoryAction, QuotationHistoryResult } from '../composables/useQuotationUndoHistory'
import { sortCurrencyCodes } from '../utils/currencyCodes'
import { flushLineItemEditBuffers } from '../utils/lineItemEditBuffers'
import type { SupportedLocale } from '@/shared/i18n/locale'
import { getQuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { formatCurrency } from '@/shared/utils/formatters'
import type { LineItemEntryMode, QuotationOutputItemDetailLevel, TaxClass, TaxMode } from '../types'
import type { QuotationSupportPanelValue } from '../utils/quotationSupportPanels'
import { createQuotationAnalysisDataset } from '../utils/quotationAnalysis'
import { describeQuotationHistoryChange, type QuotationHistoryChangeSummary } from '../utils/quotationHistoryChangeSummary'
import {
  findQuotationHistoryTargetElement,
  getQuotationHistoryTargetItemId,
  getQuotationHistoryTargetPanel,
} from '../utils/quotationHistoryTargets'
import { normalizeQuotationOutputSettings } from '../utils/quotationOutputSettings'

const QuotationAnalysisView = defineAsyncComponent(() => import('./QuotationAnalysisView.vue'))
const FloatingPreviewWindow = defineAsyncComponent(() => import('./FloatingPreviewWindow.vue'))

const props = defineProps<{
  uiLocale: SupportedLocale
}>()
const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
const toast = useToast()
const runtime = getQuotationRuntime()
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
  companyProfileRecords,
  createNewQuotation,
  saveCurrentQuotation,
  loadLatestQuotation,
  replaceQuotationDraft,
  undoLastQuotationChange,
  redoLastQuotationChange,
  resetQuotationChangeHistory,
  replaceLineItems,
  applyCustomerRecord,
  applyCompanyProfile,
  updateExchangeRate,
  addExchangeRate,
  removeExchangeRate,
  addRootItem,
  addSectionHeader,
  addChildItem,
  removeItem,
  duplicateRootItem,
  moveRootItem,
  moveRootRowToIndex,
  moveQuotationTreeRow,
  updateSectionHeaderTitle,
  updateItemField,
  setLineItemEntryMode,
  setItemPricingMethod,
  setLogoDataUrl,
  setTaxMode,
} = useQuotationEditor(toRef(props, 'uiLocale'))

const showSingleTaxModeDialog = shallowRef(false)
const showCsvImportReport = shallowRef(false)
const showGoalSeekDialog = shallowRef(false)
const goalSeekMode = shallowRef<GoalSeekMode>('items')
const goalSeekInitialItemId = shallowRef<string | null>(null)
const pendingSingleTaxClassId = shallowRef('')
const activeSupportPanel = shallowRef<QuotationSupportPanelValue>('pricing')
const supportRailRef = useTemplateRef<HTMLElement>('supportRail')
const activeCurrencies = computed(() =>
  sortCurrencyCodes(Object.keys(quotation.value.exchangeRates), quotation.value.header.currency),
)
const analysis = computed(() =>
  createQuotationAnalysisDataset(quotation.value, itemSummaries.value, totals.value),
)
const singleTaxClassOptions = computed(() =>
  (quotation.value.totalsConfig.taxClasses ?? []).map((taxClass: TaxClass) => ({
    label: taxClass.label,
    value: taxClass.id,
  })),
)
const outputItemDetailLevel = computed<QuotationOutputItemDetailLevel>({
  get: () => normalizeQuotationOutputSettings(quotation.value.outputSettings).itemDetailLevel,
  set: (itemDetailLevel) => {
    quotation.value.outputSettings = {
      ...normalizeQuotationOutputSettings(quotation.value.outputSettings),
      itemDetailLevel,
    }
  },
})
const itemFocusRequestKey = shallowRef(0)
const undoRedoNotice = shallowRef<UndoRedoNotice | null>(null)
const historyRevealTarget = shallowRef<string | null>(null)
const historyRevealTargetKey = shallowRef(0)
let undoRedoNoticeKey = 0
let undoRedoNoticeTimer: ReturnType<typeof window.setTimeout> | null = null
let undoRedoHighlightTimer: ReturnType<typeof window.setTimeout> | null = null
let undoRedoHighlightedElement: HTMLElement | null = null

interface UndoRedoNotice {
  id: number
  action: QuotationHistoryAction
  title: string
  detail: string
}

type GoalSeekMode = 'items' | 'quotation'
type GoalSeekItemUpdate = {
  itemId: string
  markupRate: number
}

const {
  statusMessage,
  currentFilePath,
  csvImportReport,
  hasNativeFileDialogs,
  saveDraft,
  saveDraftAs,
  exportJson,
  importJson,
  importJsonFromPath,
  importJsonContent,
  autoImportDevQuotation,
  importCsv,
  importCsvFromPath,
  importCsvContent,
  exportCsvTemplate,
  exportCsv,
  exportQuotationPdf,
  exportQuotationPdfToFile,
  handleLogoSelected,
} = useQuotationFileActions({
  quotation,
  itemSummaries,
  totals,
  runtime,
  flushPendingEdits: flushLineItemEditBuffers,
  saveCurrentQuotation,
  replaceQuotationDraft,
  replaceLineItems,
  setLogoDataUrl,
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
  railElement: supportRailRef,
  clearFocusedItem,
  onSaveShortcut: saveDraft,
  onUndoShortcut: handleUndoShortcut,
  onRedoShortcut: handleRedoShortcut,
  onTogglePreview: togglePreviewWindow,
})

const csvImportReportEntries = computed(() => csvImportReport.value?.entries ?? [])
const csvImportReportErrorCount = computed(() =>
  csvImportReportEntries.value.filter((entry) => entry.severity === 'error').length,
)
const csvImportReportWarningCount = computed(() =>
  csvImportReportEntries.value.filter((entry) => entry.severity === 'warning').length,
)
const csvImportReportSummary = computed(() => {
  const report = csvImportReport.value

  if (!report) {
    return ''
  }

  return t(report.ok ? 'quotations.csv.report.successSummary' : 'quotations.csv.report.failedSummary', {
    fileName: report.fileName,
    errors: csvImportReportErrorCount.value,
    warnings: csvImportReportWarningCount.value,
  })
})

function togglePreviewWindow() {
  if (isPreviewWindowOpen.value) {
    closePreviewWindow()
  } else {
    openPreviewWindow()
  }
}

async function handleUndoShortcut() {
  flushLineItemEditBuffers()
  await nextTick()
  showUndoRedoNotice(undoLastQuotationChange({ skipPendingCheck: true }))
}

async function handleRedoShortcut() {
  flushLineItemEditBuffers()
  await nextTick()
  showUndoRedoNotice(redoLastQuotationChange({ skipPendingCheck: true }))
}

watch(focusedItemId, (id) => {
  if (id) {
    activeSupportPanel.value = 'outline'
  }
})

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

function openCsvImportReport() {
  if (csvImportReportEntries.value.length === 0) {
    return
  }

  showCsvImportReport.value = true
}

function handleAnalysisItemSelection(payload: { itemId: string }) {
  handleEditorItemSelection(payload.itemId)
}

function handleEditorItemSelection(itemId: string) {
  itemFocusRequestKey.value += 1
  focusItemInEditor(itemId)
}

function handleRemoveItem(itemId: string) {
  removeItem(itemId)

  if (focusedItemId.value === itemId) {
    clearFocusedItem()
  }
}

function openItemGoalSeek(itemId: string) {
  flushLineItemEditBuffers()
  goalSeekMode.value = 'items'
  goalSeekInitialItemId.value = itemId
  showGoalSeekDialog.value = true
}

function openBatchGoalSeek() {
  flushLineItemEditBuffers()
  goalSeekMode.value = 'items'
  goalSeekInitialItemId.value = null
  showGoalSeekDialog.value = true
}

function openQuotationGoalSeek() {
  flushLineItemEditBuffers()
  goalSeekMode.value = 'quotation'
  goalSeekInitialItemId.value = null
  showGoalSeekDialog.value = true
}

function applyItemGoalSeek(updates: GoalSeekItemUpdate[]) {
  if (updates.length === 0) {
    return
  }

  updates.forEach((update) => {
    updateItemField(update.itemId, 'markupRate', update.markupRate)
  })
  statusMessage.value = t(
    updates.length === 1
      ? 'quotations.statuses.goalSeekItemApplied'
      : 'quotations.statuses.goalSeekItemsApplied',
    { count: updates.length },
  )
}

function applyQuotationGoalSeek(markupRate: number) {
  quotation.value.totalsConfig.globalMarkupRate = markupRate
  statusMessage.value = t('quotations.statuses.goalSeekGlobalApplied')
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

const quotationAgentApi = useQuotationAgentApi({
  quotation,
  itemSummaries,
  totals,
  currentFilePath,
  statusMessage,
  saveCurrentQuotation,
  importQuotationFile: importJsonFromPath,
  importQuotationContent: importJsonContent,
  importLineItemsCsvFile: importCsvFromPath,
  importLineItemsCsvContent: importCsvContent,
  exportPdfToFile: exportQuotationPdfToFile,
  setTaxMode,
  t: translateMessage,
})

function hasDevAutoImportRun() {
  return Boolean(import.meta.hot?.data?.quotationDevAutoImportRun)
}

function markDevAutoImportRun() {
  if (import.meta.hot?.data) {
    import.meta.hot.data.quotationDevAutoImportRun = true
  }
}

onMounted(() => {
  window.quotationAgent = quotationAgentApi

  if (!hasDevAutoImportRun()) {
    markDevAutoImportRun()
    void autoImportDevQuotation().then(resetQuotationChangeHistory)
  } else {
    loadLatestQuotation()
    resetQuotationChangeHistory()
  }
})

function showUndoRedoNotice(result: QuotationHistoryResult) {
  if (!result.ok) {
    return
  }

  const summary: QuotationHistoryChangeSummary = result.change.summary
    ?? (result.change.isLarge
      ? { kind: 'fallback' }
      : describeQuotationHistoryChange(result.change.before, result.change.after))
  const target = getHistoryChangeTarget(summary)
  const noticeId = undoRedoNoticeKey + 1
  undoRedoNoticeKey = noticeId
  undoRedoNotice.value = {
    id: noticeId,
    action: result.action,
    title: t(result.action === 'undo' ? 'quotations.history.undoTitle' : 'quotations.history.redoTitle'),
    detail: formatHistoryChangeSummary(summary),
  }

  if (target) {
    void revealUndoRedoTarget(target)
  }

  if (undoRedoNoticeTimer) {
    window.clearTimeout(undoRedoNoticeTimer)
  }

  undoRedoNoticeTimer = window.setTimeout(() => {
    if (undoRedoNotice.value?.id === noticeId) {
      undoRedoNotice.value = null
    }
    undoRedoNoticeTimer = null
  }, 1800)
}

async function revealUndoRedoTarget(target: string) {
  historyRevealTarget.value = target
  historyRevealTargetKey.value += 1

  const targetItemId = getQuotationHistoryTargetItemId(target)
  const targetPanel = getQuotationHistoryTargetPanel(target)

  if (targetItemId) {
    handleEditorItemSelection(targetItemId)
  } else if (workspaceMode.value !== 'editor') {
    openEditor()
  }

  if (targetPanel) {
    if (supportPanelsCollapsed.value) {
      toggleWorkbenchSupportPanels()
    }

    activeSupportPanel.value = targetPanel
  }

  await nextTick()
  await nextTick()

  const targetElement = findQuotationHistoryTargetElement(document, target)
  if (!targetElement) {
    return
  }

  targetElement.scrollIntoView?.({
    block: 'center',
    inline: 'nearest',
    behavior: 'smooth',
  })
  highlightUndoRedoTarget(targetElement)
}

function highlightUndoRedoTarget(targetElement: HTMLElement) {
  clearUndoRedoHighlight()

  targetElement.classList.add('quotation-history-target-highlight')
  undoRedoHighlightedElement = targetElement
  undoRedoHighlightTimer = window.setTimeout(clearUndoRedoHighlight, 1600)
}

function clearUndoRedoHighlight() {
  if (undoRedoHighlightTimer) {
    window.clearTimeout(undoRedoHighlightTimer)
    undoRedoHighlightTimer = null
  }

  if (undoRedoHighlightedElement) {
    undoRedoHighlightedElement.classList.remove('quotation-history-target-highlight')
    undoRedoHighlightedElement = null
  }
}

function getHistoryChangeTarget(summary: QuotationHistoryChangeSummary) {
  return 'target' in summary ? summary.target : null
}

function formatHistoryChangeSummary(summary: QuotationHistoryChangeSummary) {
  if (summary.kind === 'fieldChanged') {
    return t('quotations.history.fieldChanged', {
      field: t(summary.fieldLabelKey),
      before: formatHistoryChangeValue(summary.previousValue),
      after: formatHistoryChangeValue(summary.nextValue),
    })
  }

  if (summary.kind === 'itemFieldChanged') {
    return t('quotations.history.itemFieldChanged', {
      item: formatHistoryChangeValue(summary.itemName),
      field: t(summary.fieldLabelKey),
      before: formatHistoryChangeValue(summary.previousValue),
      after: formatHistoryChangeValue(summary.nextValue),
    })
  }

  if (summary.kind === 'itemAdded') {
    return t('quotations.history.itemAdded', {
      item: formatHistoryChangeValue(summary.itemName),
    })
  }

  if (summary.kind === 'itemRemoved') {
    return t('quotations.history.itemRemoved', {
      item: formatHistoryChangeValue(summary.itemName),
    })
  }

  return t('quotations.history.fallback')
}

function formatHistoryChangeValue(value: string) {
  return value.trim() || t('common.emptyValue')
}

onUnmounted(() => {
  if (window.quotationAgent === quotationAgentApi) {
    delete window.quotationAgent
  }
  if (undoRedoNoticeTimer) {
    window.clearTimeout(undoRedoNoticeTimer)
    undoRedoNoticeTimer = null
  }
  clearUndoRedoHighlight()
})

</script>

<template>
  <div class="quotation-editor">
    <QuotationCommandBar
      :header="quotation.header"
      :status-message="statusMessage"
      :current-file-path="currentFilePath"
      :has-native-file-dialogs="hasNativeFileDialogs"
      :supports-direct-pdf-export="runtime.capabilities.supportsDirectPdfExport"
      :workspace-mode="workspaceMode"
      :has-import-report="csvImportReportEntries.length > 0"
      :import-report-issue-count="csvImportReportEntries.length"
      :import-report-has-errors="csvImportReportErrorCount > 0"
      @create-new="startNewQuotation"
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
      @open-import-report="openCsvImportReport"
    />

    <Transition name="quotation-history-notice">
      <QuotationUndoRedoNotice
        v-if="undoRedoNotice"
        :key="undoRedoNotice.id"
        :action="undoRedoNotice.action"
        :title="undoRedoNotice.title"
        :detail="undoRedoNotice.detail"
      />
    </Transition>

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

    <Dialog
      v-model:visible="showCsvImportReport"
      modal
      :header="t('quotations.csv.report.title')"
      :style="{ width: '560px' }"
    >
      <div v-if="csvImportReport" class="csv-import-report">
        <p class="csv-import-report-summary">
          {{ csvImportReportSummary }}
        </p>

        <ul class="csv-import-report-list">
          <li
            v-for="(entry, index) in csvImportReportEntries"
            :key="`${entry.row}-${entry.severity}-${entry.column ?? 'row'}-${index}`"
            class="csv-import-report-entry"
            :class="`csv-import-report-entry--${entry.severity}`"
          >
            <span class="csv-import-report-severity">
              {{ t(`quotations.csv.report.${entry.severity}`) }}
            </span>
            <span class="csv-import-report-row">
              {{ t('quotations.csv.report.row', { row: entry.row }) }}
            </span>
            <span v-if="entry.column" class="csv-import-report-column">
              {{ t('quotations.csv.report.column', { column: entry.column }) }}
            </span>
            <span class="csv-import-report-message">
              {{ entry.message }}
            </span>
          </li>
        </ul>

        <div class="csv-import-report-actions">
          <Button
            severity="secondary"
            :label="t('quotations.csv.report.close')"
            @click="showCsvImportReport = false"
          />
        </div>
      </div>
    </Dialog>

    <GoalSeekDialog
      v-model:visible="showGoalSeekDialog"
      :mode="goalSeekMode"
      :items="quotation.majorItems"
      :currency="quotation.header.currency"
      :exchange-rates="quotation.exchangeRates"
      :global-markup-rate="quotation.totalsConfig.globalMarkupRate"
      :current-subtotal-before-tax="totals.subtotalAfterMarkup"
      :initial-item-id="goalSeekInitialItemId"
      @apply-items="applyItemGoalSeek"
      @apply-quotation="applyQuotationGoalSeek"
    />

    <div
      v-show="workspaceMode === 'editor'"
      class="workbench-layout"
      :class="{ 'workbench-layout--collapsed': supportPanelsCollapsed, 'workbench-layout--resizing': isResizing }"
    >
      <div class="workbench-center">
        <section class="workbench-main" :aria-label="t('quotations.preview.workbenchAria')">
          <LineItemsTable
            :items="quotation.majorItems"
            :quotation-number="quotation.header.quotationNumber"
            :item-summaries="itemSummaries"
            :currency="quotation.header.currency"
            :grand-total="totals.grandTotal"
            :line-item-entry-mode="quotation.lineItemEntryMode ?? 'detailed'"
            :global-markup-rate="quotation.totalsConfig.globalMarkupRate"
            :totals-config="quotation.totalsConfig"
            :exchange-rates="quotation.exchangeRates"
            :cost-currency-options="activeCurrencies"
            :quotation-currency-options="activeCurrencies"
            :focused-item-id="focusedItemId"
            :focused-item-request-key="itemFocusRequestKey"
            @add-root-item="addRootItem"
            @add-section-header="addSectionHeader"
            @add-child-item="addChildItem"
            @remove-item="handleRemoveItem"
            @duplicate-root-item="duplicateRootItem"
            @move-root-item="moveRootItem"
            @update-section-header-title="updateSectionHeaderTitle"
            @update-quotation-currency="quotation.header.currency = $event"
            @update-line-item-entry-mode="handleLineItemEntryModeChange"
            @set-item-pricing-method="setItemPricingMethod"
            @update-item-field="updateItemField"
            @request-item-goal-seek="openItemGoalSeek"
            @request-batch-goal-seek="openBatchGoalSeek"
          />
        </section>

        <footer class="totals-bar" :aria-label="t('quotations.totals.aria')">
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
          <template v-if="totals.taxAmount > 0">
            <span class="totals-bar-sep" aria-hidden="true">+</span>
            <span class="totals-bar-item">
              <span class="totals-bar-label">{{ t('quotations.totals.taxLine') }}</span>
              <strong>{{ formatCurrency(totals.taxAmount, quotation.header.currency, currentLocale) }}</strong>
            </span>
          </template>
          <span class="totals-bar-spacer" />
          <span class="totals-bar-item totals-bar-total">
            <span class="totals-bar-label">{{ t('quotations.totals.total') }}</span>
            <strong>{{ formatCurrency(totals.grandTotal, quotation.header.currency, currentLocale) }}</strong>
          </span>
        </footer>
      </div>

      <div
        v-show="!supportPanelsCollapsed"
        class="resize-handle"
        role="separator"
        aria-orientation="vertical"
        :aria-label="t('quotations.workbench.resizeAria')"
        @mousedown.prevent="onResizeHandleMouseDown"
      />

      <div
        v-show="!supportPanelsCollapsed"
        ref="supportRail"
        class="workbench-rail"
        :style="{ width: railWidth + 'px' }"
      >
        <QuotationSupportPanels
          v-model:active-tab="activeSupportPanel"
        >
          <template #outline>
            <QuotationNavigator
              :items="quotation.majorItems"
              :line-item-entry-mode="quotation.lineItemEntryMode ?? 'detailed'"
              :selected-item-id="focusedItemId"
              @select-item="handleEditorItemSelection"
              @add-child-item="addChildItem"
              @remove-item="handleRemoveItem"
              @duplicate-root-item="duplicateRootItem"
              @move-root-row-to-index="moveRootRowToIndex"
              @move-quotation-tree-row="moveQuotationTreeRow"
            />
          </template>
          <template #quoteInfo>
            <QuoteInfoPanel
              v-model="quotation.header"
              v-model:template-id="quotation.templateId"
              v-model:output-item-detail-level="outputItemDetailLevel"
              :quotation-currency-options="activeCurrencies"
              :history-reveal-target="historyRevealTarget"
              :history-reveal-target-key="historyRevealTargetKey"
            />
          </template>
          <template #customer>
            <QuoteCustomerPanel
              v-model="quotation.header"
              :customer-records="customerRecords"
              :company-profile-records="companyProfileRecords"
              :selected-company-profile-id="quotation.companyProfileId"
              :company-profile-snapshot="quotation.companyProfileSnapshot"
              @select-customer="applyCustomerRecord"
              @select-company-profile="applyCompanyProfile"
            />
          </template>
          <template #pricing>
            <PricingPanel
              v-model="quotation.totalsConfig"
              :totals="totals"
              :currency="quotation.header.currency"
              @request-tax-mode-change="handleTaxModeChange"
              @request-goal-seek="openQuotationGoalSeek"
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

      <div class="rail-toggle-strip">
        <button
          type="button"
          class="rail-toggle-btn"
          :aria-label="supportPanelsCollapsed ? t('quotations.workbench.expandSupportPanels') : t('quotations.workbench.collapseSupportPanels')"
          :aria-expanded="!supportPanelsCollapsed"
          v-tooltip.left="`${supportPanelsCollapsed ? t('quotations.workbench.expandSupportPanels') : t('quotations.workbench.collapseSupportPanels')}  ·  Ctrl + B`"
          @click="toggleWorkbenchSupportPanels"
        >
          <i :class="supportPanelsCollapsed ? 'pi pi-angle-double-left' : 'pi pi-angle-double-right'" aria-hidden="true" />
        </button>
      </div>
    </div>

    <section v-if="workspaceMode === 'analysis'" class="analysis-surface">
      <QuotationAnalysisView
        :analysis="analysis"
        :currency="quotation.header.currency"
        @select-item="handleAnalysisItemSelection"
      />
    </section>

    <FloatingPreviewWindow
      v-if="isPreviewWindowOpen"
      :supports-direct-pdf-export="runtime.capabilities.supportsDirectPdfExport"
      :quotation="quotation"
      :summaries="itemSummaries"
      :totals="totals"
      :global-markup-rate="quotation.totalsConfig.globalMarkupRate"
      :exchange-rates="quotation.exchangeRates"
      :company-profile="quotation.companyProfileSnapshot"
      @close="closePreviewWindow"
      @export-pdf="exportQuotationPdf"
      @update-template-id="quotation.templateId = $event"
    />
  </div>
</template>

<style scoped>
.quotation-editor {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  height: 100vh;
  padding: 10px 12px 0;
  min-width: 960px;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.quotation-history-notice-enter-active,
.quotation-history-notice-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.quotation-history-notice-enter-from,
.quotation-history-notice-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% + 6px)) scale(0.98);
}

.quotation-editor :deep([data-history-target]) {
  scroll-margin: 96px;
}

.quotation-editor :deep(.quotation-history-target-highlight) {
  border-radius: var(--radius-md);
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  box-shadow: 0 0 0 5px var(--accent-ring);
  transition: outline-color 0.16s ease, box-shadow 0.16s ease;
}

.workbench-layout {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0;
  min-height: 0;
  overflow: hidden;
}

/* ─── Centre column ─────────────────────────────────────────────────────── */

.workbench-center {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.workbench-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 12px 14px 0;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 72%) 0, transparent 120px),
    var(--surface-panel);
}

/* ─── Totals bar ────────────────────────────────────────────────────────── */

.totals-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 14px;
  padding: 9px 16px;
  border-top: 1px solid var(--surface-border-strong);
  background:
    linear-gradient(180deg, #ffffff 0, var(--surface-raised) 100%),
    var(--surface-raised);
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
  letter-spacing: 0.05em;
}

.totals-bar-item strong {
  color: var(--text-strong);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.totals-bar-green {
  color: var(--accent) !important;
}

.totals-bar-warn {
  color: var(--warning) !important;
}

.totals-bar-sep {
  color: var(--text-subtle);
  font-weight: 600;
  font-size: 14px;
  align-self: flex-end;
  padding-bottom: 2px;
}

.totals-bar-spacer {
  flex: 1;
  min-width: 8px;
}

.totals-bar-total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 5px 14px;
  border-radius: var(--radius-md);
  background: #ffffff;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--surface-border));
  box-shadow: inset 3px 0 0 var(--accent);
}

.totals-bar-total .totals-bar-label {
  color: var(--accent);
}

.totals-bar-total strong {
  color: var(--accent) !important;
  font-size: 16px !important;
  font-weight: 800;
}

/* ─── Analysis surface ──────────────────────────────────────────────────── */

.analysis-surface {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

/* ─── Resize handle ─────────────────────────────────────────────────────── */

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
  top: 12px;
  bottom: 12px;
  left: 3px;
  width: 2px;
  border-radius: 2px;
  background: var(--surface-border-strong);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.resize-handle:hover::after,
.resize-handle:focus-visible::after,
.workbench-layout--resizing .resize-handle::after {
  opacity: 1;
  background: var(--accent);
}

.workbench-layout--resizing {
  cursor: col-resize;
  user-select: none;
}

.workbench-layout--resizing .workbench-main,
.workbench-layout--resizing .workbench-rail {
  pointer-events: none;
}

/* ─── Workbench rail ────────────────────────────────────────────────────── */

.workbench-rail {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: stretch;
  min-height: 0;
  max-height: 100%;
  margin-left: 6px;
  min-width: 0;
}

/* ─── Persistent panel toggle strip ─────────────────────────────────────── */

.rail-toggle-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  margin-left: 6px;
}

.rail-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 96px;
  padding: 0;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: #ffffff;
  color: var(--text-muted);
  cursor: pointer;
  box-shadow: var(--shadow-control);
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}

.rail-toggle-btn:hover {
  color: var(--accent);
  background: var(--accent-surface);
  border-color: var(--accent-soft);
}

.rail-toggle-btn:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.rail-toggle-btn i {
  font-size: 13px;
}

.workbench-layout--collapsed .resize-handle {
  display: none;
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

.csv-import-report {
  display: grid;
  gap: 14px;
}

.csv-import-report-summary {
  margin: 0;
  color: var(--text-body);
  line-height: 1.5;
}

.csv-import-report-list {
  display: grid;
  gap: 8px;
  max-height: 340px;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.csv-import-report-entry {
  display: grid;
  grid-template-columns: auto auto auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--surface-border);
  border-left-width: 3px;
  border-radius: var(--radius-md);
  background: #ffffff;
  color: var(--text-body);
  font-size: 12px;
}

.csv-import-report-entry--error {
  border-left-color: var(--danger);
}

.csv-import-report-entry--warning {
  border-left-color: var(--warning);
}

.csv-import-report-severity,
.csv-import-report-row,
.csv-import-report-column {
  color: var(--text-muted);
  font-weight: 700;
  white-space: nowrap;
}

.csv-import-report-message {
  min-width: 0;
  overflow-wrap: anywhere;
}

.csv-import-report-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
