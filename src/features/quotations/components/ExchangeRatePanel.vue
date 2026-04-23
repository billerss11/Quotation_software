<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'

import type { CurrencyCode, ExchangeRateTable } from '../types'

const props = defineProps<{
  exchangeRates: ExchangeRateTable
  quotationCurrency: CurrencyCode
}>()

const emit = defineEmits<{
  updateRate: [currency: CurrencyCode, rate: number]
}>()

const currencies: CurrencyCode[] = ['USD', 'EUR', 'CNY', 'GBP']

function updateRate(currency: CurrencyCode, value: unknown) {
  const rate = typeof value === 'number' && Number.isFinite(value) ? value : 1
  emit('updateRate', currency, rate)
}
</script>

<template>
  <section class="exchange-panel" aria-label="Exchange rates">
    <div>
      <h2 class="section-title">Exchange Rates</h2>
      <p class="section-subtitle">1 cost currency equals this amount in {{ quotationCurrency }}.</p>
    </div>

    <div class="rate-grid">
      <label v-for="currency in currencies" :key="currency" class="rate-field">
        <span>{{ currency }} to {{ quotationCurrency }}</span>
        <InputNumber
          :model-value="exchangeRates[currency]"
          :min="0.000001"
          :min-fraction-digits="2"
          :max-fraction-digits="6"
          :disabled="currency === quotationCurrency"
          @update:model-value="updateRate(currency, $event)"
        />
      </label>
    </div>
  </section>
</template>

<style scoped>
.exchange-panel {
  display: grid;
  gap: 16px;
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

.section-subtitle {
  margin: 4px 0 0;
  color: #64748b;
}

.rate-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.rate-field {
  display: grid;
  gap: 7px;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.rate-field :deep(.p-inputnumber) {
  width: 100%;
}
</style>
