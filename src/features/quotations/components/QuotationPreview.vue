<script setup lang="ts">
import { computed } from 'vue'

import { getQuotationTemplateDefinition } from '../templates/registry'
import type { QuotationTemplateProps } from '../templates/types'
import {
  getQuotationDocumentOrientation,
  getQuotationDocumentPageSizePx,
} from '../utils/quotationDocumentPage'

const props = defineProps<QuotationTemplateProps>()

const templateDefinition = computed(() => getQuotationTemplateDefinition(props.quotation.templateId))
const documentStyle = computed(() => {
  const pageSize = getQuotationDocumentPageSizePx(getQuotationDocumentOrientation(props.quotation))

  return {
    '--brand-accent': props.quotation.branding.accentColor,
    '--quotation-page-width': `${pageSize.width}px`,
    '--quotation-page-min-height': `${pageSize.height}px`,
  }
})
</script>

<template>
  <component
    :is="templateDefinition.component"
    v-bind="props"
    :style="documentStyle"
  />
</template>
