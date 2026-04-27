<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'

import { formatCurrency } from '@/shared/utils/formatters'

import type { CurrencyCode, DiscountMode, QuotationTotals, TotalsConfig } from '../types'

const model = defineModel<TotalsConfig>({ required: true })

defineProps<{
  totals: QuotationTotals
  currency: CurrencyCode
}>()

const discountModeOptions: { label: string; value: DiscountMode }[] = [
  { label: 'Percentage', value: 'percentage' },
  { label: 'Fixed amount', value: 'fixed' },
]
</script>

<template>
  <section class="totals-panel" aria-label="Quotation totals">
    <h2 class="section-title">Pricing</h2>

    <div class="controls-grid">
      <label class="field">
        <span>Global markup</span>
        <InputNumber v-model="model.globalMarkupRate" suffix="%" :min="0" :max="1000" :max-fraction-digits="2" />
      </label>
      <label class="field">
        <span>Discount mode</span>
        <Select v-model="model.discountMode" :options="discountModeOptions" option-label="label" option-value="value" />
      </label>
      <label class="field">
        <span>Discount value</span>
        <InputNumber v-model="model.discountValue" :min="0" :max="model.discountMode === 'percentage' ? 100 : undefined" :max-fraction-digits="2" />
      </label>
      <label class="field">
        <span>Tax / VAT</span>
        <InputNumber v-model="model.taxRate" suffix="%" :min="0" :max="100" :max-fraction-digits="2" />
      </label>
    </div>

    <dl class="totals-list">
      <div>
        <dt>Total cost</dt>
        <dd>{{ formatCurrency(totals.baseSubtotal, currency) }}</dd>
      </div>
      <div class="row-additive">
        <dt>+ Markup</dt>
        <dd>{{ formatCurrency(totals.markupAmount, currency) }}</dd>
      </div>
      <div class="row-deductive">
        <dt>− Discount</dt>
        <dd>{{ formatCurrency(totals.discountAmount, currency) }}</dd>
      </div>
      <div class="row-result">
        <dt>Price before tax</dt>
        <dd>{{ formatCurrency(totals.taxableSubtotal, currency) }}</dd>
      </div>
      <div class="row-additive">
        <dt>+ Tax / VAT</dt>
        <dd>{{ formatCurrency(totals.taxAmount, currency) }}</dd>
      </div>
      <div class="grand-total">
        <dt>Total</dt>
        <dd>{{ formatCurrency(totals.grandTotal, currency) }}</dd>
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
