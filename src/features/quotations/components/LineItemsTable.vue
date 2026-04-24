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
  MajorItemSummary,
  QuotationItem,
  QuotationItemField,
} from '../types'
import {
  calculateQuotationItemSellingAmount,
  calculateQuotationItemUnitSellingPrice,
  calculateUnitSellingPrice,
  getEffectiveMarkupRate,
} from '../utils/quotationCalculations'
import { getMajorItemPricingDisplay } from '../utils/majorItemPricingDisplay'
import {
  createInheritedMarkupContext,
  getQuotationItemPricingDisplay,
  type InheritedMarkupContext,
} from '../utils/quotationItemPricingDisplay'
import { getQuotationItemAmountMismatch } from '../utils/quotationItemValidation'

interface WorkbenchRow {
  item: QuotationItem
  depth: number
  itemNumber: string
  inheritedMarkupContext: InheritedMarkupContext | null
}

const props = defineProps<{
  items: QuotationItem[]
  summaries: MajorItemSummary[]
  currency: CurrencyCode
  globalMarkupRate: number
  exchangeRates: ExchangeRateTable
}>()

const emit = defineEmits<{
  addRootItem: []
  addChildItem: [parentItemId: string]
  removeItem: [itemId: string]
  duplicateRootItem: [itemId: string]
  moveRootItem: [itemId: string, direction: -1 | 1]
  updateItemField: [itemId: string, field: QuotationItemField, value: QuotationItem[QuotationItemField]]
}>()

const currencyOptions: CurrencyCode[] = ['USD', 'EUR', 'CNY', 'GBP']
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

function updateText(itemId: string, field: QuotationItemField, value: unknown) {
  emit('updateItemField', itemId, field, String(value ?? ''))
}

function updateNumber(itemId: string, field: QuotationItemField, value: unknown) {
  emit('updateItemField', itemId, field, toNumber(value))
}

function updateOptionalNumber(itemId: string, field: QuotationItemField, value: unknown) {
  emit(
    'updateItemField',
    itemId,
    field,
    (typeof value === 'number' && Number.isFinite(value) ? value : undefined) as QuotationItem[QuotationItemField],
  )
}

function updateCurrency(itemId: string, value: unknown) {
  emit('updateItemField', itemId, 'costCurrency', value as CurrencyCode)
}

function getItemMarkupRate(item: QuotationItem, inheritedMarkupRate?: number) {
  return getEffectiveMarkupRate(item.markupRate, inheritedMarkupRate ?? props.globalMarkupRate)
}

function getItemUnitSellingPrice(item: QuotationItem, inheritedMarkupRate?: number) {
  if (item.children.length > 0) {
    return calculateQuotationItemUnitSellingPrice(
      item,
      props.globalMarkupRate,
      props.exchangeRates,
      inheritedMarkupRate,
    )
  }

  return calculateUnitSellingPrice(item, getItemMarkupRate(item, inheritedMarkupRate), props.exchangeRates)
}

function getItemSellingAmount(item: QuotationItem, inheritedMarkupRate?: number) {
  return calculateQuotationItemSellingAmount(item, props.globalMarkupRate, props.exchangeRates, inheritedMarkupRate)
}

function getItemPricing(item: QuotationItem, inheritedMarkupContext?: InheritedMarkupContext | null) {
  return getQuotationItemPricingDisplay(item, props.globalMarkupRate, props.exchangeRates, inheritedMarkupContext)
}

function getItemAmountMismatch(item: QuotationItem, inheritedMarkupRate?: number) {
  return getQuotationItemAmountMismatch(item, props.globalMarkupRate, props.exchangeRates, inheritedMarkupRate)
}

function getMismatchMessage(item: QuotationItem, inheritedMarkupRate?: number) {
  const mismatch = getItemAmountMismatch(item, inheritedMarkupRate)

  if (!mismatch) {
    return ''
  }

  return `Expected ${formatCurrency(mismatch.expectedTotal, props.currency)} ignored; using ${formatCurrency(
    mismatch.actualTotal,
    props.currency,
  )} from child rows.`
}

function getChildRows(item: QuotationItem, itemNumber: string) {
  return flattenChildRows(
    item.children,
    itemNumber,
    createInheritedMarkupContext(item, itemNumber),
  )
}

function flattenChildRows(
  children: QuotationItem[],
  parentItemNumber: string,
  inheritedMarkupContext: InheritedMarkupContext | null,
): WorkbenchRow[] {
  return children.flatMap((child, childIndex) => {
    const itemNumber = `${parentItemNumber}.${childIndex + 1}`
    const row: WorkbenchRow = {
      item: child,
      depth: itemNumber.split('.').length,
      itemNumber,
      inheritedMarkupContext,
    }

    return [
      row,
      ...flattenChildRows(
        child.children,
        itemNumber,
        createInheritedMarkupContext(child, itemNumber, inheritedMarkupContext),
      ),
    ]
  })
}

function canAddChild(depth: number) {
  return depth < 3
}

function getMarkupHelperText(item: QuotationItem, inheritedMarkupContext?: InheritedMarkupContext | null) {
  const pricing = getItemPricing(item, inheritedMarkupContext)
  const source =
    pricing.markupSource === 'self'
      ? 'Self'
      : pricing.markupSource === 'inherited'
        ? `From ${pricing.markupSourceLabel}`
        : 'Global'

  return `Effective ${pricing.effectiveMarkupRate}% • ${source}`
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
</script>

<template>
  <section class="items-panel" aria-label="Line items">
    <div class="panel-heading">
      <div>
        <h2 class="section-title">Line Item Workbench</h2>
        <p class="section-subtitle">Enter cost and markup here; customer prices are calculated automatically.</p>
      </div>
      <Button icon="pi pi-plus" label="Root item" @click="emit('addRootItem')" />
    </div>

    <div class="items-list">
      <article v-for="(item, itemIndex) in items" :key="item.id" class="major-item">
        <header class="major-header">
          <div class="major-title-group">
            <span class="item-index">{{ itemIndex + 1 }}</span>
            <InputText
              class="title-input"
              :model-value="item.name"
              @update:model-value="updateText(item.id, 'name', $event)"
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
              @click="emit('moveRootItem', item.id, -1)"
            />
            <Button
              v-tooltip.top="'Move down'"
              icon="pi pi-arrow-down"
              severity="secondary"
              text
              rounded
              :disabled="itemIndex === items.length - 1"
              @click="emit('moveRootItem', item.id, 1)"
            />
            <Button
              v-tooltip.top="'Duplicate'"
              icon="pi pi-copy"
              severity="secondary"
              text
              rounded
              @click="emit('duplicateRootItem', item.id)"
            />
            <Button
              v-tooltip.top="'Delete'"
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              @click="emit('removeItem', item.id)"
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
              @update:model-value="updateText(item.id, 'description', $event)"
            />
          </label>
          <label class="field">
            <span>Quantity</span>
            <InputNumber
              :model-value="item.quantity"
              :min="0"
              :max-fraction-digits="2"
              @update:model-value="updateNumber(item.id, 'quantity', $event)"
            />
          </label>
          <label class="field">
            <span>Qty unit</span>
            <InputText
              :model-value="item.quantityUnit"
              @update:model-value="updateText(item.id, 'quantityUnit', $event)"
            />
          </label>
          <template v-if="!getPricingDisplay(item.id)?.isRolledUp">
            <label class="field">
              <span>Unit cost</span>
              <InputNumber
                :model-value="item.unitCost"
                mode="currency"
                :currency="item.costCurrency"
                locale="en-US"
                @update:model-value="updateNumber(item.id, 'unitCost', $event)"
              />
            </label>
            <label class="field">
              <span>Cost currency</span>
              <Select
                :model-value="item.costCurrency"
                :options="currencyOptions"
                @update:model-value="updateCurrency(item.id, $event)"
              />
            </label>
            <div class="computed-price">
              <span>Unit selling price</span>
              <strong>{{ formatCurrency(getItemUnitSellingPrice(item) ?? 0, currency) }}</strong>
            </div>
          </template>

          <div v-if="getPricingDisplay(item.id)?.isRolledUp" class="group-validation">
            <dl class="rollup-pricing">
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
            <p v-if="getItemAmountMismatch(item)" class="group-warning">
              {{ getMismatchMessage(item) }}
            </p>
          </div>

          <label v-if="getPricingDisplay(item.id)?.isRolledUp" class="field summary-field">
            <span>Expected total</span>
            <InputNumber
              :model-value="item.expectedTotal"
              mode="currency"
              :currency="currency"
              locale="en-US"
              @update:model-value="updateOptionalNumber(item.id, 'expectedTotal', $event)"
            />
          </label>

          <label class="field" :class="{ 'summary-field': getPricingDisplay(item.id)?.isRolledUp }">
            <span>Markup override</span>
            <InputNumber
              :model-value="item.markupRate"
              suffix="%"
              :min="0"
              :max-fraction-digits="2"
              @update:model-value="updateNumber(item.id, 'markupRate', $event)"
            />
            <small class="field-helper">{{ getMarkupHelperText(item) }}</small>
          </label>
        </div>

        <div v-if="item.children.length > 0" class="sub-items">
          <div class="sub-item sub-item-head">
            <span>No.</span>
            <span>Item</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Unit cost</span>
            <span>CCY</span>
            <span>Markup</span>
            <span>Unit selling</span>
            <span>Amount</span>
            <span></span>
          </div>

          <div
            v-for="row in getChildRows(item, String(itemIndex + 1))"
            :key="row.item.id"
            class="sub-item"
            :class="{ 'sub-item-group': row.item.children.length > 0, 'detail-item': row.depth === 3 }"
          >
            <span class="sub-index">{{ row.itemNumber }}</span>

            <div class="nested-description">
              <InputText
                :model-value="row.item.name"
                @update:model-value="updateText(row.item.id, 'name', $event)"
              />
              <Textarea
                :model-value="row.item.description"
                rows="1"
                auto-resize
                @update:model-value="updateText(row.item.id, 'description', $event)"
              />
              <div class="row-meta">
                <span>Cost {{ formatCurrency(getItemPricing(row.item, row.inheritedMarkupContext).baseAmount, currency) }}</span>
                <span>
                  Markup {{ formatCurrency(getItemPricing(row.item, row.inheritedMarkupContext).markupAmount, currency) }}
                </span>
              </div>
            </div>

            <template v-if="row.item.children.length === 0">
              <InputNumber
                :model-value="row.item.quantity"
                :min="0"
                :max-fraction-digits="2"
                @update:model-value="updateNumber(row.item.id, 'quantity', $event)"
              />
              <InputText
                :model-value="row.item.quantityUnit"
                @update:model-value="updateText(row.item.id, 'quantityUnit', $event)"
              />
              <InputNumber
                :model-value="row.item.unitCost"
                mode="currency"
                :currency="row.item.costCurrency"
                locale="en-US"
                @update:model-value="updateNumber(row.item.id, 'unitCost', $event)"
              />
              <Select
                :model-value="row.item.costCurrency"
                :options="currencyOptions"
                @update:model-value="updateCurrency(row.item.id, $event)"
              />
              <div class="markup-cell">
                <InputNumber
                  :model-value="row.item.markupRate"
                  suffix="%"
                  :min="0"
                  :max-fraction-digits="2"
                  @update:model-value="updateNumber(row.item.id, 'markupRate', $event)"
                />
                <small class="cell-helper">{{ getMarkupHelperText(row.item, row.inheritedMarkupContext) }}</small>
              </div>
              <span class="line-total">
                {{ formatCurrency(getItemUnitSellingPrice(row.item, row.inheritedMarkupContext?.rate) ?? 0, currency) }}
              </span>
            </template>
            <template v-else>
              <InputNumber
                :model-value="row.item.quantity"
                :min="0"
                :max-fraction-digits="2"
                @update:model-value="updateNumber(row.item.id, 'quantity', $event)"
              />
              <InputText
                :model-value="row.item.quantityUnit"
                @update:model-value="updateText(row.item.id, 'quantityUnit', $event)"
              />
              <span class="rollup-cell">Detail lines</span>
              <span class="rollup-cell">{{ row.item.costCurrency }}</span>
              <div class="markup-cell">
                <InputNumber
                  :model-value="row.item.markupRate"
                  suffix="%"
                  :min="0"
                  :max-fraction-digits="2"
                  @update:model-value="updateNumber(row.item.id, 'markupRate', $event)"
                />
                <small class="cell-helper">{{ getMarkupHelperText(row.item, row.inheritedMarkupContext) }}</small>
              </div>
              <span class="line-total">
                {{ formatCurrency(getItemUnitSellingPrice(row.item, row.inheritedMarkupContext?.rate) ?? 0, currency) }}
              </span>
            </template>

            <span class="line-total">
              {{ formatCurrency(getItemSellingAmount(row.item, row.inheritedMarkupContext?.rate), currency) }}
            </span>

            <span class="row-actions">
              <Button
                v-if="canAddChild(row.depth)"
                v-tooltip.top="'Add child item'"
                icon="pi pi-plus"
                severity="secondary"
                text
                rounded
                @click="emit('addChildItem', row.item.id)"
              />
              <Button
                v-tooltip.top="'Delete item'"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                @click="emit('removeItem', row.item.id)"
              />
            </span>
          </div>
          <p
            v-for="row in getChildRows(item, String(itemIndex + 1)).filter((childRow) => getItemAmountMismatch(childRow.item, childRow.inheritedMarkupContext?.rate))"
            :key="`${row.item.id}-warning`"
            class="nested-warning"
          >
            {{ row.itemNumber }} {{ getMismatchMessage(row.item, row.inheritedMarkupContext?.rate) }}
          </p>
        </div>

        <footer class="major-footer">
          <Button
            v-if="canAddChild(1)"
            icon="pi pi-plus"
            label="Child item"
            severity="secondary"
            outlined
            @click="emit('addChildItem', item.id)"
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
  flex-wrap: wrap;
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
  min-width: 0;
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
  grid-template-columns: minmax(180px, 1fr) 80px 88px 124px 92px 120px 112px;
  gap: 8px;
}

.major-grid-rollup {
  grid-template-columns: minmax(180px, 1fr) 80px 88px minmax(200px, 1fr) 150px 120px;
}

.field {
  display: grid;
  gap: 5px;
  min-width: 0;
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
.sub-item :deep(.p-select),
.sub-item :deep(.p-textarea) {
  width: 100%;
}

.field :deep(.p-textarea),
.nested-description :deep(.p-textarea) {
  white-space: pre-wrap;
}

.field :deep(.p-textarea) {
  min-height: 74px;
}

.nested-description {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.nested-description :deep(.p-textarea) {
  min-height: 42px;
}

.row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
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

.computed-price span,
.rollup-row dt {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.computed-price strong,
.rollup-row dd {
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

.rollup-row dd {
  margin: 0;
}

.rollup-row-emphasis {
  border-color: #99f6e4;
  background: #ecfdf5;
}

.group-validation {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.group-warning,
.nested-warning {
  margin: 0;
  color: #b45309;
  font-size: 12px;
  font-weight: 700;
}

.summary-field {
  align-content: start;
  min-height: 62px;
  padding: 8px 10px;
  border: 1px solid #d9e2ef;
  border-radius: 8px;
  background: #f8fafc;
}

.summary-field span {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.field-helper,
.cell-helper {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
}

.sub-items {
  display: grid;
  gap: 4px;
}

.sub-item {
  display: grid;
  grid-template-columns: 60px minmax(150px, 1fr) 78px 78px 118px 82px 86px 110px 110px 68px;
  gap: 6px;
  align-items: center;
  min-height: 42px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #f8fafc;
}

.sub-item > :nth-child(8),
.sub-item > :nth-child(9) {
  justify-self: end;
  text-align: right;
}

.sub-item > :nth-child(6) {
  justify-self: center;
  text-align: center;
}

.sub-item-head {
  min-height: 30px;
  background: #eef2f7;
  color: #64748b;
  font-size: 11px;
  font-weight: 850;
  text-transform: uppercase;
}

.sub-item-group {
  border: 1px solid #cbd5e1;
  border-left: 4px solid #64748b;
  background: #eef2f7;
}

.sub-item-group .sub-index {
  background: #dbeafe;
  color: #1d4ed8;
}

.sub-item-head span {
  min-width: 0;
}

.detail-item {
  background: #ffffff;
}

.detail-item .sub-index {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 12px;
}

.line-total {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 800;
  text-align: right;
}

.markup-cell {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.rollup-cell {
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}

.subtotal-strip {
  flex-wrap: wrap;
  gap: 12px;
  min-width: 0;
  color: #475569;
  font-size: 13px;
}

.subtotal-strip strong {
  color: var(--text-strong);
}
</style>
