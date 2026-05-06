<script setup lang="ts">
import { nextTick, onMounted, shallowRef } from 'vue'

import type { QuotationPdfRenderPayload } from '@/shared/contracts/quotationApp'
import { getQuotationRuntime } from '@/shared/runtime/quotationRuntime'
import QuotationPreview from './QuotationPreview.vue'

const props = defineProps<{
  jobId: string
}>()

const runtime = getQuotationRuntime()
const payload = shallowRef<QuotationPdfRenderPayload | null>(null)
const loadError = shallowRef('')

onMounted(() => {
  void initializePrintDocument()
})

async function initializePrintDocument() {
  document.documentElement.style.backgroundColor = '#ffffff'
  document.body.style.margin = '0'
  document.body.style.backgroundColor = '#ffffff'

  try {
    payload.value = await runtime.getQuotationPrintPayload(props.jobId)
    await nextTick()
    await waitForDocumentAssets()
    await runtime.notifyQuotationPrintReady(props.jobId)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Failed to prepare quotation print view.'
  }
}

async function waitForDocumentAssets() {
  await waitForAnimationFrame()

  if ('fonts' in document) {
    await document.fonts.ready
  }

  const images = Array.from(document.querySelectorAll('img'))

  await Promise.all(images.map(waitForImageReady))
  await waitForAnimationFrame()
}

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

async function waitForImageReady(image: HTMLImageElement) {
  if (typeof image.decode === 'function') {
    try {
      await image.decode()
      return
    } catch {
      // Fall back to load events when decode is not available for this image source.
    }
  }

  if (image.complete) {
    return
  }

  await new Promise<void>((resolve) => {
    const finish = () => resolve()
    image.addEventListener('load', finish, { once: true })
    image.addEventListener('error', finish, { once: true })
  })
}
</script>

<template>
  <main class="print-document-shell">
    <QuotationPreview
      v-if="payload"
      :quotation="payload.quotation"
      :summaries="payload.summaries"
      :totals="payload.totals"
      :global-markup-rate="payload.globalMarkupRate"
      :exchange-rates="payload.exchangeRates"
      :company-profile="payload.companyProfile"
    />
    <p v-else-if="loadError" class="print-document-error">{{ loadError }}</p>
  </main>
</template>

<style scoped>
.print-document-shell {
  display: grid;
  justify-content: center;
  background: #ffffff;
}

.print-document-shell :deep(.quotation-document) {
  margin: 0;
  border: 0;
  box-shadow: none;
  display: block;
  min-height: auto;
}

.print-document-error {
  margin: 0;
  padding: 24px;
  color: #b91c1c;
}

.print-document-shell :deep(.quotation-document > * + *) {
  margin-top: 20px;
}

.print-document-shell :deep(.document-header),
.print-document-shell :deep(.meta-band),
.print-document-shell :deep(.summary-section),
.print-document-shell :deep(.document-footer) {
  break-inside: avoid;
  page-break-inside: avoid;
}

.print-document-shell :deep(.quotation-table tr) {
  break-inside: avoid;
  page-break-inside: avoid;
}

.print-document-shell :deep(.summary-section) {
  margin-top: 24px;
}

.print-document-shell :deep(.document-footer) {
  margin-top: 32px;
  padding-top: 0;
}
</style>

<style>
@page {
  size: A4;
  margin: 10mm 0 12mm;
}
</style>
