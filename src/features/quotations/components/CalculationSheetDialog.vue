<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { getQuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { formatCurrency } from '@/shared/utils/formatters'

import type { CurrencyCode, ExchangeRateTable, QuotationItem, TotalsConfig } from '../types'
import { roundMoney } from '../utils/moneyMath'
import { createCalculationSheetCsvContent, type CalculationSheetCsvLabels } from '../utils/quotationCalculationSheetCsv'
import { calculateExtraChargesTotal } from '../utils/quotationCalculations'
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
const tableWrapRef = useTemplateRef<HTMLDivElement>('tableWrap')
const columnHighlightRef = useTemplateRef<HTMLDivElement>('columnHighlight')
const isMixedTaxMode = computed(() => props.totalsConfig.taxMode === 'mixed')
const isQuotationSheet = computed(() => Array.isArray(props.items))
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
const sheetSummary = computed(() => {
  const rootRows = sheetRows.value.filter((row) => row.depth === 1)

  const summary = rootRows.reduce(
    (summary, row) => ({
      totalCost: summary.totalCost + row.totalCost,
      totalMarkupAmount: summary.totalMarkupAmount + row.totalMarkupAmount,
      totalTaxAmount: summary.totalTaxAmount + row.totalTaxAmount,
      totalWithTax: summary.totalWithTax + row.totalWithTax,
    }),
    {
      totalCost: 0,
      totalMarkupAmount: 0,
      totalTaxAmount: 0,
      totalWithTax: 0,
    },
  )

  return {
    totalCost: roundMoney(summary.totalCost),
    totalMarkupAmount: roundMoney(summary.totalMarkupAmount),
    totalTaxAmount: roundMoney(summary.totalTaxAmount),
    totalWithTax: roundMoney(summary.totalWithTax),
  }
})
const extraChargesTotal = computed(() =>
  isQuotationSheet.value ? calculateExtraChargesTotal(props.totalsConfig.extraCharges) : 0,
)
const quoteTotal = computed(() => roundMoney(sheetSummary.value.totalWithTax + extraChargesTotal.value))
const csvSummaryRows = computed(() =>
  isQuotationSheet.value
    ? [
        {
          label: t('quotations.lineItems.calculationSheet.summary.lineItemsTotal'),
          amount: sheetSummary.value.totalWithTax,
        },
        {
          label: t('quotations.lineItems.calculationSheet.summary.extraChargesTotal'),
          amount: extraChargesTotal.value,
        },
        {
          label: t('quotations.lineItems.calculationSheet.summary.quoteTotal'),
          amount: quoteTotal.value,
        },
      ]
    : undefined,
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
  effectiveRate: (rate) => t('quotations.lineItems.calculationSheet.effectiveRate', { rate }),
}))

let activeColumnHoverKey = ''

watch(visible, (nextVisible) => {
  if (!nextVisible) {
    hideColumnHover()
  }
})

onUnmounted(() => {
  hideColumnHover()
})

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
  const rate = formatRate(row.markupRate)

  if (row.isGroup) {
    return t('quotations.lineItems.calculationSheet.effectiveRate', { rate })
  }

  if (row.pricingMethod === 'manual_price') {
    return t('quotations.lineItems.calculationSheet.manualPrice')
  }

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

function getRowClass(row: CalculationSheetRow) {
  return {
    'sheet-row-root': row.depth === 1,
    'sheet-row-group': row.isGroup && row.depth > 1,
  }
}

function getColumnHoverAttrs(columnIndex: number) {
  return {
    'data-sheet-column-index': columnIndex,
  }
}

function updateColumnHover(event: PointerEvent) {
  const tableWrap = tableWrapRef.value
  const highlight = columnHighlightRef.value
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-sheet-column-index]')
    : null
  const table = target?.closest<HTMLTableElement>('[data-calculation-sheet-table="root"]')

  if (!tableWrap || !highlight || !target || !table || !tableWrap.contains(target)) {
    hideColumnHover()
    return
  }

  const columnIndex = target.dataset.sheetColumnIndex
  if (!columnIndex) {
    hideColumnHover()
    return
  }

  const tableRect = table.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const left = Math.round(targetRect.left - tableRect.left)
  const width = Math.round(targetRect.width)
  const height = table.scrollHeight
  const nextHoverKey = `${columnIndex}:${left}:${width}:${height}`

  if (activeColumnHoverKey === nextHoverKey && !highlight.hidden) {
    return
  }

  activeColumnHoverKey = nextHoverKey
  highlight.style.height = `${height}px`
  highlight.style.transform = `translateX(${left}px)`
  highlight.style.width = `${width}px`
  highlight.hidden = false
}

function hideColumnHover() {
  activeColumnHoverKey = ''

  if (columnHighlightRef.value) {
    columnHighlightRef.value.hidden = true
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
        summaryRows: csvSummaryRows.value,
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
    class="sheet-dialog-shell"
    modal
    maximizable
    :draggable="true"
    :style="{ width: 'min(98vw, 1720px)', height: 'min(92vh, 960px)', resize: 'both', overflow: 'hidden' }"
    :content-style="{ height: '100%', padding: '0' }"
    :breakpoints="{ '960px': '98vw' }"
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
      <div class="sheet-context-bar">
        <span class="sheet-context-note">{{ t('quotations.lineItems.calculationSheet.hint') }}</span>
        <span class="sheet-context-chip">{{ t('quotations.lineItems.calculationSheet.rootRollup') }}</span>
        <span class="sheet-context-chip">{{ props.currency }}</span>
      </div>

      <div v-if="sheetRows.length > 0" class="sheet-summary-strip">
        <div class="sheet-summary-card">
          <span>{{ t('quotations.lineItems.calculationSheet.columns.totalCost') }}</span>
          <strong>{{ formatMoney(sheetSummary.totalCost) }}</strong>
        </div>
        <div class="sheet-summary-card">
          <span>{{ t('quotations.lineItems.calculationSheet.columns.totalMarkup') }}</span>
          <strong>{{ formatMoney(sheetSummary.totalMarkupAmount) }}</strong>
        </div>
        <div class="sheet-summary-card">
          <span>{{ t('quotations.lineItems.calculationSheet.columns.totalTax') }}</span>
          <strong>{{ formatMoney(sheetSummary.totalTaxAmount) }}</strong>
        </div>
        <div class="sheet-summary-card sheet-summary-card-strong">
          <span>
            {{
              isQuotationSheet
                ? t('quotations.lineItems.calculationSheet.summary.lineItemsTotal')
                : t('quotations.lineItems.calculationSheet.columns.totalTotal')
            }}
          </span>
          <strong>{{ formatMoney(sheetSummary.totalWithTax) }}</strong>
        </div>
        <div v-if="isQuotationSheet" class="sheet-summary-card">
          <span>{{ t('quotations.lineItems.calculationSheet.summary.extraChargesTotal') }}</span>
          <strong>{{ formatMoney(extraChargesTotal) }}</strong>
        </div>
        <div v-if="isQuotationSheet" class="sheet-summary-card sheet-summary-card-strong">
          <span>{{ t('quotations.lineItems.calculationSheet.summary.quoteTotal') }}</span>
          <strong>{{ formatMoney(quoteTotal) }}</strong>
        </div>
      </div>

      <div
        ref="tableWrap"
        class="sheet-table-wrap"
        @pointerleave="hideColumnHover"
        @pointerover="updateColumnHover"
        @scroll.passive="hideColumnHover"
      >
        <div
          ref="columnHighlight"
          class="sheet-column-hover-indicator"
          aria-hidden="true"
          hidden
        />
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
              <th class="sheet-sticky-start sheet-sticky-number" colspan="2" scope="colgroup">{{ t('quotations.lineItems.calculationSheet.groups.item') }}</th>
              <th class="sheet-group-inputs" :colspan="inputColumnCount" scope="colgroup">{{ t('quotations.lineItems.calculationSheet.groups.inputs') }}</th>
              <th class="sheet-group-unit" colspan="5" scope="colgroup">{{ t('quotations.lineItems.calculationSheet.groups.unit') }}</th>
              <th class="sheet-group-total" colspan="5" scope="colgroup">{{ t('quotations.lineItems.calculationSheet.groups.total') }}</th>
            </tr>
            <tr class="sheet-column-row">
              <th class="sheet-sticky-start sheet-sticky-number" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.number)">{{ t('quotations.lineItems.calculationSheet.columns.number') }}</th>
              <th class="sheet-sticky-start sheet-sticky-name" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.name)">{{ t('quotations.lineItems.calculationSheet.columns.name') }}</th>
              <th class="sheet-cell-input" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.quantity)">{{ t('quotations.lineItems.calculationSheet.columns.quantity') }}</th>
              <th class="sheet-cell-input" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unit)">{{ t('quotations.lineItems.calculationSheet.columns.unit') }}</th>
              <th class="sheet-cell-input sheet-currency-cell" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.fx)">{{ t('quotations.lineItems.calculationSheet.columns.costCurrency') }}</th>
              <th class="sheet-cell-input" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.markupRate)">{{ t('quotations.lineItems.calculationSheet.columns.markupRate') }}</th>
              <th v-if="isMixedTaxMode" class="sheet-cell-input" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.taxClass)">{{ t('quotations.lineItems.calculationSheet.columns.taxClass') }}</th>
              <th class="sheet-cell-input" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.taxRate)">{{ t('quotations.lineItems.calculationSheet.columns.taxRate') }}</th>
              <th class="sheet-cell-unit" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitCost)">{{ t('quotations.lineItems.calculationSheet.columns.unitCost') }}</th>
              <th class="sheet-cell-unit" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitMarkup)">{{ t('quotations.lineItems.calculationSheet.columns.unitMarkup') }}</th>
              <th class="sheet-cell-unit" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitPrice)">{{ t('quotations.lineItems.calculationSheet.columns.unitPrice') }}</th>
              <th class="sheet-cell-unit" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitTax)">{{ t('quotations.lineItems.calculationSheet.columns.unitTax') }}</th>
              <th class="sheet-cell-unit" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitTotal)">{{ t('quotations.lineItems.calculationSheet.columns.unitTotal') }}</th>
              <th class="sheet-cell-total" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalCost)">{{ t('quotations.lineItems.calculationSheet.columns.totalCost') }}</th>
              <th class="sheet-cell-total" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalMarkup)">{{ t('quotations.lineItems.calculationSheet.columns.totalMarkup') }}</th>
              <th class="sheet-cell-total" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.subtotal)">{{ t('quotations.lineItems.summaryLabels.subtotalExcludingTax') }}</th>
              <th class="sheet-cell-total" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalTax)">{{ t('quotations.lineItems.calculationSheet.columns.totalTax') }}</th>
              <th class="sheet-cell-total" scope="col" v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalTotal)">{{ t('quotations.lineItems.calculationSheet.columns.totalTotal') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in sheetRows"
              :key="row.itemId"
              class="sheet-row"
              :class="getRowClass(row)"
            >
              <td class="sheet-number sheet-sticky-start sheet-sticky-number" v-bind="getColumnHoverAttrs(sheetColumnIndexes.number)">{{ row.itemNumber }}</td>
              <td class="sheet-name-cell sheet-sticky-start sheet-sticky-name" v-bind="getColumnHoverAttrs(sheetColumnIndexes.name)">
                <span class="sheet-name" :style="{ paddingLeft: `${Math.max(row.depth - 1, 0) * 18}px` }">
                  {{ row.name || t('quotations.lineItems.navigator.unnamed') }}
                </span>
              </td>
              <td class="sheet-number sheet-cell-input" v-bind="getColumnHoverAttrs(sheetColumnIndexes.quantity)">{{ formatQuantity(row.quantity) }}</td>
              <td class="sheet-cell-input" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unit)">{{ row.quantityUnit || '-' }}</td>
              <td class="sheet-muted sheet-currency-cell sheet-cell-input" v-bind="getColumnHoverAttrs(sheetColumnIndexes.fx)">{{ formatFx(row) }}</td>
              <td class="sheet-rate sheet-cell-input" v-bind="getColumnHoverAttrs(sheetColumnIndexes.markupRate)">{{ formatMarkupRate(row) }}</td>
              <td v-if="isMixedTaxMode" class="sheet-tax sheet-cell-input" v-bind="getColumnHoverAttrs(sheetColumnIndexes.taxClass)">{{ formatTaxClass(row) }}</td>
              <td class="sheet-tax sheet-cell-input" v-bind="getColumnHoverAttrs(sheetColumnIndexes.taxRate)">{{ formatTaxRate(row) }}</td>
              <td class="sheet-money sheet-cell-unit" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitCost)">{{ formatMoney(row.unitCost) }}</td>
              <td class="sheet-money sheet-cell-unit" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitMarkup)">{{ formatMoney(row.unitMarkupAmount) }}</td>
              <td class="sheet-money sheet-cell-unit" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitPrice)">{{ formatMoney(row.unitPrice) }}</td>
              <td class="sheet-money sheet-tax sheet-cell-unit" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitTax)">{{ formatMoney(row.unitTaxAmount) }}</td>
              <td class="sheet-money sheet-total sheet-cell-unit" v-bind="getColumnHoverAttrs(sheetColumnIndexes.unitTotal)">{{ formatMoney(row.unitTotalWithTax) }}</td>
              <td class="sheet-money sheet-cell-total" v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalCost)">{{ formatMoney(row.totalCost) }}</td>
              <td class="sheet-money sheet-cell-total" v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalMarkup)">{{ formatMoney(row.totalMarkupAmount) }}</td>
              <td class="sheet-money sheet-cell-total" v-bind="getColumnHoverAttrs(sheetColumnIndexes.subtotal)">{{ formatMoney(row.subtotal) }}</td>
              <td class="sheet-money sheet-tax sheet-cell-total" v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalTax)">{{ formatMoney(row.totalTaxAmount) }}</td>
              <td class="sheet-money sheet-total sheet-cell-total" v-bind="getColumnHoverAttrs(sheetColumnIndexes.totalTotal)">{{ formatMoney(row.totalWithTax) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
:global(.sheet-dialog-shell.p-dialog) {
  border: 1px solid var(--surface-border-strong);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 22px 56px rgb(15 23 42 / 22%);
}

:global(.sheet-dialog-shell.p-dialog .p-dialog-header) {
  border-bottom: 1px solid var(--surface-border-strong);
  padding: 10px 12px 10px 14px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--accent-surface) 68%, transparent), transparent 50%),
    var(--surface-card);
}

:global(.sheet-dialog-shell.p-dialog .p-dialog-content) {
  background: var(--surface-panel);
}

.sheet-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  min-width: 0;
}

.sheet-dialog-title-block {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.sheet-dialog-eyebrow {
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.sheet-dialog-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 17px;
  font-weight: 800;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-dialog-actions {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
}

.sheet-tax-mode {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  padding: 6px 9px;
  background: var(--accent-surface);
  color: var(--accent);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.sheet-dialog {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-raised) 82%, white), var(--surface-panel)),
    var(--surface-panel);
  container: calculation-sheet / inline-size;
}

.sheet-context-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--surface-border-strong);
  background: color-mix(in srgb, var(--surface-raised) 78%, white);
  color: var(--text-muted);
  font-size: 12px;
}

.sheet-context-note {
  min-width: 0;
  margin-right: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-context-chip {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  min-height: 24px;
  border: 1px solid color-mix(in srgb, var(--surface-border-strong) 72%, transparent);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  background: var(--surface-card);
  color: var(--text-body);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.sheet-summary-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  border-bottom: 1px solid var(--surface-border-strong);
  background: var(--surface-border-strong);
}

.sheet-summary-card {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px 14px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-raised) 70%, white), white),
    var(--surface-card);
}

.sheet-summary-card span {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.sheet-summary-card strong {
  overflow: hidden;
  color: var(--text-strong);
  font-size: 17px;
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-summary-card-strong {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-surface) 72%, white), white),
    var(--surface-card);
}

.sheet-summary-card-strong strong {
  color: var(--accent);
}

.sheet-table-wrap {
  --sheet-row-hover-wash: rgb(15 118 110 / 9%);
  --sheet-column-hover-wash: rgb(16 185 129 / 10%);
  position: relative;
  min-height: 0;
  overflow: auto;
  border-top: 1px solid color-mix(in srgb, var(--surface-border-strong) 72%, white);
  background:
    linear-gradient(90deg, rgb(15 23 42 / 5%), transparent 10px) 0 0 / 10px 100% no-repeat,
    var(--surface-card);
}

.sheet-column-hover-indicator {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 7;
  width: 0;
  background: var(--sheet-column-hover-wash);
  pointer-events: none;
  will-change: transform, width, height;
}

.sheet-column-hover-indicator[hidden] {
  display: none;
}

.sheet-table {
  --sheet-sticky-number-width: 52px;
  --sheet-sticky-name-left: var(--sheet-sticky-number-width);
  width: 100%;
  min-width: 1540px;
  border-collapse: separate;
  border-spacing: 0;
  color: var(--text-body);
  font-size: 12px;
  table-layout: fixed;
}

.sheet-table-mixed {
  min-width: 1640px;
}

.sheet-number-col {
  width: var(--sheet-sticky-number-width);
}

.sheet-name-col {
  width: 250px;
}

.sheet-qty-col,
.sheet-unit-col,
.sheet-tax-rate-col {
  width: 64px;
}

.sheet-fx-col {
  width: 86px;
}

.sheet-money-col {
  width: 116px;
}

.sheet-rate-col {
  width: 104px;
}

.sheet-tax-class-col {
  width: 110px;
}

.sheet-table th,
.sheet-table td {
  border-right: 1px solid color-mix(in srgb, var(--surface-border) 78%, white);
  border-bottom: 1px solid color-mix(in srgb, var(--surface-border) 82%, white);
  padding: 8px 9px;
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
  z-index: 5;
  height: 34px;
  border-bottom-color: color-mix(in srgb, var(--accent) 26%, var(--surface-border));
  background: #122234;
  color: #ffffff;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0;
  text-align: center;
  text-transform: uppercase;
}

.sheet-column-row th {
  position: sticky;
  top: 34px;
  z-index: 5;
  height: 42px;
  background: #f3f6f8;
  color: #475569;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.15;
  text-transform: uppercase;
}

.sheet-group-inputs {
  background: color-mix(in srgb, #122234 88%, #0e7490) !important;
}

.sheet-group-unit {
  background: color-mix(in srgb, #122234 86%, var(--accent)) !important;
}

.sheet-group-total {
  background: color-mix(in srgb, #122234 84%, #b45309) !important;
}

.sheet-cell-input {
  background-color: color-mix(in srgb, #f8fafc 72%, white);
}

.sheet-cell-unit {
  background-color: color-mix(in srgb, var(--accent-surface) 28%, white);
}

.sheet-cell-total {
  background-color: color-mix(in srgb, #fff7ed 50%, white);
}

.sheet-row:nth-child(even) {
  background: #fbfdff;
}

.sheet-row:hover > td {
  box-shadow: inset 0 0 0 9999px var(--sheet-row-hover-wash);
}

.sheet-row-root {
  background: color-mix(in srgb, var(--accent-surface) 74%, white) !important;
  font-weight: 800;
}

.sheet-row-group {
  background: color-mix(in srgb, var(--info-soft) 46%, white);
  font-weight: 700;
}

.sheet-row-root > .sheet-sticky-start,
.sheet-row-group > .sheet-sticky-start {
  background: inherit;
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
  color: #4f46e5;
  font-weight: 800;
}

.sheet-tax {
  color: #9a4f00;
  font-weight: 800;
}

.sheet-total {
  color: #047857;
  font-weight: 900;
}

.sheet-name {
  display: inline-block;
  max-width: 100%;
  line-height: 1.25;
  overflow-wrap: anywhere;
  white-space: normal;
}

.sheet-sticky-start {
  position: sticky;
  z-index: 4;
  background: inherit;
}

th.sheet-sticky-start {
  z-index: 6;
}

.sheet-sticky-number {
  left: 0;
  box-shadow: 1px 0 0 color-mix(in srgb, var(--surface-border-strong) 72%, transparent);
}

.sheet-sticky-name {
  left: var(--sheet-sticky-name-left);
  box-shadow: 1px 0 0 color-mix(in srgb, var(--surface-border-strong) 72%, transparent);
}

tbody .sheet-sticky-start {
  background: var(--surface-card);
}

tbody .sheet-row:nth-child(even) .sheet-sticky-start {
  background: #fbfdff;
}

tbody .sheet-row:hover .sheet-sticky-start {
  box-shadow:
    inset 0 0 0 9999px var(--sheet-row-hover-wash),
    1px 0 0 color-mix(in srgb, var(--surface-border-strong) 72%, transparent);
}

@container calculation-sheet (max-width: 900px) {
  .sheet-table {
    min-width: 1280px;
    font-size: 11px;
  }

  .sheet-table-mixed {
    min-width: 1360px;
  }

  .sheet-table th,
  .sheet-table td {
    padding: 7px 6px;
  }

  .sheet-name-col {
    width: 190px;
  }

  .sheet-fx-col {
    width: 74px;
  }

  .sheet-money-col {
    width: 96px;
  }

  .sheet-rate-col {
    width: 90px;
  }
}

@media (max-width: 700px) {
  .sheet-dialog-header,
  .sheet-context-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .sheet-dialog-title {
    white-space: normal;
  }

  .sheet-summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
