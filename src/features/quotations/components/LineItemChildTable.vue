<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency } from '@/shared/utils/formatters'

import type { ChildRow } from '../utils/lineItemChildRows'
import {
  calculateQuotationItemSectionUnitCost,
  type QuotationItemPricingDisplay,
} from '../utils/quotationItemPricing'
import type {
  CurrencyCode,
  ExchangeRateTable,
  PricingMethod,
  QuotationItem,
  QuotationItemField,
} from '../types'

type SelectOption<T extends string = string> = {
  label: string
  value: T
}

const props = defineProps<{
  rows: ChildRow[]
  warningRows: ChildRow[]
  currency: CurrencyCode
  currentLocale: SupportedLocale
  exchangeRates: ExchangeRateTable
  costCurrencyOptions: string[]
  pricingMethodOptions: Array<SelectOption<PricingMethod>>
  taxMode: string
  isMixedTaxMode: boolean
  showAmountWithTax: boolean
  isGroupItem: (item: QuotationItem) => boolean
  isSectionExpanded: (itemId: string) => boolean
  isItemIncomplete: (item: QuotationItem) => boolean
  shouldShowPricingMethodSelector: (item: QuotationItem) => boolean
  shouldShowDetailedCostControls: (item: QuotationItem) => boolean
  shouldShowMarkupEditor: (item: QuotationItem) => boolean
  shouldShowManualPriceControls: (item: QuotationItem) => boolean
  shouldShowTaxSummary: (item: QuotationItem) => boolean
  getTextFieldValue: (item: QuotationItem, field: QuotationItemField) => string
  getNumberFieldValue: (item: QuotationItem, field: QuotationItemField, fallback?: number) => number
  getOptionalNumberFieldValue: (
    item: QuotationItem,
    field: QuotationItemField,
  ) => number | null | undefined
  getPricingMethodValue: (item: QuotationItem) => PricingMethod
  getPricing: (itemId: string) => QuotationItemPricingDisplay | undefined
  getMarkupLabel: (item: QuotationItem) => string
  getLineMarkupAriaLabel: (item: QuotationItem, itemNumber: string) => string
  getLineManualUnitPriceAriaLabel: (itemNumber: string) => string
  getLinePricingMethodAriaLabel: (itemNumber: string) => string
  getTaxClassValue: (item: QuotationItem) => string
  getTaxClassOptions: (inheritedTaxClassId?: string) => SelectOption[]
  getUnitTaxSummaryLabel: (item: QuotationItem) => string
  getTotalTaxSummaryLabel: (item: QuotationItem) => string
  getUnitSellingPrice: (item: QuotationItem) => number
  getSellingAmount: (item: QuotationItem) => number
  getAmountWithTax: (item: QuotationItem) => number
  getMismatchMessage: (item: QuotationItem) => string
}>()

const emit = defineEmits<{
  toggleSection: [itemId: string]
  setText: [itemId: string, field: QuotationItemField, value: unknown]
  setNumber: [itemId: string, field: QuotationItemField, value: unknown]
  setOptionalNumber: [itemId: string, field: QuotationItemField, value: unknown]
  setPricingMethod: [itemId: string, value: unknown]
  setCurrency: [itemId: string, value: unknown]
  setTaxClass: [itemId: string, value: unknown]
  addChildItem: [itemId: string]
  removeItem: [itemId: string]
  flushField: [itemId: string, field: QuotationItemField]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="child-table-wrap">
    <div class="child-table">
      <div
        class="ct-head"
        :class="props.isMixedTaxMode ? 'ct-grid-mixed' : props.showAmountWithTax ? 'ct-grid-single' : 'ct-grid-notax'"
      >
        <span>#</span>
        <span>{{ t('quotations.lineItems.childHeaders.item') }}</span>
        <span>{{ t('quotations.lineItems.childHeaders.qty') }}</span>
        <span>{{ t('quotations.lineItems.childHeaders.unit') }}</span>
        <span>{{ t('quotations.lineItems.childHeaders.unitCost') }}</span>
        <span>{{ t('quotations.lineItems.childHeaders.costFx') }}</span>
        <span>{{ t('quotations.lineItems.childHeaders.markup') }}</span>
        <span v-if="props.isMixedTaxMode">{{ t('quotations.lineItems.childHeaders.taxClass') }}</span>
        <span>{{ t('quotations.lineItems.childHeaders.unitPrice') }}</span>
        <span>{{ t('quotations.lineItems.childHeaders.amount') }}</span>
        <span v-if="props.showAmountWithTax">{{ t('quotations.lineItems.childHeaders.amountWithTax') }}</span>
        <span></span>
      </div>

      <div
        v-for="row in props.rows"
        :key="row.item.id"
        class="ct-row"
        :data-item-id="row.item.id"
        :data-tax-mode="props.taxMode"
        :class="{
          'ct-grid-mixed': props.isMixedTaxMode,
          'ct-grid-single': !props.isMixedTaxMode && props.showAmountWithTax,
          'ct-grid-notax': !props.isMixedTaxMode && !props.showAmountWithTax,
          'ct-row-l2': row.depth === 2 && !props.isGroupItem(row.item),
          'ct-row-section': props.isGroupItem(row.item),
          'ct-row-d3': row.depth === 3,
          'ct-row-incomplete': props.isItemIncomplete(row.item),
        }"
      >
        <span
          class="ct-num"
          :class="{
            'ct-num-l2': row.depth === 2 && !props.isGroupItem(row.item),
            'ct-num-d3': row.depth === 3,
            'ct-num-section': props.isGroupItem(row.item),
          }"
        >
          <button
            v-if="props.isGroupItem(row.item) && row.item.children.length > 0"
            type="button"
            class="ct-section-toggle"
            :aria-expanded="props.isSectionExpanded(row.item.id)"
            :aria-label="props.isSectionExpanded(row.item.id)
              ? t('quotations.lineItems.collapseItem')
              : t('quotations.lineItems.expandItem')"
            @click="emit('toggleSection', row.item.id)"
          >
            <i :class="props.isSectionExpanded(row.item.id) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
          </button>
          <span
            class="ct-num-badge"
            :class="{
              'ct-badge-l2': row.depth === 2 && !props.isGroupItem(row.item),
              'ct-badge-section': props.isGroupItem(row.item),
              'ct-badge-d3': row.depth === 3,
            }"
          >
            {{ row.itemNumber }}
          </span>
        </span>

        <div class="ct-item">
          <InputText
            :class="{ 'field-missing': !props.getTextFieldValue(row.item, 'name').trim() }"
            :model-value="props.getTextFieldValue(row.item, 'name')"
            :aria-label="t('quotations.lineItems.lineItemNameAria', { itemNumber: row.itemNumber })"
            :placeholder="t('quotations.lineItems.namePlaceholder')"
            @update:model-value="emit('setText', row.item.id, 'name', $event)"
            @blur="emit('flushField', row.item.id, 'name')"
          />
          <Textarea
            :model-value="props.getTextFieldValue(row.item, 'description')"
            :aria-label="t('quotations.lineItems.lineItemDescriptionAria', { itemNumber: row.itemNumber })"
            rows="1"
            auto-resize
            :placeholder="t('quotations.lineItems.descriptionPlaceholder')"
            @update:model-value="emit('setText', row.item.id, 'description', $event)"
            @blur="emit('flushField', row.item.id, 'description')"
          />
          <div class="ct-meta">
            <span v-if="props.shouldShowPricingMethodSelector(row.item)" class="ct-meta-control">
              <span class="ct-meta-label">{{ t('quotations.lineItems.pricingBasis') }}</span>
              <Select
                :model-value="props.getPricingMethodValue(row.item)"
                :options="props.pricingMethodOptions"
                option-label="label"
                option-value="value"
                :aria-label="props.getLinePricingMethodAriaLabel(row.itemNumber)"
                @update:model-value="emit('setPricingMethod', row.item.id, $event)"
              />
            </span>
            <span>
              {{ t('quotations.lineItems.totalCost') }}:
              {{ formatCurrency(props.getPricing(row.item.id)?.baseAmount ?? 0, props.currency, props.currentLocale) }}
            </span>
          </div>
        </div>

        <InputNumber
          :class="{ 'field-missing': !(props.getNumberFieldValue(row.item, 'quantity') > 0) }"
          :model-value="props.getNumberFieldValue(row.item, 'quantity')"
          :min="0"
          :max-fraction-digits="2"
          :aria-label="t('quotations.lineItems.lineItemQuantityAria', { itemNumber: row.itemNumber })"
          @update:model-value="emit('setNumber', row.item.id, 'quantity', $event)"
          @blur="emit('flushField', row.item.id, 'quantity')"
        />

        <InputText
          :class="{ 'field-missing': !props.getTextFieldValue(row.item, 'quantityUnit').trim() }"
          :model-value="props.getTextFieldValue(row.item, 'quantityUnit')"
          :aria-label="t('quotations.lineItems.lineItemUnitAria', { itemNumber: row.itemNumber })"
          @update:model-value="emit('setText', row.item.id, 'quantityUnit', $event)"
          @blur="emit('flushField', row.item.id, 'quantityUnit')"
        />

        <template v-if="!props.isGroupItem(row.item)">
          <template v-if="props.shouldShowDetailedCostControls(row.item)">
            <InputNumber
              :class="{ 'field-missing': !(props.getNumberFieldValue(row.item, 'unitCost') > 0) }"
              :model-value="props.getNumberFieldValue(row.item, 'unitCost')"
              mode="currency"
              :currency="row.item.costCurrency"
              :locale="props.currentLocale"
              :aria-label="t('quotations.lineItems.lineItemUnitCostAria', { itemNumber: row.itemNumber })"
              @update:model-value="emit('setNumber', row.item.id, 'unitCost', $event)"
              @blur="emit('flushField', row.item.id, 'unitCost')"
            />
            <Select
              :model-value="row.item.costCurrency"
              :options="props.costCurrencyOptions"
              class="cost-fx-select"
              :aria-label="t('quotations.lineItems.lineItemCostFxAria', { itemNumber: row.itemNumber })"
              @update:model-value="emit('setCurrency', row.item.id, $event)"
            />
          </template>
          <template v-else>
            <span class="ct-muted">--</span>
            <span class="ct-muted">--</span>
          </template>
        </template>
        <template v-else>
          <span class="ct-derived-cost">
            {{ formatCurrency(calculateQuotationItemSectionUnitCost(row.item, props.exchangeRates), props.currency, props.currentLocale) }}
          </span>
          <span class="ct-muted">{{ props.currency }}</span>
        </template>

        <div class="ct-markup">
          <template v-if="props.shouldShowMarkupEditor(row.item)">
            <InputNumber
              :model-value="props.getOptionalNumberFieldValue(row.item, 'markupRate')"
              :placeholder="t('quotations.lineItems.markupInheritPlaceholder')"
              suffix="%"
              :min="0"
              :max="1000"
              :max-fraction-digits="2"
              :aria-label="props.getLineMarkupAriaLabel(row.item, row.itemNumber)"
              @update:model-value="emit('setOptionalNumber', row.item.id, 'markupRate', $event)"
              @blur="emit('flushField', row.item.id, 'markupRate')"
            />
            <small class="ct-hint">{{ props.getMarkupLabel(row.item) }}</small>
          </template>
          <span v-else class="ct-muted">--</span>
        </div>

        <div v-if="props.isMixedTaxMode" class="ct-markup">
          <Select
            :model-value="props.getTaxClassValue(row.item)"
            :options="props.getTaxClassOptions(row.inheritedTaxClassId)"
            option-label="label"
            option-value="value"
            :aria-label="t('quotations.lineItems.lineItemTaxClassAria', { itemNumber: row.itemNumber })"
            @update:model-value="emit('setTaxClass', row.item.id, $event)"
          />
          <small class="ct-hint">{{ props.getUnitTaxSummaryLabel(row.item) }}</small>
        </div>

        <template v-if="props.shouldShowManualPriceControls(row.item)">
          <InputNumber
            :class="{ 'field-missing': !(props.getNumberFieldValue(row.item, 'manualUnitPrice') > 0) }"
            :model-value="props.getNumberFieldValue(row.item, 'manualUnitPrice')"
            mode="currency"
            :currency="props.currency"
            :locale="props.currentLocale"
            :aria-label="props.getLineManualUnitPriceAriaLabel(row.itemNumber)"
            @update:model-value="emit('setNumber', row.item.id, 'manualUnitPrice', $event)"
            @blur="emit('flushField', row.item.id, 'manualUnitPrice')"
          />
        </template>
        <span v-else class="ct-amount">
          {{ formatCurrency(props.getUnitSellingPrice(row.item), props.currency, props.currentLocale) }}
        </span>

        <span class="ct-amount">
          {{ formatCurrency(props.getSellingAmount(row.item), props.currency, props.currentLocale) }}
        </span>

        <div v-if="props.showAmountWithTax" class="ct-amount-detail">
          <span class="ct-amount">
            {{ formatCurrency(props.getAmountWithTax(row.item), props.currency, props.currentLocale) }}
          </span>
          <small v-if="props.isMixedTaxMode && props.shouldShowTaxSummary(row.item)" class="ct-hint ct-amount-hint">
            {{ props.getTotalTaxSummaryLabel(row.item) }}
          </small>
        </div>

        <span class="ct-actions">
          <Button
            v-if="row.depth < 3"
            v-tooltip.top="t('quotations.lineItems.addChild')"
            icon="pi pi-plus"
            severity="secondary"
            text
            rounded
            :aria-label="t('quotations.lineItems.addChildToLineItemAria', { itemNumber: row.itemNumber })"
            @click="emit('addChildItem', row.item.id)"
          />
          <Button
            v-tooltip.top="t('quotations.lineItems.delete')"
            icon="pi pi-trash"
            severity="danger"
            text
            rounded
            :aria-label="t('quotations.lineItems.deleteLineItemAria', { itemNumber: row.itemNumber })"
            @click="emit('removeItem', row.item.id)"
          />
        </span>
      </div>

      <p
        v-for="row in props.warningRows"
        :key="`warn-${row.item.id}`"
        class="child-warning"
      >
        {{ row.itemNumber }}: {{ props.getMismatchMessage(row.item) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.child-table-wrap {
  overflow: visible;
  padding: 7px 8px 8px 14px;
  border-top: 1px solid color-mix(in srgb, var(--surface-border) 72%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--surface-border) 72%, transparent);
  background: color-mix(in srgb, var(--surface-muted) 62%, white);
  transition: background-color 0.18s ease;
}

:global(.item-card:hover) .child-table-wrap {
  background: color-mix(in srgb, var(--accent-surface) 52%, white);
}

:global(.item-card-focused) .child-table-wrap {
  background: color-mix(in srgb, var(--accent-surface) 68%, white);
}

.child-table {
  display: grid;
  min-width: 980px;
  gap: 4px;
  background: transparent;
}

.ct-head,
.ct-row {
  display: grid;
  gap: 4px;
  align-items: center;
  padding: 3px 7px;
}

.ct-grid-mixed {
  grid-template-columns: 54px minmax(190px, 1.45fr) 54px 58px 94px 72px 88px 108px 88px 90px 92px 52px;
}

.ct-grid-single {
  grid-template-columns: 54px minmax(190px, 1.45fr) 54px 58px 94px 72px 88px 88px 90px 92px 52px;
}

.ct-grid-notax {
  grid-template-columns: 54px minmax(190px, 1.45fr) 54px 58px 94px 72px 88px 88px 90px 52px;
}

.ct-head {
  min-height: 26px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 72%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--surface-raised) 88%, white);
  color: var(--text-muted);
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.035em;
  position: sticky;
  top: 54px;
  z-index: 7;
  box-shadow:
    0 1px 0 color-mix(in srgb, var(--surface-border) 70%, transparent),
    0 8px 14px rgb(15 23 42 / 8%);
}

.ct-row {
  position: relative;
  min-height: 34px;
  align-items: start;
  border: 1px solid color-mix(in srgb, var(--surface-border) 72%, transparent);
  border-radius: var(--radius-sm);
  border-left: 0;
  background: var(--surface-card);
  scroll-margin-top: 160px;
  box-shadow: 0 1px 1px rgb(15 23 42 / 3%);
  transition: background-color 0.13s ease, border-color 0.13s ease, box-shadow 0.13s ease;
}

.ct-row::before {
  content: '';
  position: absolute;
  top: 5px;
  bottom: 5px;
  left: 0;
  width: 4px;
  border-radius: 0 4px 4px 0;
  background: transparent;
}

.ct-row:hover {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--surface-border));
  background: color-mix(in srgb, var(--accent-surface) 34%, white);
  box-shadow:
    inset 4px 0 0 0 color-mix(in srgb, var(--accent) 28%, transparent),
    0 3px 10px rgb(15 23 42 / 6%);
}

.ct-row:focus-within {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent-surface) 54%, white);
  box-shadow: inset 4px 0 0 0 var(--accent);
}

.ct-row-l2::before {
  background: var(--info);
  opacity: 0.55;
}

.ct-row-l2 {
  background: #ffffff;
}

.ct-row-section {
  min-height: 46px;
  border-color: color-mix(in srgb, var(--accent) 34%, var(--surface-border));
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--accent-surface) 80%, white), #ffffff 62%),
    #ffffff;
}

.ct-row-section::before {
  width: 4px;
  background: var(--accent);
}

.ct-row-section .ct-item :deep(.p-inputtext:first-child) {
  border-color: color-mix(in srgb, var(--accent) 20%, var(--surface-border));
  background: #ffffff;
  font-weight: 760;
}

.ct-row-section .ct-item {
  gap: 4px;
}

.ct-row-section .ct-actions :deep(.p-button:first-child) {
  width: 32px;
  height: 32px;
  border: 1px solid var(--accent-soft);
  background: var(--surface-card);
  color: var(--accent);
}

.ct-row-d3 {
  padding-left: 24px;
  border-left: 0;
  border-color: color-mix(in srgb, var(--info) 12%, var(--surface-border));
  background: color-mix(in srgb, var(--info-soft) 28%, white);
}

.ct-row-d3::before {
  left: 16px;
  width: 2px;
  background: color-mix(in srgb, var(--info) 36%, var(--surface-border-strong));
  opacity: 0.6;
}

.ct-row-incomplete::before {
  background: #f59e0b !important;
  opacity: 0.85;
}

.ct-row-incomplete {
  background: #fffbf3 !important;
}

.field-missing {
  border-color: #f59e0b !important;
  box-shadow: 0 0 0 1px rgb(245 158 11 / 22%) !important;
}

.ct-row :deep(.p-inputtext),
.ct-row :deep(.p-inputnumber),
.ct-row :deep(.p-select) {
  width: 100%;
  min-width: 0;
}

.ct-row :deep(.p-inputnumber-input),
.ct-row :deep(.p-select-label) {
  min-width: 0;
  font-size: 12px;
}

.ct-row :deep(.p-inputtext),
.ct-row :deep(.p-inputnumber-input) {
  min-height: 28px;
  padding: 0.27rem 0.44rem;
  font-size: 12px;
  font-weight: 600;
}

.ct-row :deep(.p-select-label) {
  padding: 0.27rem 0.44rem;
}

.cost-fx-select {
  min-width: 102px;
}

.cost-fx-select :deep(.p-select-label) {
  overflow: visible;
  text-overflow: clip;
}

.ct-row :deep(.p-textarea) {
  width: 100%;
  max-height: 36px;
  overflow: auto;
  white-space: pre-wrap;
}

.ct-num {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
}

.ct-num-section {
  gap: 4px;
}

.ct-section-toggle {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 19px;
  height: 19px;
  padding: 0;
  border: none;
  border-radius: 4px;
  color: var(--accent);
  background: rgb(4 120 87 / 14%);
  cursor: pointer;
  font-size: 9px;
}

.ct-section-toggle:hover {
  background: rgb(4 120 87 / 25%);
}

.ct-num-d3 {
  position: relative;
  justify-content: flex-end;
  padding-right: 3px;
}

.ct-num-d3::before {
  content: '';
  position: absolute;
  left: -1px;
  bottom: 50%;
  width: 18px;
  height: 14px;
  border-left: 2px solid var(--surface-border-strong);
  border-bottom: 2px solid var(--surface-border-strong);
  border-radius: 0 0 0 4px;
}

.ct-num-badge {
  display: inline-grid;
  min-width: 28px;
  height: 18px;
  place-items: center;
  padding: 0 5px;
  border-radius: var(--radius-xs);
  background: var(--info-soft);
  color: var(--info);
  font-size: 10.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ct-badge-section {
  min-width: 32px;
  height: 21px;
  background: var(--accent);
  color: #ffffff;
}

.ct-badge-l2 {
  background: var(--info-soft);
  color: var(--info);
}

.ct-badge-d3 {
  background: var(--surface-muted);
  color: var(--text-muted);
  font-weight: 700;
}

.ct-item {
  display: grid;
  gap: 3px;
  min-width: 0;
  align-self: center;
  padding: 2px 0;
}

.ct-item :deep(.p-inputtext) {
  font-size: 12.5px;
}

.ct-item :deep(.p-textarea) {
  min-height: 24px;
  padding: 0.28rem 0.46rem;
  border-color: color-mix(in srgb, var(--surface-border) 70%, transparent);
  background: color-mix(in srgb, var(--surface-muted) 46%, white);
  font-size: 11.5px;
  line-height: 1.25;
}

.ct-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 7px;
  color: var(--text-subtle);
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1.15;
}

.ct-meta-control {
  display: grid;
  gap: 2px;
  min-width: 120px;
}

.ct-meta-label {
  color: var(--text-subtle);
  font-size: 10px;
  font-weight: 600;
}

.ct-meta-control :deep(.p-select) {
  min-width: 0;
}

.ct-meta-control :deep(.p-select-label) {
  padding: 0.28rem 0.45rem;
  font-size: 11px;
}

.ct-markup {
  display: grid;
  gap: 2px;
  min-width: 0;
  align-self: start;
}

.ct-hint {
  color: var(--text-subtle);
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1.2;
}

.ct-amount-hint {
  justify-self: end;
  padding-right: 4px;
  text-align: right;
}

.ct-amount-detail {
  display: grid;
  gap: 2px;
  justify-items: end;
  min-width: 0;
  align-self: start;
}

.ct-amount {
  align-self: start;
  color: var(--text-strong);
  font-size: 11.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
  justify-self: end;
}

.ct-muted {
  align-self: start;
  padding-top: 7px;
  color: var(--text-subtle);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  justify-self: center;
}

.ct-derived-cost {
  align-self: start;
  padding-top: 7px;
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  font-style: italic;
}

.ct-actions {
  display: flex;
  align-self: center;
  justify-content: flex-end;
  gap: 0;
  padding-right: 1px;
}

.ct-actions :deep(.p-button) {
  width: 24px;
  height: 24px;
}

.ct-row-l2 .ct-actions :deep(.p-button:first-child) {
  border: 1px solid var(--surface-border-strong);
  background: var(--surface-card);
  color: var(--info);
}

.child-warning {
  margin: 0;
  padding: 5px 10px;
  background: var(--warning-soft);
  border-top: 1px solid #fed7aa;
  color: var(--warning);
  font-size: 12px;
  font-weight: 600;
}
</style>
