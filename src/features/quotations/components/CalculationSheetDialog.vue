<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { getQuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { formatCurrency } from '@/shared/utils/formatters'

import type { CurrencyCode, ExchangeRateTable, QuotationItem, TotalsConfig } from '../types'
import { createCalculationSheetCsvContent, type CalculationSheetCsvLabels } from '../utils/quotationCalculationSheetCsv'
import {
  createCalculationSheetRows,
  type CalculationSheetRow,
} from '../utils/quotationCalculationSheetRows'

const visible = defineModel<boolean>('visible', { default: false })

const props = defineProps<{
  item?: QuotationItem
  itemNumber?: string
  items?: QuotationItem[]
  title?: string
  exportFileName?: string
  currency: CurrencyCode
  globalMarkupRate: number
  totalsConfig: TotalsConfig
  exchangeRates: ExchangeRateTable
}>()

const { t, locale } = useI18n()
const runtime = getQuotationRuntime()
const currentLocale = computed(() => locale.value as SupportedLocale)
const isMixedTaxMode = computed(() => props.totalsConfig.taxMode === 'mixed')
const fallbackItemName = computed(() =>
  props.item?.name.trim() || t('quotations.lineItems.navigator.unnamed'),
)
const dialogTitle = computed(() =>
  props.title
    ?? t('quotations.lineItems.calculationSheet.title', {
      itemNumber: props.itemNumber ?? '',
      name: fallbackItemName.value,
      itemName: fallbackItemName.value,
    }),
)
const taxModeLabel = computed(() =>
  isMixedTaxMode.value
    ? t('quotations.lineItems.calculationSheet.mixedTaxMode')
    : t('quotations.lineItems.calculationSheet.singleTaxMode'),
)
const sheetRows = computed(() =>
  props.items?.length
    ? props.items.flatMap((item, index) => createSheetRows(item, String(index + 1)))
    : props.item
      ? createSheetRows(props.item, props.itemNumber ?? '1')
      : [],
)
const isExportingCsv = shallowRef(false)
const inputColumnCount = computed(() => (isMixedTaxMode.value ? 6 : 5))
const sheetColumnIndexes = computed(() => {
  const taxRate = isMixedTaxMode.value ? 7 : 6
  const unitCost = taxRate + 1

  return {
    number: 0,
    name: 1,
    quantity: 2,
    unit: 3,
    fx: 4,
    markupRate: 5,
    taxClass: 6,
    taxRate,
    unitCost,
    unitMarkup: unitCost + 1,
    unitPrice: unitCost + 2,
    unitTax: unitCost + 3,
    unitTotal: unitCost + 4,
    totalCost: unitCost + 5,
    totalMarkup: unitCost + 6,
    subtotal: unitCost + 7,
    totalTax: unitCost + 8,
    totalTotal: unitCost + 9,
  }
})
const exportFileName = computed(() =>
  props.exportFileName
  ?? (props.items?.length
    ? 'calculation-sheet-quotation.csv'
    : `calculation-sheet-item-${sanitizeFileNamePart(props.itemNumber ?? '1')}.csv`),
)
const csvLabels = computed<CalculationSheetCsvLabels>(() => ({
  groups: {
    item: t('quotations.lineItems.calculationSheet.groups.item'),
    inputs: t('quotations.lineItems.calculationSheet.groups.inputs'),
    unit: t('quotations.lineItems.calculationSheet.groups.unit'),
    total: t('quotations.lineItems.calculationSheet.groups.total'),
  },
  columns: {
    number: t('quotations.lineItems.calculationSheet.columns.number'),
    name: t('quotations.lineItems.calculationSheet.columns.name'),
    quantity: t('quotations.lineItems.calculationSheet.columns.quantity'),
    unit: t('quotations.lineItems.calculationSheet.columns.unit'),
    costCurrency: t('quotations.lineItems.calculationSheet.columns.costCurrency'),
    markupRate: t('quotations.lineItems.calculationSheet.columns.markupRate'),
    taxClass: t('quotations.lineItems.calculationSheet.columns.taxClass'),
    taxRate: t('quotations.lineItems.calculationSheet.columns.taxRate'),
    cost: t('quotations.lineItems.calculationSheet.csvColumns.cost'),
    markup: t('quotations.lineItems.calculationSheet.csvColumns.markup'),
    price: t('quotations.lineItems.calculationSheet.csvColumns.price'),
    tax: t('quotations.lineItems.calculationSheet.csvColumns.tax'),
    total: t('quotations.lineItems.calculationSheet.csvColumns.total'),
    subtotalExcludingTax: t('quotations.lineItems.summaryLabels.subtotalExcludingTax'),
  },
  rollup: t('quotations.lineItems.calculationSheet.rollup'),
  taxClassMixed: t('quotations.lineItems.taxClassMixed'),
  costCurrencyMixed: t('quotations.lineItems.calculationSheet.costCurrencyMixed'),
  manualPrice: t('quotations.lineItems.calculationSheet.manualPrice'),
  globalRate: (rate) => t('quotations.lineItems.calculationSheet.globalRate', { rate }),
  inheritedRate: (rate, source) => t('quotations.lineItems.calculationSheet.inheritedRate', { rate, source }),
}))

function createSheetRows(item: QuotationItem, itemNumber: string) {
  return createCalculationSheetRows({
    item,
    itemNumber,
    globalMarkupRate: props.globalMarkupRate,
    exchangeRates: props.exchangeRates,
    totalsConfig: props.totalsConfig,
  })
}

function formatMoney(amount: number) {
  return formatCurrency(amount, props.currency, currentLocale.value)
}

function formatQuantity(value: number) {
  const normalizedValue = Number.isFinite(value) ? value : 0

  return new Intl.NumberFormat(currentLocale.value, {
    minimumFractionDigits: Number.isInteger(normalizedValue) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(normalizedValue)
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat(currentLocale.value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value)
}

function formatRate(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return '--'
  }

  return `${formatDecimal(value)}%`
}

function formatFx(row: CalculationSheetRow) {
  if (row.hasMixedCostCurrencies) {
    return t('quotations.lineItems.calculationSheet.costCurrencyMixed')
  }

  if (row.costCurrency === null) {
    return t('quotations.lineItems.calculationSheet.rollup')
  }

  return row.costCurrency
}

function formatMarkupRate(row: CalculationSheetRow) {
  if (row.pricingMethod === 'manual_price') {
    return t('quotations.lineItems.calculationSheet.manualPrice')
  }

  const rate = formatRate(row.markupRate)

  if (row.markupSource === 'inherited') {
    return t('quotations.lineItems.calculationSheet.inheritedRate', {
      rate,
      source: row.markupSourceLabel ?? '-',
    })
  }

  if (row.markupSource === 'global') {
    return t('quotations.lineItems.calculationSheet.globalRate', { rate })
  }

  return rate
}

function formatTaxClass(row: CalculationSheetRow) {
  if (row.hasMixedTaxClasses) {
    return t('quotations.lineItems.taxClassMixed')
  }

  return row.taxClassLabel ?? '--'
}

function formatTaxRate(row: CalculationSheetRow) {
  return formatRate(row.taxRate ?? row.effectiveTaxRate)
}

function getRowClass(row: CalculationSheetRow, index: number) {
  return {
    'sheet-row-root': index === 0,
    'sheet-row-group': row.isGroup && index > 0,
  }
}

function getColumnHoverAttrs(columnIndex: number) {
  return {
    'data-sheet-column-index': columnIndex,
  }
}

async function exportCalculationSheetCsv() {
  if (isExportingCsv.value) {
    return
  }

  isExportingCsv.value = true

  try {
    await runtime.saveLineItemsCsvFile({
      defaultPath: exportFileName.value,
      content: createCalculationSheetCsvContent({
        rows: sheetRows.value,
        currency: props.currency,
        includeTaxClass: isMixedTaxMode.value,
        labels: csvLabels.value,
      }),
    })
  } finally {
    isExportingCsv.value = false
  }
}

function sanitizeFileNamePart(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .trim() || '1'
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    maximizable
    :draggable="true"
    :style="{ width: 'min(92vw, 1180px)', height: 'min(82vh, 720px)', resize: 'both', overflow: 'hidden' }"
    :content-style="{ height: '100%', padding: '0' }"
    :breakpoints="{ '960px': '96vw' }"
  >
    <template #header>
      <div class="sheet-dialog-header">
        <div class="sheet-dialog-title-block">
          <span class="sheet-dialog-eyebrow">{{ t('quotations.lineItems.calculationSheet.eyebrow') }}</span>
          <h3 class="sheet-dialog-title">{{ dialogTitle }}</h3>
        </div>
        <div class="sheet-dialog-actions">
          <span class="sheet-tax-mode">{{ taxModeLabel }}</span>
          <Button
            data-calculation-sheet-export-csv
            icon="pi pi-file-export"
            :label="t('quotations.lineItems.calculationSheet.exportCsv')"
            size="small"
            severity="secondary"
            outlined
            :loading="isExportingCsv"
            :disabled="sheetRows.length === 0"
            :aria-label="t('quotations.lineItems.calculationSheet.exportCsvAria')"
            @click="exportCalculationSheetCsv"
          />
        </div>
      </div>
    </template>

    <div class="sheet-dialog" data-calculation-sheet-dialog="root">
      <div class="sheet-scroll-hint">
        <span>{{ t('quotations.lineItems.calculationSheet.hint') }}</span>
        <strong>{{ t('quotations.lineItems.calculationSheet.rollup') }}</strong>
      </div>

      <div class="sheet-table-wrap">
        <table
          class="sheet-table"
          data-calculation-sheet-table="root"
          :class="{ 'sheet-table-mixed': isMixedTaxMode }"
        >
          <colgroup>
            <col class="sheet-number-col">
            <col class="sheet-name-col">
            <col class="sheet-qty-col">
            <col class="sheet-unit-col">
            <col class="sheet-fx-col">
            <col class="sheet-rate-col">
            <col v-if="isMixedTaxMode" class="sheet-tax-class-col">
            <col class="sheet-tax-rate-col">
            <col class="sheet-money-col">
            <col class="sheet-money-col">
            <col class="sheet-money-col">
            <col class="sheet-money-col">
            <col class="sheet-money-col">
            <col class="sheet-money-col">
            <col class="sheet-money-col">
            <col class="sheet-money-col">
            <col class="sheet-money-col">
            <col class="sheet-money-col">
          </colgroup>
          <thead>
            <tr class="sheet-group-row">
              <th colspan="2">{{ t('quotations.lineItems.calculationSheet.groups.item') }}</th>
              <th :colspan="inputColumnCount">{{ t('quotations.lineItems.calculationSheet.groups.inputs') }}</th>
              <th colspan="5">{{ t('quotations.lineItems.calculationSheet.groups.unit') }}</th>
              <th colspan="5">{{ t('quotations.lineItems.calculationSheet.groups.total') }}</th>
            </tr>
            <tr class="sheet-column-row">
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.number)">{{ t('quotations.lineItems.calculationSheet.columns.number') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.name)">{{ t('quotations.lineItems.calculationSheet.columns.name') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.quantity)">{{ t('quotations.lineItems.calculationSheet.columns.quantity') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.unit)">{{ t('quotations.lineItems.calculationSheet.columns.unit') }}</th>
              <th class="sheet-currency-cell" v-bind="getColumnHoverAttrs(sheetColumnIndexes.fx)">{{ t('quotations.lineItems.calculationSheet.columns.costCurrency') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.markupRate)">{{ t('quotations.lineItems.calculationSheet.columns.markupRate') }}</th>
              <th v-if="isMixedTaxMode" v-bind="getColumnHoverAttrs(sheetColumnIndexes.taxClass)">{{ t('quotations.lineItems.calculationSheet.columns.taxClass') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.taxRate)">{{ t('quotations.lineItems.calculationSheet.columns.taxRate') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitCost)">{{ t('quotations.lineItems.calculationSheet.columns.unitCost') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitMarkup)">{{ t('quotations.lineItems.calculationSheet.columns.unitMarkup') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitPrice)">{{ t('quotations.lineItems.calculationSheet.columns.unitPrice') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitTax)">{{ t('quotations.lineItems.calculationSheet.columns.unitTax') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitTotal)">{{ t('quotations.lineItems.calculationSheet.columns.unitTotal') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalCost)">{{ t('quotations.lineItems.calculationSheet.columns.totalCost') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalMarkup)">{{ t('quotations.lineItems.calculationSheet.columns.totalMarkup') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.subtotal)">{{ t('quotations.lineItems.summaryLabels.subtotalExcludingTax') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalTax)">{{ t('quotations.lineItems.calculationSheet.columns.totalTax') }}</th>
              <th v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalTotal)">{{ t('quotations.lineItems.calculationSheet.columns.totalTotal') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in sheetRows"
              :key="row.itemId"
              class="sheet-row"
              :class="getRowClass(row, index)"
            >
              <td class="sheet-number" v-bind="getColumnHoverAttrs(sheetColumnIndexes.number)">{{ row.itemNumber }}</td>
              <td class="sheet-name-cell" v-bind="getColumnHoverAttrs(sheetColumnIndexes.name)">
                <span class="sheet-name" :style="{ paddingLeft: `${Math.max(row.depth - 1, 0) * 18}px` }">
                  {{ row.name || t('quotations.lineItems.navigator.unnamed') }}
                </span>
              </td>
              <td class="sheet-number" v-bind="getColumnHoverAttrs(sheetColumnIndexes.quantity)">{{ formatQuantity(row.quantity) }}</td>
              <td v-bind="getColumnHoverAttrs(sheetColumnIndexes.unit)">{{ row.quantityUnit || '-' }}</td>
              <td class="sheet-muted sheet-currency-cell" v-bind="getColumnHoverAttrs(sheetColumnIndexes.fx)">{{ formatFx(row) }}</td>
              <td class="sheet-rate" v-bind="getColumnHoverAttrs(sheetColumnIndexes.markupRate)">{{ formatMarkupRate(row) }}</td>
              <td v-if="isMixedTaxMode" class="sheet-tax" v-bind="getColumnHoverAttrs(sheetColumnIndexes.taxClass)">{{ formatTaxClass(row) }}</td>
              <td class="sheet-tax" v-bind="getColumnHoverAttrs(sheetColumnIndexes.taxRate)">{{ formatTaxRate(row) }}</td>
              <td class="sheet-money" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitCost)">{{ formatMoney(row.unitCost) }}</td>
              <td class="sheet-money" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitMarkup)">{{ formatMoney(row.unitMarkupAmount) }}</td>
              <td class="sheet-money" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitPrice)">{{ formatMoney(row.unitPrice) }}</td>
              <td class="sheet-money sheet-tax" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitTax)">{{ formatMoney(row.unitTaxAmount) }}</td>
              <td class="sheet-money sheet-total" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitTotal)">{{ formatMoney(row.unitTotalWithTax) }}</td>
              <td class="sheet-money" v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalCost)">{{ formatMoney(row.totalCost) }}</td>
              <td class="sheet-money" v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalMarkup)">{{ formatMoney(row.totalMarkupAmount) }}</td>
              <td class="sheet-money" v-bind="getColumnHoverAttrs(sheetColumnIndexes.subtotal)">{{ formatMoney(row.subtotal) }}</td>
              <td class="sheet-money sheet-tax" v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalTax)">{{ formatMoney(row.totalTaxAmount) }}</td>
              <td class="sheet-money sheet-total" v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalTotal)">{{ formatMoney(row.totalWithTax) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.sheet-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  width: 100%;
  min-width: 0;
}

.sheet-dialog-title-block {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.sheet-dialog-eyebrow {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sheet-dialog-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 800;
}

.sheet-dialog-actions {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

.sheet-tax-mode {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  padding: 6px 10px;
  background: var(--surface-card);
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
}

.sheet-dialog {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  background: linear-gradient(135deg, #f7f1e6 0%, #eaf3f3 100%);
  container: calculation-sheet / inline-size;
}

.sheet-scroll-hint {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  border-bottom: 1px solid #ead7aa;
  background: #fff8e8;
  color: #7c4a03;
  font-size: 12px;
}

.sheet-table-wrap {
  min-height: 0;
  overflow: auto;
  background: var(--surface-card);
}

.sheet-table {
  width: 100%;
  min-width: 1180px;
  border-collapse: separate;
  border-spacing: 0;
  color: var(--text-body);
  font-size: 12px;
  table-layout: fixed;
}

.sheet-table-mixed {
  min-width: 1280px;
}

.sheet-number-col {
  width: 46px;
}

.sheet-name-col {
  width: 150px;
}

.sheet-qty-col,
.sheet-unit-col,
.sheet-tax-rate-col {
  width: 56px;
}

.sheet-fx-col,
.sheet-money-col {
  width: 74px;
}

.sheet-rate-col {
  width: 84px;
}

.sheet-tax-class-col {
  width: 76px;
}

.sheet-table th,
.sheet-table td {
  border-right: 1px solid var(--surface-border);
  border-bottom: 1px solid var(--surface-border);
  padding: 8px 7px;
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
  transition: background-color 0.12s ease;
}

.sheet-name-cell {
  white-space: normal !important;
}

.sheet-currency-cell {
  line-height: 1.2;
  overflow-wrap: anywhere;
  white-space: normal !important;
}

.sheet-group-row th {
  position: sticky;
  top: 0;
  z-index: 3;
  background: #294c60;
  color: #ffffff;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-align: center;
  text-transform: uppercase;
}

.sheet-column-row th {
  position: sticky;
  top: 32px;
  z-index: 3;
  background: #eef4f7;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.sheet-row:nth-child(even) {
  background: #fbfdff;
}

.sheet-row:hover > td {
  background: #fff8cc;
}

/* CSS-only column hover avoids stale highlighted cells after scroll or resize. */
.sheet-table:has([data-sheet-column-index='0']:hover) [data-sheet-column-index='0'],
.sheet-table:has([data-sheet-column-index='1']:hover) [data-sheet-column-index='1'],
.sheet-table:has([data-sheet-column-index='2']:hover) [data-sheet-column-index='2'],
.sheet-table:has([data-sheet-column-index='3']:hover) [data-sheet-column-index='3'],
.sheet-table:has([data-sheet-column-index='4']:hover) [data-sheet-column-index='4'],
.sheet-table:has([data-sheet-column-index='5']:hover) [data-sheet-column-index='5'],
.sheet-table:has([data-sheet-column-index='6']:hover) [data-sheet-column-index='6'],
.sheet-table:has([data-sheet-column-index='7']:hover) [data-sheet-column-index='7'],
.sheet-table:has([data-sheet-column-index='8']:hover) [data-sheet-column-index='8'],
.sheet-table:has([data-sheet-column-index='9']:hover) [data-sheet-column-index='9'],
.sheet-table:has([data-sheet-column-index='10']:hover) [data-sheet-column-index='10'],
.sheet-table:has([data-sheet-column-index='11']:hover) [data-sheet-column-index='11'],
.sheet-table:has([data-sheet-column-index='12']:hover) [data-sheet-column-index='12'],
.sheet-table:has([data-sheet-column-index='13']:hover) [data-sheet-column-index='13'],
.sheet-table:has([data-sheet-column-index='14']:hover) [data-sheet-column-index='14'],
.sheet-table:has([data-sheet-column-index='15']:hover) [data-sheet-column-index='15'],
.sheet-table:has([data-sheet-column-index='16']:hover) [data-sheet-column-index='16'],
.sheet-table:has([data-sheet-column-index='17']:hover) [data-sheet-column-index='17'] {
  background: #fff8cc !important;
}

.sheet-row-root {
  background: #eaf4ef !important;
  font-weight: 800;
}

.sheet-row-group {
  background: var(--accent-surface);
  font-weight: 700;
}

.sheet-number,
.sheet-money {
  font-variant-numeric: tabular-nums;
}

.sheet-money {
  text-align: right !important;
}

.sheet-muted {
  color: var(--text-subtle);
}

.sheet-rate {
  color: #6d3fc4;
  font-weight: 800;
}

.sheet-tax {
  color: #9a4f00;
  font-weight: 800;
}

.sheet-total {
  color: #226b4a;
  font-weight: 900;
}

.sheet-name {
  display: inline-block;
  max-width: 100%;
  line-height: 1.25;
  overflow-wrap: anywhere;
  white-space: normal;
}

@container calculation-sheet (max-width: 900px) {
  .sheet-table {
    min-width: 980px;
    font-size: 11px;
  }

  .sheet-table-mixed {
    min-width: 1060px;
  }

  .sheet-table th,
  .sheet-table td {
    padding: 6px 5px;
  }

  .sheet-name-col {
    width: 120px;
  }

  .sheet-money-col,
  .sheet-fx-col {
    width: 62px;
  }

  .sheet-rate-col {
    width: 72px;
  }
}

@media (max-width: 700px) {
  .sheet-dialog-header,
  .sheet-scroll-hint {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
