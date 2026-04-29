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
  defaultTaxClass.value ? formatTaxRatePercentage(defaultTaxClass.value.rate) : '',
)

function addTaxClass() {
  model.value.taxClasses ??= []
  model.value.taxClasses.push(createTaxClass())

  if (!model.value.defaultTaxClassId && model.value.taxClasses[0]) {
    model.value.defaultTaxClassId = model.value.taxClasses[0].id
  }
}

function removeTaxClass(taxClassId: string) {
  if (!model.value.taxClasses || model.value.taxClasses.length <= 1) {
    return
  }

  model.value.taxClasses = model.value.taxClasses.filter((taxClass) => taxClass.id !== taxClassId)

  if (!model.value.taxClasses.some((taxClass) => taxClass.id === model.value.defaultTaxClassId)) {
    model.value.defaultTaxClassId = model.value.taxClasses[0]?.id
  }
}

function setDefaultTaxClass(taxClassId: string) {
  model.value.defaultTaxClassId = taxClassId
}

function isDefaultTaxClass(taxClassId: string) {
  return model.value.defaultTaxClassId === taxClassId
}

function handleTaxModeChange(value: unknown) {
  const nextTaxMode = value === 'mixed' ? 'mixed' : 'single'

  if (nextTaxMode === selectedTaxMode.value) {
    return
  }

  emit('requestTaxModeChange', nextTaxMode)
}
</script>

<template>
  <section class="pricing-panel" :aria-label="t('quotations.totals.aria')">
    <h2 class="section-title">{{ t('quotations.totals.title') }}</h2>

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
      <label v-if="!isMixedTaxMode && defaultTaxClass" class="field">
        <span>{{ t('quotations.totals.tax') }}</span>
        <InputNumber v-model="defaultTaxClass.rate" suffix="%" :min="0" :max="100" :max-fraction-digits="2" />
        <small class="subsection-copy">{{ t('quotations.totals.singleTaxHelp', { label: singleTaxHelpLabel }) }}</small>
      </label>
    </div>

    <section v-if="isMixedTaxMode" class="tax-classes" :aria-label="t('quotations.totals.taxClassesAria')">
      <div class="tax-classes-header">
        <div>
          <h3 class="subsection-title">{{ t('quotations.totals.taxClassesTitle') }}</h3>
          <p class="subsection-copy">{{ t('quotations.totals.taxClassesHelp') }}</p>
        </div>
        <Button icon="pi pi-plus" size="small" :label="t('quotations.totals.addTaxClass')" @click="addTaxClass" />
      </div>

      <div class="tax-class-list">
        <div v-for="taxClass in model.taxClasses ?? []" :key="taxClass.id" class="tax-class-row">
          <Button
            size="small"
            severity="secondary"
            :outlined="!isDefaultTaxClass(taxClass.id)"
            :label="isDefaultTaxClass(taxClass.id) ? t('quotations.totals.defaultTaxClass') : t('quotations.totals.makeDefaultTaxClass')"
            @click="setDefaultTaxClass(taxClass.id)"
          />
          <label class="field">
            <span>{{ t('quotations.totals.taxClassLabel') }}</span>
            <InputText v-model="taxClass.label" />
          </label>
          <label class="field field-rate">
            <span>{{ t('quotations.totals.taxClassRate') }}</span>
            <InputNumber v-model="taxClass.rate" suffix="%" :min="0" :max="100" :max-fraction-digits="2" />
          </label>
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
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-card);
  box-shadow: var(--shadow-control);
}

.section-title,
.subsection-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.subsection-title {
  font-size: 13px;
}

.subsection-copy {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 12px;
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
.field :deep(.p-inputtext),
.field :deep(.p-select) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.tax-classes {
  display: grid;
  gap: 12px;
  padding-top: 4px;
  border-top: 1px dashed var(--surface-border);
}

.tax-classes-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.tax-class-list {
  display: grid;
  gap: 10px;
}

.tax-class-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 132px auto;
  gap: 10px;
  align-items: end;
  padding: 10px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-panel);
}

.field-rate {
  min-width: 120px;
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

.row-additive dt,
.row-additive dd {
  color: var(--accent);
}

.row-deductive dt,
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

@media (max-width: 900px) {
  .tax-class-row {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
}
</style>
