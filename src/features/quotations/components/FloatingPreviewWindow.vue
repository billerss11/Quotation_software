<script setup lang="ts">
import Button from 'primevue/button'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CompanyProfile } from '@/shared/services/localCompanyProfileStorage'

import type { ExchangeRateTable, MajorItemSummary, QuotationDraft, QuotationTotals } from '../types'
import type { QuotationTemplateId } from '../templates/templateIds'
import { createPreviewWindowFrame } from '../utils/previewWindowFrame'
import QuotationPreview from './QuotationPreview.vue'
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

const frame = shallowRef(
  createPreviewWindowFrame({
    viewportWidth: typeof window === 'undefined' ? 1440 : window.innerWidth,
    viewportHeight: typeof window === 'undefined' ? 960 : window.innerHeight,
  }),
)
const dragState = shallowRef<{
  pointerId: number
  startX: number
  startY: number
  startLeft: number
  startTop: number
} | null>(null)

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
  <section class="floating-preview" :style="windowStyle" :aria-label="t('quotations.floatingPreview.aria')">
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

    <div class="floating-preview-body">
      <QuotationPreview
        :quotation="props.quotation"
        :summaries="props.summaries"
        :totals="props.totals"
        :global-markup-rate="props.globalMarkupRate"
        :exchange-rates="props.exchangeRates"
        :company-profile="props.companyProfile"
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
  grid-template-rows: auto minmax(0, 1fr);
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

.floating-preview-body {
  min-height: 0;
  padding: 16px;
  overflow: auto;
  background:
    linear-gradient(180deg, var(--surface-raised), var(--surface-panel)),
    var(--surface-panel);
}

.floating-preview-body :deep(.quotation-document) {
  border: 1px solid var(--surface-border);
  box-shadow: 0 10px 28px rgb(15 23 42 / 12%);
}
</style>
