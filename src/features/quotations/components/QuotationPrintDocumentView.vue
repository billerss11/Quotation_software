<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { QuotationPdfRenderPayload } from '@/shared/contracts/quotationApp'
import { getQuotationRuntime } from '@/shared/runtime/quotationRuntime'
import QuotationPaginatedDocument from './QuotationPaginatedDocument.vue'

const props = defineProps<{ jobId: string }>()
const { t } = useI18n()
const runtime = getQuotationRuntime()
const payload = shallowRef<QuotationPdfRenderPayload | null>(null)
const loadError = shallowRef('')
let notified = false

onMounted(async () => {
  document.documentElement.style.backgroundColor = '#ffffff'
  document.body.style.margin = '0'
  document.body.style.backgroundColor = '#ffffff'
  try {
    payload.value = await runtime.getQuotationPrintPayload(props.jobId)
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)))
  }
})

async function onReady() {
  if (notified || loadError.value) return
  notified = true
  try {
    // The shared component signals after assets and page fragmentation finish.
    await runtime.notifyQuotationPrintReady(props.jobId)
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)))
  }
}
function onError(error: Error) {
  console.error(error)
  loadError.value = t('quotations.pagination.failed')
}
</script>

<template>
  <main class="print-document-shell">
    <QuotationPaginatedDocument
      v-if="payload"
      :quotation="payload.quotation"
      :summaries="payload.summaries"
      :totals="payload.totals"
      :global-markup-rate="payload.globalMarkupRate"
      :exchange-rates="payload.exchangeRates"
      :company-profile="payload.companyProfile"
      @ready="onReady"
      @error="onError"
    />
    <p v-if="loadError" class="print-document-error">{{ loadError }}</p>
  </main>
</template>

<style scoped>
.print-document-shell { margin: 0; background: white; }
.print-document-error { padding: 24px; color: #b91c1c; }
</style>
