<script setup lang="ts">
import { computed } from 'vue'

import type { GoodsReceiptDraft } from '../utils/goodsReceipt'
import { createGoodsReceiptPdfRows, getGoodsReceiptTotalQuantity } from '../utils/goodsReceipt'
import CompactGoodsReceiptTemplate from '../templates/CompactGoodsReceiptTemplate.vue'
import StandardGoodsReceiptTemplate from '../templates/StandardGoodsReceiptTemplate.vue'

const props = defineProps<{
  draft: GoodsReceiptDraft
  branding: {
    logoDataUrl: string
    accentColor: string
  }
}>()

const templateComponents = {
  standard: StandardGoodsReceiptTemplate,
  compact: CompactGoodsReceiptTemplate,
}
const pdfRows = computed(() => createGoodsReceiptPdfRows(props.draft))
const totalQuantity = computed(() => getGoodsReceiptTotalQuantity(pdfRows.value))
const templateComponent = computed(() => templateComponents[props.draft.templateId])
</script>

<template>
  <component
    :is="templateComponent"
    :draft="props.draft"
    :rows="pdfRows"
    :total-quantity="totalQuantity"
    :branding="props.branding"
  />
</template>
