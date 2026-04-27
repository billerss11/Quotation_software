<script setup lang="ts">
import Button from 'primevue/button'
import { computed, shallowRef } from 'vue'

import type { CompanyProfile } from '@/shared/services/localCompanyProfileStorage'

import type { ExchangeRateTable, MajorItemSummary, QuotationDraft, QuotationTotals } from '../types'
import { createPreviewWindowFrame } from '../utils/previewWindowFrame'
import QuotationPreview from './QuotationPreview.vue'

const props = defineProps<{
  quotation: QuotationDraft
  summaries: MajorItemSummary[]
  totals: QuotationTotals
  globalMarkupRate: number
  exchangeRates: ExchangeRateTable
  companyProfile: CompanyProfile
}>()

const emit = defineEmits<{
  close: []
  print: []
}>()

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

function startDrag(event: PointerEvent) {
  if (event.button !== 0) {
    return
  }

  const target = event.target as HTMLElement

  if (target.closest('button')) {
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
  <section class="floating-preview" :style="windowStyle" aria-label="Floating quotation preview">
    <header
      class="floating-preview-bar"
      @pointerdown="startDrag"
      @pointermove="moveDrag"
      @pointerup="stopDrag"
      @pointercancel="stopDrag"
    >
      <div>
        <strong>{{ quotation.header.quotationNumber }}</strong>
        <span>{{ quotation.header.customerCompany || quotation.header.contactPerson || 'Quotation preview' }}</span>
      </div>
      <div class="floating-actions">
        <Button icon="pi pi-print" severity="secondary" text rounded aria-label="Print preview" @click="emit('print')" />
        <Button icon="pi pi-times" severity="secondary" text rounded aria-label="Close preview" @click="emit('close')" />
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
  background: rgb(15 23 42 / 18%);
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
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  box-shadow: 0 24px 70px rgb(15 23 42 / 28%);
  resize: both;
  overflow: hidden;
}

.floating-preview-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 50px;
  padding: 8px 10px 8px 16px;
  border-bottom: 1px solid #d9e2ef;
  background: #ffffff;
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
}

.floating-preview-bar span {
  color: #64748b;
  font-size: 13px;
}

.floating-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: default;
}

.floating-preview-body {
  min-height: 0;
  padding: 18px;
  overflow: auto;
}

.floating-preview-body :deep(.quotation-document) {
  width: 850px;
  min-height: 1100px;
  margin: 0 auto;
  box-shadow: 0 12px 34px rgb(15 23 42 / 12%);
}
</style>
