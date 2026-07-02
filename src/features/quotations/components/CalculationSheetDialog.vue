<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, nextTick, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
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

type SheetCardField = {
  label: string
  value: string
  kind?: 'money' | 'tax' | 'total'
}

type SheetCardSection = {
  label: string
  tone: 'inputs' | 'unit' | 'total'
  fields: SheetCardField[]
}

type SheetCardRow = {
  row: CalculationSheetRow
  sections: SheetCardSection[]
}

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
const sheetDialogRef = useTemplateRef<HTMLElement>('sheetDialog')
const tableWrapRef = useTemplateRef<HTMLDivElement>('tableWrap')
const columnHighlightRef = useTemplateRef<HTMLDivElement>('columnHighlight')
const isCardLayout = shallowRef(false)
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
const sheetSummary = computed(() => {
  const rootRows = sheetRows.value.filter((row) => row.depth === 1)

  return rootRows.reduce(
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
})
const sheetCardRows = computed<SheetCardRow[]>(() =>
  sheetRows.value.map((row) => ({
    row,
    sections: [
      {
        label: t('quotations.lineItems.calculationSheet.groups.inputs'),
        tone: 'inputs',
        fields: [
          {
            label: t('quotations.lineItems.calculationSheet.columns.quantity'),
            value: formatQuantity(row.quantity),
          },
          {
            label: t('quotations.lineItems.calculationSheet.columns.unit'),
            value: row.quantityUnit || '-',
          },
          {
            label: t('quotations.lineItems.calculationSheet.columns.costCurrency'),
            value: formatFx(row),
          },
          {
            label: t('quotations.lineItems.calculationSheet.columns.markupRate'),
            value: formatMarkupRate(row),
          },
          ...(isMixedTaxMode.value
            ? [{
                label: t('quotations.lineItems.calculationSheet.columns.taxClass'),
                value: formatTaxClass(row),
              }]
            : []),
          {
            label: t('quotations.lineItems.calculationSheet.columns.taxRate'),
            value: formatTaxRate(row),
            kind: 'tax',
          },
        ],
      },
      {
        label: t('quotations.lineItems.calculationSheet.groups.unit'),
        tone: 'unit',
        fields: [
          {
            label: t('quotations.lineItems.calculationSheet.columns.unitCost'),
            value: formatMoney(row.unitCost),
            kind: 'money',
          },
          {
            label: t('quotations.lineItems.calculationSheet.columns.unitMarkup'),
            value: formatMoney(row.unitMarkupAmount),
            kind: 'money',
          },
          {
            label: t('quotations.lineItems.calculationSheet.columns.unitPrice'),
            value: formatMoney(row.unitPrice),
            kind: 'money',
          },
          {
            label: t('quotations.lineItems.calculationSheet.columns.unitTax'),
            value: formatMoney(row.unitTaxAmount),
            kind: 'tax',
          },
          {
            label: t('quotations.lineItems.calculationSheet.columns.unitTotal'),
            value: formatMoney(row.unitTotalWithTax),
            kind: 'total',
          },
        ],
      },
      {
        label: t('quotations.lineItems.calculationSheet.groups.total'),
        tone: 'total',
        fields: [
          {
            label: t('quotations.lineItems.calculationSheet.columns.totalCost'),
            value: formatMoney(row.totalCost),
            kind: 'money',
          },
          {
            label: t('quotations.lineItems.calculationSheet.columns.totalMarkup'),
            value: formatMoney(row.totalMarkupAmount),
            kind: 'money',
          },
          {
            label: t('quotations.lineItems.summaryLabels.subtotalExcludingTax'),
            value: formatMoney(row.subtotal),
            kind: 'money',
          },
          {
            label: t('quotations.lineItems.calculationSheet.columns.totalTax'),
            value: formatMoney(row.totalTaxAmount),
            kind: 'tax',
          },
          {
            label: t('quotations.lineItems.calculationSheet.columns.totalTotal'),
            value: formatMoney(row.totalWithTax),
            kind: 'total',
          },
        ],
      },
    ],
  })),
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

let layoutResizeObserver: ResizeObserver | null = null
let activeColumnHoverKey = ''

watch(
  visible,
  async (nextVisible) => {
    if (!nextVisible) {
      stopObservingSheetLayout()
      hideColumnHover()
      return
    }

    await nextTick()
    observeSheetLayout()
  },
  { immediate: true },
)

onUnmounted(() => {
  stopObservingSheetLayout()
})

function observeSheetLayout() {
  stopObservingSheetLayout()
  syncSheetLayout()

  const sheetDialog = sheetDialogRef.value
  if (!sheetDialog || typeof ResizeObserver === 'undefined') {
    return
  }

  layoutResizeObserver = new ResizeObserver(syncSheetLayout)
  layoutResizeObserver.observe(sheetDialog)
}

function stopObservingSheetLayout() {
  layoutResizeObserver?.disconnect()
  layoutResizeObserver = null
}

function syncSheetLayout() {
  const sheetDialog = sheetDialogRef.value
  if (!sheetDialog) {
    return
  }

  const nextIsCardLayout = sheetDialog.clientWidth <= 1500
  isCardLayout.value = nextIsCardLayout

  if (nextIsCardLayout) {
    hideColumnHover()
  }
}

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
  if (isCardLayout.value) {
    hideColumnHover()
    return
  }

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
    :style="{
      width: 'min(96vw, 1720px)',
      maxWidth: 'calc(100vw - 24px)',
      height: 'min(90vh, 900px)',
      maxHeight: 'calc(100vh - 24px)',
      overflow: 'hidden',
    }"
    :content-style="{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '0',
      padding: '0',
      overflow: 'hidden',
    }"
    :breakpoints="{ '1180px': '96vw', '700px': 'calc(100vw - 16px)' }"
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

    <div ref="sheetDialog" class="sheet-dialog" data-calculation-sheet-dialog="root">
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
          <span>{{ t('quotations.lineItems.calculationSheet.columns.totalTotal') }}</span>
          <strong>{{ formatMoney(sheetSummary.totalWithTax) }}</strong>
        </div>
      </div>

      <div class="sheet-detail-area">
        <div
          v-if="isCardLayout && sheetCardRows.length > 0"
          class="sheet-card-list"
          data-calculation-sheet-cards="root"
        >
          <article
            v-for="cardRow in sheetCardRows"
            :key="`${cardRow.row.itemId}-card`"
            class="sheet-detail-card"
            :class="getRowClass(cardRow.row)"
          >
            <div class="sheet-card-heading">
              <span class="sheet-card-number">{{ cardRow.row.itemNumber }}</span>
              <strong
                class="sheet-card-name"
                :style="{ paddingLeft: `${Math.max(cardRow.row.depth - 1, 0) * 14}px` }"
              >
                {{ cardRow.row.name || t('quotations.lineItems.navigator.unnamed') }}
              </strong>
            </div>

            <div class="sheet-card-sections">
              <section
                v-for="section in cardRow.sections"
                :key="section.label"
                class="sheet-card-section"
                :class="`sheet-card-section-${section.tone}`"
              >
                <h4 class="sheet-card-section-title">{{ section.label }}</h4>
                <dl class="sheet-card-fields">
                  <div
                    v-for="field in section.fields"
                    :key="field.label"
                    class="sheet-card-field"
                    :class="field.kind ? `sheet-card-field-${field.kind}` : undefined"
                  >
                    <dt class="sheet-card-label">{{ field.label }}</dt>
                    <dd class="sheet-card-value">{{ field.value }}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </article>
        </div>

        <div
          v-else-if="sheetRows.length > 0"
          ref="tableWrap"
          class="sheet-table-wrap"
          @pointerleave="hideColumnHover"
          @pointerover="updateColumnHover"
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
    </div>
  </Dialog>
</template>

<style scoped>
:deep(.sheet-dialog-shell) {
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
  border: 1px solid color-mix(in srgb, var(--surface-border-strong) 72%, transparent);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 18px 54px rgb(15 23 42 / 18%);
}

:deep(.sheet-dialog-shell .p-dialog-header) {
  flex-shrink: 0;
  border-bottom: 1px solid var(--surface-border);
  padding: 12px 14px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--accent) 8%, transparent), transparent 52%),
    var(--surface-card);
}

:deep(.sheet-dialog-shell .p-dialog-content) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: var(--surface-panel);
}

.sheet-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  width: 100%;
  min-width: 0;
}

.sheet-dialog-title-block {
  display: grid;
  flex: 1 1 320px;
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
  flex: 0 1 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.sheet-tax-mode {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  border: 1px solid var(--accent-soft);
  border-radius: var(--radius-md);
  padding: 6px 9px;
  background: color-mix(in srgb, var(--accent-surface) 78%, white);
  color: var(--accent);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.sheet-dialog {
  display: grid;
  flex: 1 1 auto;
  grid-template-rows: auto auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
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
  border-bottom: 1px solid var(--surface-border);
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
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-border);
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

.sheet-detail-area {
  display: grid;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.sheet-table-wrap {
  --sheet-row-hover-wash: rgb(37 99 235 / 8%);
  --sheet-column-hover-wash: rgb(16 185 129 / 10%);
  position: relative;
  min-height: 0;
  overflow: auto;
  border-top: 1px solid color-mix(in srgb, var(--surface-border) 72%, white);
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

.sheet-card-list {
  display: block;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 10px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-raised) 44%, transparent), transparent 160px),
    var(--surface-panel);
}

.sheet-detail-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--surface-border-strong) 62%, transparent);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  box-shadow: 0 1px 2px rgb(15 23 42 / 5%);
}

.sheet-detail-card + .sheet-detail-card {
  margin-top: 8px;
}

.sheet-detail-card.sheet-row-root {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--surface-border));
  background: color-mix(in srgb, var(--accent-surface) 46%, white);
}

.sheet-detail-card.sheet-row-group {
  background: color-mix(in srgb, var(--info-soft) 34%, white);
}

.sheet-card-heading {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 9px;
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--surface-border) 78%, white);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-raised) 76%, white), white),
    var(--surface-card);
}

.sheet-card-number {
  display: inline-grid;
  place-items: center;
  min-width: 34px;
  min-height: 24px;
  border: 1px solid color-mix(in srgb, var(--surface-border-strong) 64%, transparent);
  border-radius: var(--radius-sm);
  background: var(--surface-card);
  color: var(--text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  line-height: 1;
}

.sheet-card-name {
  min-width: 0;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 900;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.sheet-card-sections {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: color-mix(in srgb, var(--surface-border) 72%, white);
}

.sheet-card-section {
  display: grid;
  align-content: start;
  min-width: 0;
  background: var(--surface-card);
}

.sheet-card-section-inputs {
  background: color-mix(in srgb, #f8fafc 78%, white);
}

.sheet-card-section-unit {
  background: color-mix(in srgb, var(--accent-surface) 24%, white);
}

.sheet-card-section-total {
  background: color-mix(in srgb, #fff7ed 42%, white);
}

.sheet-card-section-title {
  margin: 0;
  padding: 8px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--surface-border) 74%, white);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.2;
  text-transform: uppercase;
}

.sheet-card-fields {
  display: grid;
  margin: 0;
}

.sheet-card-field {
  display: grid;
  grid-template-columns: minmax(92px, 0.9fr) minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
  padding: 7px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--surface-border) 58%, white);
}

.sheet-card-field:last-child {
  border-bottom: 0;
}

.sheet-card-label,
.sheet-card-value {
  min-width: 0;
  margin: 0;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.sheet-card-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.sheet-card-value {
  color: var(--text-strong);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  text-align: right;
}

.sheet-card-field-tax .sheet-card-value {
  color: #9a4f00;
}

.sheet-card-field-total .sheet-card-value {
  color: #047857;
  font-weight: 900;
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
  background: #102033;
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
  background: #f7fafc;
  color: #475569;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.15;
  text-transform: uppercase;
}

.sheet-group-inputs {
  background: color-mix(in srgb, #102033 88%, #0ea5e9) !important;
}

.sheet-group-unit {
  background: color-mix(in srgb, #102033 88%, var(--accent)) !important;
}

.sheet-group-total {
  background: color-mix(in srgb, #102033 84%, #b45309) !important;
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

@container calculation-sheet (max-width: 760px) {
  .sheet-context-bar {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .sheet-context-note {
    flex-basis: 100%;
    white-space: normal;
  }

  .sheet-summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sheet-summary-card {
    padding: 9px 10px;
  }

  .sheet-card-list {
    padding: 8px;
  }

  .sheet-card-sections {
    grid-template-columns: minmax(0, 1fr);
  }

  .sheet-card-field {
    grid-template-columns: minmax(0, 1fr);
    gap: 3px;
  }

  .sheet-card-value {
    text-align: left;
  }
}

@container calculation-sheet (max-width: 520px) {
  .sheet-summary-strip {
    grid-template-columns: minmax(0, 1fr);
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
