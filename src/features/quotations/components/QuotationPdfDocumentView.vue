<script setup lang="ts">
import { nextTick, onMounted, shallowRef } from 'vue'

import type { QuotationPdfRenderPayload } from '../../../../electron/preload-api'
import QuotationPreview from './QuotationPreview.vue'

const props = defineProps<{
  jobId: string
}>()

const payload = shallowRef<QuotationPdfRenderPayload | null>(null)
const loadError = shallowRef('')

onMounted(() => {
  void initializePdfDocument()
})

async function initializePdfDocument() {
  document.documentElement.style.backgroundColor = '#ffffff'
  document.body.style.margin = '0'
  document.body.style.backgroundColor = '#ffffff'

  try {
    if (!window.quotationApp?.getQuotationPdfPayload || !window.quotationApp.notifyQuotationPdfReady) {
      throw new Error('Quotation PDF bridge is unavailable.')
    }

    payload.value = await window.quotationApp.getQuotationPdfPayload(props.jobId)
    await nextTick()
    await waitForDocumentAssets()
    await window.quotationApp.notifyQuotationPdfReady(props.jobId)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Failed to prepare quotation PDF.'
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
  <main class="pdf-document-shell">
    <QuotationPreview
      v-if="payload"
      :quotation="payload.quotation"
      :summaries="payload.summaries"
      :totals="payload.totals"
      :global-markup-rate="payload.globalMarkupRate"
      :exchange-rates="payload.exchangeRates"
      :company-profile="payload.companyProfile"
    />
    <p v-else-if="loadError" class="pdf-document-error">{{ loadError }}</p>
  </main>
</template>

<style scoped>
.pdf-document-shell {
  background: #ffffff;
}

.pdf-document-shell :deep(.quotation-document) {
  width: auto;
  min-height: auto;
  margin: 0;
  border: 0;
  box-shadow: none;
}

.pdf-document-error {
  margin: 0;
  padding: 24px;
  color: #b91c1c;
}
</style>
