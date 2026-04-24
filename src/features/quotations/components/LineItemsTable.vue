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
  calculateQuotationItemBaseSubtotal,
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

interface ChildRow {
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

const CURRENCY_OPTIONS: CurrencyCode[] = ['USD', 'EUR', 'CNY', 'GBP']

const summaryByItemId = computed(() => new Map(props.summaries.map((s) => [s.itemId, s])))

const pricingDisplayByItemId = computed(
  () => new Map(props.items.map((item) => [item.id, getMajorItemPricingDisplay(item, summaryByItemId.value.get(item.id))])),
)

function getSummary(itemId: string) {
  return summaryByItemId.value.get(itemId)
}

function isGroupItem(item: QuotationItem) {
  return item.children.length > 0
}

function getPricingRows(itemId: string) {
  return pricingDisplayByItemId.value.get(itemId)?.rows ?? []
}

function getChildRows(item: QuotationItem, itemNumber: string): ChildRow[] {
  return flattenChildren(item.children, itemNumber, createInheritedMarkupContext(item, itemNumber))
}

function flattenChildren(
  children: QuotationItem[],
  parentNumber: string,
  inheritedMarkupContext: InheritedMarkupContext | null,
): ChildRow[] {
  return children.flatMap((child, i) => {
    const itemNumber = `${parentNumber}.${i + 1}`
    const row: ChildRow = {
      item: child,
      depth: itemNumber.split('.').length,
      itemNumber,
      inheritedMarkupContext,
    }
    return [row, ...flattenChildren(child.children, itemNumber, createInheritedMarkupContext(child, itemNumber, inheritedMarkupContext))]
  })
}

function getMarkupLabel(item: QuotationItem, inheritedMarkupContext?: InheritedMarkupContext | null) {
  const pricing = getQuotationItemPricingDisplay(item, props.globalMarkupRate, props.exchangeRates, inheritedMarkupContext)
  const source =
    pricing.markupSource === 'self' ? 'Self' :
    pricing.markupSource === 'inherited' ? `From ${pricing.markupSourceLabel}` : 'Global'
  return `Effective ${pricing.effectiveMarkupRate}% · ${source}`
}

function getUnitSellingPrice(item: QuotationItem, inheritedMarkupRate?: number) {
  if (isGroupItem(item)) {
    return calculateQuotationItemUnitSellingPrice(item, props.globalMarkupRate, props.exchangeRates, inheritedMarkupRate)
  }
  const rate = getEffectiveMarkupRate(item.markupRate, inheritedMarkupRate ?? props.globalMarkupRate)
  return calculateUnitSellingPrice(item, rate, props.exchangeRates)
}

function getSellingAmount(item: QuotationItem, inheritedMarkupRate?: number) {
  return calculateQuotationItemSellingAmount(item, props.globalMarkupRate, props.exchangeRates, inheritedMarkupRate)
}

function getMismatchMessage(item: QuotationItem, inheritedMarkupRate?: number) {
  const mismatch = getQuotationItemAmountMismatch(item, props.globalMarkupRate, props.exchangeRates, inheritedMarkupRate)
  if (!mismatch) return ''
  return `Expected ${formatCurrency(mismatch.expectedTotal, props.currency)} ignored; using ${formatCurrency(mismatch.actualTotal, props.currency)} from child rows.`
}

function setText(itemId: string, field: QuotationItemField, value: unknown) {
  emit('updateItemField', itemId, field, String(value ?? ''))
}

function setNumber(itemId: string, field: QuotationItemField, value: unknown) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  emit('updateItemField', itemId, field, n)
}

function setOptionalNumber(itemId: string, field: QuotationItemField, value: unknown) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : undefined
  emit('updateItemField', itemId, field, n as QuotationItem[QuotationItemField])
}

function setCurrency(itemId: string, value: unknown) {
  emit('updateItemField', itemId, 'costCurrency', value as CurrencyCode)
}

/**
 * For a section row (group with children), unit cost = sum of all direct
 * children's total base costs. This equals baseAmount ÷ quantity, computed
 * without division so there's no divide-by-zero risk.
 */
function getSectionUnitCost(item: QuotationItem): number {
  return item.children.reduce(
    (sum, child) => sum + calculateQuotationItemBaseSubtotal(child, props.exchangeRates),
    0,
  )
}
</script>

<template>
  <section class="workbench" aria-label="Line items">

    <!-- Panel heading -->
    <div class="workbench-heading">
      <div>
        <h2 class="heading-title">Line Items</h2>
        <p class="heading-sub">Cost and markup here — customer prices are calculated automatically.</p>
      </div>
      <Button icon="pi pi-plus" label="Add item" rounded @click="emit('addRootItem')" />
    </div>

    <!-- Item cards -->
    <div class="items-list">
      <article v-for="(item, itemIndex) in items" :key="item.id" class="item-card">

        <!-- Card header: number badge + name + actions -->
        <header class="card-header">
          <span class="item-badge">{{ itemIndex + 1 }}</span>
          <InputText
            class="item-name-input"
            :model-value="item.name"
            placeholder="Item name"
            @update:model-value="setText(item.id, 'name', $event)"
          />
          <div class="header-actions">
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

        <!-- Card body -->
        <div class="card-body">

          <!-- Description -->
          <label class="desc-label">
            <span class="field-label">Description</span>
            <Textarea
              :model-value="item.description"
              rows="2"
              auto-resize
              @update:model-value="setText(item.id, 'description', $event)"
            />
          </label>

          <!-- Pricing strip: leaf item -->
          <div v-if="!isGroupItem(item)" class="pricing-strip">
            <label class="pf">
              <span class="field-label">Quantity</span>
              <InputNumber :model-value="item.quantity" :min="0" :max-fraction-digits="2" @update:model-value="setNumber(item.id, 'quantity', $event)" />
            </label>
            <label class="pf pf-sm">
              <span class="field-label">Unit</span>
              <InputText :model-value="item.quantityUnit" @update:model-value="setText(item.id, 'quantityUnit', $event)" />
            </label>
            <label class="pf pf-lg">
              <span class="field-label">Unit cost</span>
              <InputNumber :model-value="item.unitCost" mode="currency" :currency="item.costCurrency" locale="en-US" @update:model-value="setNumber(item.id, 'unitCost', $event)" />
            </label>
            <label class="pf pf-sm">
              <span class="field-label">Currency</span>
              <Select :model-value="item.costCurrency" :options="CURRENCY_OPTIONS" @update:model-value="setCurrency(item.id, $event)" />
            </label>
            <label class="pf pf-md">
              <span class="field-label">Markup</span>
              <InputNumber :model-value="item.markupRate" suffix="%" :min="0" :max-fraction-digits="2" @update:model-value="setOptionalNumber(item.id, 'markupRate', $event)" />
              <small class="field-hint">{{ getMarkupLabel(item) }}</small>
            </label>
            <div class="selling-badge">
              <span class="field-label">Unit selling price</span>
              <strong>{{ formatCurrency(getUnitSellingPrice(item) ?? 0, currency) }}</strong>
            </div>
          </div>

          <!-- Pricing strip: group item (rolled-up) -->
          <div v-else class="pricing-strip pricing-strip-group">
            <label class="pf pf-sm">
              <span class="field-label">Quantity</span>
              <InputNumber :model-value="item.quantity" :min="0" :max-fraction-digits="2" @update:model-value="setNumber(item.id, 'quantity', $event)" />
            </label>
            <label class="pf pf-sm">
              <span class="field-label">Unit</span>
              <InputText :model-value="item.quantityUnit" @update:model-value="setText(item.id, 'quantityUnit', $event)" />
            </label>
            <label class="pf pf-md">
              <span class="field-label">Markup override</span>
              <InputNumber :model-value="item.markupRate" suffix="%" :min="0" :max-fraction-digits="2" @update:model-value="setOptionalNumber(item.id, 'markupRate', $event)" />
              <small class="field-hint">{{ getMarkupLabel(item) }}</small>
            </label>
            <div class="rollup-cards">
              <div
                v-for="row in getPricingRows(item.id)"
                :key="row.label"
                class="rollup-card"
                :class="{ 'rollup-card-total': row.emphasis }"
              >
                <span>{{ row.label }}</span>
                <strong>{{ formatCurrency(row.amount, currency) }}</strong>
              </div>
            </div>
          </div>

          <!-- Expected total override (group only) -->
          <div v-if="isGroupItem(item)" class="expected-total-row">
            <label class="pf pf-md">
              <span class="field-label">Expected total override <span class="field-label-hint">(optional)</span></span>
              <InputNumber :model-value="item.expectedTotal" mode="currency" :currency="currency" locale="en-US" @update:model-value="setOptionalNumber(item.id, 'expectedTotal', $event)" />
            </label>
            <p v-if="getMismatchMessage(item)" class="mismatch-warning">
              {{ getMismatchMessage(item) }}
            </p>
          </div>

        </div>

        <!-- Child rows table -->
        <div v-if="item.children.length > 0" class="child-table-wrap">
          <div class="child-table">
            <!-- Table header -->
            <div class="ct-head">
              <span>#</span>
              <span>Item</span>
              <span>Qty</span>
              <span>Unit</span>
              <span>Unit cost</span>
              <span>CCY</span>
              <span>Markup</span>
              <span>Unit price</span>
              <span>Amount</span>
              <span></span>
            </div>

            <!-- Table rows -->
            <div
              v-for="row in getChildRows(item, String(itemIndex + 1))"
              :key="row.item.id"
              class="ct-row"
              :class="{
                'ct-row-section': isGroupItem(row.item),
                'ct-row-d3': row.depth === 3,
              }"
            >
              <!-- # -->
              <span class="ct-num" :class="{ 'ct-num-d3': row.depth === 3 }">
                <span
                  class="ct-num-badge"
                  :class="{
                    'ct-badge-section': isGroupItem(row.item),
                    'ct-badge-d3': row.depth === 3,
                  }"
                >
                  {{ row.itemNumber }}
                </span>
              </span>

              <!-- Item name + description -->
              <div class="ct-item">
                <InputText
                  :model-value="row.item.name"
                  placeholder="Name"
                  @update:model-value="setText(row.item.id, 'name', $event)"
                />
                <Textarea
                  :model-value="row.item.description"
                  rows="1"
                  auto-resize
                  placeholder="Description"
                  @update:model-value="setText(row.item.id, 'description', $event)"
                />
                <div class="ct-meta">
                  <span>Cost: {{ formatCurrency(getQuotationItemPricingDisplay(row.item, globalMarkupRate, exchangeRates, row.inheritedMarkupContext).baseAmount, currency) }}</span>
                  <span>Markup: {{ formatCurrency(getQuotationItemPricingDisplay(row.item, globalMarkupRate, exchangeRates, row.inheritedMarkupContext).markupAmount, currency) }}</span>
                </div>
              </div>

              <!-- Qty -->
              <InputNumber
                :model-value="row.item.quantity"
                :min="0"
                :max-fraction-digits="2"
                @update:model-value="setNumber(row.item.id, 'quantity', $event)"
              />

              <!-- Unit -->
              <InputText
                :model-value="row.item.quantityUnit"
                @update:model-value="setText(row.item.id, 'quantityUnit', $event)"
              />

              <!-- Unit cost (leaf only) -->
              <template v-if="!isGroupItem(row.item)">
                <InputNumber
                  :model-value="row.item.unitCost"
                  mode="currency"
                  :currency="row.item.costCurrency"
                  locale="en-US"
                  @update:model-value="setNumber(row.item.id, 'unitCost', $event)"
                />
                <Select
                  :model-value="row.item.costCurrency"
                  :options="CURRENCY_OPTIONS"
                  @update:model-value="setCurrency(row.item.id, $event)"
                />
              </template>
              <template v-else>
                <span class="ct-derived-cost">
                  {{ formatCurrency(getSectionUnitCost(row.item), currency) }}
                </span>
                <span class="ct-muted">{{ currency }}</span>
              </template>

              <!-- Markup -->
              <div class="ct-markup">
                <InputNumber
                  :model-value="row.item.markupRate"
                  suffix="%"
                  :min="0"
                  :max-fraction-digits="2"
                  @update:model-value="setOptionalNumber(row.item.id, 'markupRate', $event)"
                />
                <small class="ct-hint">{{ getMarkupLabel(row.item, row.inheritedMarkupContext) }}</small>
              </div>

              <!-- Unit price -->
              <span class="ct-amount">
                {{ formatCurrency(getUnitSellingPrice(row.item, row.inheritedMarkupContext?.rate) ?? 0, currency) }}
              </span>

              <!-- Total amount -->
              <span class="ct-amount">
                {{ formatCurrency(getSellingAmount(row.item, row.inheritedMarkupContext?.rate), currency) }}
              </span>

              <!-- Row actions -->
              <span class="ct-actions">
                <Button
                  v-if="row.depth < 3"
                  v-tooltip.top="'Add child'"
                  icon="pi pi-plus"
                  severity="secondary"
                  text
                  rounded
                  @click="emit('addChildItem', row.item.id)"
                />
                <Button
                  v-tooltip.top="'Delete'"
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  @click="emit('removeItem', row.item.id)"
                />
              </span>
            </div>

            <!-- Mismatch warnings for child rows -->
            <p
              v-for="row in getChildRows(item, String(itemIndex + 1)).filter((r) => getMismatchMessage(r.item, r.inheritedMarkupContext?.rate))"
              :key="`warn-${row.item.id}`"
              class="child-warning"
            >
              {{ row.itemNumber }}: {{ getMismatchMessage(row.item, row.inheritedMarkupContext?.rate) }}
            </p>
          </div>
        </div>

        <!-- Card footer -->
        <footer class="card-footer">
          <Button
            icon="pi pi-plus"
            label="Child item"
            severity="secondary"
            outlined
            size="small"
            @click="emit('addChildItem', item.id)"
          />
          <div class="subtotal-bar">
            <span>Cost <strong>{{ formatCurrency(getSummary(item.id)?.baseSubtotal ?? 0, currency) }}</strong></span>
            <span>Markup <strong>{{ formatCurrency(getSummary(item.id)?.markupAmount ?? 0, currency) }}</strong></span>
            <span class="subtotal-total">Selling price <strong>{{ formatCurrency(getSummary(item.id)?.subtotal ?? 0, currency) }}</strong></span>
          </div>
        </footer>

      </article>
    </div>

  </section>
</template>

<style scoped>
/* ── Panel ─────────────────────────────────────────────────── */

.workbench {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.workbench-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.heading-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 18px;
}

.heading-sub {
  margin: 3px 0 0;
  color: #64748b;
  font-size: 13px;
}

.items-list {
  display: grid;
  gap: 12px;
}

/* ── Item card ─────────────────────────────────────────────── */

.item-card {
  display: grid;
  min-width: 0;
  border: 1px solid #cbd5e1;
  border-left: 5px solid var(--accent);
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

/* ── Card header ───────────────────────────────────────────── */

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid #dbe5ef;
  background: #eef4f8;
}

.item-badge {
  display: inline-grid;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
}

.item-name-input {
  flex: 1;
  min-width: 0;
}

.item-name-input :deep(.p-inputtext) {
  border-color: transparent;
  background: #fff;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.header-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

/* ── Card body ─────────────────────────────────────────────── */

.card-body {
  display: grid;
  gap: 12px;
  padding: 14px 16px;
}

/* Description */

.desc-label {
  display: grid;
  gap: 5px;
}

.desc-label :deep(.p-textarea) {
  width: 100%;
  min-height: 60px;
  white-space: pre-wrap;
}

/* Field labels */

.field-label {
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field-label-hint {
  color: #94a3b8;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
}

.field-hint {
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
}

/* Pricing strip */

.pricing-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
}

.pf {
  display: grid;
  gap: 5px;
  min-width: 90px;
  flex: 1;
}

.pf-sm {
  flex: 0 0 88px;
}

.pf-md {
  flex: 0 0 120px;
}

.pf-lg {
  flex: 0 0 140px;
}

.pf :deep(.p-inputtext),
.pf :deep(.p-inputnumber),
.pf :deep(.p-select) {
  width: 100%;
}

/* Selling price badge */

.selling-badge {
  display: grid;
  gap: 5px;
  flex: 0 0 auto;
  min-width: 130px;
  padding: 8px 14px;
  border: 1px solid #99f6e4;
  border-radius: 8px;
  background: #ecfdf5;
  align-content: start;
}

.selling-badge span {
  color: #0f766e;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.selling-badge strong {
  color: #0f172a;
  font-size: 16px;
  font-weight: 800;
}

/* Rollup pricing cards */

.rollup-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  min-width: 0;
  align-self: flex-end;
}

.rollup-card {
  display: grid;
  gap: 4px;
  min-width: 110px;
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d9e2ef;
  border-radius: 8px;
  background: #f8fafc;
}

.rollup-card span {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.rollup-card strong {
  color: var(--text-strong);
  font-weight: 800;
}

.rollup-card-total {
  border-color: #99f6e4;
  background: #ecfdf5;
}

.rollup-card-total strong {
  color: #0f766e;
}

/* Expected total row */

.expected-total-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
}

.mismatch-warning {
  margin: 0;
  align-self: center;
  color: #b45309;
  font-size: 12px;
  font-weight: 600;
}

/* ── Child table ───────────────────────────────────────────── */

.child-table-wrap {
  overflow-x: auto;
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
}

.child-table {
  display: grid;
  min-width: 780px;
  gap: 0;
}

.ct-head,
.ct-row {
  display: grid;
  grid-template-columns: 64px minmax(160px, 1fr) 70px 70px 120px 78px 100px 106px 106px 72px;
  gap: 6px;
  align-items: center;
  padding: 6px 12px;
}

/* Table header */

.ct-head {
  min-height: 34px;
  background: #f1f5f9;
  border-bottom: 2px solid #e2e8f0;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* ── Level 2 leaf row (default) ── indigo */

.ct-row {
  min-height: 44px;
  border-top: 1px solid #ede9fe;
  border-left: 4px solid #818cf8;
  background: #fafafa;
}

/* ── Level 2 section row (group) ── teal, matches card */

.ct-row-section {
  border-top: 1px solid #ccfbf1;
  border-left: 5px solid var(--accent);
  background: #f0fdf8;
}

.ct-row-section .ct-item :deep(.p-inputtext:first-child) {
  font-weight: 700;
}

/* ── Level 3 grandchild row ── subtle gray, white bg */

.ct-row-d3 {
  border-top: 1px solid #f1f5f9;
  border-left: 2px solid #e2e8f0;
  background: #ffffff;
}

/* Input widths */

.ct-row :deep(.p-inputtext),
.ct-row :deep(.p-inputnumber),
.ct-row :deep(.p-select) {
  width: 100%;
}

.ct-row :deep(.p-textarea) {
  width: 100%;
  white-space: pre-wrap;
}

/* ── Number cell ─────────────────────────────────────────────── */

.ct-num {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Grandchild: indent + L-shaped tree connector */

.ct-num-d3 {
  position: relative;
  justify-content: flex-end;
  padding-right: 4px;
}

.ct-num-d3::before {
  content: '';
  position: absolute;
  left: 10px;
  bottom: 50%;
  width: 14px;
  height: 18px;
  border-left: 2px solid #cbd5e1;
  border-bottom: 2px solid #cbd5e1;
  border-radius: 0 0 0 4px;
}

/* ── Number badge ─────────────────────────────────────────────── */

/* Default: depth-2 leaf — indigo */
.ct-num-badge {
  display: inline-grid;
  min-width: 38px;
  height: 24px;
  place-items: center;
  padding: 0 6px;
  border-radius: 5px;
  background: #ede9fe;
  color: #4f46e5;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

/* Section badge — solid teal, white text */
.ct-badge-section {
  background: var(--accent);
  color: #ffffff;
}

/* Grandchild badge — light gray, muted text */
.ct-badge-d3 {
  background: #f1f5f9;
  color: #94a3b8;
  border: 1px solid #e2e8f0;
  font-weight: 700;
}

/* Item cell */

.ct-item {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.ct-item :deep(.p-textarea) {
  min-height: 32px;
}

.ct-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 700;
}

/* Markup cell */

.ct-markup {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.ct-hint {
  color: #94a3b8;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
}

.ct-amount {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 800;
  text-align: right;
  justify-self: end;
}

.ct-muted {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  justify-self: center;
}

.ct-derived-cost {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-style: italic;
}

.ct-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0;
}

/* Child warnings */

.child-warning {
  margin: 0;
  padding: 6px 12px;
  background: #fffbeb;
  border-top: 1px solid #fde68a;
  color: #b45309;
  font-size: 12px;
  font-weight: 600;
}

/* ── Card footer ───────────────────────────────────────────── */

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 16px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.subtotal-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  color: #64748b;
  font-size: 13px;
}

.subtotal-bar strong {
  color: var(--text-strong);
}

.subtotal-total {
  font-weight: 700;
}

.subtotal-total strong {
  font-size: 14px;
}
</style>
