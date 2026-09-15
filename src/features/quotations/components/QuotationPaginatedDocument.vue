<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationTemplateProps } from '../templates/types'
import { getQuotationDocumentOrientation } from '../utils/quotationDocumentPage'
import { paginateQuotationDocument } from '../utils/quotationPagination'
import QuotationPreview from './QuotationPreview.vue'

const props = withDefaults(defineProps<QuotationTemplateProps & { scale?: number }>(), { scale: 1 })
const emit = defineEmits<{
  ready: [result: { pageCount: number; pageWidth: number; pageHeight: number }]
  error: [error: Error]
}>()
const { t } = useI18n()
const sourceRef = useTemplateRef<HTMLElement>('source')
const draftRef = useTemplateRef<HTMLElement>('draft')
const pagesRef = useTemplateRef<HTMLElement>('pages')
const pageCount = ref(0)
const preparing = ref(true)
const failed = ref(false)
let revision = 0
let disposed = false

const templateProps = computed<QuotationTemplateProps>(() => ({
  quotation: props.quotation,
  summaries: props.summaries,
  totals: props.totals,
  globalMarkupRate: props.globalMarkupRate,
  exchangeRates: props.exchangeRates,
  companyProfile: props.companyProfile,
}))
const orientation = computed(() => getQuotationDocumentOrientation(props.quotation))
const pageSize = computed(() => ({
  width: (orientation.value === 'landscape' ? 297 : 210) * 96 / 25.4,
  height: (orientation.value === 'landscape' ? 210 : 297) * 96 / 25.4,
}))
const displayScale = computed(() => Math.max(0.1, Math.min(2, props.scale)))
const displayStyle = computed(() => ({
  width: `${pageSize.value.width * displayScale.value}px`,
  height: `${(pageCount.value * pageSize.value.height + Math.max(0, pageCount.value - 1) * 24) * displayScale.value}px`,
}))
const pagesStyle = computed(() => ({ transform: `scale(${displayScale.value})` }))
const pageRule = computed(() => `@page { size: A4 ${orientation.value}; margin: 0; }`)

watch(templateProps, () => { void buildPages() }, { deep: true, immediate: true, flush: 'post' })
onBeforeUnmount(() => { disposed = true; revision += 1 })

async function buildPages() {
  const current = ++revision
  preparing.value = true
  failed.value = false
  await nextTick()
  try {
    if (document.fonts) await document.fonts.ready
    const source = sourceRef.value?.querySelector<HTMLElement>('.quotation-document')
    if (!source || !draftRef.value || !pagesRef.value) throw new Error('The quotation layout is not mounted.')
    source.style.width = `${pageSize.value.width}px`
    source.dataset.documentOrientation = orientation.value
    await Promise.all(Array.from(source.querySelectorAll('img')).map(img => img.decode().catch(() => {})))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    if (disposed || revision !== current) return
    const locale = props.quotation.header.documentLocale
    const translate = (key: string, params: Record<string, number> = {}) => t(key, params, { locale })
    const pages = paginateQuotationDocument(source, draftRef.value, {
      ...pageSize.value,
      quotationNumber: props.quotation.header.quotationNumber,
      continuedLabel: translate('quotations.pagination.continued'),
      termsLabel: translate('quotations.document.notesTerms'),
      summaryLabel: translate('quotations.pagination.summary'),
      pageLabel: (page, total) => translate('quotations.pagination.page', { page, total }),
    })
    pagesRef.value.replaceChildren(...pages)
    pageCount.value = pages.length
    preparing.value = false
    await nextTick()
    if (disposed || revision !== current) return
    emit('ready', { pageCount: pages.length, pageWidth: pageSize.value.width, pageHeight: pageSize.value.height })
  } catch (error) {
    if (disposed || revision !== current) return
    failed.value = true
    preparing.value = false
    emit('error', error instanceof Error ? error : new Error(String(error)))
  }
}
</script>

<template>
  <section class="quotation-pagination" :data-pagination-ready="!preparing && !failed" :data-page-count="pageCount">
    <component :is="'style'">{{ pageRule }}</component>
    <div class="quotation-measurement" aria-hidden="true" inert>
      <div ref="source" class="quotation-measure-source"><QuotationPreview v-bind="templateProps" /></div>
      <div ref="draft" class="quotation-pagination-draft" />
    </div>
    <p v-if="preparing" class="pagination-status" role="status">{{ t('quotations.pagination.preparing') }}</p>
    <p v-else-if="failed" class="pagination-status" role="alert">{{ t('quotations.pagination.failed') }}</p>
    <div v-show="!preparing && !failed" class="quotation-pages-viewport" :style="displayStyle">
      <div ref="pages" class="quotation-pages" :style="pagesStyle" />
    </div>
  </section>
</template>

<style scoped>
.quotation-pagination { width: max-content; max-width: none; }
.quotation-measurement { position: fixed; left: -100000px; top: 0; visibility: hidden; pointer-events: none; }
.quotation-pages-viewport { position: relative; }
.quotation-pages { display: grid; gap: 24px; transform-origin: top left; width: max-content; }
.pagination-status { padding: 16px; font-size: 14px; color: var(--text-muted, #475569); }
</style>

<style>
/* These rules also apply to native DOM clones of scoped Vue templates. */
.quotation-pagination .quotation-document {
  display: block !important;
  min-height: 0 !important;
  height: auto !important;
  margin: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  border: 0 !important;
  box-shadow: none !important;
  box-sizing: border-box;
}
.quotation-pagination .quotation-document > * { min-width: 0; }
.quotation-pagination :is(.items-section, .spreadsheet-items) { padding-top: 0 !important; padding-bottom: 0 !important; }
.quotation-pagination .quotation-summary {
  grid-template-columns: minmax(0, 1fr) 360px !important;
  gap: 16px !important;
  padding-top: 8px !important;
  padding-bottom: 8px !important;
}
.quotation-pagination .quotation-summary :is(.totals-box, .totals-panel, .totals-board) { padding: 8px 10px !important; }
.quotation-pagination .quotation-summary :is(.totals-row, .total-row, .grand-total, .grand-total-row) {
  padding: 3px 8px !important;
  min-height: 0 !important;
}
.quotation-pagination .quotation-summary dt { padding: 0 !important; font-size: 11px !important; line-height: 1.35; }
.quotation-pagination .quotation-summary dd { padding: 0 !important; font-size: 12px !important; line-height: 1.35; overflow-wrap: anywhere; }
.quotation-pagination .quotation-summary :is(.grand-total, .grand-total-row) dd { font-size: 16px !important; }
.quotation-pagination .quotation-template-atelier[data-document-orientation="landscape"] .quotation-summary {
  grid-template-columns: minmax(0, 1fr) 420px !important;
}
.quotation-page {
  position: relative;
  box-sizing: border-box;
  padding: 28px 0 0;
  background: #fff;
  color: #17212b;
  box-shadow: 0 2px 12px rgb(15 23 42 / 12%);
  break-after: page;
  page-break-after: always;
}
.quotation-page:last-child { break-after: auto; page-break-after: auto; }
.quotation-page-footer {
  position: absolute;
  bottom: 12px;
  left: 30px;
  right: 30px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 20px;
  border-top: 1px solid #ccd3d7;
  padding-top: 7px;
  font: 10.667px/1.3 Arial, "Microsoft YaHei", sans-serif;
  color: #46525b;
}
.quotation-page-reference { overflow-wrap: anywhere; white-space: pre-line; }
.quotation-page-number { white-space: nowrap; }
.quotation-continuation {
  padding: 6px 0 8px;
  border-bottom: 1px solid #c4ccd1;
  margin-bottom: 10px;
  color: #273843;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.quotation-pagination .quotation-summary-prose,
.quotation-pagination .quotation-summary-totals { display: block !important; min-height: 0; }
.quotation-pagination .quotation-summary-prose > * { width: auto !important; }
.quotation-pagination .quotation-summary-totals > * { max-width: 420px; margin-left: auto; }
@media print {
  .quotation-measurement, .pagination-status { display: none !important; }
  .quotation-pages { display: block !important; transform: none !important; }
  .quotation-pages-viewport { width: auto !important; height: auto !important; }
  .quotation-page { box-shadow: none; margin: 0 !important; }
}
</style>
