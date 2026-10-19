<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'
import { shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationHeader } from '../types'
import type { QuotationExcelExportMode } from '../utils/quotationExcelExport'

const props = defineProps<{
  visible: boolean
  header: QuotationHeader
  busy: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  export: [mode: QuotationExcelExportMode]
}>()

const { t } = useI18n()
const mode = shallowRef<QuotationExcelExportMode>('customer')
const modes = ['customer', 'internal'] as const

watch(() => props.visible, (visible) => {
  if (visible) mode.value = 'customer'
})

function setVisible(visible: boolean) {
  if (!props.busy) emit('update:visible', visible)
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    modal
    :header="t('quotations.excel.title')"
    :style="{ width: '440px' }"
    :breakpoints="{ '480px': '94vw' }"
    :closable="!props.busy"
    :close-on-escape="!props.busy"
    :close-button-props="{ 'aria-label': t('quotations.excel.cancel') }"
    @update:visible="setVisible"
  >
    <p class="export-context" translate="no">
      {{ t('quotations.excel.context', { number: props.header.quotationNumber, revision: props.header.revisionNumber ?? 1, currency: props.header.currency }) }}
    </p>
    <fieldset class="export-options" :disabled="props.busy">
      <legend class="export-legend">{{ t('quotations.excel.audience') }}</legend>
      <label v-for="option in modes" :key="option" class="export-option" :class="{ selected: mode === option }" :for="`excel-${option}`">
        <RadioButton v-model="mode" :input-id="`excel-${option}`" name="excel-mode" :value="option" :disabled="props.busy" />
        <span>
          <strong>{{ t(`quotations.excel.${option}`) }}</strong>
          <small>{{ t(`quotations.excel.${option}Description`) }}</small>
        </span>
      </label>
    </fieldset>
    <Message v-if="props.error" severity="error" :closable="false" class="export-error">{{ props.error }}</Message>
    <template #footer>
      <Button :label="t('quotations.excel.cancel')" severity="secondary" text :disabled="props.busy" @click="setVisible(false)" />
      <Button :label="t('quotations.excel.export')" icon="pi pi-file-excel" :loading="props.busy" :disabled="props.busy" @click="emit('export', mode)" />
    </template>
  </Dialog>
</template>

<style scoped>
.export-context { margin: 0 0 18px; color: var(--text-muted); font-size: 13px; }
.export-options { display: grid; gap: 10px; margin: 0; padding: 0; border: 0; }
.export-legend { margin-bottom: 10px; color: var(--text-body); font-size: 13px; font-weight: 600; }
.export-option { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border: 1px solid var(--surface-border); border-radius: var(--radius-md); cursor: pointer; }
.export-option.selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 5%, var(--surface-card)); }
.export-option strong { display: block; color: var(--text-strong); font-size: 14px; }
.export-option small { display: block; margin-top: 4px; color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.export-error { margin-top: 14px; }
</style>
