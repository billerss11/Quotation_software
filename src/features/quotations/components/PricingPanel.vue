<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency, formatPercent } from '@/shared/utils/formatters'

import type { CurrencyCode, MixedTaxDocumentColumn, QuotationExtraCharge, QuotationTotals, TotalsConfig, TaxMode } from '../types'
import { useBufferedFieldValues } from '../composables/useBufferedFieldValues'
import {
  MIXED_TAX_DOCUMENT_COLUMN_DEFINITIONS,
  normalizeMixedTaxDocumentColumns,
  toggleMixedTaxDocumentColumn,
} from '../utils/quotationDocumentColumns'
import { calculateCostSalesPercentage } from '../utils/quotationCalculations'
import { createTaxClass, formatTaxRatePercentage } from '../utils/quotationTaxes'

const props = defineProps<{
  totals: QuotationTotals
  currency: CurrencyCode
  totalsConfig: TotalsConfig
}>()

const emit = defineEmits<{
  requestTaxModeChange: [nextTaxMode: TaxMode]
  requestGoalSeek: []
  updateTotalsField: [field: keyof TotalsConfig, value: TotalsConfig[keyof TotalsConfig]]
  updateTaxClassField: [taxClassId: string, field: 'label' | 'rate', value: string | number]
  addTaxClass: [taxClass: ReturnType<typeof createTaxClass>]
  removeTaxClass: [taxClassId: string]
  addExtraCharge: [charge: QuotationExtraCharge]
  removeExtraCharge: [chargeId: string]
  updateExtraChargeField: [chargeId: string, field: 'label' | 'amount', value: string | number]
}>()
const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
const taxModeOptions = computed<{ label: string; value: TaxMode }[]>(() => [
  { label: t('quotations.totals.taxModes.single'), value: 'single' },
  { label: t('quotations.totals.taxModes.mixed'), value: 'mixed' },
])
const selectedTaxMode = computed(() => props.totalsConfig.taxMode ?? 'single')
const isMixedTaxMode = computed(() => selectedTaxMode.value === 'mixed')
const selectedMixedTaxColumns = computed(() => normalizeMixedTaxDocumentColumns(props.totalsConfig.mixedTaxColumns))
const mixedTaxColumnOptions = computed<{ label: string; value: MixedTaxDocumentColumn }[]>(() =>
  MIXED_TAX_DOCUMENT_COLUMN_DEFINITIONS.map((definition) => ({
    label: t(definition.selectorLabelKey),
    value: definition.id,
  })),
)
const taxBucketRows = computed(() => props.totals.taxBuckets.filter((bucket) => bucket.taxableSubtotal > 0))
const extraChargeRows = computed(() => props.totalsConfig.extraCharges ?? [])
const visibleExtraChargeRows = computed(() => extraChargeRows.value.filter((charge) => getPositiveAmount(charge.amount) > 0))
const costSalesPercentage = computed(() =>
  calculateCostSalesPercentage(props.totals.baseSubtotal, props.totals.subtotalAfterMarkup),
)
const costSalesPercentageLabel = computed(() =>
  costSalesPercentage.value === null
    ? t('common.emptyValue')
    : formatPercent(costSalesPercentage.value, currentLocale.value),
)
const defaultTaxClass = computed(() => {
  const taxClasses = props.totalsConfig.taxClasses ?? []
  return taxClasses.find((taxClass) => taxClass.id === props.totalsConfig.defaultTaxClassId) ?? taxClasses[0] ?? null
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
    emit('updateTotalsField', 'globalMarkupRate', normalizeBufferedNumber(value))
    return
  }

  if (key === 'singleTaxRate') {
    if (defaultTaxClass.value) {
      emit('updateTaxClassField', defaultTaxClass.value.id, 'rate', normalizeBufferedNumber(value))
    }
    return
  }

  const extraChargeMatch = key.match(/^extraCharge:(.+):(label|amount)$/)

  if (extraChargeMatch) {
    const [, extraChargeId, field] = extraChargeMatch
    const charge = (props.totalsConfig.extraCharges ?? []).find((entry) => entry.id === extraChargeId)

    if (!charge) {
      return
    }

    if (field === 'label') {
      emit('updateExtraChargeField', extraChargeId, 'label', String(value ?? ''))
      return
    }

    emit('updateExtraChargeField', extraChargeId, 'amount', getPositiveAmount(normalizeBufferedNumber(value)))
    return
  }

  const taxClassMatch = key.match(/^taxClass:(.+):(label|rate)$/)

  if (!taxClassMatch) {
    return
  }

  const [, taxClassId, field] = taxClassMatch
  const taxClass = (props.totalsConfig.taxClasses ?? []).find((entry) => entry.id === taxClassId)

  if (!taxClass) {
    return
  }

  if (field === 'label') {
    emit('updateTaxClassField', taxClassId, 'label', String(value ?? ''))
    return
  }

  emit('updateTaxClassField', taxClassId, 'rate', normalizeBufferedNumber(value))
})

function addTaxClass() {
  flushBufferedValues()
  emit('addTaxClass', createTaxClass({ label: t('quotations.totals.newTaxClassLabel') }))
}

function removeTaxClass(taxClassId: string) {
  flushBufferedValues()
  if (!props.totalsConfig.taxClasses || props.totalsConfig.taxClasses.length <= 1) {
    return
  }

  emit('removeTaxClass', taxClassId)
}

function addExtraCharge() {
  flushBufferedValues()
  emit('addExtraCharge', createExtraCharge(t('quotations.totals.extraChargeDefaultLabel')))
}

function removeExtraCharge(chargeId: string) {
  flushBufferedValues()
  emit('removeExtraCharge', chargeId)
}

function setDefaultTaxClass(taxClassId: string) {
  flushBufferedValues()
  emit('updateTotalsField', 'defaultTaxClassId', taxClassId)
}

function isDefaultTaxClass(taxClassId: string) {
  return props.totalsConfig.defaultTaxClassId === taxClassId
}

function handleTaxModeChange(value: unknown) {
  flushBufferedValues()
  const nextTaxMode = value === 'mixed' ? 'mixed' : 'single'

  if (nextTaxMode === selectedTaxMode.value) {
    return
  }

  emit('requestTaxModeChange', nextTaxMode)
}

function requestGoalSeek() {
  flushBufferedValues()
  emit('requestGoalSeek')
}

function isMixedTaxColumnSelected(column: MixedTaxDocumentColumn) {
  return selectedMixedTaxColumns.value.includes(column)
}

function handleMixedTaxColumnChange(column: MixedTaxDocumentColumn, value: unknown) {
  emit(
    'updateTotalsField',
    'mixedTaxColumns',
    toggleMixedTaxDocumentColumn(props.totalsConfig.mixedTaxColumns, column, value === true),
  )
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

function getTopLevelNumberValue(field: 'globalMarkupRate') {
  return getBufferedNumberValue(field, props.totalsConfig[field])
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
    <div class="pricing-layout">
      <div class="pricing-settings">
        <section class="pricing-section markup-settings" :aria-label="t('quotations.totals.globalMarkup')">
          <div class="field" data-history-target="totals:globalMarkupRate">
            <label for="quotation-global-markup">{{ t('quotations.totals.globalMarkup') }}</label>
            <span class="field-action-row">
              <InputNumber
                input-id="quotation-global-markup"
                :model-value="getTopLevelNumberValue('globalMarkupRate')"
                suffix="%"
                :min="0"
                :max="1000"
                :max-fraction-digits="2"
                @update:model-value="setBufferedNumberValue('globalMarkupRate', $event)"
                @blur="flushBufferedValue('globalMarkupRate')"
              />
              <Button
                v-tooltip.top="t('quotations.goalSeek.openQuotation')"
                icon="pi pi-bullseye"
                :label="t('quotations.goalSeek.openQuotation')"
                severity="secondary"
                outlined
                :aria-label="t('quotations.goalSeek.openQuotationAria')"
                @click.stop.prevent="requestGoalSeek"
              />
            </span>
          </div>
        </section>

        <section class="pricing-section tax-settings" :aria-label="t('quotations.totals.tax')">
          <h3 class="subsection-title">{{ t('quotations.totals.tax') }}</h3>
          <div class="controls-grid">
            <label class="field" data-history-target="totals:taxMode">
              <span>{{ t('quotations.totals.taxMode') }}</span>
              <Select
                :aria-label="t('quotations.totals.taxMode')"
                :model-value="selectedTaxMode"
                :options="taxModeOptions"
                option-label="label"
                option-value="value"
                @update:model-value="handleTaxModeChange"
              />
            </label>
            <label v-if="!isMixedTaxMode && defaultTaxClass" class="field" data-history-target="totals:taxRate">
              <span>{{ t('quotations.totals.taxClassRate') }}</span>
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
                <h4 class="subsection-title">{{ t('quotations.totals.taxClassesTitle') }}</h4>
                <p class="subsection-copy">{{ t('quotations.totals.taxClassesHelp') }}</p>
              </div>
              <Button class="add-tax-class-btn" icon="pi pi-plus" size="small" severity="secondary" text :label="t('quotations.totals.addTaxClass')" @click="addTaxClass" />
            </div>

            <div class="tax-class-list" role="list">
              <div class="tax-class-list-headings" aria-hidden="true">
                <span>{{ t('quotations.totals.taxClassLabel') }}</span>
                <span>{{ t('quotations.totals.taxClassRate') }}</span>
                <span></span>
              </div>
              <div
                v-for="taxClass in props.totalsConfig.taxClasses ?? []"
                :key="taxClass.id"
                class="tax-class-row"
                :class="{ 'tax-class-row-default': isDefaultTaxClass(taxClass.id) }"
                :data-history-target="`totals:taxClass:${taxClass.id}`"
                role="listitem"
              >
                <label class="field tax-class-label-field" :data-history-target="`totals:taxClass:${taxClass.id}:label`">
                  <span class="field-sr-label">{{ t('quotations.totals.taxClassLabel') }}</span>
                  <InputText
                    :model-value="getTaxClassLabelValue(taxClass.id, taxClass.label)"
                    @update:model-value="setTaxClassLabelValue(taxClass.id, $event)"
                    @blur="flushTaxClassLabelValue(taxClass.id)"
                  />
                </label>
                <label class="field tax-class-rate-field" :data-history-target="`totals:taxClass:${taxClass.id}:rate`">
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
                    :disabled="(props.totalsConfig.taxClasses ?? []).length <= 1"
                    :aria-label="t('quotations.totals.deleteTaxClassAria', { label: taxClass.label })"
                    @click="removeTaxClass(taxClass.id)"
                  />
                </div>
              </div>
            </div>
          </section>

          <section v-if="isMixedTaxMode" class="mixed-tax-columns" :aria-label="t('quotations.totals.mixedTaxColumns.aria')">
            <div>
              <h4 class="subsection-title">{{ t('quotations.totals.mixedTaxColumns.title') }}</h4>
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
        </section>

        <section class="pricing-section extra-charges" :aria-label="t('quotations.totals.extraChargesAria')">
          <div class="subsection-header">
            <div>
              <h3 class="subsection-title">{{ t('quotations.totals.extraChargesTitle') }}</h3>
              <p class="subsection-copy">{{ t('quotations.totals.extraChargesHelp') }}</p>
            </div>
            <Button class="add-extra-charge-btn" icon="pi pi-plus" size="small" severity="secondary" text :label="t('quotations.totals.addExtraCharge')" @click="addExtraCharge" />
          </div>

          <p v-if="extraChargeRows.length === 0" class="empty-copy">{{ t('quotations.totals.extraChargeEmpty') }}</p>
          <div v-else class="extra-charge-list" role="list">
            <div
              v-for="charge in extraChargeRows"
              :key="charge.id"
              class="extra-charge-row"
              :data-history-target="`totals:extraCharge:${charge.id}`"
              role="listitem"
            >
              <label class="field extra-charge-name-field" :data-history-target="`totals:extraCharge:${charge.id}:label`">
                <span>{{ t('quotations.totals.extraChargeName') }}</span>
                <InputText
                  :model-value="getExtraChargeLabelValue(charge)"
                  :placeholder="t('quotations.totals.extraChargeNamePlaceholder')"
                  @update:model-value="setExtraChargeLabelValue(charge, $event)"
                  @blur="flushExtraChargeLabelValue(charge)"
                />
              </label>
              <label class="field extra-charge-amount-field" :data-history-target="`totals:extraCharge:${charge.id}:amount`">
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
      </div>

      <section class="pricing-breakdown" :aria-label="t('quotations.totals.breakdownTitle')">
        <h3 class="subsection-title">{{ t('quotations.totals.breakdownTitle') }}</h3>
        <dl class="totals-list">
          <div>
            <dt>{{ t('quotations.totals.totalCost') }}</dt>
            <dd>{{ formatCurrency(props.totals.baseSubtotal, props.currency, currentLocale) }}</dd>
          </div>
          <div class="row-additive">
            <dt>{{ t('quotations.totals.markup') }}</dt>
            <dd>{{ formatCurrency(props.totals.markupAmount, props.currency, currentLocale) }}</dd>
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
          <div>
            <dt>{{ t('quotations.totals.costSalesPct') }}</dt>
            <dd>{{ costSalesPercentageLabel }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </section>
</template>

<style scoped>
.pricing-panel {
  min-width: 0;
  container-type: inline-size;
}

.pricing-layout,
.pricing-settings {
  display: grid;
  min-width: 0;
  gap: 24px;
}

.pricing-section,
.tax-classes,
.mixed-tax-columns {
  display: grid;
  min-width: 0;
  gap: 14px;
}

.pricing-section + .pricing-section {
  padding-top: 22px;
  border-top: 1px solid var(--surface-border);
}

.subsection-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.4;
}

.subsection-copy,
.empty-copy {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
}

.controls-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  min-width: 0;
  gap: 14px;
}

.field {
  display: grid;
  min-width: 0;
  gap: 6px;
  color: var(--text-body);
  font-size: 12px;
  font-weight: 550;
  line-height: 1.4;
}

.field :deep(.p-inputnumber),
.field :deep(.p-inputtext),
.field :deep(.p-select) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  font-size: 13px;
  font-weight: 400;
}

.field :deep(.p-inputtext),
.field :deep(.p-inputnumber-input) {
  min-height: 36px;
  padding: 8px 10px;
  box-shadow: none;
}

.field :deep(.p-select) {
  min-height: 36px;
  box-shadow: none;
}

.field :deep(.p-select-label) {
  min-width: 0;
  padding: 8px 10px;
  font-size: 13px;
}

.field-action-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.pricing-panel :deep(.p-button) {
  min-height: 36px;
  font-size: 12px;
  box-shadow: none;
}

.field-action-row :deep(.p-button) {
  padding: 8px 10px;
}

.tax-classes,
.mixed-tax-columns {
  padding-top: 16px;
  border-top: 1px solid var(--surface-border);
}

.tax-classes-header,
.subsection-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
  gap: 8px 12px;
}

.tax-classes-header > div,
.subsection-header > div {
  flex: 1 1 160px;
  min-width: 0;
}

.add-tax-class-btn,
.add-extra-charge-btn {
  flex: 0 1 auto;
  padding: 6px 0;
}

.add-tax-class-btn :deep(.p-button-label),
.add-extra-charge-btn :deep(.p-button-label) {
  white-space: normal;
}

.tax-class-list,
.extra-charge-list {
  display: grid;
  min-width: 0;
  gap: 12px;
}

.tax-class-list-headings {
  display: none;
}

.tax-class-row,
.extra-charge-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  min-width: 0;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--surface-border);
}

.tax-class-row:last-child,
.extra-charge-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.tax-class-label-field,
.extra-charge-name-field {
  grid-column: 1 / -1;
}

.tax-class-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tax-default-action,
.tax-class-delete,
.extra-charge-delete {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: var(--radius-sm);
}

.tax-class-row-default .tax-default-action {
  border-color: transparent;
  background: var(--accent-surface);
  color: var(--accent-hover);
}

.mixed-tax-column-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  gap: 10px 16px;
}

.mixed-tax-column-option {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  gap: 8px;
  color: var(--text-body);
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
}

.mixed-tax-column-option :deep(.p-checkbox) {
  flex-shrink: 0;
}

.mixed-tax-column-option span {
  min-width: 0;
}

.pricing-breakdown {
  display: grid;
  align-self: start;
  min-width: 0;
  gap: 16px;
  padding: 16px;
  border-radius: var(--radius-md);
  background: var(--surface-raised);
}

.totals-list {
  display: grid;
  min-width: 0;
  gap: 10px;
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.totals-list > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  min-width: 0;
  gap: 12px;
}

.totals-list dt {
  min-width: 0;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}

.totals-list dd {
  flex-shrink: 0;
  max-width: 65%;
  margin: 0;
  color: var(--text-strong);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.row-result {
  padding-top: 10px;
  border-top: 1px solid var(--surface-border);
}

.row-result dt {
  color: var(--text-body);
  font-weight: 550;
}

.grand-total {
  margin-top: 4px;
  padding-top: 14px;
  border-top: 1px solid var(--surface-border);
}

.grand-total dt {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 650;
}

.grand-total dd {
  color: var(--accent-hover);
  font-size: 20px;
  font-weight: 650;
  line-height: 1.3;
}

@container (min-width: 440px) {
  .controls-grid,
  .mixed-tax-column-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tax-class-list-headings,
  .tax-class-row {
    grid-template-columns: minmax(0, 1fr) 92px 74px;
    gap: 10px;
  }

  .tax-class-list-headings {
    display: grid;
    color: var(--text-muted);
    font-size: 11px;
  }

  .tax-class-label-field,
  .extra-charge-name-field {
    grid-column: auto;
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

  .extra-charge-row {
    grid-template-columns: minmax(0, 1fr) 100px 36px;
  }
}

@container (min-width: 620px) {
  .pricing-layout {
    grid-template-columns: minmax(0, 1.2fr) minmax(240px, 0.8fr);
  }
}
</style>
