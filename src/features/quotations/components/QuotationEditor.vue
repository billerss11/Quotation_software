<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, shallowRef, toRef, useTemplateRef, watch } from 'vue'

import { useI18n } from 'vue-i18n'

import ExchangeRatePanel from './ExchangeRatePanel.vue'
import LineItemsImportDialog from './LineItemsImportDialog.vue'
import GoalSeekDialog from './GoalSeekDialog.vue'
import LineItemsTable from './LineItemsTable.vue'
import PricingPanel from './PricingPanel.vue'
import QuoteCustomerPanel from './QuoteCustomerPanel.vue'
import QuoteInfoPanel from './QuoteInfoPanel.vue'
import QuotationSummarySettings from './QuotationSummarySettings.vue'
import QuotationCommandBar from './QuotationCommandBar.vue'
import QuotationRevisionsDialog from './QuotationRevisionsDialog.vue'
import QuotationWorkflowNav, { type QuotationWorkflowStep } from './QuotationWorkflowNav.vue'
import QuotationDocumentSettings from './QuotationDocumentSettings.vue'
import QuotationReviewWorkspace from './QuotationReviewWorkspace.vue'
import QuotationNavigator from './QuotationNavigator.vue'
import QuotationUndoRedoNotice from './QuotationUndoRedoNotice.vue'
import { useGoodsReceiptExport } from '@/features/goods-receipts/composables/useGoodsReceiptExport'
import { useQuotationAutomationApis } from '../composables/useQuotationAutomationApis'
import { useQuotationEditor } from '../composables/useQuotationEditor'
import { useQuotationFileActions } from '../composables/useQuotationFileActions'
import { useQuotationWorkbench } from '../composables/useQuotationWorkbench'
import { useQuotationWorkspace } from '../composables/useQuotationWorkspace'
import type { QuotationHistoryAction, QuotationHistoryResult } from '../composables/useQuotationUndoHistory'
import { sortCurrencyCodes } from '../utils/currencyCodes'
import { getReferenceCurrencyCodes } from '../utils/exchangeRates'
import { flushLineItemEditBuffers } from '../utils/lineItemEditBuffers'
import type { SupportedLocale } from '@/shared/i18n/locale'
import { getQuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { formatCurrency } from '@/shared/utils/formatters'
import type { QuotationInformationalTotal, QuotationOutputItemDetailLevel, TaxClass, TaxMode } from '../types'
import { createQuotationAnalysisDataset } from '../utils/quotationAnalysis'
import {
  formatQuotationHistoryChangeSummary,
  type QuotationHistoryChangeSummary,
} from '../utils/quotationHistoryChangeSummary'
import {
  findQuotationHistoryTargetElement,
  getQuotationHistoryTargetItemId,
  getQuotationHistoryTargetPanel,
} from '../utils/quotationHistoryTargets'
import { normalizeQuotationOutputSettings } from '../utils/quotationOutputSettings'
import { getQuotationSections, getQuotationSummaryItems } from '../utils/quotationSummaryDisplay'
import { createQuotationSnapshotPayload } from '../utils/quotationSnapshotPayload'
import { createGoodsReceiptLineDrafts } from '@/features/goods-receipts/utils/goodsReceipt'
import { registerQuotationAgentApis } from '../services/quotationAutomationRegistration'
import {
  getQuotationActivityContext,
  useActivityHistory,
} from '@/features/activity-history/composables/useActivityHistory'


const QuotationAnalysisView = defineAsyncComponent(() => import('./QuotationAnalysisView.vue'))
const FloatingPreviewWindow = defineAsyncComponent(() => import('./FloatingPreviewWindow.vue'))
const QuotationSavedRevisionView = defineAsyncComponent(() => import('./QuotationSavedRevisionView.vue'))
const GoodsReceiptDialog = defineAsyncComponent(() => import('@/features/goods-receipts/components/GoodsReceiptDialog.vue'))

const props = defineProps<{
  uiLocale: SupportedLocale
}>()
const emit = defineEmits<{
  manageCustomers: []
  manageCompanyProfiles: []
}>()
const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
const toast = useToast()
const runtime = getQuotationRuntime()
const activityHistory = useActivityHistory({ runtime })
const quotationEditor = useQuotationEditor(toRef(props, 'uiLocale'), {
  onHistoryCommitted: activityHistory.recordQuotationHistory,
})
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
  quotationRevisions,
  revisionHistoryUnavailable,
  isQuotationRevisionBusy,
  replaceQuotationDocument,
  savedDrafts,
  itemSummaries,
  totals,
  customerRecords,
  companyProfileRecords,
  storageRecoveryReport,
  libraryStorageWarning,
  manualQuotationNumberRequired,
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
  updateCompanyProfileField,
  updateExchangeRate,
  updateExchangeRates,
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
  updateHeaderField,
  setTemplateId,
  setOutputItemDetailLevel,
  setOutputSettings,
  setQuotationCurrency,
  setItemPricingMethod,
  setLogoDataUrl,
  setTaxMode,
  updateTotalsField,
  updateTaxClassField,
  addTaxClass,
  removeTaxClass,
  addExtraCharge,
  removeExtraCharge,
  updateExtraChargeField,
  applyItemGoalSeek: applyItemGoalSeekChanges,
  applyQuotationGoalSeek: applyQuotationGoalSeekChange,
} = quotationEditor

const showSingleTaxModeDialog = shallowRef(false)
const showLineItemsImportDialog = shallowRef(false)
const showGoalSeekDialog = shallowRef(false)
const showGoodsReceiptDialog = shallowRef(false)
const showRevisionsDialog = shallowRef(false)
const previewRevisionId = shallowRef<string | null>(null)
const selectedRevision = computed(() => quotationRevisions.value.find(entry => entry.id === previewRevisionId.value) ?? null)
const revisionPreview = computed(() => selectedRevision.value ? createQuotationSnapshotPayload(selectedRevision.value.quotation) : null)
const goalSeekMode = shallowRef<GoalSeekMode>('items')
const goalSeekInitialItemId = shallowRef<string | null>(null)
const pendingSingleTaxClassId = shallowRef('')
const workflowStep = shallowRef<QuotationWorkflowStep>('details')
const referenceCurrencyCodes = getReferenceCurrencyCodes()
const supportedCurrencyOptions = computed(() => sortCurrencyCodes(
  [...referenceCurrencyCodes, ...Object.keys(quotation.value.exchangeRates)],
  quotation.value.header.currency,
))
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
  set: setOutputItemDetailLevel,
})
const summarySections = computed(() => getQuotationSections(quotation.value.majorItems, itemSummaries.value))
const summaryItems = computed(() => getQuotationSummaryItems(quotation.value, itemSummaries.value))

function updateInformationalTotal(id: string, patch: Partial<QuotationInformationalTotal>) {
  setOutputSettings({
    informationalTotals: (quotation.value.outputSettings?.informationalTotals ?? [])
      .map(row => row.id === id ? { ...row, ...patch, id } : row),
  })
}

function removeInformationalTotal(id: string) {
  setOutputSettings({
    informationalTotals: (quotation.value.outputSettings?.informationalTotals ?? []).filter(row => row.id !== id),
  })
}
const quotationTemplateId = computed({
  get: () => quotation.value.templateId,
  set: setTemplateId,
})
const hasGoodsReceiptItems = computed(() => createGoodsReceiptLineDrafts(quotation.value.majorItems).length > 0)
const itemFocusRequestKey = shallowRef(0)
const undoRedoNotice = shallowRef<UndoRedoNotice | null>(null)
const historyRevealTarget = shallowRef<string | null>(null)
const historyRevealTargetKey = shallowRef(0)
const workbenchMainRef = useTemplateRef<HTMLElement>('workbenchMain')
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

const quotationFileActions = useQuotationFileActions({
  quotation,
  quotationRevisions,
  revisionHistoryUnavailable,
  isQuotationRevisionBusy,
  replaceQuotationDocument,
  itemSummaries,
  totals,
  runtime,
  flushPendingEdits: flushLineItemEditBuffers,
  saveCurrentQuotation,
  replaceQuotationDraft,
  replaceLineItems,
  setLogoDataUrl,
  t: translateMessage,
  recordActivity: (messageKey, params) => activityHistory.recordMessage(
    'quotation',
    getQuotationActivityContext(quotation.value),
    messageKey,
    params,
  ),
})
const {
  statusMessage,
  currentFilePath,
  lineItemsImportReport,
  pendingLineItemsImport,
  hasNativeFileDialogs,
  saveDraft,
  saveDraftAs,
  exportJson,
  importJson,
  autoImportDevQuotation,
  importCsv,
  importXlsx,
  confirmLineItemsImport,
  cancelLineItemsImport,
  exportCsvTemplate,
  exportExcelTemplate,
  exportCsv,
  exportQuotationPdf,
  handleLogoSelected,
} = quotationFileActions

const goodsReceiptExport = useGoodsReceiptExport({
  quotation,
  isQuotationRevisionBusy,
  runtime,
  statusMessage,
  saveCurrentQuotation,
  t: translateMessage,
  recordActivity: (messageKey, params) => activityHistory.recordMessage(
    'goods-receipt',
    getQuotationActivityContext(quotation.value),
    messageKey,
    params,
  ),
})
const { exportGoodsReceiptPdf } = goodsReceiptExport

const {
  supportPanelsCollapsed,
  isPreviewWindowOpen,
  toggleSupportPanels: toggleWorkbenchSupportPanels,
  openPreviewWindow,
  closePreviewWindow,
} = useQuotationWorkbench({
  workspaceMode,
  focusedItemId,
  clearFocusedItem,
  onSaveShortcut: () => { if (!selectedRevision.value) return saveDraft() },
  onUndoShortcut: handleUndoShortcut,
  onRedoShortcut: handleRedoShortcut,
  onTogglePreview: togglePreviewWindow,
})

const lineItemsImportReportEntries = computed(() => lineItemsImportReport.value?.entries ?? [])
const lineItemsImportReportErrorCount = computed(() =>
  lineItemsImportReportEntries.value.filter((entry) => entry.severity === 'error').length,
)
function togglePreviewWindow() {
  if (isQuotationRevisionBusy.value) return
  if (isPreviewWindowOpen.value) {
    closePreviewWindow()
  } else {
    openPreviewWindow()
  }
}

async function handleUndoShortcut() {
  if (isQuotationRevisionBusy.value || selectedRevision.value) return
  flushLineItemEditBuffers()
  await nextTick()
  showUndoRedoNotice(undoLastQuotationChange({ skipPendingCheck: true }))
}

async function handleRedoShortcut() {
  if (isQuotationRevisionBusy.value || selectedRevision.value) return
  flushLineItemEditBuffers()
  await nextTick()
  showUndoRedoNotice(redoLastQuotationChange({ skipPendingCheck: true }))
}

function navigateWorkflow(step: QuotationWorkflowStep) {
  if (isQuotationRevisionBusy.value) return
  flushLineItemEditBuffers()
  workflowStep.value = step
  if (step === 'analysis') openAnalysis()
  else openEditor()
}

watch(workspaceMode, mode => {
  if (mode === 'analysis') workflowStep.value = 'analysis'
  else if (workflowStep.value === 'analysis') workflowStep.value = 'items'
})
watch(quotation, () => {
  workflowStep.value = quotation.value.header.projectName.trim() || quotation.value.header.customerCompany.trim() ? 'items' : 'details'
  openEditor()
})

function loadDraft() {
  if (isQuotationRevisionBusy.value) return
  loadLatestQuotation()
  currentFilePath.value = ''
  statusMessage.value = revisionHistoryUnavailable.value
    ? t('quotations.revisions.historyUnavailable')
    : savedDrafts.value.length > 0 ? t('quotations.statuses.latestLoaded') : t('quotations.statuses.noDrafts')
}

function startNewQuotation() {
  if (isQuotationRevisionBusy.value) return
  createNewQuotation()
  currentFilePath.value = ''
  navigateWorkflow('details')
  statusMessage.value = t('quotations.statuses.newReady')
}

async function createRevision(note: string) {
  try {
    await quotationFileActions.createQuotationRevision({ note }, true)
  } catch (error) {
    quotationFileActions.showRevisionError(error)
  }
}

async function restoreRevision(id: string) {
  try {
    await quotationFileActions.restoreQuotationRevision(id, {}, true)
  } catch (error) {
    quotationFileActions.showRevisionError(error)
  }
}

function previewRevision(id: string) {
  if (isQuotationRevisionBusy.value) return
  try {
    flushLineItemEditBuffers()
    quotationFileActions.getQuotationRevision(id)
    previewRevisionId.value = id
    showRevisionsDialog.value = false
    closePreviewWindow()
  } catch (error) {
    quotationFileActions.showRevisionError(error)
  }
}

function returnToWorkingRevision() {
  closePreviewWindow()
  previewRevisionId.value = null
}

function selectRevision(id: string | null) {
  if (id === null) returnToWorkingRevision()
  else previewRevision(id)
}

async function deleteRevision(id: string) {
  try {
    await quotationFileActions.deleteQuotationRevision(id, {}, true)
  } catch (error) {
    quotationFileActions.showRevisionError(error)
  }
}

function exportPreviewPdf() {
  return previewRevisionId.value
    ? quotationFileActions.exportRevisionPdf(previewRevisionId.value)
    : exportQuotationPdf()
}

watch(quotationRevisions, () => {
  if (previewRevisionId.value && !selectedRevision.value) returnToWorkingRevision()
})
watch(quotation, returnToWorkingRevision)

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

function openLineItemsImportReport() {
  if (selectedRevision.value || isQuotationRevisionBusy.value || !lineItemsImportReport.value) {
    return
  }

  showLineItemsImportDialog.value = true
}

function openLineItemsImportDialog() {
  if (selectedRevision.value || isQuotationRevisionBusy.value) return
  showLineItemsImportDialog.value = true
}

function confirmSelectedLineItemsImport() {
  if (selectedRevision.value || isQuotationRevisionBusy.value) return
  if (confirmLineItemsImport()) {
    showLineItemsImportDialog.value = false
  }
}

function openGoodsReceiptDialog() {
  flushLineItemEditBuffers()

  if (!hasGoodsReceiptItems.value) {
    statusMessage.value = t('goodsReceipts.errors.noDetailItems')
    return
  }

  showGoodsReceiptDialog.value = true
}

function handleAnalysisItemSelection(payload: { itemId: string }) {
  handleEditorItemSelection(payload.itemId)
}

function handleEditorItemSelection(itemId: string) {
  navigateWorkflow('items')
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

  applyItemGoalSeekChanges(updates)
  statusMessage.value = t(
    updates.length === 1
      ? 'quotations.statuses.goalSeekItemApplied'
      : 'quotations.statuses.goalSeekItemsApplied',
    { count: updates.length },
  )
}

function applyQuotationGoalSeek(markupRate: number) {
  applyQuotationGoalSeekChange(markupRate)
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
        : result === 'unavailable'
          ? 'quotations.exchangeRates.rateUnavailable'
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

const {
  legacyApi: quotationAgentApi,
  apiV2: quotationAgentApiV2,
} = useQuotationAutomationApis({
  editor: quotationEditor,
  fileActions: quotationFileActions,
  goodsReceiptExport,
  runtime,
  t: translateMessage,
})
let unregisterQuotationAgentApis: (() => void) | null = null

function hasDevAutoImportRun() {
  return Boolean(import.meta.hot?.data?.quotationDevAutoImportRun)
}

function markDevAutoImportRun() {
  if (import.meta.hot?.data) {
    import.meta.hot.data.quotationDevAutoImportRun = true
  }
}

onMounted(() => {
  unregisterQuotationAgentApis = registerQuotationAgentApis(quotationAgentApi, quotationAgentApiV2)

  if (storageRecoveryReport.recoveredDraftCount > 0 || storageRecoveryReport.discardedDraftCount > 0) {
    toast.add({
      severity: storageRecoveryReport.discardedDraftCount > 0 ? 'warn' : 'info',
      summary: t('quotations.statuses.draftRecoverySummary'),
      detail: t('quotations.statuses.draftRecoveryDetail', {
        recovered: storageRecoveryReport.recoveredDraftCount,
        discarded: storageRecoveryReport.discardedDraftCount,
      }),
      life: 8000,
    })
  }

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
    const isDocumentSetting = target === 'quotation:templateId' || target === 'header:documentLocale' || target === 'quotation:summaryDisplay' || target === 'quotation:outputSettings'
    navigateWorkflow(isDocumentSetting ? 'review' : targetPanel === 'pricing' || targetPanel === 'rates' ? 'pricing' : 'details')
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
  return formatQuotationHistoryChangeSummary(summary, (key, params) => t(key, params ?? {}))
}

onUnmounted(() => {
  unregisterQuotationAgentApis?.()
  unregisterQuotationAgentApis = null
  if (undoRedoNoticeTimer) {
    window.clearTimeout(undoRedoNoticeTimer)
    undoRedoNoticeTimer = null
  }
  clearUndoRedoHighlight()
})

</script>

<template>
  <div class="quotation-editor" :inert="isQuotationRevisionBusy || undefined" :aria-busy="isQuotationRevisionBusy">
    <div class="quotation-command-area">
      <QuotationCommandBar
        :header="revisionPreview?.quotation.header ?? quotation.header"
        :revisions="quotationRevisions"
        :working-revision-number="quotation.header.revisionNumber ?? 1"
        :selected-revision-id="previewRevisionId"
        :revision-history-unavailable="revisionHistoryUnavailable"
        @select-revision="selectRevision"
        @open-revisions="showRevisionsDialog = true"
        :status-message="statusMessage"
        :current-file-path="currentFilePath"
        :has-native-file-dialogs="hasNativeFileDialogs"
        :supports-direct-pdf-export="runtime.capabilities.supportsDirectPdfExport"
        :workspace-mode="workspaceMode"
        :has-import-report="Boolean(lineItemsImportReport)"
        :import-report-issue-count="lineItemsImportReportEntries.length"
        :import-report-has-errors="lineItemsImportReportErrorCount > 0"
        :has-goods-receipt-items="hasGoodsReceiptItems"
        @create-new="startNewQuotation"
        @save="saveDraft"
        @save-as="saveDraftAs"
        @import-line-items="openLineItemsImportDialog"
        @export-csv="exportCsv"
        @export-csv-template="exportCsvTemplate"
        @import-json="importJson"
        @export-json="exportJson"
        @load-latest="loadDraft"
        @open-preview="togglePreviewWindow"
        @export-pdf="exportPreviewPdf"
        @generate-goods-receipt="openGoodsReceiptDialog"
        @logo-selected="handleLogoSelected"
        @open-editor="openEditor"
        @open-analysis="openAnalysis"
        @open-import-report="openLineItemsImportReport"
        />

      <Message v-if="libraryStorageWarning" severity="warn" :closable="false" class="quotation-storage-notice" data-testid="quotation-storage-warning">
        {{ t('quotations.statuses.libraryStorageWarning') }}
      </Message>
      <Message v-if="manualQuotationNumberRequired && !selectedRevision" severity="warn" :closable="false" class="quotation-storage-notice" data-testid="quotation-number-warning">
        {{ t('quotations.statuses.quotationNumberRequired') }}
      </Message>
    </div>

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

    <QuotationRevisionsDialog
      v-model:visible="showRevisionsDialog"
      :revisions="quotationRevisions"
      :current-revision-number="quotation.header.revisionNumber ?? 1"
      :can-mutate="runtime.capabilities.isDesktop"
      :can-export-pdf="runtime.capabilities.supportsDirectPdfExport"
      :busy="isQuotationRevisionBusy"
      :history-unavailable="revisionHistoryUnavailable"
      :status-message="statusMessage"
      @create="createRevision"
      @restore="restoreRevision"
      @delete="deleteRevision"
      @preview="previewRevision"
      @export-pdf="quotationFileActions.exportRevisionPdf"
      />

    <LineItemsImportDialog
      v-model:visible="showLineItemsImportDialog"
      :report="lineItemsImportReport"
      :has-pending-import="Boolean(pendingLineItemsImport)"
      @choose-csv-file="importCsv"
      @choose-xlsx-file="importXlsx"
      @download-template="exportCsvTemplate"
      @download-excel-template="exportExcelTemplate"
      @confirm="confirmSelectedLineItemsImport"
      @cancel="cancelLineItemsImport"
      />

    <GoalSeekDialog
      v-model:visible="showGoalSeekDialog"
      :mode="goalSeekMode"
      :items="quotation.majorItems"
      :currency="quotation.header.currency"
      :exchange-rates="quotation.exchangeRates"
      :global-markup-rate="quotation.totalsConfig.globalMarkupRate"
      :totals="totals"
      :totals-config="quotation.totalsConfig"
      :initial-item-id="goalSeekInitialItemId"
      @apply-items="applyItemGoalSeek"
      @apply-quotation="applyQuotationGoalSeek"
      />

    <GoodsReceiptDialog
      v-model:visible="showGoodsReceiptDialog"
      :busy="isQuotationRevisionBusy"
      :quotation="quotation"
      :supports-direct-pdf-export="runtime.capabilities.supportsDirectPdfExport"
      @export-pdf="exportGoodsReceiptPdf"
      />

    <div v-show="!selectedRevision" class="workflow-navigation">
      <QuotationWorkflowNav :model-value="workflowStep" @update:model-value="navigateWorkflow" />
    </div>

    <div v-show="!selectedRevision && workspaceMode === 'editor'" class="workbench-layout">
      <section v-show="workflowStep === 'details'" id="workflow-panel-details" class="workflow-page" role="tabpanel" aria-labelledby="workflow-tab-details">
          <header class="page-heading"><div><h1>{{ t('workspace.detailsTitle') }}</h1><p>{{ t('workspace.detailsDescription') }}</p></div><Button :label="t('workspace.nextItems')" icon="pi pi-arrow-right" icon-pos="right" @click="navigateWorkflow('items')" /></header>
        <div class="details-layout">
          <QuoteInfoPanel
            :header="quotation.header"
            :quotation-currency-options="supportedCurrencyOptions"
            :history-reveal-target="historyRevealTarget"
            :history-reveal-target-key="historyRevealTargetKey"
            @update-header-field="updateHeaderField"
            />
          <QuoteCustomerPanel
            :header="quotation.header"
            :customer-records="customerRecords"
            :company-profile-records="companyProfileRecords"
            :selected-company-profile-id="quotation.companyProfileId"
            :company-profile-snapshot="quotation.companyProfileSnapshot"
            @select-customer="applyCustomerRecord"
            @select-company-profile="applyCompanyProfile"
            @update-company-profile-field="updateCompanyProfileField"
            @update-header-field="updateHeaderField"
            @manage-customers="emit('manageCustomers')"
            @manage-company-profiles="emit('manageCompanyProfiles')"
            />
        </div>
      </section>

      <div v-show="workflowStep === 'items'" id="workflow-panel-items" class="items-workspace" role="tabpanel" aria-labelledby="workflow-tab-items">
        <div class="items-workspace-body">
            <aside v-show="!supportPanelsCollapsed" id="quotation-outline" class="items-outline"><p>{{ t('workspace.outlineHint') }}</p><QuotationNavigator
              :items="quotation.majorItems"
              :selected-item-id="focusedItemId"
              @select-item="handleEditorItemSelection"
              @add-child-item="addChildItem"
              @remove-item="handleRemoveItem"
              @duplicate-root-item="duplicateRootItem"
              @move-root-row-to-index="moveRootRowToIndex"
              @move-quotation-tree-row="moveQuotationTreeRow"
              /></aside>
          <section ref="workbenchMain" class="workbench-main" :aria-label="t('quotations.preview.workbenchAria')">
            <LineItemsTable
              :items="quotation.majorItems"
              :quotation-number="quotation.header.quotationNumber"
              :item-summaries="itemSummaries"
              :currency="quotation.header.currency"
              :grand-total="totals.grandTotal"
              :global-markup-rate="quotation.totalsConfig.globalMarkupRate"
              :totals-config="quotation.totalsConfig"
              :exchange-rates="quotation.exchangeRates"
              :cost-currency-options="supportedCurrencyOptions"
              :quotation-currency-options="supportedCurrencyOptions"
              :focused-item-id="focusedItemId"
              :focused-item-request-key="itemFocusRequestKey"
              :scroll-container="workbenchMainRef"
              @add-root-item="addRootItem"
              @import-line-items="openLineItemsImportDialog"
              @add-section-header="addSectionHeader"
              @add-child-item="addChildItem"
              @remove-item="handleRemoveItem"
              @duplicate-root-item="duplicateRootItem"
              @move-root-item="moveRootItem"
              @update-section-header-title="updateSectionHeaderTitle"
              @update-quotation-currency="setQuotationCurrency"
              @set-item-pricing-method="setItemPricingMethod"
              @update-item-field="updateItemField"
              @request-item-goal-seek="openItemGoalSeek"
              @request-batch-goal-seek="openBatchGoalSeek"
              >
              <template #view-actions>
                <Button :label="t('workspace.outline')" icon="pi pi-list" severity="secondary" text :aria-expanded="!supportPanelsCollapsed" aria-controls="quotation-outline" :aria-label="t('workspace.toggleOutline')" @click="toggleWorkbenchSupportPanels" />
              </template>
            </LineItemsTable>
          </section>
        </div>
      </div>

      <section v-show="workflowStep === 'pricing'" id="workflow-panel-pricing" class="workflow-page" role="tabpanel" aria-labelledby="workflow-tab-pricing">
          <header class="page-heading"><div><h1>{{ t('workspace.pricingTitle') }}</h1><p>{{ t('workspace.pricingDescription') }}</p></div><Button :label="t('workspace.nextReview')" icon="pi pi-arrow-right" icon-pos="right" @click="navigateWorkflow('review')" /></header>
        <div class="pricing-layout">
            <section class="workspace-card"><h2>{{ t('workspace.pricingSettings') }}</h2><PricingPanel
              :totals-config="quotation.totalsConfig"
              :totals="totals"
              :currency="quotation.header.currency"
              @request-tax-mode-change="handleTaxModeChange"
              @request-goal-seek="openQuotationGoalSeek"
              @update-totals-field="updateTotalsField"
              @update-tax-class-field="updateTaxClassField"
              @add-tax-class="addTaxClass"
              @remove-tax-class="removeTaxClass"
              @add-extra-charge="addExtraCharge"
              @remove-extra-charge="removeExtraCharge"
              @update-extra-charge-field="updateExtraChargeField"
              /></section>
            <section class="workspace-card"><h2>{{ t('workspace.exchangeRates') }}</h2><ExchangeRatePanel
              :exchange-rates="quotation.exchangeRates"
              :quotation-currency="quotation.header.currency"
              @update-rate="updateExchangeRate"
              @update-rates="updateExchangeRates"
              @add-currency="handleAddCurrency"
              @remove-currency="handleRemoveCurrency"
              /></section>
        </div>
      </section>

      <section v-if="workflowStep === 'review'" id="workflow-panel-review" class="review-page" role="tabpanel" aria-labelledby="workflow-tab-review">
        <QuotationReviewWorkspace :quotation="quotation" :summaries="itemSummaries" :totals="totals" :global-markup-rate="quotation.totalsConfig.globalMarkupRate" :exchange-rates="quotation.exchangeRates" :company-profile="quotation.companyProfileSnapshot" :supports-direct-pdf-export="runtime.capabilities.supportsDirectPdfExport" @export-pdf="exportQuotationPdf" @open-preview="openPreviewWindow">
          <QuotationDocumentSettings v-model:template-id="quotationTemplateId" v-model:output-item-detail-level="outputItemDetailLevel" :document-locale="quotation.header.documentLocale" @update:document-locale="updateHeaderField('documentLocale', $event)">
            <QuotationSummarySettings
              :settings="quotation.outputSettings"
              :sections="summarySections"
              :items="summaryItems"
              :currency="quotation.header.currency"
              :document-locale="quotation.header.documentLocale"
              @update-settings="setOutputSettings"
              @update-row="updateInformationalTotal"
              @add-row="setOutputSettings({ informationalTotals: [...(quotation.outputSettings?.informationalTotals ?? []), $event] })"
              @remove-row="removeInformationalTotal"
              />
          </QuotationDocumentSettings>
        </QuotationReviewWorkspace>
      </section>
      <footer class="totals-bar" :aria-label="t('quotations.totals.aria')">
        <span class="totals-bar-item">
          <span class="totals-bar-label">{{ t('quotations.totals.totalCost') }}</span>
          <strong>{{ formatCurrency(totals.baseSubtotal, quotation.header.currency, currentLocale) }}</strong>
        </span>
        <span class="totals-bar-sep" aria-hidden="true">+</span>
        <span class="totals-bar-item">
          <span class="totals-bar-label">{{ t('quotations.totals.markup') }}</span>
          <strong class="totals-bar-green">{{ formatCurrency(totals.markupAmount, quotation.header.currency, currentLocale) }}</strong>
        </span>
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

    <QuotationSavedRevisionView
      v-if="selectedRevision"
      :revision="selectedRevision"
      :working-revision-number="quotation.header.revisionNumber ?? 1"
      :can-restore="runtime.capabilities.isDesktop && !revisionHistoryUnavailable"
      :busy="isQuotationRevisionBusy"
      @back="returnToWorkingRevision"
      @restore="restoreRevision"
      />

    <section v-if="!selectedRevision && workspaceMode === 'analysis'" id="workflow-panel-analysis" class="analysis-surface" role="tabpanel" aria-labelledby="workflow-tab-analysis">
      <QuotationAnalysisView
        :analysis="analysis"
        :currency="quotation.header.currency"
        @select-item="handleAnalysisItemSelection"
        />
    </section>

    <FloatingPreviewWindow
      v-if="isPreviewWindowOpen"
      :read-only="Boolean(revisionPreview)"
      :supports-direct-pdf-export="runtime.capabilities.supportsDirectPdfExport"
      :quotation="revisionPreview?.quotation ?? quotation"
      :summaries="revisionPreview?.summaries ?? itemSummaries"
      :totals="revisionPreview?.totals ?? totals"
      :global-markup-rate="revisionPreview?.globalMarkupRate ?? quotation.totalsConfig.globalMarkupRate"
      :exchange-rates="revisionPreview?.exchangeRates ?? quotation.exchangeRates"
      :company-profile="revisionPreview?.companyProfile ?? quotation.companyProfileSnapshot"
      @close="closePreviewWindow"
      @export-pdf="exportPreviewPdf"
      @update-template-id="setTemplateId"
      />
  </div>
</template>

<style scoped>
.quotation-storage-notice {
  margin-top: 8px;
}

.quotation-editor { display: flex; flex-direction: column; height: 100%; min-width: 0; min-height: 0; overflow: hidden; background: var(--app-bg-elevated); }
.quotation-command-area, .workflow-navigation { flex-shrink: 0; }
.quotation-command-area { background: var(--surface-card); }

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

.workbench-layout { display: flex; flex: 1; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden; }
.workflow-page { flex: 1; min-height: 0; overflow: auto; padding: 28px 32px; }
.page-heading { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin: 0 auto 24px; max-width: 1280px; }
.page-heading h1 { margin: 0 0 7px; font-size: 24px; font-weight: 650; letter-spacing: -0.5px; color: var(--text-strong); }
.page-heading p { margin: 0; font-size: 13px; line-height: 1.6; color: var(--text-muted); }
.page-heading :deep(.p-button) { flex-shrink: 0; }
.details-layout, .pricing-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; gap: 24px; max-width: 1280px; margin: 0 auto; }
.workspace-card { display: grid; gap: 22px; min-width: 0; padding: 24px; background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); }
.workspace-card > h2 { margin: 0; font-size: 16px; font-weight: 650; color: var(--text-strong); }
.items-workspace { display: flex; flex: 1; flex-direction: column; min-width: 0; min-height: 0; }
.items-workspace-body { display: flex; flex: 1; min-height: 0; min-width: 0; }
.items-outline { width: 228px; flex-shrink: 0; overflow: auto; background: var(--surface-card); border-right: 1px solid var(--surface-border); padding: 16px 12px; }
.items-outline > p { margin: 0 4px 16px; font-size: 12px; color: var(--text-muted); line-height: 1.5; }
.workbench-main { flex: 1; min-width: 0; min-height: 0; overflow: auto; padding: 20px 24px; }
.review-page { flex: 1; min-width: 0; min-height: 0; }
.totals-bar { display: flex; flex-shrink: 0; align-items: center; gap: 22px; padding: 12px 28px; border-top: 1px solid var(--surface-border); background: var(--surface-card); }
.totals-bar-item { display: flex; flex-direction: column; gap: 4px; white-space: nowrap; }
.totals-bar-label { color: var(--text-muted); font-size: 11px; font-weight: 500; }
.totals-bar-item strong { color: var(--text-strong); font-size: 15px; font-weight: 650; font-variant-numeric: tabular-nums; }
.totals-bar-green { color: var(--accent) !important; }
.totals-bar-sep { color: var(--text-subtle); font-size: 14px; }
.totals-bar-spacer { flex: 1; }
.totals-bar-total { text-align: right; padding-left: 24px; border-left: 1px solid var(--surface-border); }
.totals-bar-total strong { font-size: 22px; color: var(--accent); }
.analysis-surface { flex: 1; min-width: 0; min-height: 0; overflow: auto; padding: 24px; }
@media (max-width: 1100px) { .workflow-page { padding: 22px; } .details-layout, .pricing-layout { gap: 18px; } .items-outline { width: 190px; } .workbench-main { padding: 16px; } }
@media (max-width: 800px) { .details-layout, .pricing-layout { grid-template-columns: 1fr; } .page-heading { flex-wrap: wrap; gap: 16px; } .page-heading h1 { font-size: 21px; } .items-workspace-body { flex-direction: column; } .items-outline { width: 100%; max-height: 200px; border-right: 0; border-bottom: 1px solid var(--surface-border); } .totals-bar { gap: 12px; padding: 10px 16px; } .totals-bar-total strong { font-size: 18px; } }
@media (max-width: 520px) { .workflow-page { padding: 16px; } .totals-bar-sep { display: none; } .totals-bar-item strong { font-size: 13px; } .totals-bar-label { font-size: 10px; } .totals-bar-total { padding-left: 12px; } .totals-bar-total strong { font-size: 16px; } }

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
