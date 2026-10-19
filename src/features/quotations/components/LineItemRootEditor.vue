<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CurrencyCode, PricingMethod, QuotationItemField } from '../types'
import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatPercent } from '@/shared/utils/formatters'

type SelectOption<T extends string = string> = {
  label: string
  value: T
}

const props = defineProps<{
  itemId: string
  displayItemNumber: number
  currency: CurrencyCode
  currentLocale: SupportedLocale
  costCurrency: CurrencyCode
  costCurrencyOptions: string[]
  pricingMethodOptions: Array<SelectOption<PricingMethod>>
  taxClassOptions: Array<SelectOption>
  isGroupItem: boolean
  isMixedTaxMode: boolean
  showPricingMethodSelector: boolean
  showManualPriceControls: boolean
  showDetailedCostControls: boolean
  showMarkupEditor: boolean
  showExpectedTotal: boolean
  quantityValue: number
  quantityUnitValue: string
  pricingMethodValue: PricingMethod
  manualUnitPriceValue: number
  unitCostValue: number
  markupRateValue: number | null | undefined
  inheritedMarkupRate?: number
  taxClassValue: string | null
  expectedTotalValue: number | null | undefined
  manualPriceLabel: string
  manualUnitPriceAriaLabel: string
  pricingMethodAriaLabel: string
  markupFieldLabel: string
  markupLabel: string
  markupUsageLabel: string
  markupTooltipLabel: string
  markupAriaLabel: string
  unitTaxSummaryLabel: string
  mismatchMessage: string
}>()

const emit = defineEmits<{
  setText: [field: QuotationItemField, value: unknown]
  setNumber: [field: QuotationItemField, value: unknown]
  setOptionalNumber: [field: QuotationItemField, value: unknown]
  setPricingMethod: [value: unknown]
  setCurrency: [value: unknown]
  setTaxClass: [value: unknown]
  flushField: [field: QuotationItemField]
  requestGoalSeek: []
}>()

const { t } = useI18n()
const markupHelp = computed(() =>
  [props.markupLabel, props.markupUsageLabel, props.markupTooltipLabel].filter(Boolean).join('\n'),
)
const markupPlaceholder = computed(() => props.inheritedMarkupRate === undefined
  ? t('quotations.lineItems.markupInheritPlaceholder')
  : t('quotations.lineItems.markupInheritedValue', {
      rate: formatPercent(props.inheritedMarkupRate, props.currentLocale),
    }),
)
</script>

<template>
  <div class="item-editor-main">
    <div
      class="item-control-grid"
      :class="{
        'item-control-grid-mixed': props.isMixedTaxMode,
        'item-control-grid-group': props.isGroupItem,
      }"
    >
      <label class="pf pf-sm" :data-history-target="`item:${props.itemId}:quantity`">
        <span class="field-label">{{ t('quotations.lineItems.quantity') }}</span>
        <InputNumber
          :class="{ 'field-missing': !(props.quantityValue > 0) }"
          :model-value="props.quantityValue"
          :min="0"
          :max-fraction-digits="2"
          :aria-label="t('quotations.lineItems.itemQuantityAria', { index: props.displayItemNumber })"
          @update:model-value="emit('setNumber', 'quantity', $event)"
          @blur="emit('flushField', 'quantity')"
        />
      </label>
      <label class="pf pf-sm" :data-history-target="`item:${props.itemId}:quantityUnit`">
        <span class="field-label">{{ t('quotations.lineItems.unit') }}</span>
        <InputText
          :class="{ 'field-missing': !props.quantityUnitValue.trim() }"
          :model-value="props.quantityUnitValue"
          :aria-label="t('quotations.lineItems.itemUnitAria', { index: props.displayItemNumber })"
          @update:model-value="emit('setText', 'quantityUnit', $event)"
          @blur="emit('flushField', 'quantityUnit')"
        />
      </label>
      <template v-if="!props.isGroupItem">
        <label v-if="props.showPricingMethodSelector" class="pf pf-md" :data-history-target="`item:${props.itemId}:pricingMethod`">
          <span class="field-label">{{ t('quotations.lineItems.pricingBasis') }}</span>
          <Select
            :model-value="props.pricingMethodValue"
            :options="props.pricingMethodOptions"
            option-label="label"
            option-value="value"
            :aria-label="props.pricingMethodAriaLabel"
            @update:model-value="emit('setPricingMethod', $event)"
          />
        </label>
        <label v-if="props.showManualPriceControls" class="pf pf-lg" :data-history-target="`item:${props.itemId}:manualUnitPrice`">
          <span class="field-label">{{ props.manualPriceLabel }}</span>
          <InputNumber
            :class="{ 'field-missing': !(props.manualUnitPriceValue > 0) }"
            :model-value="props.manualUnitPriceValue"
            mode="currency"
            :currency="props.currency"
            :locale="props.currentLocale"
            :aria-label="props.manualUnitPriceAriaLabel"
            @update:model-value="emit('setNumber', 'manualUnitPrice', $event)"
            @blur="emit('flushField', 'manualUnitPrice')"
          />
        </label>
        <div v-if="props.showDetailedCostControls" class="cost-field-group">
          <label class="pf pf-lg pf-unit-cost" :data-history-target="`item:${props.itemId}:unitCost`">
            <span class="field-label">{{ t('quotations.lineItems.unitCost') }}</span>
            <InputNumber
              :class="{ 'field-missing': !(props.unitCostValue > 0) }"
              :model-value="props.unitCostValue"
              :locale="props.currentLocale"
              :aria-label="t('quotations.lineItems.itemUnitCostAria', { index: props.displayItemNumber })"
              @update:model-value="emit('setNumber', 'unitCost', $event)"
              @blur="emit('flushField', 'unitCost')"
            />
          </label>
          <label class="pf pf-sm" :data-history-target="`item:${props.itemId}:costCurrency`">
            <span class="field-label">{{ t('quotations.lineItems.costFx') }}</span>
            <Select
              :model-value="props.costCurrency"
              :options="props.costCurrencyOptions"
              filter
              :aria-label="t('quotations.lineItems.itemCostFxAria', { index: props.displayItemNumber })"
              @update:model-value="emit('setCurrency', $event)"
            />
          </label>
        </div>
        <label v-if="props.showMarkupEditor" class="pf pf-md pf-markup" :data-history-target="`item:${props.itemId}:markupRate`">
          <span class="field-label-row">
            <span class="field-label">{{ props.markupFieldLabel }}</span>
            <span
              v-if="markupHelp"
              v-tooltip.focus.top="markupHelp"
              :title="markupHelp"
              class="field-help"
              tabindex="0"
              :aria-label="markupHelp"
            >
              <i class="pi pi-question-circle" aria-hidden="true" />
            </span>
          </span>
          <span class="markup-input-row">
            <InputNumber
              :model-value="props.markupRateValue"
              :placeholder="markupPlaceholder"
              suffix="%"
              :min="0"
              :max="1000"
              :max-fraction-digits="2"
              :aria-label="props.markupAriaLabel"
              @update:model-value="emit('setOptionalNumber', 'markupRate', $event)"
              @blur="emit('flushField', 'markupRate')"
            />
            <Button
              v-if="props.showDetailedCostControls && props.unitCostValue > 0"
              v-tooltip.top="t('quotations.goalSeek.openItem')"
              icon="pi pi-bullseye"
              severity="secondary"
              text
              :aria-label="t('quotations.goalSeek.openItemAria', { itemNumber: props.displayItemNumber })"
              @click.stop.prevent="emit('requestGoalSeek')"
            />
          </span>
        </label>
      </template>
      <template v-else-if="props.showMarkupEditor">
        <label class="pf pf-md pf-markup" :data-history-target="`item:${props.itemId}:markupRate`">
          <span class="field-label-row">
            <span class="field-label">{{ props.markupFieldLabel }}</span>
            <span
              v-if="markupHelp"
              v-tooltip.focus.top="markupHelp"
              :title="markupHelp"
              class="field-help"
              tabindex="0"
              :aria-label="markupHelp"
            >
              <i class="pi pi-question-circle" aria-hidden="true" />
            </span>
          </span>
          <InputNumber
            :model-value="props.markupRateValue"
            :placeholder="markupPlaceholder"
            suffix="%"
            :min="0"
            :max="1000"
            :max-fraction-digits="2"
            :aria-label="props.markupAriaLabel"
            @update:model-value="emit('setOptionalNumber', 'markupRate', $event)"
            @blur="emit('flushField', 'markupRate')"
          />
        </label>
      </template>
      <label v-if="props.isMixedTaxMode" class="pf pf-lg" :data-history-target="`item:${props.itemId}:taxClassId`">
        <span class="field-label-row">
          <span class="field-label">{{ t('quotations.lineItems.taxClass') }}</span>
          <span v-if="props.unitTaxSummaryLabel" v-tooltip.focus.top="props.unitTaxSummaryLabel"
            class="field-help" tabindex="0" :title="props.unitTaxSummaryLabel" :aria-label="props.unitTaxSummaryLabel">
            <i class="pi pi-info-circle" aria-hidden="true" />
          </span>
        </span>
        <Select
          :model-value="props.taxClassValue"
          :options="props.taxClassOptions"
          :placeholder="props.taxClassOptions[0]?.label"
          option-label="label"
          option-value="value"
          :aria-label="t('quotations.lineItems.itemTaxClassAria', { index: props.displayItemNumber })"
          @update:model-value="emit('setTaxClass', $event)"
        />
      </label>
    </div>
  </div>

  <div v-if="props.isGroupItem && props.showExpectedTotal" class="expected-total-row">
    <p class="mismatch-warning">
      {{ props.mismatchMessage }}
    </p>
    <label class="pf pf-md expected-total-input" :data-history-target="`item:${props.itemId}:expectedTotal`">
      <span class="field-label">
        {{ t('quotations.lineItems.sourceTotal') }}
        <span class="field-label-hint">{{ t('quotations.lineItems.referenceOnly') }}</span>
      </span>
      <InputNumber
        :model-value="props.expectedTotalValue"
        mode="currency"
        :currency="props.currency"
        :locale="props.currentLocale"
        :min="0"
        :aria-label="t('quotations.lineItems.itemSourceTotalAria', { index: props.displayItemNumber })"
        @update:model-value="emit('setOptionalNumber', 'expectedTotal', $event)"
        @blur="emit('flushField', 'expectedTotal')"
      />
    </label>
  </div>
</template>

<style scoped>
.item-editor-main {
  min-width: 0;
}
.item-control-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  gap: 8px;
}
.pf {
  display: grid;
  flex: 1 1 150px;
  align-content: start;
  gap: 3px;
  min-width: 0;
  margin: 0;
}
.pf-sm {
  flex: 0 1 72px;
}
.pf-md {
  flex: 0 1 140px;
}
.pf-lg {
  max-width: 230px;
}
.pf-markup {
  flex: 1 1 170px;
  max-width: 260px;
}
.field-label, .field-label-row {
  min-height: 15px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
}
.field-label-row {
  display: flex;
  align-items: center;
  gap: 5px;
}
.field-label-hint {
  color: var(--text-subtle);
  font-weight: 400;
}
.field-help {
  display: inline-flex;
  color: var(--text-subtle);
  cursor: help;
}
.field-help:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.field-help .pi {
  font-size: 11px;
}
.cost-field-group {
  display: grid;
  flex: 0 1 220px;
  grid-template-columns: minmax(0, 1.4fr) minmax(70px, 1fr);
  gap: 6px;
  min-width: 0;
}
.pf :deep(.p-inputtext), .pf :deep(.p-inputnumber), .pf :deep(.p-select) {
  min-width: 0;
  width: 100%;
}
.pf :deep(.p-inputtext), .pf :deep(.p-select) {
  min-height: 30px;
  border-radius: 4px;
  background: var(--surface-card);
  border-color: var(--surface-border);
  box-shadow: none;
  font-size: 12px;
}
.pf :deep(.p-inputtext) {
  padding: 5px 8px;
}
.pf :deep(.p-inputnumber-input) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.pf :deep(.p-select-label) {
  padding: 5px 8px;
  font-size: 12px;
}
.pf :deep(.p-select-dropdown) {
  width: 24px;
}
.markup-input-row {
  display: flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
}
.markup-input-row :deep(.p-button) {
  flex-shrink: 0;
  width: 28px;
  height: 30px;
  padding: 0;
}
.expected-total-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(150px, 220px);
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-left: 2px solid var(--warning);
  background: var(--warning-soft);
}
.mismatch-warning {
  margin: 0;
  color: var(--warning);
  font-size: 12px;
  line-height: 1.4;
}
.field-missing {
  border-color: var(--warning) !important;
}

.pf-unit-cost > .field-label,
.pf-markup .field-label {
  color: var(--accent-emphasis);
  font-weight: 700;
}

/* Match the theme while overriding the app's default input colors. */
.pf-unit-cost :deep(.p-inputnumber-input),
.pf-markup :deep(.p-inputnumber-input) {
  border-color: var(--accent-soft) !important;
  background: var(--accent-surface) !important;
  color: var(--accent-emphasis) !important;
  font-size: 13px;
  font-weight: 700;
}

.pf-markup :deep(.p-inputnumber-input::placeholder) {
  color: var(--accent-emphasis) !important;
  opacity: 1;
}

.pf-unit-cost :deep(.field-missing .p-inputnumber-input) {
  border-color: var(--warning) !important;
}
@container line-item-card (max-width: 540px) {
  .item-control-grid:not(.item-control-grid-group) {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
  .item-control-grid:not(.item-control-grid-group) > .pf {
    grid-column: span 3;
  }
  .item-control-grid:not(.item-control-grid-group) > .pf-sm {
    grid-column: span 2;
  }
  .cost-field-group {
    grid-column: span 3;
  }
  .expected-total-row {
    grid-template-columns: 1fr;
  }
}
</style>
