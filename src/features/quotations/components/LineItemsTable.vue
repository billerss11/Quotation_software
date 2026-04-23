<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'

import { formatCurrency } from '@/shared/utils/formatters'

import type {
  CurrencyCode,
  ExchangeRateTable,
  MajorItemField,
  MajorItemSummary,
  QuotationMajorItem,
  QuotationSubItem,
  SubItemField,
} from '../types'
import {
  calculateLineSellingAmount,
  calculateUnitSellingPrice,
  getEffectiveMarkupRate,
} from '../utils/quotationCalculations'
import { getMajorItemPricingDisplay } from '../utils/majorItemPricingDisplay'

const props = defineProps<{
  items: QuotationMajorItem[]
  summaries: MajorItemSummary[]
  currency: CurrencyCode
  globalMarkupRate: number
  exchangeRates: ExchangeRateTable
}>()

const emit = defineEmits<{
  addMajorItem: []
  addSubItem: [majorItemId: string]
  removeMajorItem: [majorItemId: string]
  removeSubItem: [majorItemId: string, subItemId: string]
  duplicateMajorItem: [majorItemId: string]
  moveMajorItem: [majorItemId: string, direction: -1 | 1]
  updateMajorItemField: [
    majorItemId: string,
    field: MajorItemField,
    value: QuotationMajorItem[MajorItemField],
  ]
  updateSubItemField: [
    majorItemId: string,
    subItemId: string,
    field: SubItemField,
    value: QuotationSubItem[SubItemField],
  ]
}>()

const summaryByItemId = computed(() => new Map(props.summaries.map((summary) => [summary.itemId, summary])))
const pricingDisplayByItemId = computed(
  () =>
    new Map(
      props.items.map((item) => [
        item.id,
        getMajorItemPricingDisplay(item, summaryByItemId.value.get(item.id)),
      ]),
    ),
)

function getSummary(itemId: string) {
  return summaryByItemId.value.get(itemId)
}

function getPricingDisplay(itemId: string) {
  return pricingDisplayByItemId.value.get(itemId)
}

function updateMajorText(itemId: string, field: MajorItemField, value: unknown) {
  emit('updateMajorItemField', itemId, field, String(value ?? ''))
}

function updateMajorNumber(itemId: string, field: MajorItemField, value: unknown) {
  emit('updateMajorItemField', itemId, field, toNumber(value))
}

function updateMajorCurrency(itemId: string, value: unknown) {
  emit('updateMajorItemField', itemId, 'costCurrency', value as CurrencyCode)
}

function updateSubText(itemId: string, subItemId: string, field: SubItemField, value: unknown) {
  emit('updateSubItemField', itemId, subItemId, field, String(value ?? ''))
}

function updateSubNumber(itemId: string, subItemId: string, field: SubItemField, value: unknown) {
  emit('updateSubItemField', itemId, subItemId, field, toNumber(value))
}

function updateSubCurrency(itemId: string, subItemId: string, value: unknown) {
  emit('updateSubItemField', itemId, subItemId, 'costCurrency', value as CurrencyCode)
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getMajorMarkupRate(item: QuotationMajorItem) {
  return getEffectiveMarkupRate(item.markupRate, props.globalMarkupRate)
}

function getSubItemMarkupRate(item: QuotationMajorItem, subItem: QuotationSubItem) {
  return getEffectiveMarkupRate(subItem.markupRate ?? item.markupRate, props.globalMarkupRate)
}

const currencyOptions: CurrencyCode[] = ['USD', 'EUR', 'CNY', 'GBP']
</script>

<template>
  <section class="items-panel" aria-label="Line items">
    <div class="panel-heading">
      <div>
        <h2 class="section-title">Line Items</h2>
        <p class="section-subtitle">Major items own subtotal lines; sub-items roll up automatically.</p>
      </div>
      <Button icon="pi pi-plus" label="Major item" @click="emit('addMajorItem')" />
    </div>

    <div class="items-list">
      <article v-for="(item, itemIndex) in items" :key="item.id" class="major-item">
        <header class="major-header">
          <span class="item-index">{{ itemIndex + 1 }}</span>
          <InputText
            class="title-input"
            :model-value="item.title"
            @update:model-value="updateMajorText(item.id, 'title', $event)"
          />
          <div class="item-actions">
            <Button
              v-tooltip.top="'Move up'"
              icon="pi pi-arrow-up"
              severity="secondary"
              text
              rounded
              :disabled="itemIndex === 0"
              @click="emit('moveMajorItem', item.id, -1)"
            />
            <Button
              v-tooltip.top="'Move down'"
              icon="pi pi-arrow-down"
              severity="secondary"
              text
              rounded
              :disabled="itemIndex === items.length - 1"
              @click="emit('moveMajorItem', item.id, 1)"
            />
            <Button
              v-tooltip.top="'Duplicate'"
              icon="pi pi-copy"
              severity="secondary"
              text
              rounded
              @click="emit('duplicateMajorItem', item.id)"
            />
            <Button
              v-tooltip.top="'Delete'"
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              @click="emit('removeMajorItem', item.id)"
            />
          </div>
        </header>

        <div class="major-grid">
          <label class="field field-description">
            <span>Description</span>
            <Textarea
              :model-value="item.description"
              rows="2"
              auto-resize
              @update:model-value="updateMajorText(item.id, 'description', $event)"
            />
          </label>
          <template v-if="!getPricingDisplay(item.id)?.isRolledUp">
            <label class="field">
              <span>Quantity</span>
              <InputNumber
                :model-value="item.quantity"
                :min="0"
                :min-fraction-digits="0"
                :max-fraction-digits="2"
                @update:model-value="updateMajorNumber(item.id, 'quantity', $event)"
              />
            </label>
            <label class="field">
              <span>Unit cost</span>
              <InputNumber
                :model-value="item.unitCost"
                mode="currency"
                :currency="item.costCurrency"
                locale="en-US"
                @update:model-value="updateMajorNumber(item.id, 'unitCost', $event)"
              />
            </label>
            <label class="field">
              <span>Cost currency</span>
              <Select
                :model-value="item.costCurrency"
                :options="currencyOptions"
                @update:model-value="updateMajorCurrency(item.id, $event)"
              />
            </label>
            <div class="computed-price">
              <span>Unit selling price</span>
              <strong>
                {{
                  formatCurrency(
                    calculateUnitSellingPrice(item, getMajorMarkupRate(item), exchangeRates),
                    currency,
                  )
                }}
              </strong>
            </div>
          </template>

          <dl v-else class="rollup-pricing">
            <div
              v-for="row in getPricingDisplay(item.id)?.rows"
              :key="row.label"
              class="rollup-row"
              :class="{ 'rollup-row-emphasis': row.emphasis }"
            >
              <dt>{{ row.label }}</dt>
              <dd>{{ formatCurrency(row.amount, currency) }}</dd>
            </div>
          </dl>

          <label class="field">
            <span>Markup override</span>
            <InputNumber
              :model-value="item.markupRate"
              suffix="%"
              :min="0"
              :max-fraction-digits="2"
              @update:model-value="updateMajorNumber(item.id, 'markupRate', $event)"
            />
          </label>
        </div>

        <div class="sub-items">
          <div v-for="(subItem, subIndex) in item.subItems" :key="subItem.id" class="sub-item">
            <span class="sub-index">{{ itemIndex + 1 }}.{{ subIndex + 1 }}</span>
            <InputText
              :model-value="subItem.description"
              @update:model-value="updateSubText(item.id, subItem.id, 'description', $event)"
            />
            <InputNumber
              :model-value="subItem.quantity"
              :min="0"
              :max-fraction-digits="2"
              @update:model-value="updateSubNumber(item.id, subItem.id, 'quantity', $event)"
            />
            <InputNumber
              :model-value="subItem.unitCost"
              mode="currency"
              :currency="subItem.costCurrency"
              locale="en-US"
              @update:model-value="updateSubNumber(item.id, subItem.id, 'unitCost', $event)"
            />
            <Select
              :model-value="subItem.costCurrency"
              :options="currencyOptions"
              @update:model-value="updateSubCurrency(item.id, subItem.id, $event)"
            />
            <span class="line-total">
              {{
                formatCurrency(
                  calculateUnitSellingPrice(subItem, getSubItemMarkupRate(item, subItem), exchangeRates),
                  currency,
                )
              }}
            </span>
            <span class="line-total">
              {{
                formatCurrency(
                  calculateLineSellingAmount(subItem, getSubItemMarkupRate(item, subItem), exchangeRates),
                  currency,
                )
              }}
            </span>
            <Button
              v-tooltip.top="'Delete sub-item'"
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              @click="emit('removeSubItem', item.id, subItem.id)"
            />
          </div>
        </div>

        <footer class="major-footer">
          <Button
            icon="pi pi-plus"
            label="Sub-item"
            severity="secondary"
            outlined
            @click="emit('addSubItem', item.id)"
          />
          <div class="subtotal-strip">
            <span>Base {{ formatCurrency(getSummary(item.id)?.baseSubtotal ?? 0, currency) }}</span>
            <span>Markup {{ formatCurrency(getSummary(item.id)?.markupAmount ?? 0, currency) }}</span>
            <strong>Subtotal {{ formatCurrency(getSummary(item.id)?.subtotal ?? 0, currency) }}</strong>
          </div>
        </footer>
      </article>
    </div>
  </section>
</template>

<style scoped>
.items-panel {
  display: grid;
  gap: 16px;
}

.panel-heading,
.major-header,
.major-footer,
.subtotal-strip,
.item-actions {
  display: flex;
  align-items: center;
}

.panel-heading,
.major-footer {
  justify-content: space-between;
  gap: 16px;
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

.items-list {
  display: grid;
  gap: 16px;
}

.major-item {
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: #ffffff;
}

.major-header {
  gap: 12px;
}

.item-index,
.sub-index {
  display: inline-grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  background: var(--accent-soft);
  color: #115e59;
  font-weight: 800;
}

.title-input {
  flex: 1;
  min-width: 0;
  font-weight: 750;
}

.item-actions {
  gap: 4px;
}

.major-grid {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 110px 150px 120px 150px 140px;
  gap: 12px;
}

.field {
  display: grid;
  gap: 6px;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.field-description {
  min-width: 0;
}

.field :deep(.p-inputtext),
.field :deep(.p-inputnumber),
.field :deep(.p-select),
.field :deep(.p-textarea),
.sub-item :deep(.p-inputtext),
.sub-item :deep(.p-inputnumber),
.sub-item :deep(.p-select) {
  width: 100%;
}

.computed-price {
  display: grid;
  gap: 6px;
  min-height: 72px;
  padding: 10px 12px;
  border: 1px solid #d9e2ef;
  border-radius: 8px;
  background: #f8fafc;
}

.computed-price span {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.computed-price strong {
  align-self: end;
  color: var(--text-strong);
  font-weight: 800;
}

.rollup-pricing {
  display: grid;
  grid-column: span 2;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.rollup-row {
  display: grid;
  gap: 5px;
  min-height: 72px;
  padding: 10px 12px;
  border: 1px solid #d9e2ef;
  border-radius: 8px;
  background: #f8fafc;
}

.rollup-row dt {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.rollup-row dd {
  margin: 0;
  color: var(--text-strong);
  font-weight: 800;
}

.rollup-row-emphasis {
  border-color: #99f6e4;
  background: #ecfdf5;
}

.sub-items {
  display: grid;
  gap: 8px;
}

.sub-item {
  display: grid;
  grid-template-columns: 52px minmax(220px, 1fr) 120px 170px 110px 140px 140px 42px;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  background: #f8fafc;
}

.line-total {
  color: var(--text-strong);
  font-weight: 800;
  text-align: right;
}

.subtotal-strip {
  flex-wrap: wrap;
  gap: 14px;
  color: #475569;
}

.subtotal-strip strong {
  color: var(--text-strong);
}
</style>
