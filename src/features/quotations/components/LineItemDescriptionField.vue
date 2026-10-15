<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ExpandableTextField from './ExpandableTextField.vue'

const model = defineModel<string>({ required: true })
const props = defineProps<{
  historyTarget: string
  inputAriaLabel: string
  itemNumber: string
  placeholder: string
}>()
const emit = defineEmits<{
  blur: []
}>()
const { t } = useI18n()
</script>

<template>
  <ExpandableTextField
    v-model="model"
    :history-target="props.historyTarget"
    :input-aria-label="props.inputAriaLabel"
    :placeholder="props.placeholder"
    :editor-title="t('quotations.lineItems.descriptionEditor.title', { itemNumber: props.itemNumber })"
    :editor-hint="t('quotations.lineItems.descriptionEditor.hint')"
    :expand-aria-label="t('quotations.lineItems.descriptionEditor.openAria', { itemNumber: props.itemNumber })"
    @blur="emit('blur')"
  />
</template>
