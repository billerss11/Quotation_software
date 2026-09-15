<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CompanyProfile } from '@/shared/services/localCompanyProfileStorage'

import type { ExchangeRateTable, MajorItemSummary, QuotationDraft, QuotationTotals } from '../types'
import type { QuotationTemplateId } from '../templates/templateIds'
import {
  getQuotationDocumentOrientation,
  getQuotationDocumentPageSizePx,
} from '../utils/quotationDocumentPage'
import {
  calculatePreviewScale,
  createPreviewWindowFrame,
  type PreviewZoomMode,
} from '../utils/previewWindowFrame'
import QuotationPaginatedDocument from './QuotationPaginatedDocument.vue'
import QuotationTemplateSelector from './QuotationTemplateSelector.vue'

const props = defineProps<{
  supportsDirectPdfExport: boolean
  quotation: QuotationDraft
  summaries: MajorItemSummary[]
  totals: QuotationTotals
  globalMarkupRate: number
  exchangeRates: ExchangeRateTable
  companyProfile: CompanyProfile
}>()

const emit = defineEmits<{
  close: []
  exportPdf: []
  updateTemplateId: [templateId: QuotationTemplateId]
}>()
const { t } = useI18n()

const orientation = computed(() => getQuotationDocumentOrientation(props.quotation))
const initialPageSize = getQuotationDocumentPageSizePx(orientation.value)
const frame = shallowRef(
  createPreviewWindowFrame({
    viewportWidth: typeof window === 'undefined' ? 1440 : window.innerWidth,
    viewportHeight: typeof window === 'undefined' ? 960 : window.innerHeight,
    pageWidth: initialPageSize.width,
    pageHeight: initialPageSize.height,
  }),
)
const zoomMode = shallowRef<PreviewZoomMode>('fit-width')
const documentMetrics = shallowRef({
  pageCount: 0,
  pageWidth: initialPageSize.width,
  pageHeight: initialPageSize.height,
})
const previewBodySize = shallowRef({ width: 0, height: 0 })
const dragState = shallowRef<{
  pointerId: number
  startX: number
  startY: number
  startLeft: number
  startTop: number
} | null>(null)
const previewWindow = useTemplateRef<HTMLElement>('previewWindow')
const previewBody = useTemplateRef<HTMLElement>('previewBody')
let resizeObserver: ResizeObserver | null = null

const windowStyle = computed(() => ({
  width: `${frame.value.width}px`,
  height: `${frame.value.height}px`,
  left: `${frame.value.left}px`,
  top: `${frame.value.top}px`,
}))
const exportActionAria = computed(() => (
  props.supportsDirectPdfExport
    ? t('quotations.floatingPreview.exportPdfAria')
    : t('quotations.floatingPreview.printAria')
))
const previewScale = computed(() => calculatePreviewScale({
  mode: zoomMode.value,
  pageWidth: documentMetrics.value.pageWidth,
  pageHeight: documentMetrics.value.pageHeight,
  availableWidth: previewBodySize.value.width,
  availableHeight: previewBodySize.value.height,
}))
const zoomPercentLabel = computed(() => `${Math.round(previewScale.value * 100)}%`)

watch(
  () => [orientation.value, props.quotation.templateId] as const,
  ([nextOrientation]) => {
    const pageSize = getQuotationDocumentPageSizePx(nextOrientation)

    zoomMode.value = 'fit-width'
    documentMetrics.value = {
      pageCount: 0,
      pageWidth: pageSize.width,
      pageHeight: pageSize.height,
    }
    frame.value = createPreviewWindowFrame({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pageWidth: pageSize.width,
      pageHeight: pageSize.height,
    })
  },
)

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    const element = previewWindow.value
    const body = previewBody.value

    if (element) {
      const { width, height } = element.getBoundingClientRect()
      const roundedWidth = Math.round(width)
      const roundedHeight = Math.round(height)

      if (roundedWidth !== frame.value.width || roundedHeight !== frame.value.height) {
        frame.value = {
          ...frame.value,
          width: roundedWidth,
          height: roundedHeight,
        }
      }
    }

    if (body) {
      const nextBodySize = {
        width: Math.max(0, body.clientWidth - 32),
        height: Math.max(0, body.clientHeight - 32),
      }

      if (
        nextBodySize.width !== previewBodySize.value.width
        || nextBodySize.height !== previewBodySize.value.height
      ) {
        previewBodySize.value = nextBodySize
      }
    }
  })
  resizeObserver.observe(previewWindow.value!)
  resizeObserver.observe(previewBody.value!)
  window.addEventListener('resize', constrainFrameToViewport)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', constrainFrameToViewport)
})

function handleDocumentReady(metrics: { pageCount: number; pageWidth: number; pageHeight: number }) {
  documentMetrics.value = metrics
}

function setZoomMode(mode: PreviewZoomMode) {
  zoomMode.value = mode
}

function constrainFrameToViewport() {
  const width = Math.min(frame.value.width, Math.max(1, window.innerWidth - 48))
  const height = Math.min(frame.value.height, Math.max(1, window.innerHeight - 48))

  frame.value = {
    width,
    height,
    left: clamp(frame.value.left, 24, Math.max(24, window.innerWidth - width - 24)),
    top: clamp(frame.value.top, 24, Math.max(24, window.innerHeight - height - 24)),
  }
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0) {
    return
  }

  const target = event.target as HTMLElement

  if (target.closest('button, .template-selector, .p-select')) {
    return
  }

  dragState.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startLeft: frame.value.left,
    startTop: frame.value.top,
  }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function moveDrag(event: PointerEvent) {
  const drag = dragState.value

  if (!drag || drag.pointerId !== event.pointerId) {
    return
  }

  frame.value = {
    ...frame.value,
    left: clamp(drag.startLeft + event.clientX - drag.startX, 12, window.innerWidth - 120),
    top: clamp(drag.startTop + event.clientY - drag.startY, 12, window.innerHeight - 80),
  }
}

function stopDrag(event: PointerEvent) {
  if (dragState.value?.pointerId === event.pointerId) {
    dragState.value = null
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
</script>

<template>
  <div class="preview-backdrop" aria-hidden="true" />
  <section ref="previewWindow" class="floating-preview" :style="windowStyle" :aria-label="t('quotations.floatingPreview.aria')">
    <header
      class="floating-preview-bar"
      @pointerdown="startDrag"
      @pointermove="moveDrag"
      @pointerup="stopDrag"
      @pointercancel="stopDrag"
    >
      <div>
        <strong>{{ quotation.header.quotationNumber }}</strong>
        <span>{{ quotation.header.customerCompany || quotation.header.contactPerson || t('quotations.floatingPreview.fallbackTitle') }}</span>
      </div>
      <div class="floating-actions">
        <QuotationTemplateSelector
          :model-value="props.quotation.templateId"
          compact
          :aria-label="t('quotations.templates.selectorAria')"
          @update:model-value="emit('updateTemplateId', $event)"
        />
        <Button icon="pi pi-print" severity="secondary" text rounded :aria-label="exportActionAria" @click="emit('exportPdf')" />
        <Button icon="pi pi-times" severity="secondary" text rounded :aria-label="t('quotations.floatingPreview.closeAria')" @click="emit('close')" />
      </div>
    </header>

    <div class="floating-preview-toolbar">
      <div class="floating-zoom-controls" role="group" :aria-label="t('quotations.floatingPreview.zoomControlsAria')">
        <Button
          size="small"
          :label="t('quotations.floatingPreview.fitWidth')"
          :severity="zoomMode === 'fit-width' ? 'primary' : 'secondary'"
          :outlined="zoomMode !== 'fit-width'"
          :aria-pressed="zoomMode === 'fit-width'"
          @click="setZoomMode('fit-width')"
        />
        <Button
          size="small"
          :label="t('quotations.floatingPreview.actualSize')"
          :severity="zoomMode === 'actual-size' ? 'primary' : 'secondary'"
          :outlined="zoomMode !== 'actual-size'"
          :aria-pressed="zoomMode === 'actual-size'"
          @click="setZoomMode('actual-size')"
        />
        <Button
          size="small"
          :label="t('quotations.floatingPreview.fitPage')"
          :severity="zoomMode === 'fit-page' ? 'primary' : 'secondary'"
          :outlined="zoomMode !== 'fit-page'"
          :aria-pressed="zoomMode === 'fit-page'"
          @click="setZoomMode('fit-page')"
        />
      </div>
      <div class="floating-preview-status" aria-live="polite">
        <span>{{ zoomPercentLabel }}</span>
        <span v-if="documentMetrics.pageCount > 0">
          {{ t('quotations.floatingPreview.pageCount', { count: documentMetrics.pageCount }) }}
        </span>
      </div>
    </div>

    <div ref="previewBody" class="floating-preview-body">
      <QuotationPaginatedDocument
        :quotation="props.quotation"
        :summaries="props.summaries"
        :totals="props.totals"
        :global-markup-rate="props.globalMarkupRate"
        :exchange-rates="props.exchangeRates"
        :company-profile="props.companyProfile"
        :scale="previewScale"
        @ready="handleDocumentReady"
      />
    </div>
  </section>
</template>

<style scoped>
.preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgb(7 17 29 / 30%);
  pointer-events: none;
}

.floating-preview {
  position: fixed;
  z-index: 41;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  min-width: 720px;
  min-height: 620px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 48px);
  border: 1px solid var(--surface-border-strong);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius-lg);
  background: var(--surface-panel);
  box-shadow: 0 22px 56px rgb(15 23 42 / 24%);
  resize: both;
  overflow: hidden;
}

.floating-preview-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 50px;
  padding: 8px 10px 8px 14px;
  border-bottom: 1px solid var(--surface-border-strong);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--accent-surface) 54%, transparent), transparent 48%),
    var(--surface-card);
  cursor: move;
  user-select: none;
}

.floating-preview-bar div:first-child {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.floating-preview-bar strong,
.floating-preview-bar span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.floating-preview-bar strong {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 900;
  line-height: 1.15;
}

.floating-preview-bar span {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.25;
}

.floating-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: default;
}

.floating-actions :deep(.p-button) {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
}

.floating-preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-card);
}

.floating-zoom-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.floating-zoom-controls :deep(.p-button) {
  min-height: 30px;
  padding: 5px 10px;
  font-size: 12px;
}

.floating-preview-status {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.floating-preview-body {
  min-height: 0;
  padding: 16px;
  overflow: auto;
  scrollbar-gutter: stable;
  background:
    linear-gradient(180deg, var(--surface-raised), var(--surface-panel)),
    var(--surface-panel);
}

.floating-preview-body :deep(.quotation-page) {
  outline: 1px solid var(--surface-border);
  box-shadow: 0 10px 28px rgb(15 23 42 / 12%);
}
</style>
