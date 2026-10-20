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
  min-width: 0;
  gap: 24px;
  container-type: inline-size;
}

.form-section {
  display: grid;
  min-width: 0;
  gap: 14px;
}

.form-section:last-child {
  padding-top: 22px;
  border-top: 1px solid var(--surface-border);
}

.section-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.4;
}

.field-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  min-width: 0;
  gap: 16px;
}

.field,
.quote-info-panel :deep(.template-selector) {
  display: grid;
  min-width: 0;
  gap: 6px;
  color: var(--text-body);
  font-size: 12px;
  font-weight: 550;
  line-height: 1.4;
  text-transform: none;
  letter-spacing: 0;
}

.field :deep(.p-inputtext),
.field :deep(.p-select),
.field :deep(.p-textarea),
.quote-info-panel :deep(.template-selector-control.p-select) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: 36px;
  border-color: var(--surface-border);
  font-size: 13px;
  font-weight: 400;
  box-shadow: none;
}

.field :deep(.p-inputtext),
.field :deep(.p-textarea),
.field :deep(.p-select-label),
.quote-info-panel :deep(.template-selector-control .p-select-label) {
  padding: 8px 10px;
  font-size: 13px;
}

.field :deep(.p-inputtext),
.field :deep(.p-select-label) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.field :deep(.p-textarea) {
  min-height: 88px;
  max-height: 220px;
  overflow-y: auto;
  resize: vertical;
}

.revision-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  min-height: 36px;
  gap: 6px 10px;
}

.revision-controls strong {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 550;
}

.revision-controls :deep(.p-button) {
  min-height: 36px;
  padding: 6px 0;
  font-size: 12px;
  box-shadow: none;
}

.extras-toggle {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  min-height: 36px;
  gap: 8px;
  padding: 6px 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 550;
  cursor: pointer;
}

.extras-toggle:hover {
  color: var(--accent-hover);
}

.extras-toggle:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}

.extras-toggle i {
  font-size: 11px;
}

.extras-stack {
  margin-top: 2px;
}

@container (min-width: 560px) {
  .field-stack {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px 20px;
  }

  .field[data-history-target="header:projectName"] {
    grid-column: 1 / -1;
  }
}
</style>
