<script setup lang="ts">
import { computed } from 'vue'

import { getQuotationTemplateDefinition } from '../templates/registry'
import type { QuotationTemplateProps } from '../templates/types'

const props = defineProps<QuotationTemplateProps>()

const templateDefinition = computed(() => getQuotationTemplateDefinition(props.quotation.templateId))
</script>

<template>
  <component
    :is="templateDefinition.component"
    v-bind="props"
  />
</template>
