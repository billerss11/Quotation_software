<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency } from '@/shared/utils/formatters'

import type { CurrencyCode, DiscountMode, MixedTaxDocumentColumn, QuotationExtraCharge, QuotationTotals, TotalsConfig, TaxMode } from '../types'
import { useBufferedFieldValues } from '../composables/useBufferedFieldValues'
import {
  MIXED_TAX_DOCUMENT_COLUMNS,
  normalizeMixedTaxDocumentColumns,
  toggleMixedTaxDocumentColumn,
} from '../utils/quotationDocumentColumns'
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
const mixedTaxColumnLabelKeys: Record<MixedTaxDocumentColumn, string> = {
  taxRate: 'quotations.totals.mixedTaxColumns.options.taxRate',
  unitPrice: 'quotations.totals.mixedTaxColumns.options.unitPrice',
  taxAmount: 'quotations.totals.mixedTaxColumns.options.taxAmount',
  netAmount: 'quotations.totals.mixedTaxColumns.options.netAmount',
  grossAmount: 'quotations.totals.mixedTaxColumns.options.grossAmount',
}
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
const selectedMixedTaxColumns = computed(() => normalizeMixedTaxDocumentColumns(model.value.mixedTaxColumns))
const mixedTaxColumnOptions = computed<{ label: string; value: MixedTaxDocumentColumn }[]>(() =>
  MIXED_TAX_DOCUMENT_COLUMNS.map((value) => ({
    label: t(mixedTaxColumnLabelKeys[value]),
    value,
  })),
)
const taxBucketRows = computed(() => props.totals.taxBuckets.filter((bucket) => bucket.taxableSubtotal > 0))
const extraChargeRows = computed(() => model.value.extraCharges ?? [])
const visibleExtraChargeRows = computed(() => extraChargeRows.value.filter((charge) => getPositiveAmount(charge.amount) > 0))
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

  const extraChargeMatch = key.match(/^extraCharge:(.+):(label|amount)$/)

  if (extraChargeMatch) {
    const [, extraChargeId, field] = extraChargeMatch
    const charge = (model.value.extraCharges ?? []).find((entry) => entry.id === extraChargeId)

    if (!charge) {
      return
    }

    if (field === 'label') {
      charge.label = String(value ?? '')
      return
    }

    charge.amount = getPositiveAmount(normalizeBufferedNumber(value))
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

function addExtraCharge() {
  flushBufferedValues()
  model.value.extraCharges ??= []
  model.value.extraCharges.push(createExtraCharge(t('quotations.totals.extraChargeDefaultLabel')))
}

function removeExtraCharge(chargeId: string) {
  flushBufferedValues()
  model.value.extraCharges = (model.value.extraCharges ?? []).filter((charge) => charge.id !== chargeId)
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

function isMixedTaxColumnSelected(column: MixedTaxDocumentColumn) {
  return selectedMixedTaxColumns.value.includes(column)
}

function handleMixedTaxColumnChange(column: MixedTaxDocumentColumn, value: unknown) {
  model.value.mixedTaxColumns = toggleMixedTaxDocumentColumn(model.value.mixedTaxColumns, column, value === true)
}

function getTaxClassBufferKey(taxClassId: string, field: 'label' | 'rate') {
  return `taxClass:${taxClassId}:${field}`
}

function getExtraChargeBufferKey(chargeId: string, field: 'label' | 'amount') {
  return `extraCharge:${chargeId}:${field}`
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

function getExtraChargeLabelValue(charge: QuotationExtraCharge) {
  return getBufferedValue(getExtraChargeBufferKey(charge.id, 'label'), charge.label)
}

function setExtraChargeLabelValue(charge: QuotationExtraCharge, value: unknown) {
  queueBufferedValue(getExtraChargeBufferKey(charge.id, 'label'), String(value ?? ''))
}

function flushExtraChargeLabelValue(charge: QuotationExtraCharge) {
  flushBufferedValue(getExtraChargeBufferKey(charge.id, 'label'))
}

function getExtraChargeAmountValue(charge: QuotationExtraCharge) {
  return getBufferedNumberValue(getExtraChargeBufferKey(charge.id, 'amount'), charge.amount)
}

function setExtraChargeAmountValue(charge: QuotationExtraCharge, value: unknown) {
  setBufferedNumberValue(getExtraChargeBufferKey(charge.id, 'amount'), value)
}

function flushExtraChargeAmountValue(charge: QuotationExtraCharge) {
  flushBufferedValue(getExtraChargeBufferKey(charge.id, 'amount'))
}

function createExtraCharge(label: string): QuotationExtraCharge {
  return {
    id: crypto.randomUUID(),
    label,
    amount: 0,
  }
}

function normalizeBufferedNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getPositiveAmount(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0
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

      <div class="tax-class-list" role="list">
        <div class="tax-class-list-headings" aria-hidden="true">
          <span>{{ t('quotations.totals.taxClassLabel') }}</span>
          <span>{{ t('quotations.totals.taxClassRate') }}</span>
          <span></span>
        </div>
        <div
          v-for="taxClass in model.taxClasses ?? []"
          :key="taxClass.id"
          class="tax-class-row"
          :class="{ 'tax-class-row-default': isDefaultTaxClass(taxClass.id) }"
          role="listitem"
        >
          <label class="field tax-class-label-field">
            <span class="field-sr-label">{{ t('quotations.totals.taxClassLabel') }}</span>
            <InputText
              :model-value="getTaxClassLabelValue(taxClass.id, taxClass.label)"
              @update:model-value="setTaxClassLabelValue(taxClass.id, $event)"
              @blur="flushTaxClassLabelValue(taxClass.id)"
            />
          </label>
          <label class="field tax-class-rate-field">
            <span class="field-sr-label">{{ t('quotations.totals.taxClassRate') }}</span>
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
          <div class="tax-class-actions">
            <Button
              class="tax-default-action"
              icon="pi pi-check"
              size="small"
              severity="secondary"
              :text="!isDefaultTaxClass(taxClass.id)"
              :outlined="!isDefaultTaxClass(taxClass.id)"
              :aria-label="isDefaultTaxClass(taxClass.id) ? t('quotations.totals.defaultTaxClass') : t('quotations.totals.makeDefaultTaxClass')"
              @click="setDefaultTaxClass(taxClass.id)"
            />
            <Button
              class="tax-class-delete"
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
      </div>
    </section>

    <section v-if="isMixedTaxMode" class="mixed-tax-columns" :aria-label="t('quotations.totals.mixedTaxColumns.aria')">
      <div>
        <h3 class="subsection-title">{{ t('quotations.totals.mixedTaxColumns.title') }}</h3>
        <p class="subsection-copy">{{ t('quotations.totals.mixedTaxColumns.help') }}</p>
      </div>
      <div class="mixed-tax-column-list">
        <label v-for="option in mixedTaxColumnOptions" :key="option.value" class="mixed-tax-column-option">
          <Checkbox
            :model-value="isMixedTaxColumnSelected(option.value)"
            binary
            @update:model-value="handleMixedTaxColumnChange(option.value, $event)"
          />
          <span>{{ option.label }}</span>
        </label>
      </div>
    </section>

    <section class="extra-charges" :aria-label="t('quotations.totals.extraChargesAria')">
      <div class="subsection-header">
        <div>
          <h3 class="subsection-title">{{ t('quotations.totals.extraChargesTitle') }}</h3>
          <p class="subsection-copy">{{ t('quotations.totals.extraChargesHelp') }}</p>
        </div>
        <Button class="add-extra-charge-btn" icon="pi pi-plus" size="small" :label="t('quotations.totals.addExtraCharge')" @click="addExtraCharge" />
      </div>

      <p v-if="extraChargeRows.length === 0" class="empty-copy">{{ t('quotations.totals.extraChargeEmpty') }}</p>
      <div v-else class="extra-charge-list" role="list">
        <div v-for="charge in extraChargeRows" :key="charge.id" class="extra-charge-row" role="listitem">
          <label class="field extra-charge-name-field">
            <span>{{ t('quotations.totals.extraChargeName') }}</span>
            <InputText
              :model-value="getExtraChargeLabelValue(charge)"
              :placeholder="t('quotations.totals.extraChargeNamePlaceholder')"
              @update:model-value="setExtraChargeLabelValue(charge, $event)"
              @blur="flushExtraChargeLabelValue(charge)"
            />
          </label>
          <label class="field extra-charge-amount-field">
            <span>{{ t('quotations.totals.extraChargeAmount') }}</span>
            <InputNumber
              :model-value="getExtraChargeAmountValue(charge)"
              :min="0"
              :max-fraction-digits="2"
              @update:model-value="setExtraChargeAmountValue(charge, $event)"
              @blur="flushExtraChargeAmountValue(charge)"
            />
          </label>
          <Button
            class="extra-charge-delete"
            icon="pi pi-trash"
            severity="danger"
            text
            rounded
            :aria-label="t('quotations.totals.deleteExtraChargeAria', { label: charge.label || t('quotations.totals.extraChargeDefaultLabel') })"
            @click="removeExtraCharge(charge.id)"
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
      <div v-for="charge in visibleExtraChargeRows" :key="charge.id" class="row-additive">
        <dt>+ {{ charge.label || t('quotations.totals.extraChargeDefaultLabel') }}</dt>
        <dd>{{ formatCurrency(charge.amount, props.currency, currentLocale) }}</dd>
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
  gap: 10px;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--surface-border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent) 7%, transparent), transparent 70%),
    var(--surface-muted);
}

.tax-classes-header,
.subsection-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.add-tax-class-btn :deep(.p-button-label),
.add-extra-charge-btn :deep(.p-button-label) {
  white-space: nowrap;
  font-size: 12px;
}

.add-tax-class-btn {
  flex: 0 0 auto;
  max-width: 138px;
}

.tax-class-list {
  display: grid;
  gap: 6px;
}

.tax-class-list-headings {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 66px;
  gap: 8px;
  padding: 0 8px 0 13px;
  color: var(--text-body);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
}

.tax-class-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 66px;
  gap: 8px;
  align-items: center;
  min-width: 0;
  padding: 7px 8px 7px 10px;
  border: 1px solid var(--surface-border);
  border-left: 3px solid transparent;
  border-radius: 8px;
  background: var(--surface-card);
}

.tax-class-row-default {
  border-left-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--surface-card));
}

.tax-class-rate-field {
  min-width: 0;
}

.tax-class-label-field {
  min-width: 0;
}

.field-sr-label {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.extra-charge-row .field > span {
  white-space: nowrap;
}

.tax-class-actions {
  display: grid;
  grid-template-columns: repeat(2, 30px);
  gap: 4px;
  justify-content: end;
  align-items: center;
}

.tax-default-action,
.tax-class-delete {
  width: 30px;
  height: 30px;
}

.mixed-tax-columns {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--surface-border));
  border-radius: var(--radius-md);
  background: var(--surface-card);
}

.mixed-tax-column-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.mixed-tax-column-option {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  color: var(--text-body);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
}

.mixed-tax-column-option span {
  min-width: 0;
}

.extra-charges {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--surface-border));
  border-radius: var(--radius-md);
  background: var(--surface-card);
}

.empty-copy {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.extra-charge-list {
  display: grid;
  gap: 6px;
}

.extra-charge-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px 30px;
  gap: 8px;
  align-items: end;
  min-width: 0;
  padding: 8px 8px 8px 10px;
  border: 1px solid var(--surface-border);
  border-left: 3px solid color-mix(in srgb, var(--accent) 45%, var(--surface-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-muted) 58%, var(--surface-card));
}

.extra-charge-name-field,
.extra-charge-amount-field {
  min-width: 0;
}

.extra-charge-delete {
  align-self: end;
  width: 30px;
  height: 30px;
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
