<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency } from '@/shared/utils/formatters'

import type { CurrencyCode, DiscountMode, QuotationTotals, TotalsConfig, TaxMode } from '../types'
import { useBufferedFieldValues } from '../composables/useBufferedFieldValues'
import { createTaxClass, formatTaxRatePercentage } from '../utils/quotationTaxes'

const props = defineProps<{
  totals: QuotationTotals
  currency: CurrencyCode
}>()

const model = defineModel<TotalsConfig>({ required: true })
const emit = defineEmits<{
  requestTaxModeChange: [nextTaxMode: TaxMode]
}>()
const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
const discountModeOptions = computed<{ label: string; value: DiscountMode }[]>(() => [
  { label: t('quotations.totals.discountModes.percentage'), value: 'percentage' },
  { label: t('quotations.totals.discountModes.fixed'), value: 'fixed' },
])
const taxModeOptions = computed<{ label: string; value: TaxMode }[]>(() => [
  { label: t('quotations.totals.taxModes.single'), value: 'single' },
  { label: t('quotations.totals.taxModes.mixed'), value: 'mixed' },
])
const selectedTaxMode = computed(() => model.value.taxMode ?? 'single')
const isMixedTaxMode = computed(() => selectedTaxMode.value === 'mixed')
const taxBucketRows = computed(() => props.totals.taxBuckets.filter((bucket) => bucket.taxableSubtotal > 0))
const defaultTaxClass = computed(() => {
  const taxClasses = model.value.taxClasses ?? []
  return taxClasses.find((taxClass) => taxClass.id === model.value.defaultTaxClassId) ?? taxClasses[0] ?? null
})
const singleTaxHelpLabel = computed(() =>
  defaultTaxClass.value ? formatTaxRatePercentage(getTaxClassRateValue(defaultTaxClass.value.id, defaultTaxClass.value.rate)) : '',
)
const {
  getBufferedValue,
  queueBufferedValue,
  flushBufferedValue,
  flushBufferedValues,
} = useBufferedFieldValues((key, value) => {
  if (key === 'globalMarkupRate') {
    model.value.globalMarkupRate = normalizeBufferedNumber(value)
    return
  }

  if (key === 'discountValue') {
    model.value.discountValue = normalizeBufferedNumber(value)
    return
  }

  if (key === 'singleTaxRate') {
    if (defaultTaxClass.value) {
      defaultTaxClass.value.rate = normalizeBufferedNumber(value)
    }
    return
  }

  const taxClassMatch = key.match(/^taxClass:(.+):(label|rate)$/)

  if (!taxClassMatch) {
    return
  }

  const [, taxClassId, field] = taxClassMatch
  const taxClass = (model.value.taxClasses ?? []).find((entry) => entry.id === taxClassId)

  if (!taxClass) {
    return
  }

  if (field === 'label') {
    taxClass.label = String(value ?? '')
    return
  }

  taxClass.rate = normalizeBufferedNumber(value)
})

function addTaxClass() {
  flushBufferedValues()
  model.value.taxClasses ??= []
  model.value.taxClasses.push(createTaxClass({ label: t('quotations.totals.newTaxClassLabel') }))

  if (!model.value.defaultTaxClassId && model.value.taxClasses[0]) {
    model.value.defaultTaxClassId = model.value.taxClasses[0].id
  }
}

function removeTaxClass(taxClassId: string) {
  flushBufferedValues()
  if (!model.value.taxClasses || model.value.taxClasses.length <= 1) {
    return
  }

  model.value.taxClasses = model.value.taxClasses.filter((taxClass) => taxClass.id !== taxClassId)

  if (!model.value.taxClasses.some((taxClass) => taxClass.id === model.value.defaultTaxClassId)) {
    model.value.defaultTaxClassId = model.value.taxClasses[0]?.id
  }
}

function setDefaultTaxClass(taxClassId: string) {
  flushBufferedValues()
  model.value.defaultTaxClassId = taxClassId
}

function isDefaultTaxClass(taxClassId: string) {
  return model.value.defaultTaxClassId === taxClassId
}

function handleTaxModeChange(value: unknown) {
  flushBufferedValues()
  const nextTaxMode = value === 'mixed' ? 'mixed' : 'single'

  if (nextTaxMode === selectedTaxMode.value) {
    return
  }

  emit('requestTaxModeChange', nextTaxMode)
}

function handleDiscountModeChange(value: unknown) {
  flushBufferedValues()
  model.value.discountMode = value === 'fixed' ? 'fixed' : 'percentage'
}

function getTaxClassBufferKey(taxClassId: string, field: 'label' | 'rate') {
  return `taxClass:${taxClassId}:${field}`
}

function getBufferedNumberValue(key: string, fallback: number) {
  return getBufferedValue(key, fallback)
}

function setBufferedNumberValue(key: string, value: unknown) {
  queueBufferedValue(key, normalizeBufferedNumber(value))
}

function getTopLevelNumberValue(field: 'globalMarkupRate' | 'discountValue') {
  return getBufferedNumberValue(field, model.value[field])
}

function getTaxClassLabelValue(taxClassId: string, fallback: string) {
  return getBufferedValue(getTaxClassBufferKey(taxClassId, 'label'), fallback)
}

function setTaxClassLabelValue(taxClassId: string, value: unknown) {
  queueBufferedValue(getTaxClassBufferKey(taxClassId, 'label'), String(value ?? ''))
}

function flushTaxClassLabelValue(taxClassId: string) {
  flushBufferedValue(getTaxClassBufferKey(taxClassId, 'label'))
}

function getTaxClassRateValue(taxClassId: string, fallback: number) {
  return getBufferedNumberValue(getTaxClassBufferKey(taxClassId, 'rate'), fallback)
}

function setTaxClassRateValue(taxClassId: string, value: unknown) {
  setBufferedNumberValue(getTaxClassBufferKey(taxClassId, 'rate'), value)
}

function flushTaxClassRateValue(taxClassId: string) {
  flushBufferedValue(getTaxClassBufferKey(taxClassId, 'rate'))
}

function normalizeBufferedNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
</script>

<template>
  <section class="pricing-panel" :aria-label="t('quotations.totals.aria')">
    <div class="controls-grid">
      <label class="field">
        <span>{{ t('quotations.totals.taxMode') }}</span>
        <Select
          :model-value="selectedTaxMode"
          :options="taxModeOptions"
          option-label="label"
          option-value="value"
          @update:model-value="handleTaxModeChange"
        />
      </label>
      <label class="field">
        <span>{{ t('quotations.totals.globalMarkup') }}</span>
        <InputNumber
          :model-value="getTopLevelNumberValue('globalMarkupRate')"
          suffix="%"
          :min="0"
          :max="1000"
          :max-fraction-digits="2"
          @update:model-value="setBufferedNumberValue('globalMarkupRate', $event)"
          @blur="flushBufferedValue('globalMarkupRate')"
        />
      </label>
      <label class="field">
        <span>{{ t('quotations.totals.discountMode') }}</span>
        <Select
          :model-value="model.discountMode"
          :options="discountModeOptions"
          option-label="label"
          option-value="value"
          @update:model-value="handleDiscountModeChange"
        />
      </label>
      <label class="field">
        <span>{{ t('quotations.totals.discountValue') }}</span>
        <InputNumber
          :model-value="getTopLevelNumberValue('discountValue')"
          :min="0"
          :max="model.discountMode === 'percentage' ? 100 : undefined"
          :max-fraction-digits="2"
          @update:model-value="setBufferedNumberValue('discountValue', $event)"
          @blur="flushBufferedValue('discountValue')"
        />
      </label>
      <label v-if="!isMixedTaxMode && defaultTaxClass" class="field field-full">
        <span>{{ t('quotations.totals.tax') }}</span>
        <InputNumber
          :model-value="getBufferedNumberValue('singleTaxRate', defaultTaxClass.rate)"
          suffix="%"
          :min="0"
          :max="100"
          :max-fraction-digits="2"
          @update:model-value="setBufferedNumberValue('singleTaxRate', $event)"
          @blur="flushBufferedValue('singleTaxRate')"
        />
        <small class="subsection-copy">{{ t('quotations.totals.singleTaxHelp', { label: singleTaxHelpLabel }) }}</small>
      </label>
    </div>

    <section v-if="isMixedTaxMode" class="tax-classes" :aria-label="t('quotations.totals.taxClassesAria')">
      <div class="tax-classes-header">
        <div>
          <h3 class="subsection-title">{{ t('quotations.totals.taxClassesTitle') }}</h3>
          <p class="subsection-copy">{{ t('quotations.totals.taxClassesHelp') }}</p>
        </div>
        <Button class="add-tax-class-btn" icon="pi pi-plus" size="small" :label="t('quotations.totals.addTaxClass')" @click="addTaxClass" />
      </div>

      <div class="tax-class-list">
        <div v-for="taxClass in model.taxClasses ?? []" :key="taxClass.id" class="tax-class-row">
          <div class="tax-class-actions">
            <Button
              size="small"
              severity="secondary"
              :outlined="!isDefaultTaxClass(taxClass.id)"
              :label="isDefaultTaxClass(taxClass.id) ? t('quotations.totals.defaultTaxClass') : t('quotations.totals.makeDefaultTaxClass')"
              @click="setDefaultTaxClass(taxClass.id)"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              :disabled="(model.taxClasses ?? []).length <= 1"
              :aria-label="t('quotations.totals.deleteTaxClassAria', { label: taxClass.label })"
              @click="removeTaxClass(taxClass.id)"
            />
          </div>
          <div class="tax-class-fields">
            <label class="field">
              <span>{{ t('quotations.totals.taxClassLabel') }}</span>
              <InputText
                :model-value="getTaxClassLabelValue(taxClass.id, taxClass.label)"
                @update:model-value="setTaxClassLabelValue(taxClass.id, $event)"
                @blur="flushTaxClassLabelValue(taxClass.id)"
              />
            </label>
            <label class="field">
              <span>{{ t('quotations.totals.taxClassRate') }}</span>
              <InputNumber
                :model-value="getTaxClassRateValue(taxClass.id, taxClass.rate)"
                suffix="%"
                :min="0"
                :max="100"
                :max-fraction-digits="2"
                @update:model-value="setTaxClassRateValue(taxClass.id, $event)"
                @blur="flushTaxClassRateValue(taxClass.id)"
              />
            </label>
          </div>
        </div>
      </div>
    </section>

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
      <div v-if="!isMixedTaxMode" class="row-additive">
        <dt>{{ t('quotations.totals.taxLine') }}</dt>
        <dd>{{ formatCurrency(props.totals.taxAmount, props.currency, currentLocale) }}</dd>
      </div>
      <div v-for="bucket in isMixedTaxMode ? taxBucketRows : []" :key="bucket.taxClassId" class="row-additive">
        <dt>{{ t('quotations.totals.taxBucket', { label: bucket.label }) }}</dt>
        <dd>{{ formatCurrency(bucket.taxAmount, props.currency, currentLocale) }}</dd>
      </div>
      <div class="grand-total">
        <dt>{{ t('quotations.totals.total') }}</dt>
        <dd>{{ formatCurrency(props.totals.grandTotal, props.currency, currentLocale) }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.pricing-panel {
  display: grid;
  gap: 14px;
}

.subsection-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 700;
}

.subsection-copy {
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.controls-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-items: start;
}

.field-full {
  grid-column: 1 / -1;
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

.field :deep(.p-inputnumber),
.field :deep(.p-inputtext),
.field :deep(.p-select) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}

.tax-classes {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.tax-classes-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.add-tax-class-btn :deep(.p-button-label) {
  white-space: nowrap;
  font-size: 12px;
}

.tax-class-list {
  display: grid;
  gap: 8px;
}

.tax-class-row {
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-card);
}

.tax-class-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.tax-class-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px;
  gap: 8px;
  align-items: end;
}

.totals-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  font-size: 12px;
}

.totals-list div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 18px;
}

.totals-list dt {
  color: var(--text-muted);
  font-weight: 600;
}

.totals-list dd {
  margin: 0;
  color: var(--text-strong);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.row-additive dt,
.row-additive dd {
  color: var(--accent);
}

.row-deductive dt,
.row-deductive dd {
  color: var(--warning);
}

.row-result {
  padding-top: 6px;
  border-top: 1px dashed var(--surface-border);
}

.row-result dt {
  color: var(--text-body);
  font-weight: 700;
}

.grand-total {
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--surface-border);
  font-size: 15px;
}

.grand-total dt {
  color: var(--text-strong);
  font-weight: 700;
}

.grand-total dd {
  color: var(--accent);
  font-size: 17px;
  font-weight: 800;
}
</style>
