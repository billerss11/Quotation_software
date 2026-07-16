<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import { computed, nextTick, onUnmounted, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatIsoDate } from '@/shared/utils/formatters'

import { useBufferedFieldValues } from '../composables/useBufferedFieldValues'
import { fetchLatestExchangeRates } from '../services/onlineExchangeRates'
import type { ExchangeRateTable } from '../types'
import { getSupportedCurrencyCodes, sortCurrencyCodes } from '../utils/currencyCodes'

interface CurrencyOption {
  label: string
  value: string
}

const props = defineProps<{
  exchangeRates: ExchangeRateTable
  quotationCurrency: string
}>()

const emit = defineEmits<{
  updateRate: [currency: string, rate: number]
  updateRates: [rates: ExchangeRateTable]
  addCurrency: [currency: string]
  removeCurrency: [currency: string]
}>()

const { t, locale } = useI18n()
const addingCurrency = shallowRef(false)
const selectedCurrency = shallowRef<string | null>(null)
const isFetchingRates = shallowRef(false)
const onlineRateDate = shallowRef('')
const onlineRateFetchFailed = shallowRef(false)
const missingOnlineCurrencies = shallowRef<string[]>([])
let onlineRateRequestKey = 0
const currencies = computed(() =>
  sortCurrencyCodes(Object.keys(props.exchangeRates), props.quotationCurrency),
)
const canFetchRates = computed(() =>
  currencies.value.some((currency) => currency !== props.quotationCurrency),
)
const formattedOnlineRateDate = computed(() =>
  onlineRateDate.value
    ? formatIsoDate(onlineRateDate.value, locale.value as SupportedLocale)
    : '',
)
const missingOnlineCurrencyList = computed(() => missingOnlineCurrencies.value.join(', '))
const currencyDisplayNames = computed(() =>
  typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames([locale.value], { type: 'currency' })
    : null,
)
const availableCurrencyOptions = computed<CurrencyOption[]>(() => {
  const activeCurrencies = new Set(currencies.value)

  return getSupportedCurrencyCodes()
    .filter((currency) => !activeCurrencies.has(currency))
    .map((currency) => ({
      label: formatCurrencyOption(currency),
      value: currency,
    }))
})
const {
  getBufferedValue,
  queueBufferedValue,
  flushBufferedValue,
  flushBufferedValues,
} = useBufferedFieldValues((key, value) => {
  const currency = key.replace(/^rate:/, '')
  emit('updateRate', currency, normalizeRateValue(value))
})

function updateRate(currency: string, value: unknown) {
  invalidateOnlineRateRequest()
  queueBufferedValue(getRateBufferKey(currency), normalizeRateValue(value))
}

function confirmAdd() {
  flushBufferedValues()

  if (!selectedCurrency.value) {
    return
  }

  invalidateOnlineRateRequest()
  emit('addCurrency', selectedCurrency.value)
  selectedCurrency.value = null
  addingCurrency.value = false
}

function cancelAdd() {
  selectedCurrency.value = null
  addingCurrency.value = false
}

function formatCurrencyOption(currency: string) {
  const name = currencyDisplayNames.value?.of(currency)

  return name && name !== currency ? `${currency} - ${name}` : currency
}

function removeCurrency(currency: string) {
  flushBufferedValues()
  invalidateOnlineRateRequest()
  emit('removeCurrency', currency)
}

async function fetchOnlineRates() {
  if (isFetchingRates.value || !canFetchRates.value) {
    return
  }

  flushBufferedValues()
  isFetchingRates.value = true
  clearOnlineRateStatus()
  const requestKey = ++onlineRateRequestKey
  const requestedBaseCurrency = props.quotationCurrency
  const requestedExchangeRates = props.exchangeRates
  const requestedExchangeRatesSnapshot = { ...requestedExchangeRates }

  try {
    const result = await fetchLatestExchangeRates(requestedBaseCurrency, currencies.value)
    if (!isOnlineRateRequestCurrent(
      requestKey,
      requestedBaseCurrency,
      requestedExchangeRates,
      requestedExchangeRatesSnapshot,
    )) {
      return
    }

    emit('updateRates', result.rates)
    await nextTick()
    onlineRateDate.value = result.date
    missingOnlineCurrencies.value = result.missingCurrencies
  } catch {
    if (isOnlineRateRequestCurrent(
      requestKey,
      requestedBaseCurrency,
      requestedExchangeRates,
      requestedExchangeRatesSnapshot,
    )) {
      onlineRateFetchFailed.value = true
    }
  } finally {
    isFetchingRates.value = false
  }
}

function invalidateOnlineRateRequest() {
  onlineRateRequestKey += 1
  clearOnlineRateStatus()
}

function isOnlineRateRequestCurrent(
  requestKey: number,
  baseCurrency: string,
  exchangeRates: ExchangeRateTable,
  exchangeRatesSnapshot: ExchangeRateTable,
) {
  return (
    requestKey === onlineRateRequestKey
    && props.quotationCurrency === baseCurrency
    && props.exchangeRates === exchangeRates
    && haveSameExchangeRates(props.exchangeRates, exchangeRatesSnapshot)
  )
}

function haveSameExchangeRates(left: ExchangeRateTable, right: ExchangeRateTable) {
  const leftCurrencies = Object.keys(left)
  const rightCurrencies = Object.keys(right)

  return (
    leftCurrencies.length === rightCurrencies.length
    && leftCurrencies.every((currency) => Object.is(left[currency], right[currency]))
  )
}

function clearOnlineRateStatus() {
  onlineRateDate.value = ''
  onlineRateFetchFailed.value = false
  missingOnlineCurrencies.value = []
}

function getRateBufferKey(currency: string) {
  return `rate:${currency}`
}

function getRateValue(currency: string) {
  return getBufferedValue(getRateBufferKey(currency), props.exchangeRates[currency] ?? 1)
}

function flushRate(currency: string) {
  flushBufferedValue(getRateBufferKey(currency))
}

function normalizeRateValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 1
}

watch(
  [() => props.quotationCurrency, () => props.exchangeRates],
  clearOnlineRateStatus,
)

onUnmounted(() => {
  onlineRateRequestKey += 1
})
</script>

<template>
  <section class="exchange-panel" :aria-label="t('quotations.exchangeRates.aria')">
    <div>
      <h2 class="section-title">{{ t('quotations.exchangeRates.title') }}</h2>
      <p class="section-subtitle">{{ t('quotations.exchangeRates.subtitle', { currency: quotationCurrency }) }}</p>
    </div>

    <div class="online-rate-toolbar">
      <Button
        size="small"
        icon="pi pi-refresh"
        :label="t('quotations.exchangeRates.fetchLatest')"
        :loading="isFetchingRates"
        :disabled="!canFetchRates"
        @click="fetchOnlineRates"
      />
      <span class="online-rate-source">{{ t('quotations.exchangeRates.onlineSource') }}</span>
    </div>
    <p v-if="onlineRateFetchFailed" class="online-rate-status online-rate-error" role="alert">
      {{ t('quotations.exchangeRates.fetchError') }}
    </p>
    <p v-else-if="formattedOnlineRateDate" class="online-rate-status">
      {{ t('quotations.exchangeRates.fetchedDate', { date: formattedOnlineRateDate }) }}
    </p>
    <p v-if="missingOnlineCurrencyList" class="online-rate-status online-rate-warning">
      {{ t('quotations.exchangeRates.missingOnlineRates', { currencies: missingOnlineCurrencyList }) }}
    </p>

    <div class="rate-list">
      <div
        v-for="currency in currencies"
        :key="currency"
        class="rate-row"
        :data-history-target="`exchangeRate:${currency}`"
      >
        <span class="currency-label">{{ currency }}</span>
        <span class="pair-label">{{ t('quotations.exchangeRates.pair', { source: currency, currency: quotationCurrency }) }}</span>
        <InputNumber
          class="rate-input"
          :model-value="getRateValue(currency)"
          :min="0.000001"
          :max="1000000"
          :min-fraction-digits="2"
          :max-fraction-digits="6"
          :disabled="currency === quotationCurrency"
          @update:model-value="updateRate(currency, $event)"
          @blur="flushRate(currency)"
        />
        <Button
          v-if="currency !== quotationCurrency"
          text
          severity="secondary"
          size="small"
          icon="pi pi-times"
          :aria-label="t('quotations.exchangeRates.removeAria', { currency })"
          @click="removeCurrency(currency)"
        />
        <span v-else class="base-badge">{{ t('quotations.exchangeRates.baseBadge') }}</span>
      </div>
    </div>

    <div v-if="addingCurrency" class="add-row">
      <Select
        v-model="selectedCurrency"
        :options="availableCurrencyOptions"
        option-label="label"
        option-value="value"
        filter
        class="currency-select"
        :placeholder="t('quotations.exchangeRates.selectPlaceholder')"
        @keyup.enter="confirmAdd"
        @keyup.escape="cancelAdd"
      />
      <Button
        size="small"
        :label="t('quotations.exchangeRates.confirmAdd')"
        :disabled="!selectedCurrency"
        @click="confirmAdd"
      />
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
  gap: 12px;
}

.section-title {
  margin: 0;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.section-subtitle {
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.online-rate-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.online-rate-source,
.online-rate-status {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.online-rate-status {
  margin: -4px 0 0;
}

.online-rate-error {
  color: var(--p-red-600);
}

.online-rate-warning {
  color: var(--p-orange-700);
}

.rate-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rate-row {
  display: grid;
  grid-template-columns: 2.6rem minmax(0, 1fr) 7rem auto;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  transition: background-color 0.13s ease;
}

.rate-row:hover {
  background: var(--surface-muted);
}

.currency-label {
  font-weight: 700;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong);
}

.pair-label {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rate-input :deep(.p-inputnumber) {
  width: 100%;
}

.rate-input :deep(.p-inputnumber-input) {
  font-variant-numeric: tabular-nums;
}

.base-badge {
  display: inline-grid;
  place-items: center;
  font-size: 10px;
  color: var(--accent);
  font-weight: 700;
  padding: 2px 8px;
  border: 1px solid var(--accent-soft);
  border-radius: 999px;
  background: var(--accent-surface);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.add-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.currency-select {
  min-width: 14rem;
  max-width: 100%;
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
