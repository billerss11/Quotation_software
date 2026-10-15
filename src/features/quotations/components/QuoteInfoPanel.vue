<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'

import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { SUPPORTED_LOCALES } from '@/shared/i18n/locale'

import QuotationTemplateSelector from './QuotationTemplateSelector.vue'
import ExpandableTextField from './ExpandableTextField.vue'
import type { QuotationHeader, QuotationOutputItemDetailLevel } from '../types'
import type { QuotationTemplateId } from '../templates/templateIds'
import { QUOTATION_OUTPUT_ITEM_DETAIL_LEVELS } from '../utils/quotationOutputSettings'

const props = defineProps<{
  header: QuotationHeader
  quotationCurrencyOptions: string[]
  historyRevealTarget?: string | null
  historyRevealTargetKey?: number
}>()

const templateId = defineModel<QuotationTemplateId>('templateId', { required: true })
const outputItemDetailLevel = defineModel<QuotationOutputItemDetailLevel>('outputItemDetailLevel', { required: true })
const emit = defineEmits<{
  updateHeaderField: [field: keyof QuotationHeader, value: QuotationHeader[keyof QuotationHeader]]
  openRevisions: []
}>()
const { t } = useI18n()

const documentLocaleOptions = computed<{ label: string; value: SupportedLocale }[]>(() =>
  SUPPORTED_LOCALES.map((value) => ({
    label: t(`common.locales.${value}`),
    value,
  })),
)
const outputItemDetailLevelOptions = computed<{ label: string; value: QuotationOutputItemDetailLevel }[]>(() =>
  QUOTATION_OUTPUT_ITEM_DETAIL_LEVELS.map((value) => ({
    label: t(`quotations.headerForm.outputItemDetailLevels.level${value}`),
    value,
  })),
)

const extrasExpanded = shallowRef(false)
const extrasStack = useTemplateRef<HTMLDivElement>('extrasStack')

async function toggleExtras() {
  extrasExpanded.value = !extrasExpanded.value
  if (!extrasExpanded.value) return

  await nextTick()
  extrasStack.value?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function updateHeaderField<K extends keyof QuotationHeader>(field: K, value: QuotationHeader[K]) {
  emit('updateHeaderField', field, value)
}

watch(
  () => [props.historyRevealTarget, props.historyRevealTargetKey] as const,
  ([target]) => {
    if (target === 'header:notes' || target === 'header:terms') {
      extrasExpanded.value = true
    }
  },
  { immediate: true },
)
</script>

<template>
  <section class="quote-info-panel" :aria-label="t('quotations.headerForm.aria')">
    <div class="form-section">
      <h2 class="section-title">{{ t('quotations.headerForm.quotationDetails') }}</h2>
      <div class="field-stack">
        <label class="field" data-history-target="header:quotationNumber">
          <span>{{ t('quotations.headerForm.quotationNumber') }}</span>
          <InputText :model-value="props.header.quotationNumber" @update:model-value="updateHeaderField('quotationNumber', String($event ?? ''))" />
        </label>
        <div class="field">
          <span>{{ t('quotations.headerForm.revision') }}</span>
          <div class="revision-controls">
            <strong>{{ t('quotations.revisions.revision', { number: props.header.revisionNumber ?? 1 }) }}</strong>
            <Button
              severity="secondary"
              text
              size="small"
              icon="pi pi-history"
              :label="t('quotations.revisions.manage')"
              @click="emit('openRevisions')"
            />
          </div>
        </div>
        <label class="field" data-history-target="header:quotationDate">
          <span>{{ t('quotations.headerForm.quotationDate') }}</span>
          <InputText :model-value="props.header.quotationDate" type="date" @update:model-value="updateHeaderField('quotationDate', String($event ?? ''))" />
        </label>
        <label class="field" data-history-target="header:projectName">
          <span>{{ t('quotations.headerForm.projectName') }}</span>
          <InputText :model-value="props.header.projectName" @update:model-value="updateHeaderField('projectName', String($event ?? ''))" />
        </label>
        <label class="field" data-history-target="header:documentLocale">
          <span>{{ t('quotations.headerForm.documentLanguage') }}</span>
          <Select :model-value="props.header.documentLocale" :options="documentLocaleOptions" option-label="label" option-value="value" @update:model-value="updateHeaderField('documentLocale', $event)" />
        </label>
        <QuotationTemplateSelector
          v-model="templateId"
          :label="t('quotations.headerForm.documentTemplate')"
        />
        <label class="field" data-history-target="quotation:outputSettings">
          <span>{{ t('quotations.headerForm.outputItemDetailLevel') }}</span>
          <Select
            v-model="outputItemDetailLevel"
            :options="outputItemDetailLevelOptions"
            option-label="label"
            option-value="value"
          />
        </label>
      </div>
    </div>

    <slot name="summary" />

    <div class="form-section">
      <h2 class="section-title">{{ t('quotations.headerForm.terms') }}</h2>
      <div class="field-stack">
        <label class="field" data-history-target="header:validityPeriod">
          <span>{{ t('quotations.headerForm.validityPeriod') }}</span>
          <InputText :model-value="props.header.validityPeriod" @update:model-value="updateHeaderField('validityPeriod', String($event ?? ''))" />
        </label>
        <label class="field" data-history-target="header:currency">
          <span>{{ t('quotations.headerForm.currency') }}</span>
          <Select
            :model-value="props.header.currency"
            :options="quotationCurrencyOptions"
            filter
            @update:model-value="updateHeaderField('currency', $event)"
          />
        </label>
      </div>
      <button type="button" class="extras-toggle" :aria-expanded="extrasExpanded" @click="toggleExtras">
        <i :class="extrasExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" aria-hidden="true" />
        {{ extrasExpanded ? t('quotations.headerForm.hideExtras') : t('quotations.headerForm.showExtras') }}
      </button>
      <div v-if="extrasExpanded" ref="extrasStack" class="field-stack extras-stack">
        <div class="field" data-history-target="header:notes">
          <span>{{ t('quotations.headerForm.notes') }}</span>
          <ExpandableTextField
            :model-value="props.header.notes"
            :input-aria-label="t('quotations.headerForm.notes')"
            :editor-title="t('quotations.headerForm.notes')"
            :rows="3"
            :auto-resize="false"
            @update:model-value="updateHeaderField('notes', $event)"
          />
        </div>
        <div class="field" data-history-target="header:terms">
          <span>{{ t('quotations.headerForm.termsAndConditions') }}</span>
          <ExpandableTextField
            :model-value="props.header.terms ?? ''"
            :input-aria-label="t('quotations.headerForm.termsAndConditions')"
            :editor-title="t('quotations.headerForm.termsAndConditions')"
            :rows="5"
            :auto-resize="false"
            @update:model-value="updateHeaderField('terms', $event)"
          />
        </div>
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
.field :deep(.p-select-label) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.field :deep(.p-textarea) {
  min-height: 72px;
  max-height: 180px;
  overflow-y: auto;
  resize: vertical;
}

.revision-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  min-height: 32px;
  text-transform: none;
  letter-spacing: 0;
}
</style>
