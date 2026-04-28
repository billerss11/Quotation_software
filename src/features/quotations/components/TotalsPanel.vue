<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency } from '@/shared/utils/formatters'

import type { CurrencyCode, DiscountMode, QuotationTotals, TotalsConfig } from '../types'

const props = defineProps<{
  totals: QuotationTotals
  currency: CurrencyCode
}>()

const model = defineModel<TotalsConfig>({ required: true })
const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
const discountModeOptions = computed<{ label: string; value: DiscountMode }[]>(() => [
  { label: t('quotations.totals.discountModes.percentage'), value: 'percentage' },
  { label: t('quotations.totals.discountModes.fixed'), value: 'fixed' },
])
</script>

<template>
  <section class="totals-panel" :aria-label="t('quotations.totals.aria')">
    <h2 class="section-title">{{ t('quotations.totals.title') }}</h2>

    <div class="controls-grid">
      <label class="field">
        <span>{{ t('quotations.totals.globalMarkup') }}</span>
        <InputNumber v-model="model.globalMarkupRate" suffix="%" :min="0" :max="1000" :max-fraction-digits="2" />
      </label>
      <label class="field">
        <span>{{ t('quotations.totals.discountMode') }}</span>
        <Select v-model="model.discountMode" :options="discountModeOptions" option-label="label" option-value="value" />
      </label>
      <label class="field">
        <span>{{ t('quotations.totals.discountValue') }}</span>
        <InputNumber v-model="model.discountValue" :min="0" :max="model.discountMode === 'percentage' ? 100 : undefined" :max-fraction-digits="2" />
      </label>
      <label class="field">
        <span>{{ t('quotations.totals.tax') }}</span>
        <InputNumber v-model="model.taxRate" suffix="%" :min="0" :max="100" :max-fraction-digits="2" />
      </label>
    </div>

    <dl class="totals-list">
      <div>
        <dt>{{ t('quotations.totals.totalCost') }}</dt>
        <dd>{{ formatCurrency(props.totals.baseSubtotal, props.currency, currentLocale) }}</dd>
      </div>
      <div class="row-additive">
        <dt>{{ t('quotations.totals.markup') }}</dt>
        <dd>{{ formatCurrency(props.totals.markupAmount, props.currency, currentLocale) }}</dd>
      </div>
      <div class="row-deductive">
        <dt>{{ t('quotations.totals.discount') }}</dt>
        <dd>{{ formatCurrency(props.totals.discountAmount, props.currency, currentLocale) }}</dd>
      </div>
      <div class="row-result">
        <dt>{{ t('quotations.totals.priceBeforeTax') }}</dt>
        <dd>{{ formatCurrency(props.totals.taxableSubtotal, props.currency, currentLocale) }}</dd>
      </div>
      <div class="row-additive">
        <dt>{{ t('quotations.totals.taxLine') }}</dt>
        <dd>{{ formatCurrency(props.totals.taxAmount, props.currency, currentLocale) }}</dd>
      </div>
      <div class="grand-total">
        <dt>{{ t('quotations.totals.total') }}</dt>
        <dd>{{ formatCurrency(props.totals.grandTotal, props.currency, currentLocale) }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.totals-panel {
  display: grid;
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-card);
  box-shadow: var(--shadow-control);
}

.section-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.controls-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  align-items: start;
}

.field {
  display: grid;
  gap: 7px;
  min-width: 0;
  color: var(--text-body);
  font-size: 13px;
  font-weight: 700;
}

.field :deep(.p-inputnumber),
.field :deep(.p-select) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.field :deep(.p-inputnumber-input),
.field :deep(.p-select-label) {
  min-width: 0;
}

.totals-list {
  display: grid;
  gap: 10px;
  margin: 0;
}

.totals-list div {
  display: flex;
  justify-content: space-between;
  gap: 18px;
}

.totals-list dt {
  color: var(--text-muted);
}

.totals-list dd {
  margin: 0;
  color: var(--text-strong);
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.row-additive dt {
  color: var(--accent);
}

.row-additive dd {
  color: var(--accent);
}

.row-deductive dt {
  color: var(--warning);
}

.row-deductive dd {
  color: var(--warning);
}

.row-result {
  padding-top: 8px;
  border-top: 1px dashed var(--surface-border);
}

.row-result dt {
  color: var(--text-body);
  font-weight: 700;
}

.grand-total {
  margin-top: 6px;
  padding-top: 14px;
  border-top: 2px solid var(--surface-border);
  font-size: 20px;
  align-items: baseline;
}
</style>
