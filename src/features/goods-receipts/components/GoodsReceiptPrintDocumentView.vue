<script setup lang="ts">
import { nextTick, onMounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { GoodsReceiptPdfRenderPayload } from '@/shared/contracts/quotationApp'
import { getQuotationRuntime } from '@/shared/runtime/quotationRuntime'

import GoodsReceiptPreview from './GoodsReceiptPreview.vue'

const props = defineProps<{
  jobId: string
}>()

const runtime = getQuotationRuntime()
const { t } = useI18n()
const payload = shallowRef<GoodsReceiptPdfRenderPayload | null>(null)
const loadError = shallowRef('')

onMounted(() => {
  void initializePrintDocument()
})

async function initializePrintDocument() {
  document.documentElement.style.backgroundColor = '#ffffff'
  document.body.style.margin = '0'
  document.body.style.backgroundColor = '#ffffff'

  try {
    payload.value = await runtime.getGoodsReceiptPrintPayload(props.jobId)
    await nextTick()
    await waitForDocumentAssets()
    await runtime.notifyGoodsReceiptPrintReady(props.jobId)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : t('goodsReceipts.errors.printViewFailed')
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
    <GoodsReceiptPreview
      v-if="payload"
      :draft="payload.draft"
      :branding="payload.branding"
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

.print-document-shell :deep(.goods-receipt-document) {
  margin: 0;
  border: 0;
  box-shadow: none;
  display: block;
  min-height: auto;
}

.print-document-shell :deep(.goods-receipt-header),
.print-document-shell :deep(.goods-receipt-parties),
.print-document-shell :deep(.goods-receipt-remarks),
.print-document-shell :deep(.goods-receipt-signatures) {
  break-inside: avoid;
  page-break-inside: avoid;
}

.print-document-shell :deep(.goods-receipt-table tr) {
  break-inside: avoid;
  page-break-inside: avoid;
}

.print-document-error {
  margin: 0;
  padding: 24px;
  color: #b91c1c;
}
</style>

<style>
@page {
  size: A4;
  margin: 10mm 0 12mm;
}
</style>
