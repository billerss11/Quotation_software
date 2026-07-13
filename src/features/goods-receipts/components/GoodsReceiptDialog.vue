<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import { computed, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationDraft } from '@/features/quotations/types'

import GoodsReceiptDetailsForm from './GoodsReceiptDetailsForm.vue'
import GoodsReceiptItemsEditor from './GoodsReceiptItemsEditor.vue'
import GoodsReceiptPreview from './GoodsReceiptPreview.vue'
import type { GoodsReceiptDraft, GoodsReceiptTemplateId } from '../utils/goodsReceipt'
import {
  createGoodsReceiptDraft,
  createGoodsReceiptNumber,
  normalizeGoodsReceiptTemplateId,
  validateGoodsReceiptDraft,
} from '../utils/goodsReceipt'

const GOODS_RECEIPT_TEMPLATE_STORAGE_KEY = 'quotation-software:goods-receipt-template'
const DEFAULT_EDITOR_PANE_WIDTH = 560
const MIN_EDITOR_PANE_WIDTH = 380
const MAX_EDITOR_PANE_WIDTH = 900
const MIN_PREVIEW_PANE_WIDTH = 460
const EDITOR_PANE_RESIZE_STEP = 24
const PANE_RESIZE_HANDLE_WIDTH = 10

const visible = defineModel<boolean>('visible', { default: false })
const props = defineProps<{
  quotation: QuotationDraft
  supportsDirectPdfExport: boolean
}>()
const emit = defineEmits<{
  exportPdf: [draft: GoodsReceiptDraft]
}>()
const { t } = useI18n()
const draft = ref<GoodsReceiptDraft | null>(null)
const grNumberUserEdited = shallowRef(false)
const dialogLayoutRef = useTemplateRef<HTMLElement>('dialogLayout')
const editorPaneWidth = shallowRef(DEFAULT_EDITOR_PANE_WIDTH)
const isResizingEditorPane = shallowRef(false)

const templateOptions = computed<{ label: string; value: GoodsReceiptTemplateId }[]>(() => [
  { label: t('goodsReceipts.templates.standard'), value: 'standard' },
  { label: t('goodsReceipts.templates.compact'), value: 'compact' },
])
const validation = computed(() =>
  draft.value
    ? validateGoodsReceiptDraft(draft.value)
    : { errors: [], warnings: [] },
)
const canExport = computed(() => Boolean(draft.value) && validation.value.errors.length === 0)
const exportActionLabel = computed(() =>
  props.supportsDirectPdfExport ? t('goodsReceipts.actions.exportPdf') : t('goodsReceipts.actions.print'),
)
const dialogLayoutStyle = computed(() => ({
  '--goods-receipt-editor-width': `${editorPaneWidth.value}px`,
}))

watch(
  visible,
  (nextVisible) => {
    if (nextVisible) {
      resetDraft()
    }
  },
)

watch(
  () => draft.value?.documentDate,
  (documentDate) => {
    if (!draft.value || !documentDate || grNumberUserEdited.value) {
      return
    }

    draft.value.grNumber = createGoodsReceiptNumber(documentDate)
  },
)

watch(
  () => draft.value?.templateId,
  (templateId) => {
    if (templateId) {
      saveTemplatePreference(templateId)
    }
  },
)

function resetDraft() {
  grNumberUserEdited.value = false
  draft.value = createGoodsReceiptDraft(props.quotation, {
    documentDate: getTodayIsoDate(),
    templateId: loadTemplatePreference(),
  })
}

function markGrNumberEdited() {
  grNumberUserEdited.value = true
}

function exportPdf() {
  if (!draft.value || !canExport.value) {
    return
  }

  emit('exportPdf', draft.value)
}

function startEditorPaneResize(event: PointerEvent) {
  if (event.button !== 0) {
    return
  }

  event.preventDefault()
  isResizingEditorPane.value = true
  updateEditorPaneWidth(event.clientX)
  window.addEventListener('pointermove', handleEditorPaneResize)
  window.addEventListener('pointerup', stopEditorPaneResize)
}

function handleEditorPaneResize(event: PointerEvent) {
  updateEditorPaneWidth(event.clientX)
}

function stopEditorPaneResize() {
  isResizingEditorPane.value = false
  window.removeEventListener('pointermove', handleEditorPaneResize)
  window.removeEventListener('pointerup', stopEditorPaneResize)
}

function resizeEditorPaneWithKeyboard(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return
  }

  event.preventDefault()
  const direction = event.key === 'ArrowRight' ? 1 : -1
  setEditorPaneWidth(editorPaneWidth.value + direction * EDITOR_PANE_RESIZE_STEP)
}

function updateEditorPaneWidth(clientX: number) {
  const layoutBounds = dialogLayoutRef.value?.getBoundingClientRect()

  if (!layoutBounds) {
    return
  }

  setEditorPaneWidth(clientX - layoutBounds.left)
}

function setEditorPaneWidth(nextWidth: number) {
  const layoutWidth = dialogLayoutRef.value?.getBoundingClientRect().width ?? 0
  const availableMaxWidth = layoutWidth > 0
    ? layoutWidth - MIN_PREVIEW_PANE_WIDTH - PANE_RESIZE_HANDLE_WIDTH
    : MAX_EDITOR_PANE_WIDTH
  const maxWidth = Math.max(
    MIN_EDITOR_PANE_WIDTH,
    Math.min(MAX_EDITOR_PANE_WIDTH, availableMaxWidth),
  )

  editorPaneWidth.value = Math.min(Math.max(nextWidth, MIN_EDITOR_PANE_WIDTH), maxWidth)
}

function getErrorMessage(code: string) {
  return t(`goodsReceipts.errors.${code}`)
}

function loadTemplatePreference(): GoodsReceiptTemplateId {
  if (typeof window === 'undefined') {
    return 'standard'
  }

  return normalizeGoodsReceiptTemplateId(window.localStorage.getItem(GOODS_RECEIPT_TEMPLATE_STORAGE_KEY))
}

function saveTemplatePreference(templateId: GoodsReceiptTemplateId) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(GOODS_RECEIPT_TEMPLATE_STORAGE_KEY, templateId)
}

function getTodayIsoDate() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${today.getFullYear()}-${month}-${day}`
}

onBeforeUnmount(stopEditorPaneResize)
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    maximizable
    class="goods-receipt-modal"
    content-class="goods-receipt-modal-content"
    :header="t('goodsReceipts.dialog.title')"
  >
    <div
      v-if="draft"
      ref="dialogLayout"
      class="goods-receipt-dialog"
      :class="{ 'is-resizing-editor-pane': isResizingEditorPane }"
      :style="dialogLayoutStyle"
    >
      <section class="goods-receipt-editor-panel">
        <header class="goods-receipt-toolbar">
          <label class="goods-receipt-template-field">
            <span>{{ t('goodsReceipts.fields.template') }}</span>
            <Select
              v-model="draft.templateId"
              :options="templateOptions"
              option-label="label"
              option-value="value"
            />
          </label>
        </header>

        <div class="goods-receipt-editor-scroll">
          <GoodsReceiptDetailsForm
            v-model="draft"
            @gr-number-edited="markGrNumberEdited"
          />
          <GoodsReceiptItemsEditor
            v-model="draft.lines"
            :warnings="validation.warnings"
            :quotation-items="props.quotation.majorItems"
          />
        </div>
      </section>

      <button
        type="button"
        class="goods-receipt-pane-resize-handle"
        role="separator"
        aria-orientation="vertical"
        :aria-label="t('goodsReceipts.actions.resizeEditorPane')"
        :aria-valuemin="MIN_EDITOR_PANE_WIDTH"
        :aria-valuemax="MAX_EDITOR_PANE_WIDTH"
        :aria-valuenow="editorPaneWidth"
        @pointerdown="startEditorPaneResize"
        @keydown="resizeEditorPaneWithKeyboard"
      />

      <section class="goods-receipt-preview-panel" :aria-label="t('goodsReceipts.preview.aria')">
        <div class="goods-receipt-preview-scroll">
          <GoodsReceiptPreview
            :draft="draft"
            :branding="props.quotation.branding"
          />
        </div>
      </section>
    </div>

    <template #footer>
      <div class="goods-receipt-footer">
        <div class="goods-receipt-errors" aria-live="polite">
          <span
            v-for="error in validation.errors"
            :key="`${error.lineId ?? 'draft'}-${error.code}`"
          >
            {{ getErrorMessage(error.code) }}
          </span>
        </div>
        <Button severity="secondary" :label="t('goodsReceipts.actions.cancel')" @click="visible = false" />
        <Button
          icon="pi pi-file-pdf"
          :label="exportActionLabel"
          :disabled="!canExport"
          @click="exportPdf"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
:global(.goods-receipt-modal.p-dialog) {
  width: min(1420px, calc(100vw - 32px));
  height: min(900px, calc(100vh - 32px));
  min-width: min(900px, calc(100vw - 20px));
  min-height: min(560px, calc(100vh - 20px));
  max-width: calc(100vw - 20px);
  max-height: calc(100vh - 20px);
  overflow: hidden;
  resize: both;
}

:global(.goods-receipt-modal.p-dialog-maximized) {
  resize: none;
}

:global(.goods-receipt-modal-content) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 0 !important;
}

.goods-receipt-dialog {
  display: grid;
  grid-template-columns: var(--goods-receipt-editor-width) 10px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  background: var(--surface-panel);
}

.goods-receipt-editor-panel,
.goods-receipt-preview-panel {
  min-width: 0;
  min-height: 0;
}

.goods-receipt-editor-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  background: #ffffff;
}

.goods-receipt-pane-resize-handle {
  position: relative;
  width: 10px;
  min-width: 10px;
  height: 100%;
  padding: 0;
  border: 0;
  background: var(--surface-panel);
  cursor: col-resize;
}

.goods-receipt-pane-resize-handle::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 4px;
  border-left: 1px solid var(--surface-border);
}

.goods-receipt-pane-resize-handle:hover::before,
.goods-receipt-pane-resize-handle:focus-visible::before,
.is-resizing-editor-pane .goods-receipt-pane-resize-handle::before {
  border-left-color: var(--accent);
}

.goods-receipt-pane-resize-handle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 36%, transparent);
  outline-offset: -2px;
}

.goods-receipt-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-card);
}

.goods-receipt-template-field {
  display: grid;
  gap: 5px;
  min-width: 220px;
}

.goods-receipt-template-field > span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.goods-receipt-editor-scroll,
.goods-receipt-preview-scroll {
  min-height: 0;
  overflow: auto;
}

.goods-receipt-editor-scroll {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 14px;
}

.goods-receipt-preview-panel {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-raised) 76%, white), var(--surface-panel)),
    var(--surface-panel);
}

.goods-receipt-preview-scroll {
  padding: 18px;
}

.goods-receipt-preview-scroll :deep(.goods-receipt-document) {
  border: 1px solid color-mix(in srgb, var(--surface-border) 72%, white);
  box-shadow: 0 10px 28px rgb(15 23 42 / 12%);
}

.goods-receipt-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}

.goods-receipt-errors {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--danger);
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 1180px) {
  :global(.goods-receipt-modal-content) {
    overflow: auto;
  }

  .goods-receipt-dialog {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    height: auto;
    max-height: none;
  }

  .goods-receipt-pane-resize-handle {
    display: none;
  }

  .goods-receipt-editor-panel {
    border-right: 0;
    border-bottom: 1px solid var(--surface-border);
  }

  .goods-receipt-editor-scroll,
  .goods-receipt-preview-scroll {
    max-height: 58vh;
  }
}
</style>
