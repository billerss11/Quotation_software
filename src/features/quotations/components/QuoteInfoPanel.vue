<script setup lang="ts">
import { computed, shallowRef } from 'vue'

import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { SUPPORTED_LOCALES } from '@/shared/i18n/locale'

import type { QuotationHeader } from '../types'

defineProps<{
  quotationCurrencyOptions: string[]
}>()

const model = defineModel<QuotationHeader>({ required: true })
const { t } = useI18n()

const documentLocaleOptions = computed<{ label: string; value: SupportedLocale }[]>(() =>
  SUPPORTED_LOCALES.map((value) => ({
    label: t(`common.locales.${value}`),
    value,
  })),
)

const extrasExpanded = shallowRef(false)
</script>

<template>
  <section class="quote-info-panel" :aria-label="t('quotations.headerForm.aria')">
    <div class="form-section">
      <h2 class="section-title">{{ t('quotations.headerForm.quotationDetails') }}</h2>
      <div class="field-stack">
        <label class="field">
          <span>{{ t('quotations.headerForm.quotationNumber') }}</span>
          <InputText v-model="model.quotationNumber" />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.revision') }}</span>
          <InputNumber v-model="model.revisionNumber" :min="1" :max-fraction-digits="0" prefix="Rev. " />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.quotationDate') }}</span>
          <InputText v-model="model.quotationDate" type="date" />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.projectName') }}</span>
          <InputText v-model="model.projectName" />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.documentLanguage') }}</span>
          <Select v-model="model.documentLocale" :options="documentLocaleOptions" option-label="label" option-value="value" />
        </label>
      </div>
    </div>

    <div class="form-section">
      <h2 class="section-title">{{ t('quotations.headerForm.terms') }}</h2>
      <div class="field-stack">
        <label class="field">
          <span>{{ t('quotations.headerForm.validityPeriod') }}</span>
          <InputText v-model="model.validityPeriod" />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.currency') }}</span>
          <Select v-model="model.currency" :options="quotationCurrencyOptions" />
        </label>
      </div>
      <button type="button" class="extras-toggle" @click="extrasExpanded = !extrasExpanded">
        <i :class="extrasExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" aria-hidden="true" />
        {{ extrasExpanded ? t('quotations.headerForm.hideExtras') : t('quotations.headerForm.showExtras') }}
      </button>
      <div v-show="extrasExpanded" class="field-stack extras-stack">
        <label class="field">
          <span>{{ t('quotations.headerForm.notes') }}</span>
          <Textarea v-model="model.notes" rows="3" auto-resize />
        </label>
        <label class="field">
          <span>{{ t('quotations.headerForm.termsAndConditions') }}</span>
          <Textarea v-model="model.terms" rows="5" auto-resize />
        </label>
      </div>
    </div>
  </section>
</template>

<style scoped>
.quote-info-panel {
  display: grid;
  gap: 14px;
}

.form-section {
  display: grid;
  gap: 8px;
}

.form-section + .form-section {
  padding-top: 12px;
  border-top: 1px solid var(--surface-border);
}

.section-title {
  margin: 0;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.extras-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.13s ease;
}

.extras-toggle:hover {
  color: var(--text-body);
}

.extras-toggle i {
  font-size: 10px;
}

.extras-stack {
  margin-top: 4px;
}

.field-stack {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.field {
  display: grid;
  gap: 4px;
  min-width: 0;
  color: var(--text-body);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field :deep(.p-inputtext),
.field :deep(.p-select),
.field :deep(.p-textarea) {
  width: 100%;
  min-width: 0;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}

.field :deep(.p-inputtext),
.field :deep(.p-select-label),
.field :deep(.p-textarea) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.field :deep(.p-textarea) {
  min-height: 72px;
  resize: vertical;
}
</style>
