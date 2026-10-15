<script setup lang="ts">
import Button from 'primevue/button'
import { computed, defineAsyncComponent, onMounted, onUnmounted, provide, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { QuotationTemplateProps } from '../templates/types'
import { getQuotationDocumentOrientation, getQuotationDocumentPageSizePx } from '../utils/quotationDocumentPage'
import { quotationContinuousPreviewKey } from '../utils/quotationPreviewContext'
const QuotationPreview = defineAsyncComponent(() => import('./QuotationPreview.vue'))

const props = defineProps<QuotationTemplateProps & { supportsDirectPdfExport: boolean }>()
const emit = defineEmits<{ exportPdf: []; openPreview: [] }>()
const { t } = useI18n()
const previewBody = useTemplateRef<HTMLElement>('previewBody')
const availableWidth = shallowRef(800)
const actualSize = shallowRef(false)
const pageSize = computed(() => getQuotationDocumentPageSizePx(getQuotationDocumentOrientation(props.quotation)))
const scale = computed(() => actualSize.value ? 1 : Math.min(1, Math.max(0.1, (availableWidth.value - 48) / pageSize.value.width)))
provide(quotationContinuousPreviewKey, { scrollElement: previewBody, scale })
let observer: ResizeObserver | undefined
onMounted(() => {
  if (!previewBody.value) return
  availableWidth.value = previewBody.value.clientWidth
  observer = new ResizeObserver(entries => { availableWidth.value = entries[0]?.contentRect.width ?? availableWidth.value })
  observer.observe(previewBody.value)
})
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div class="review-workspace">
    <aside class="review-settings"><slot /></aside>
    <section class="review-canvas" :aria-label="t('workspace.previewAria')">
      <div class="review-toolbar">
        <Button :label="actualSize ? t('workspace.fitWidth') : t('workspace.actualSize')" icon="pi pi-search" text severity="secondary" @click="actualSize = !actualSize" />
        <span class="preview-scale">{{ Math.round(scale * 100) }}%</span>
        <span class="toolbar-space" />
        <Button icon="pi pi-window-maximize" :aria-label="t('workspace.openPreview')" v-tooltip.bottom="t('workspace.openPreview')" text severity="secondary" @click="emit('openPreview')" />
        <Button icon="pi pi-file-pdf" :label="supportsDirectPdfExport ? t('quotations.commandBar.exportPdf') : t('quotations.commandBar.print')" @click="emit('exportPdf')" />
      </div>
      <div ref="previewBody" class="review-document-scroll">
        <div class="review-document" :style="{ zoom: scale, width: `${pageSize.width}px` }">
          <QuotationPreview :quotation="quotation" :summaries="summaries" :totals="totals" :global-markup-rate="globalMarkupRate" :exchange-rates="exchangeRates" :company-profile="companyProfile" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.review-workspace { display: grid; grid-template-columns: 300px minmax(0, 1fr); height: 100%; min-height: 0; min-width: 0; }
.review-settings { min-width: 0; padding: 24px; overflow: auto; background: var(--surface-card); border-right: 1px solid var(--surface-border); }
.review-canvas { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--surface-muted); }
.review-toolbar { display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: var(--surface-card); border-bottom: 1px solid var(--surface-border); }
.preview-scale { color: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.toolbar-space { flex: 1; }
.review-document-scroll { flex: 1; min-height: 0; overflow: auto; padding: 24px; }
.review-document { margin: 0 auto; box-shadow: var(--shadow-elevated); }
@media (max-width: 1000px) { .review-workspace { grid-template-columns: 260px minmax(0, 1fr); } .review-settings { padding: 18px; } .review-toolbar { padding: 8px; gap: 4px; } }
@media (max-width: 680px) { .review-workspace { display: flex; flex-direction: column; overflow: auto; } .review-settings { overflow: visible; border-right: 0; border-bottom: 1px solid var(--surface-border); } .review-canvas { min-height: 560px; flex-shrink: 0; } }
</style>
