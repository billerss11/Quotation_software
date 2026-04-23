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
        <InputNumber v-model="model.globalMarkupRate" suffix="%" :min="0" :max-fraction-digits="2" />
      </label>
      <label class="field">
        <span>Discount mode</span>
        <Select v-model="model.discountMode" :options="discountModeOptions" option-label="label" option-value="value" />
      </label>
      <label class="field">
        <span>Discount value</span>
        <InputNumber v-model="model.discountValue" :min="0" :max-fraction-digits="2" />
      </label>
      <label class="field">
        <span>Tax / VAT</span>
        <InputNumber v-model="model.taxRate" suffix="%" :min="0" :max-fraction-digits="2" />
      </label>
    </div>

    <dl class="totals-list">
      <div>
        <dt>Base subtotal</dt>
        <dd>{{ formatCurrency(totals.baseSubtotal, currency) }}</dd>
      </div>
      <div>
        <dt>Markup</dt>
        <dd>{{ formatCurrency(totals.markupAmount, currency) }}</dd>
      </div>
      <div>
        <dt>Discount</dt>
        <dd>-{{ formatCurrency(totals.discountAmount, currency) }}</dd>
      </div>
      <div>
        <dt>Taxable subtotal</dt>
        <dd>{{ formatCurrency(totals.taxableSubtotal, currency) }}</dd>
      </div>
      <div>
        <dt>Tax</dt>
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
  padding: 20px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: #ffffff;
}

.section-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 20px;
}

.controls-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.field {
  display: grid;
  gap: 7px;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.field :deep(.p-inputnumber),
.field :deep(.p-select) {
  width: 100%;
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
  color: #64748b;
}

.totals-list dd {
  margin: 0;
  color: var(--text-strong);
  font-weight: 750;
}

.grand-total {
  margin-top: 6px;
  padding-top: 14px;
  border-top: 1px solid var(--surface-border);
  font-size: 20px;
}
</style>
