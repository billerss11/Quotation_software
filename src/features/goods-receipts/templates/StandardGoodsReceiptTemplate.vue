<script setup lang="ts">
import type { GoodsReceiptDraft, GoodsReceiptPdfRow, GoodsReceiptTotalQuantity } from '../utils/goodsReceipt'
import GoodsReceiptDocumentTemplate from './GoodsReceiptDocumentTemplate.vue'

defineProps<{
  draft: GoodsReceiptDraft
  rows: GoodsReceiptPdfRow[]
  totalQuantity: GoodsReceiptTotalQuantity | null
  branding: {
    logoDataUrl: string
    accentColor: string
  }
}>()
</script>

<template>
  <GoodsReceiptDocumentTemplate
    :draft="draft"
    :rows="rows"
    :total-quantity="totalQuantity"
    :branding="branding"
    variant="standard"
  />
</template>
