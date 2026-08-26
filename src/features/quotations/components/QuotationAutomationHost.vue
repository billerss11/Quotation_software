<script setup lang="ts">
import { onUnmounted, toRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { useGoodsReceiptExport } from '@/features/goods-receipts/composables/useGoodsReceiptExport'
import type { SupportedLocale } from '@/shared/i18n/locale'
import { getQuotationRuntime } from '@/shared/runtime/quotationRuntime'

import { useQuotationAutomationApis } from '../composables/useQuotationAutomationApis'
import { useQuotationEditor } from '../composables/useQuotationEditor'
import { useQuotationFileActions } from '../composables/useQuotationFileActions'
import { registerQuotationAgentApis } from '../services/quotationAutomationRegistration'

const props = defineProps<{
  uiLocale: SupportedLocale
}>()

const { t } = useI18n()
const runtime = getQuotationRuntime()
const editor = useQuotationEditor(toRef(props, 'uiLocale'))

function translateMessage(key: string, params?: Record<string, string | number>) {
  return params ? t(key, params) : t(key)
}

const fileActions = useQuotationFileActions({
  quotation: editor.quotation,
  itemSummaries: editor.itemSummaries,
  totals: editor.totals,
  runtime,
  saveCurrentQuotation: editor.saveCurrentQuotation,
  replaceQuotationDraft: editor.replaceQuotationDraft,
  replaceLineItems: editor.replaceLineItems,
  setLogoDataUrl: editor.setLogoDataUrl,
  t: translateMessage,
})
const goodsReceiptExport = useGoodsReceiptExport({
  quotation: editor.quotation,
  runtime,
  statusMessage: fileActions.statusMessage,
  saveCurrentQuotation: editor.saveCurrentQuotation,
  t: translateMessage,
})
const { legacyApi, apiV2 } = useQuotationAutomationApis({
  editor,
  fileActions,
  goodsReceiptExport,
  runtime,
  t: translateMessage,
})
const unregister = registerQuotationAgentApis(legacyApi, apiV2)

onUnmounted(unregister)
</script>

<template>
  <div hidden aria-hidden="true" />
</template>
