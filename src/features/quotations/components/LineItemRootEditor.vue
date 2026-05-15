<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useI18n } from 'vue-i18n'

import type { CurrencyCode, PricingMethod, QuotationItemField } from '../types'
import type { SupportedLocale } from '@/shared/i18n/locale'

type SelectOption<T extends string = string> = {
  label: string
  value: T
}

const props = defineProps<{
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
  taxClassValue: string | null
  descriptionValue: string
  expectedTotalValue: number | null | undefined
  manualPriceLabel: string
  manualUnitPriceAriaLabel: string
  pricingMethodAriaLabel: string
  markupFieldLabel: string
  markupLabel: string
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
}>()

const { t } = useI18n()
</script>

<template>
  <div class="item-editor-main">
    <div class="item-control-grid" :class="{ 'item-control-grid-mixed': props.isMixedTaxMode }">
      <label class="pf pf-sm">
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
      <label class="pf pf-sm">
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
        <label v-if="props.showPricingMethodSelector" class="pf pf-md">
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
        <label v-if="props.showManualPriceControls" class="pf pf-lg">
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
        <template v-if="props.showDetailedCostControls">
          <label class="pf pf-lg">
            <span class="field-label">{{ t('quotations.lineItems.unitCost') }}</span>
            <InputNumber
              :class="{ 'field-missing': !(props.unitCostValue > 0) }"
              :model-value="props.unitCostValue"
              mode="currency"
              :currency="props.costCurrency"
              :locale="props.currentLocale"
              :aria-label="t('quotations.lineItems.itemUnitCostAria', { index: props.displayItemNumber })"
              @update:model-value="emit('setNumber', 'unitCost', $event)"
              @blur="emit('flushField', 'unitCost')"
            />
          </label>
          <label class="pf pf-sm">
            <span class="field-label">{{ t('quotations.lineItems.costFx') }}</span>
            <Select
              :model-value="props.costCurrency"
              :options="props.costCurrencyOptions"
              :aria-label="t('quotations.lineItems.itemCostFxAria', { index: props.displayItemNumber })"
              @update:model-value="emit('setCurrency', $event)"
            />
          </label>
        </template>
        <label v-if="props.showMarkupEditor" class="pf pf-md">
          <span class="field-label">{{ props.markupFieldLabel }}</span>
          <InputNumber
            :model-value="props.markupRateValue"
            :placeholder="t('quotations.lineItems.markupInheritPlaceholder')"
            suffix="%"
            :min="0"
            :max="1000"
            :max-fraction-digits="2"
            :aria-label="props.markupAriaLabel"
            @update:model-value="emit('setOptionalNumber', 'markupRate', $event)"
            @blur="emit('flushField', 'markupRate')"
          />
          <small class="field-hint">{{ props.markupLabel }}</small>
        </label>
      </template>
      <template v-else-if="props.showMarkupEditor">
        <label class="pf pf-md">
          <span class="field-label">{{ props.markupFieldLabel }}</span>
          <InputNumber
            :model-value="props.markupRateValue"
            :placeholder="t('quotations.lineItems.markupInheritPlaceholder')"
            suffix="%"
            :min="0"
            :max="1000"
            :max-fraction-digits="2"
            :aria-label="props.markupAriaLabel"
            @update:model-value="emit('setOptionalNumber', 'markupRate', $event)"
            @blur="emit('flushField', 'markupRate')"
          />
          <small class="field-hint">{{ props.markupLabel }}</small>
        </label>
      </template>
      <label v-if="props.isMixedTaxMode" class="pf pf-lg">
        <span class="field-label">{{ t('quotations.lineItems.taxClass') }}</span>
        <Select
          :model-value="props.taxClassValue"
          :options="props.taxClassOptions"
          option-label="label"
          option-value="value"
          :aria-label="t('quotations.lineItems.itemTaxClassAria', { index: props.displayItemNumber })"
          @update:model-value="emit('setTaxClass', $event)"
        />
        <small class="field-hint">{{ props.unitTaxSummaryLabel }}</small>
      </label>
    </div>

    <label class="desc-label desc-label-compact">
      <span class="field-label">{{ t('quotations.lineItems.description') }}</span>
      <Textarea
        :model-value="props.descriptionValue"
        :aria-label="t('quotations.lineItems.itemDescriptionAria', { index: props.displayItemNumber })"
        rows="1"
        auto-resize
        :placeholder="t('quotations.lineItems.descriptionPlaceholder')"
        @update:model-value="emit('setText', 'description', $event)"
        @blur="emit('flushField', 'description')"
      />
    </label>
  </div>

  <div v-if="props.isGroupItem && props.showExpectedTotal" class="expected-total-row">
    <p class="mismatch-warning">
      {{ props.mismatchMessage }}
    </p>
    <label class="pf pf-md expected-total-input">
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
.field-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
}

.field-label-hint {
  color: var(--text-subtle);
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
}

.field-hint {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.item-editor-main {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.item-control-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 6px;
  align-items: start;
}

.item-control-grid-mixed {
  grid-template-columns: repeat(15, minmax(0, 1fr));
}

.pf {
  display: grid;
  grid-column: span 3;
  gap: 3px;
  min-width: 0;
}

.pf-sm {
  grid-column: span 2;
}

.pf-md,
.pf-lg {
  grid-column: span 3;
}

.pf :deep(.p-inputtext),
.pf :deep(.p-inputnumber),
.pf :deep(.p-inputnumber-input),
.pf :deep(.p-select) {
  min-width: 0;
  width: 100%;
}

.pf :deep(.p-inputtext),
.pf :deep(.p-inputnumber-input) {
  min-height: 32px;
  padding: 0.35rem 0.6rem;
  font-size: 13px;
}

.pf :deep(.p-select-label) {
  min-width: 0;
  padding: 0.35rem 0.6rem;
  font-size: 13px;
}

.desc-label {
  display: grid;
  gap: 3px;
}

.desc-label :deep(.p-textarea) {
  width: 100%;
  white-space: pre-wrap;
}

.desc-label-compact :deep(.p-textarea) {
  min-height: 30px;
  padding: 0.32rem 0.6rem;
  font-size: 12.5px;
  line-height: 1.45;
}

.expected-total-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--warning-border);
  border-radius: var(--radius-md);
  background: var(--warning-soft);
}

.expected-total-input {
  grid-column: auto;
}

.mismatch-warning {
  margin: 0;
  color: var(--warning);
  font-size: 12px;
  font-weight: 600;
}

.field-missing {
  border-color: #f59e0b !important;
  box-shadow: 0 0 0 1px rgb(245 158 11 / 22%) !important;
}

@container line-item-card (max-width: 920px) {
  .expected-total-row {
    grid-template-columns: 1fr;
  }
}

@container line-item-card (max-width: 700px) {
  .item-control-grid,
  .item-control-grid-mixed {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .pf,
  .pf-sm,
  .pf-md,
  .pf-lg {
    grid-column: span 3;
  }
}

@container line-item-card (max-width: 520px) {
  .item-control-grid,
  .item-control-grid-mixed {
    grid-template-columns: 1fr;
  }

  .pf,
  .pf-sm,
  .pf-md,
  .pf-lg {
    grid-column: 1 / -1;
  }
}
</style>
