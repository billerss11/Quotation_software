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
  addDetailItem: [majorItemId: string, subItemId: string]
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

function getSubItemUnitSellingPrice(item: QuotationMajorItem, subItem: QuotationSubItem) {
  if (subItem.children.length > 0) {
    return null
  }

  return calculateUnitSellingPrice(subItem, getSubItemMarkupRate(item, subItem), props.exchangeRates)
}

function getSubItemSellingAmount(item: QuotationMajorItem, subItem: QuotationSubItem) {
  if (subItem.children.length > 0) {
    return null
  }

  return calculateLineSellingAmount(subItem, getSubItemMarkupRate(item, subItem), props.exchangeRates)
}
</script>

<template>
  <section class="items-panel" aria-label="Line items">
    <div class="panel-heading">
      <div>
        <h2 class="section-title">Line Item Workbench</h2>
        <p class="section-subtitle">Enter cost and markup here; customer prices are calculated automatically.</p>
      </div>
      <Button icon="pi pi-plus" label="Major item" @click="emit('addMajorItem')" />
    </div>

    <div class="items-list">
      <article v-for="(item, itemIndex) in items" :key="item.id" class="major-item">
        <header class="major-header">
          <div class="major-title-group">
            <span class="item-index">{{ itemIndex + 1 }}</span>
            <InputText
              class="title-input"
              :model-value="item.title"
              @update:model-value="updateMajorText(item.id, 'title', $event)"
            />
          </div>
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

        <div class="major-grid" :class="{ 'major-grid-rollup': getPricingDisplay(item.id)?.isRolledUp }">
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

        <div v-if="item.subItems.length > 0" class="sub-items">
          <div class="sub-item sub-item-head">
            <span>No.</span>
            <span>Description</span>
            <span>Qty</span>
            <span>Unit cost</span>
            <span>CCY</span>
            <span>Unit selling</span>
            <span>Amount</span>
            <span></span>
          </div>
          <template v-for="(subItem, subIndex) in item.subItems" :key="subItem.id">
            <div class="sub-item" :class="{ 'sub-item-group': subItem.children.length > 0 }">
              <span class="sub-index">{{ itemIndex + 1 }}.{{ subIndex + 1 }}</span>
              <InputText
                :model-value="subItem.description"
                @update:model-value="updateSubText(item.id, subItem.id, 'description', $event)"
              />
              <template v-if="subItem.children.length === 0">
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
                  {{ formatCurrency(getSubItemUnitSellingPrice(item, subItem) ?? 0, currency) }}
                </span>
                <span class="line-total">
                  {{ formatCurrency(getSubItemSellingAmount(item, subItem) ?? 0, currency) }}
                </span>
              </template>
              <template v-else>
                <span class="rollup-cell">Group</span>
                <span class="rollup-cell">Detail lines</span>
                <span class="rollup-cell">{{ subItem.costCurrency }}</span>
                <span class="rollup-cell">Calculated</span>
                <span class="rollup-cell">Parent subtotal</span>
              </template>
              <span class="row-actions">
                <Button
                  v-tooltip.top="'Add detail line'"
                  icon="pi pi-plus"
                  severity="secondary"
                  text
                  rounded
                  @click="emit('addDetailItem', item.id, subItem.id)"
                />
                <Button
                  v-tooltip.top="'Delete sub-item'"
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  @click="emit('removeSubItem', item.id, subItem.id)"
                />
              </span>
            </div>

            <div
              v-for="(detailItem, detailIndex) in subItem.children"
              :key="detailItem.id"
              class="sub-item detail-item"
            >
              <span class="sub-index">{{ itemIndex + 1 }}.{{ subIndex + 1 }}.{{ detailIndex + 1 }}</span>
              <InputText
                :model-value="detailItem.description"
                @update:model-value="updateSubText(item.id, detailItem.id, 'description', $event)"
              />
              <InputNumber
                :model-value="detailItem.quantity"
                :min="0"
                :max-fraction-digits="2"
                @update:model-value="updateSubNumber(item.id, detailItem.id, 'quantity', $event)"
              />
              <InputNumber
                :model-value="detailItem.unitCost"
                mode="currency"
                :currency="detailItem.costCurrency"
                locale="en-US"
                @update:model-value="updateSubNumber(item.id, detailItem.id, 'unitCost', $event)"
              />
              <Select
                :model-value="detailItem.costCurrency"
                :options="currencyOptions"
                @update:model-value="updateSubCurrency(item.id, detailItem.id, $event)"
              />
              <span class="line-total">
                {{ formatCurrency(getSubItemUnitSellingPrice(item, detailItem) ?? 0, currency) }}
              </span>
              <span class="line-total">
                {{ formatCurrency(getSubItemSellingAmount(item, detailItem) ?? 0, currency) }}
              </span>
              <span class="row-actions">
                <Button
                  v-tooltip.top="'Delete detail line'"
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  @click="emit('removeSubItem', item.id, detailItem.id)"
                />
              </span>
            </div>
          </template>
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
            <span>Cost {{ formatCurrency(getSummary(item.id)?.baseSubtotal ?? 0, currency) }}</span>
            <span>Markup {{ formatCurrency(getSummary(item.id)?.markupAmount ?? 0, currency) }}</span>
            <strong>Parent subtotal {{ formatCurrency(getSummary(item.id)?.subtotal ?? 0, currency) }}</strong>
          </div>
        </footer>
      </article>
    </div>
  </section>
</template>

<style scoped>
.items-panel {
  display: grid;
  gap: 10px;
  min-width: 0;
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
  gap: 12px;
}

.section-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 18px;
}

.section-subtitle {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
}

.items-list {
  display: grid;
  gap: 10px;
}

.major-item {
  display: grid;
  gap: 10px;
  padding: 0 12px 12px;
  border: 1px solid #cbd5e1;
  border-left: 5px solid var(--accent);
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.major-header {
  justify-content: space-between;
  gap: 10px;
  margin: 0 -12px;
  padding: 10px 12px;
  border-bottom: 1px solid #dbe5ef;
  background: #eef4f8;
}

.major-title-group {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10px;
}

.item-index,
.sub-index {
  display: inline-grid;
  width: auto;
  min-width: 42px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  padding: 0 8px;
  border-radius: 7px;
  background: #e6fffb;
  color: #115e59;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.major-header .item-index {
  min-width: 34px;
  height: 34px;
  background: var(--accent);
  color: #ffffff;
  font-size: 14px;
}

.title-input {
  flex: 1;
  min-width: 0;
  font-weight: 750;
}

.major-header .title-input :deep(.p-inputtext),
.major-header :deep(.p-inputtext) {
  border-color: transparent;
  background: #ffffff;
  color: #0f172a;
  font-size: 16px;
  font-weight: 850;
}

.item-actions {
  gap: 4px;
}

.major-grid {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 92px 140px 104px 140px 128px;
  gap: 8px;
}

.major-grid-rollup {
  grid-template-columns: minmax(220px, 1fr) minmax(360px, 1.3fr) 140px;
}

.field {
  display: grid;
  gap: 5px;
  color: #475569;
  font-size: 12px;
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

.field :deep(.p-textarea) {
  min-height: 74px;
  white-space: pre-wrap;
}

.computed-price {
  display: grid;
  gap: 5px;
  min-height: 62px;
  padding: 8px 10px;
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.rollup-row {
  display: grid;
  gap: 4px;
  min-height: 62px;
  padding: 8px 10px;
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
  gap: 4px;
}

.sub-item {
  display: grid;
  grid-template-columns: 76px minmax(220px, 1fr) 120px 170px 110px 140px 140px 76px;
  gap: 6px;
  align-items: center;
  min-height: 42px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #f8fafc;
}

.sub-item > :nth-child(6),
.sub-item > :nth-child(7) {
  justify-self: end;
  text-align: right;
}

.sub-item > :nth-child(5) {
  justify-self: center;
  text-align: center;
}

.sub-item-group {
  border: 1px solid #cbd5e1;
  border-left: 4px solid #64748b;
  background: #eef2f7;
}

.sub-item-group .sub-index {
  min-width: 48px;
  background: #dbeafe;
  color: #1d4ed8;
}

.sub-item-group :deep(.p-inputtext) {
  font-weight: 850;
}

.detail-item {
  background: #ffffff;
}

.detail-item .sub-index {
  min-width: 64px;
  height: 28px;
  justify-self: end;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 12px;
}

.detail-item :deep(.p-inputtext) {
  border-left: 3px solid #dbe5ef;
}

.sub-item-head {
  min-height: 30px;
  background: #eef2f7;
  color: #64748b;
  font-size: 11px;
  font-weight: 850;
  text-transform: uppercase;
}

.sub-item-head > :nth-child(6),
.sub-item-head > :nth-child(7) {
  justify-self: end;
  text-align: right;
}

.sub-item-head > :nth-child(5) {
  justify-self: center;
  text-align: center;
}

.line-total {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 800;
  text-align: right;
}

.rollup-cell {
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

.sub-item-group .rollup-cell:nth-of-type(4),
.sub-item-group .rollup-cell:nth-of-type(5) {
  justify-self: end;
  text-align: right;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}

.subtotal-strip {
  flex-wrap: wrap;
  gap: 12px;
  color: #475569;
  font-size: 13px;
}

.subtotal-strip strong {
  color: var(--text-strong);
}
</style>
