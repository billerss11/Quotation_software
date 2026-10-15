<script setup lang="ts">
import { computed } from 'vue'
import Select from 'primevue/select'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/shared/i18n/locale'
import type { QuotationOutputItemDetailLevel } from '../types'
import type { QuotationTemplateId } from '../templates/templateIds'
import { QUOTATION_OUTPUT_ITEM_DETAIL_LEVELS } from '../utils/quotationOutputSettings'
import QuotationTemplateSelector from './QuotationTemplateSelector.vue'

const templateId = defineModel<QuotationTemplateId>('templateId', { required: true })
const outputItemDetailLevel = defineModel<QuotationOutputItemDetailLevel>('outputItemDetailLevel', { required: true })
const documentLocale = defineModel<SupportedLocale>('documentLocale', { required: true })
const { t } = useI18n()
const localeOptions = computed(() => SUPPORTED_LOCALES.map(value => ({ label: t(`common.locales.${value}`), value })))
const detailOptions = computed(() => QUOTATION_OUTPUT_ITEM_DETAIL_LEVELS.map(value => ({ label: t(`quotations.headerForm.outputItemDetailLevels.level${value}`), value })))
</script>

<template>
  <section class="document-settings" :aria-label="t('workspace.documentSettings')">
    <h2>{{ t('workspace.documentSettings') }}</h2>
    <div data-history-target="quotation:templateId"><QuotationTemplateSelector v-model="templateId" :label="t('quotations.headerForm.documentTemplate')" /></div>
    <label class="document-field" data-history-target="header:documentLocale">
      <span>{{ t('quotations.headerForm.documentLanguage') }}</span>
      <Select v-model="documentLocale" :options="localeOptions" option-label="label" option-value="value" />
    </label>
    <label class="document-field" data-history-target="quotation:outputSettings">
      <span>{{ t('quotations.headerForm.outputItemDetailLevel') }}</span>
      <Select v-model="outputItemDetailLevel" :options="detailOptions" option-label="label" option-value="value" />
    </label>
    <div class="document-summary-settings"><slot /></div>
  </section>
</template>

<style scoped>
.document-settings { display: grid; align-content: start; gap: 20px; }
.document-settings h2 { margin: 0; font-size: 16px; font-weight: 650; color: var(--text-strong); }
.document-field { display: grid; gap: 7px; color: var(--text-body); font-size: 12px; font-weight: 600; }
.document-summary-settings { border-top: 1px solid var(--surface-border); padding-top: 20px; }
.document-settings :deep(.p-select) { width: 100%; min-width: 0; }
</style>
