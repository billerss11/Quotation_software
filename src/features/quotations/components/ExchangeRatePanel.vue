<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ExchangeRateTable } from '../types'
import { parseCurrencyCode, sortCurrencyCodes } from '../utils/currencyCodes'

const props = defineProps<{
  exchangeRates: ExchangeRateTable
  quotationCurrency: string
}>()

const emit = defineEmits<{
  updateRate: [currency: string, rate: number]
  addCurrency: [currency: string]
  removeCurrency: [currency: string]
}>()

const { t } = useI18n()
const addingCurrency = shallowRef(false)
const newCurrencyInput = shallowRef('')
const currencies = computed(() =>
  sortCurrencyCodes(Object.keys(props.exchangeRates), props.quotationCurrency),
)

function updateRate(currency: string, value: unknown) {
  const rate = typeof value === 'number' && Number.isFinite(value) ? value : 1
  emit('updateRate', currency, rate)
}

function confirmAdd() {
  const rawCurrency = newCurrencyInput.value.trim().toUpperCase()

  if (!rawCurrency) {
    return
  }

  emit('addCurrency', parseCurrencyCode(rawCurrency) ?? rawCurrency)
  newCurrencyInput.value = ''
  addingCurrency.value = false
}

function cancelAdd() {
  newCurrencyInput.value = ''
  addingCurrency.value = false
}
</script>

<template>
  <section class="exchange-panel" :aria-label="t('quotations.exchangeRates.aria')">
    <div>
      <h2 class="section-title">{{ t('quotations.exchangeRates.title') }}</h2>
      <p class="section-subtitle">{{ t('quotations.exchangeRates.subtitle', { currency: quotationCurrency }) }}</p>
    </div>

    <div class="rate-list">
      <div v-for="currency in currencies" :key="currency" class="rate-row">
        <span class="currency-label">{{ currency }}</span>
        <span class="pair-label">{{ t('quotations.exchangeRates.pair', { source: currency, currency: quotationCurrency }) }}</span>
        <InputNumber
          class="rate-input"
          :model-value="exchangeRates[currency]"
          :min="0.000001"
          :max="1000000"
          :min-fraction-digits="2"
          :max-fraction-digits="6"
          :disabled="currency === quotationCurrency"
          @update:model-value="updateRate(currency, $event)"
        />
        <Button
          v-if="currency !== quotationCurrency"
          text
          severity="secondary"
          size="small"
          icon="pi pi-times"
          :aria-label="t('quotations.exchangeRates.removeAria', { currency })"
          @click="emit('removeCurrency', currency)"
        />
        <span v-else class="base-badge">{{ t('quotations.exchangeRates.baseBadge') }}</span>
      </div>
    </div>

    <div v-if="addingCurrency" class="add-row">
      <InputText
        v-model="newCurrencyInput"
        :placeholder="t('quotations.exchangeRates.addPlaceholder')"
        class="add-input"
        @keyup.enter="confirmAdd"
        @keyup.escape="cancelAdd"
      />
      <Button size="small" :label="t('quotations.exchangeRates.confirmAdd')" @click="confirmAdd" />
      <Button size="small" text severity="secondary" :label="t('quotations.exchangeRates.cancelAdd')" @click="cancelAdd" />
    </div>

    <Button
      v-if="!addingCurrency"
      text
      size="small"
      icon="pi pi-plus"
      :label="t('quotations.exchangeRates.addCurrency')"
      @click="addingCurrency = true"
    />
  </section>
</template>

<style scoped>
.exchange-panel {
  display: grid;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-card);
  box-shadow: var(--shadow-control);
}

.section-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 20px;
}

.section-subtitle {
  margin: 4px 0 0;
  color: var(--text-muted);
}

.rate-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rate-row {
  display: grid;
  grid-template-columns: 3rem 1fr minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.currency-label {
  font-weight: 700;
  font-size: 13px;
  color: var(--text-strong);
}

.pair-label {
  font-size: 12px;
  color: var(--text-muted);
}

.rate-input {
  width: 100%;
}

.rate-input :deep(.p-inputnumber) {
  width: 100%;
}

.base-badge {
  font-size: 11px;
  color: var(--text-muted);
  padding: 2px 6px;
  border: 1px solid var(--surface-border);
  border-radius: 4px;
}

.add-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-input {
  width: 7rem;
}

@media (max-width: 640px) {
  .rate-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .add-row {
    flex-wrap: wrap;
  }
}
</style>
