<script setup lang="ts">
import Select from 'primevue/select'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  DEFAULT_QUOTATION_TEMPLATE_ID,
  QUOTATION_TEMPLATE_OPTIONS,
} from '../templates/templateIds'
import type { QuotationTemplateId } from '../templates/templateIds'

withDefaults(defineProps<{
  inputId?: string
  label?: string
  compact?: boolean
}>(), {
  inputId: 'quotation-template-select',
  label: '',
  compact: false,
})

const model = defineModel<QuotationTemplateId>({ default: DEFAULT_QUOTATION_TEMPLATE_ID })
const { t } = useI18n()

const templateOptions = computed(() =>
  QUOTATION_TEMPLATE_OPTIONS.map((option) => ({
    label: t(option.labelKey),
    value: option.id,
    description: t(option.descriptionKey),
  })),
)
</script>

<template>
  <label :class="['template-selector', { 'template-selector-compact': compact }]">
    <span v-if="label" class="template-selector-label">{{ label }}</span>
    <Select
      v-model="model"
      :input-id="inputId"
      :options="templateOptions"
      option-label="label"
      option-value="value"
      class="template-selector-control"
    >
      <template #option="{ option }">
        <div class="template-option">
          <strong>{{ option.label }}</strong>
          <span>{{ option.description }}</span>
        </div>
      </template>
    </Select>
  </label>
</template>

<style scoped>
.template-selector {
  display: grid;
  gap: 4px;
  min-width: 0;
  color: var(--text-body);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.template-selector-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-selector-control {
  width: 100%;
  min-width: 0;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}

.template-selector-compact {
  min-width: 180px;
  text-transform: none;
  letter-spacing: 0;
}

.template-selector-compact .template-selector-control {
  width: 180px;
}

.template-option {
  display: grid;
  gap: 2px;
}

.template-option strong {
  color: var(--text-strong);
  font-size: 13px;
}

.template-option span {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.25;
}
</style>
