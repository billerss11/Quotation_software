<script setup lang="ts">
import {
  useVirtualizer,
  type Rect,
  type VirtualItem,
  type Virtualizer,
} from '@tanstack/vue-virtual'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import {
  computed,
  onUnmounted,
  shallowRef,
  useTemplateRef,
  watch,
  type ComponentPublicInstance,
} from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { getQuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { formatCurrency } from '@/shared/utils/formatters'

import type { CurrencyCode, ExchangeRateTable, QuotationItem, TotalsConfig } from '../types'
import { roundMoney } from '../utils/moneyMath'
import { createCalculationSheetCsvContent, type CalculationSheetCsvLabels } from '../utils/quotationCalculationSheetCsv'
import { calculateCostSalesPercentage, calculateExtraChargesTotal } from '../utils/quotationCalculations'
import {
  createCalculationSheetRows,
  type CalculationSheetRow,
} from '../utils/quotationCalculationSheetRows'

type CalculationSheetAmountMode = 'totals' | 'unit'

type CalculationSheetDisplayRow = CalculationSheetRow & {
  display: {
    quantity: string
    costCurrency: string
    markupRateLines: string[]
    costSalesPercent: string
    taxClass: string
    taxRate: string
    unitCost: string
    unitMarkupAmount: string
    unitPrice: string
    unitTaxAmount: string
    unitTotalWithTax: string
    totalCost: string
    totalMarkupAmount: string
    subtotal: string
    totalTaxAmount: string
    totalWithTax: string
  }
  rowClass: ReturnType<typeof getRowClass>
  namePaddingLeft: string
}

type RenderedCalculationSheetRow = CalculationSheetDisplayRow & {
  rowIndex: number
  virtualRow: VirtualItem | null
}

const VIRTUAL_ROW_THRESHOLD = 200
const VIRTUAL_ROW_ESTIMATE_PX = 40
const VIRTUAL_ROW_OVERSCAN = 8
const VIRTUAL_TABLE_HEIGHT_PX = 640

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
const wholeQuantityFormatter = computed(() => new Intl.NumberFormat(currentLocale.value, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}))
const fractionalQuantityFormatter = computed(() => new Intl.NumberFormat(currentLocale.value, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}))
const standardRateFormatter = computed(() => new Intl.NumberFormat(currentLocale.value, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
}))
const shortRateFormatter = computed(() => new Intl.NumberFormat(currentLocale.value, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
}))
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
const amountMode = shallowRef<CalculationSheetAmountMode>('totals')
const activeAmountCellClass = computed(() =>
  amountMode.value === 'unit' ? 'sheet-cell-unit' : 'sheet-cell-total',
)
const amountModeOptions = computed(() => [
  {
    label: t('quotations.lineItems.calculationSheet.amountModes.totals'),
    value: 'totals' as const,
  },
  {
    label: t('quotations.lineItems.calculationSheet.amountModes.unit'),
    value: 'unit' as const,
  },
])
const activeAmountGroupLabel = computed(() =>
  amountMode.value === 'unit'
    ? t('quotations.lineItems.calculationSheet.groups.unit')
    : t('quotations.lineItems.calculationSheet.groups.total'),
)
const inputColumnCount = computed(() => (isMixedTaxMode.value ? 7 : 6))
const tableColumnCount = computed(() => inputColumnCount.value + 7)
const sheetColumnIndexes = computed(() => {
  const taxRate = isMixedTaxMode.value ? 8 : 7
  const amountCost = taxRate + 1

  return {
    number: 0,
    name: 1,
    quantity: 2,
    unit: 3,
    fx: 4,
    markupRate: 5,
    costSalesPercent: 6,
    taxClass: 7,
    taxRate,
    amountCost,
    amountMarkup: amountCost + 1,
    amountPrice: amountCost + 2,
    amountTax: amountCost + 3,
    amountTotal: amountCost + 4,
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
    costSalesPercent: t('quotations.lineItems.calculationSheet.columns.costSalesPercent'),
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
const displayRows = computed<CalculationSheetDisplayRow[]>(() =>
  sheetRows.value.map((row) => ({
    ...row,
    display: {
      quantity: formatQuantity(row.quantity),
      costCurrency: formatFx(row),
      markupRateLines: formatMarkupRateLines(row),
      costSalesPercent: formatCostSalesPercent(row),
      taxClass: formatTaxClass(row),
      taxRate: formatTaxRate(row),
      unitCost: formatMoney(row.unitCost),
      unitMarkupAmount: formatMoney(row.unitMarkupAmount),
      unitPrice: formatMoney(row.unitPrice),
      unitTaxAmount: formatMoney(row.unitTaxAmount),
      unitTotalWithTax: formatMoney(row.unitTotalWithTax),
      totalCost: formatMoney(row.totalCost),
      totalMarkupAmount: formatMoney(row.totalMarkupAmount),
      subtotal: formatMoney(row.subtotal),
      totalTaxAmount: formatMoney(row.totalTaxAmount),
      totalWithTax: formatMoney(row.totalWithTax),
    },
    rowClass: getRowClass(row),
    namePaddingLeft: `${Math.max(row.depth - 1, 0) * 18}px`,
  })),
)
const shouldVirtualizeRows = computed(() => displayRows.value.length > VIRTUAL_ROW_THRESHOLD)
const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>(
  computed(() => ({
    count: shouldVirtualizeRows.value ? displayRows.value.length : 0,
    getScrollElement: () => tableWrapRef.value,
    estimateSize: () => VIRTUAL_ROW_ESTIMATE_PX,
    getItemKey: (index) => displayRows.value[index]?.itemId ?? index,
    initialRect: { width: 0, height: VIRTUAL_TABLE_HEIGHT_PX },
    measureElement: (element) => {
      const height = element.getBoundingClientRect().height || element.offsetHeight
      return height > 0 ? height : VIRTUAL_ROW_ESTIMATE_PX
    },
    observeElementRect: observeVirtualScrollRect,
    observeElementOffset: observeVirtualScrollOffset,
    overscan: VIRTUAL_ROW_OVERSCAN,
  })),
)
const virtualRows = computed(() =>
  shouldVirtualizeRows.value ? rowVirtualizer.value.getVirtualItems() : [],
)
const renderedRows = computed<RenderedCalculationSheetRow[]>(() => {
  if (!shouldVirtualizeRows.value) {
    return displayRows.value.map((row, rowIndex) => ({
      ...row,
      rowIndex,
      virtualRow: null,
    }))
  }

  return virtualRows.value.flatMap((virtualRow) => {
    const row = displayRows.value[virtualRow.index]

    return row
      ? [{
          ...row,
          rowIndex: virtualRow.index,
          virtualRow,
        }]
      : []
  })
})
const virtualPaddingTop = computed(() =>
  shouldVirtualizeRows.value ? (virtualRows.value[0]?.start ?? 0) : 0,
)
const virtualPaddingBottom = computed(() => {
  if (!shouldVirtualizeRows.value) {
    return 0
  }

  const lastVirtualRow = virtualRows.value.at(-1)
  return lastVirtualRow
    ? Math.max(0, rowVirtualizer.value.getTotalSize() - lastVirtualRow.end)
    : 0
})

let activeColumnHoverKey = ''
let activeColumnIndex = ''
let columnHoverFrameId: number | null = null
const measuredVirtualRows = new WeakSet<HTMLTableRowElement>()
let pendingColumnHover: {
  columnIndex: string
  table: HTMLTableElement
  target: HTMLElement
} | null = null

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

  return (Number.isInteger(normalizedValue)
    ? wholeQuantityFormatter.value
    : fractionalQuantityFormatter.value
  ).format(normalizedValue)
}

function formatDecimal(value: number, maximumFractionDigits = 4) {
  return (maximumFractionDigits === 1
    ? shortRateFormatter.value
    : standardRateFormatter.value
  ).format(value)
}

function formatRate(value: number | null, maximumFractionDigits = 4) {
  if (value === null || !Number.isFinite(value)) {
    return '--'
  }

  return `${formatDecimal(value, maximumFractionDigits)}%`
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

function formatMarkupRateLines(row: CalculationSheetRow) {
  return splitRateText(formatMarkupRate(row))
}

function formatCostSalesPercent(row: CalculationSheetRow) {
  return formatRate(calculateCostSalesPercentage(row.totalCost, row.subtotal), 1)
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

function measureVirtualRow(ref: Element | ComponentPublicInstance | null) {
  if (ref instanceof HTMLTableRowElement && !measuredVirtualRows.has(ref)) {
    measuredVirtualRows.add(ref)
    rowVirtualizer.value.measureElement(ref)
  }
}

function observeVirtualScrollRect(
  instance: Virtualizer<HTMLDivElement, HTMLTableRowElement>,
  callback: (rect: Rect) => void,
) {
  const element = instance.scrollElement

  if (!element) {
    return
  }

  const updateRect = () => callback(getVirtualScrollRect(element))
  updateRect()

  const ResizeObserverCtor = element.ownerDocument.defaultView?.ResizeObserver
  if (!ResizeObserverCtor) {
    return
  }

  const observer = new ResizeObserverCtor(updateRect)
  observer.observe(element)

  return () => observer.disconnect()
}

function getVirtualScrollRect(element: HTMLElement): Rect {
  const rect = element.getBoundingClientRect()

  return {
    width: Math.round(element.clientWidth || rect.width || 1200),
    height: Math.round(element.clientHeight || rect.height || VIRTUAL_TABLE_HEIGHT_PX),
  }
}

function observeVirtualScrollOffset(
  instance: Virtualizer<HTMLDivElement, HTMLTableRowElement>,
  callback: (offset: number, isScrolling: boolean) => void,
) {
  const element = instance.scrollElement

  if (!element) {
    return
  }

  const updateOffset = () => callback(element.scrollTop, false)
  updateOffset()
  element.addEventListener('scroll', updateOffset, { passive: true })

  return () => element.removeEventListener('scroll', updateOffset)
}

function setAmountMode(mode: CalculationSheetAmountMode) {
  amountMode.value = mode
  hideColumnHover()
}

function splitRateText(value: string) {
  const match = value.match(/\d[\d.,]*%/)

  if (!match || match.index === undefined) {
    return [value]
  }

  const before = value.slice(0, match.index).trim()
  const rate = match[0]
  const after = value.slice(match.index + rate.length).trim()

  return [before, rate, after].filter(Boolean)
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

  if (columnIndex === activeColumnIndex && !highlight.hidden && columnHoverFrameId === null) {
    return
  }

  pendingColumnHover = { columnIndex, table, target }

  if (columnHoverFrameId !== null) {
    return
  }

  columnHoverFrameId = window.requestAnimationFrame(flushColumnHover)
}

function flushColumnHover() {
  columnHoverFrameId = null

  const tableWrap = tableWrapRef.value
  const highlight = columnHighlightRef.value
  const pendingHover = pendingColumnHover
  pendingColumnHover = null

  if (
    !tableWrap
    || !highlight
    || !pendingHover
    || !tableWrap.contains(pendingHover.target)
    || !pendingHover.table.contains(pendingHover.target)
  ) {
    hideColumnHover()
    return
  }

  const { columnIndex, table, target } = pendingHover
  const tableRect = table.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const left = Math.round(targetRect.left - tableRect.left)
  const width = Math.round(targetRect.width)
  const height = table.scrollHeight
  const nextHoverKey = `${columnIndex}:${left}:${width}:${height}`

  if (activeColumnHoverKey === nextHoverKey && !highlight.hidden) {
    return
  }

  activeColumnIndex = columnIndex
  activeColumnHoverKey = nextHoverKey
  highlight.style.height = `${height}px`
  highlight.style.transform = `translateX(${left}px)`
  highlight.style.width = `${width}px`
  highlight.hidden = false
}

function hideColumnHover() {
  activeColumnHoverKey = ''
  activeColumnIndex = ''
  pendingColumnHover = null

  if (columnHoverFrameId !== null) {
    window.cancelAnimationFrame(columnHoverFrameId)
    columnHoverFrameId = null
  }

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
    :style="{ width: 'min(96vw, 1400px)', height: 'min(92vh, 920px)', resize: 'both', overflow: 'hidden' }"
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
        <div
          class="sheet-amount-toggle"
          role="group"
          :aria-label="t('quotations.lineItems.calculationSheet.amountModeAria')"
        >
          <button
            v-for="option in amountModeOptions"
            :key="option.value"
            type="button"
            class="sheet-amount-toggle-button"
            :class="{ 'sheet-amount-toggle-button-active': amountMode === option.value }"
            :data-calculation-sheet-amount-mode="option.value"
            :aria-pressed="amountMode === option.value"
            @click="setAmountMode(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <span class="sheet-context-chip">{{ t('quotations.lineItems.calculationSheet.rootRollup') }}</span>
        <span class="sheet-context-chip">{{ props.currency }}</span>
      </div>

      <div
        v-if="sheetRows.length > 0"
        class="sheet-summary-strip"
        :class="{ 'sheet-summary-strip-quotation': isQuotationSheet }"
      >
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
          :aria-rowcount="displayRows.length + 2"
        >
          <colgroup>
            <col class="sheet-number-col">
            <col class="sheet-name-col">
            <col class="sheet-qty-col">
            <col class="sheet-unit-col">
            <col class="sheet-fx-col">
            <col class="sheet-rate-col">
            <col class="sheet-rate-col">
            <col v-if="isMixedTaxMode" class="sheet-tax-class-col">
            <col class="sheet-tax-rate-col">
            <col class="sheet-money-col">
            <col class="sheet-money-col">
            <col class="sheet-money-col">
            <col class="sheet-money-col">
            <col class="sheet-money-col">
          </colgroup>
          <thead>
            <tr class="sheet-group-row" aria-rowindex="1">
              <th class="sheet-sticky-start sheet-sticky-number" colspan="2" scope="colgroup">{{ t('quotations.lineItems.calculationSheet.groups.item') }}</th>
              <th class="sheet-group-inputs" :colspan="inputColumnCount" scope="colgroup">{{ t('quotations.lineItems.calculationSheet.groups.inputs') }}</th>
              <th
                :class="amountMode === 'unit' ? 'sheet-group-unit' : 'sheet-group-total'"
                colspan="5"
                scope="colgroup"
              >
                {{ activeAmountGroupLabel }}
              </th>
            </tr>
            <tr class="sheet-column-row" aria-rowindex="2">
              <th class="sheet-sticky-start sheet-sticky-number" scope="col" :data-sheet-column-index="sheetColumnIndexes.number">{{ t('quotations.lineItems.calculationSheet.columns.number') }}</th>
              <th class="sheet-sticky-start sheet-sticky-name" scope="col" :data-sheet-column-index="sheetColumnIndexes.name">{{ t('quotations.lineItems.calculationSheet.columns.name') }}</th>
              <th class="sheet-cell-input" scope="col" :data-sheet-column-index="sheetColumnIndexes.quantity">{{ t('quotations.lineItems.calculationSheet.columns.quantity') }}</th>
              <th class="sheet-cell-input" scope="col" :data-sheet-column-index="sheetColumnIndexes.unit">{{ t('quotations.lineItems.calculationSheet.columns.unit') }}</th>
              <th class="sheet-cell-input sheet-currency-cell" scope="col" :data-sheet-column-index="sheetColumnIndexes.fx">{{ t('quotations.lineItems.calculationSheet.columns.costCurrency') }}</th>
              <th class="sheet-cell-input" scope="col" :data-sheet-column-index="sheetColumnIndexes.markupRate">{{ t('quotations.lineItems.calculationSheet.columns.markupRate') }}</th>
              <th class="sheet-cell-input" scope="col" :data-sheet-column-index="sheetColumnIndexes.costSalesPercent">{{ t('quotations.lineItems.calculationSheet.columns.costSalesPercent') }}</th>
              <th v-if="isMixedTaxMode" class="sheet-cell-input" scope="col" :data-sheet-column-index="sheetColumnIndexes.taxClass">{{ t('quotations.lineItems.calculationSheet.columns.taxClass') }}</th>
              <th class="sheet-cell-input" scope="col" :data-sheet-column-index="sheetColumnIndexes.taxRate">{{ t('quotations.lineItems.calculationSheet.columns.taxRate') }}</th>
              <th :class="activeAmountCellClass" scope="col" :data-sheet-column-index="sheetColumnIndexes.amountCost">
                {{ amountMode === 'unit' ? t('quotations.lineItems.calculationSheet.columns.unitCost') : t('quotations.lineItems.calculationSheet.columns.totalCost') }}
              </th>
              <th :class="activeAmountCellClass" scope="col" :data-sheet-column-index="sheetColumnIndexes.amountMarkup">
                {{ amountMode === 'unit' ? t('quotations.lineItems.calculationSheet.columns.unitMarkup') : t('quotations.lineItems.calculationSheet.columns.totalMarkup') }}
              </th>
              <th :class="activeAmountCellClass" scope="col" :data-sheet-column-index="sheetColumnIndexes.amountPrice">
                {{ amountMode === 'unit' ? t('quotations.lineItems.calculationSheet.columns.unitPrice') : t('quotations.lineItems.summaryLabels.subtotalExcludingTax') }}
              </th>
              <th :class="activeAmountCellClass" scope="col" :data-sheet-column-index="sheetColumnIndexes.amountTax">
                {{ amountMode === 'unit' ? t('quotations.lineItems.calculationSheet.columns.unitTax') : t('quotations.lineItems.calculationSheet.columns.totalTax') }}
              </th>
              <th :class="activeAmountCellClass" scope="col" :data-sheet-column-index="sheetColumnIndexes.amountTotal">
                {{ amountMode === 'unit' ? t('quotations.lineItems.calculationSheet.columns.unitTotal') : t('quotations.lineItems.calculationSheet.columns.totalTotal') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="virtualPaddingTop > 0"
              class="sheet-virtual-spacer-row"
              aria-hidden="true"
            >
              <td :colspan="tableColumnCount" :style="{ height: `${virtualPaddingTop}px` }" />
            </tr>
            <tr
              v-for="row in renderedRows"
              :key="row.itemId"
              :ref="row.virtualRow ? measureVirtualRow : undefined"
              class="sheet-row"
              :class="[row.rowClass, { 'sheet-row-even': row.rowIndex % 2 === 1 }]"
              :data-index="row.virtualRow?.index"
              :aria-rowindex="row.rowIndex + 3"
            >
              <td class="sheet-number sheet-sticky-start sheet-sticky-number" :data-sheet-column-index="sheetColumnIndexes.number">{{ row.itemNumber }}</td>
              <td class="sheet-name-cell sheet-sticky-start sheet-sticky-name" :data-sheet-column-index="sheetColumnIndexes.name">
                <span class="sheet-name" :style="{ paddingLeft: row.namePaddingLeft }">
                  {{ row.name || t('quotations.lineItems.navigator.unnamed') }}
                </span>
              </td>
              <td class="sheet-number sheet-cell-input" :data-sheet-column-index="sheetColumnIndexes.quantity">{{ row.display.quantity }}</td>
              <td class="sheet-cell-input" :data-sheet-column-index="sheetColumnIndexes.unit">{{ row.quantityUnit || '-' }}</td>
              <td class="sheet-muted sheet-currency-cell sheet-cell-input" :data-sheet-column-index="sheetColumnIndexes.fx">{{ row.display.costCurrency }}</td>
              <td class="sheet-rate sheet-cell-input" :data-sheet-column-index="sheetColumnIndexes.markupRate">
                <span class="sheet-rate-lines">
                  <span
                    v-for="(line, index) in row.display.markupRateLines"
                    :key="`${index}-${line}`"
                  >
                    {{ line }}
                  </span>
                </span>
              </td>
              <td class="sheet-rate sheet-cell-input" :data-sheet-column-index="sheetColumnIndexes.costSalesPercent">{{ row.display.costSalesPercent }}</td>
              <td v-if="isMixedTaxMode" class="sheet-tax sheet-cell-input" :data-sheet-column-index="sheetColumnIndexes.taxClass">{{ row.display.taxClass }}</td>
              <td class="sheet-tax sheet-cell-input" :data-sheet-column-index="sheetColumnIndexes.taxRate">{{ row.display.taxRate }}</td>
              <td class="sheet-money" :class="activeAmountCellClass" :data-sheet-column-index="sheetColumnIndexes.amountCost">
                {{ amountMode === 'unit' ? row.display.unitCost : row.display.totalCost }}
              </td>
              <td class="sheet-money" :class="activeAmountCellClass" :data-sheet-column-index="sheetColumnIndexes.amountMarkup">
                {{ amountMode === 'unit' ? row.display.unitMarkupAmount : row.display.totalMarkupAmount }}
              </td>
              <td class="sheet-money" :class="activeAmountCellClass" :data-sheet-column-index="sheetColumnIndexes.amountPrice">
                {{ amountMode === 'unit' ? row.display.unitPrice : row.display.subtotal }}
              </td>
              <td class="sheet-money sheet-tax" :class="activeAmountCellClass" :data-sheet-column-index="sheetColumnIndexes.amountTax">
                {{ amountMode === 'unit' ? row.display.unitTaxAmount : row.display.totalTaxAmount }}
              </td>
              <td class="sheet-money sheet-total" :class="activeAmountCellClass" :data-sheet-column-index="sheetColumnIndexes.amountTotal">
                {{ amountMode === 'unit' ? row.display.unitTotalWithTax : row.display.totalWithTax }}
              </td>
            </tr>
            <tr
              v-if="virtualPaddingBottom > 0"
              class="sheet-virtual-spacer-row"
              aria-hidden="true"
            >
              <td :colspan="tableColumnCount" :style="{ height: `${virtualPaddingBottom}px` }" />
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
  box-shadow: var(--shadow-elevated);
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
    linear-gradient(180deg, var(--surface-raised), var(--surface-panel)),
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
  background: var(--surface-raised);
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

.sheet-amount-toggle {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--surface-border-strong);
  border-radius: var(--radius-sm);
  padding: 2px;
  background: var(--surface-card);
}

.sheet-amount-toggle-button {
  min-height: 24px;
  border: 0;
  border-radius: var(--radius-xs);
  padding: 0 9px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.sheet-amount-toggle-button:hover:not(.sheet-amount-toggle-button-active) {
  background: var(--surface-muted);
  color: var(--text-body);
}

.sheet-amount-toggle-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.sheet-amount-toggle-button-active {
  background: var(--accent);
  color: var(--text-on-accent);
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

.sheet-summary-strip-quotation {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.sheet-summary-card {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px 14px;
  background:
    linear-gradient(180deg, var(--surface-raised), var(--surface-card)),
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
    linear-gradient(180deg, var(--accent-surface), var(--surface-card)),
    var(--surface-card);
}

.sheet-summary-card-strong strong {
  color: var(--accent);
}

.sheet-table-wrap {
  --sheet-row-hover-wash: color-mix(in srgb, var(--accent) 9%, transparent);
  --sheet-column-hover-wash: color-mix(in srgb, var(--accent) 10%, transparent);
  position: relative;
  min-height: 0;
  overflow: auto;
  border-top: 1px solid var(--surface-border-strong);
  background:
    linear-gradient(90deg, var(--surface-hover), transparent 10px) 0 0 / 10px 100% no-repeat,
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
  --sheet-sticky-number-width: 48px;
  --sheet-sticky-name-left: var(--sheet-sticky-number-width);
  width: 100%;
  min-width: 1120px;
  border-collapse: separate;
  border-spacing: 0;
  color: var(--text-body);
  font-size: 11px;
  table-layout: fixed;
}

.sheet-table-mixed {
  min-width: 1200px;
}

.sheet-number-col {
  width: var(--sheet-sticky-number-width);
}

.sheet-name-col {
  width: 160px;
}

.sheet-qty-col,
.sheet-unit-col,
.sheet-tax-rate-col {
  width: 56px;
}

.sheet-fx-col {
  width: 76px;
}

.sheet-money-col {
  width: 96px;
}

.sheet-rate-col {
  width: 84px;
}

.sheet-tax-class-col {
  width: 92px;
}

.sheet-table th,
.sheet-table td {
  border-right: 1px solid var(--surface-border);
  border-bottom: 1px solid var(--surface-border);
  padding: 6px 7px;
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
  height: 30px;
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
  top: 30px;
  z-index: 5;
  height: 40px;
  background: var(--surface-raised);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.15;
  overflow-wrap: anywhere;
  text-transform: uppercase;
  white-space: normal;
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
  background-color: var(--surface-raised);
}

.sheet-cell-unit {
  background-color: color-mix(in srgb, var(--accent-surface) 28%, var(--surface-card));
}

.sheet-cell-total {
  background-color: color-mix(in srgb, var(--warning-soft) 50%, var(--surface-card));
}

.sheet-row-even {
  background: var(--surface-raised);
}

.sheet-virtual-spacer-row > td {
  border: 0;
  padding: 0;
}

.sheet-row:hover > td {
  box-shadow: inset 0 0 0 9999px var(--sheet-row-hover-wash);
}

.sheet-row-root {
  background: color-mix(in srgb, var(--accent-surface) 74%, var(--surface-card)) !important;
  font-weight: 800;
}

.sheet-row-group {
  background: color-mix(in srgb, var(--info-soft) 46%, var(--surface-card));
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

.sheet-number,
.sheet-money,
.sheet-rate,
.sheet-tax {
  text-align: center !important;
}

.sheet-muted {
  color: var(--text-subtle);
}

.sheet-rate {
  color: var(--info);
  font-weight: 800;
  line-height: 1.15;
  overflow-wrap: anywhere;
  white-space: normal !important;
}

.sheet-rate-lines {
  display: grid;
  gap: 1px;
}

.sheet-tax {
  color: var(--warning);
  font-weight: 800;
}

.sheet-total {
  color: var(--accent-emphasis);
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

tbody .sheet-row-even .sheet-sticky-start {
  background: var(--surface-raised);
}

tbody .sheet-row:hover .sheet-sticky-start {
  box-shadow:
    inset 0 0 0 9999px var(--sheet-row-hover-wash),
    1px 0 0 color-mix(in srgb, var(--surface-border-strong) 72%, transparent);
}

@container calculation-sheet (max-width: 1200px) {
  .sheet-table {
    --sheet-sticky-number-width: 44px;
    min-width: 920px;
    font-size: 10.5px;
  }

  .sheet-table-mixed {
    min-width: 970px;
  }

  .sheet-table th,
  .sheet-table td {
    padding: 7px 6px;
  }

  .sheet-name-col {
    width: 130px;
  }

  .sheet-qty-col,
  .sheet-unit-col,
  .sheet-tax-rate-col {
    width: 50px;
  }

  .sheet-fx-col {
    width: 64px;
  }

  .sheet-money-col {
    width: 78px;
  }

  .sheet-rate-col {
    width: 68px;
  }

  .sheet-tax-class-col {
    width: 64px;
  }
}

@container calculation-sheet (max-width: 700px) {
  .sheet-context-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .sheet-amount-toggle {
    order: 2;
  }

  .sheet-summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .sheet-dialog-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .sheet-dialog-title {
    white-space: normal;
  }
}
</style>
