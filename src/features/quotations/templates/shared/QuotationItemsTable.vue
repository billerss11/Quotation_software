<script setup lang="ts">
import { useVirtualizer, type Rect, type Virtualizer } from '@tanstack/vue-virtual'
import {
  computed,
  inject,
  nextTick,
  shallowRef,
  useTemplateRef,
  watch,
  type ComponentPublicInstance,
} from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { DEFAULT_LOCALE } from '@/shared/i18n/locale'
import { messages } from '@/shared/i18n/messages'
import { formatCurrency } from '@/shared/utils/formatters'

import type {
  ExchangeRateTable,
  MajorItemSummary,
  QuotationDraft,
  QuotationTotals,
} from '../../types'
import {
  getMixedTaxDocumentColumnDefinitions,
  type MixedTaxDocumentColumnDefinition,
} from '../../utils/quotationDocumentColumns'
import {
  EMPTY_QUOTATION_PREVIEW_ROW_PRICING,
  getMixedTaxDocumentColumnValue,
  getQuotationPreviewRowAmount,
  getQuotationPreviewRowUnitPrice,
} from '../../utils/quotationDocumentColumnValues'
import {
  getQuotationDocumentTableLayout,
  getSingleTaxMoneyColumnWidth,
} from '../../utils/quotationDocumentTableLayout'
import { createQuotationPreviewRowPricingMap } from '../../utils/quotationPreviewPricing'
import { createQuotationPreviewRows, type QuotationPreviewRow } from '../../utils/quotationPreviewRows'
import { quotationContinuousPreviewKey } from '../../utils/quotationPreviewContext'
import { normalizeQuotationOutputSettings } from '../../utils/quotationOutputSettings'
import { createCalculationTotalsConfig } from '../../utils/quotationTaxes'

type QuotationItemsTableVariant =
  | 'classic'
  | 'technical-bid'
  | 'executive-summary'
  | 'luminous'
  | 'signal'
  | 'atelier'
  | 'spreadsheet'

interface FixedColumnDefinition {
  id: string
  className: string
  labelKey: string
  mixedLabelKey?: string
}

interface SingleTaxColumnDefinition {
  id: string
  className: string
  labelKey: string
}

interface DisplayRow {
  rowIndex: number
  row: QuotationPreviewRow
  classes: Array<string | Record<string, boolean>>
  showDetail: boolean
  ancestorBreadcrumb: string
  parentItemNumber: string
  parentDescription: string
  unitPriceDisplay: string
  amountDisplay: string
  mixedTaxCells: Array<{
    column: MixedTaxDocumentColumnDefinition
    value: string
  }>
}

const VIRTUAL_ROW_THRESHOLD = 100
const VIRTUAL_ROW_ESTIMATE_PX = 48
const VIRTUAL_SECTION_ROW_ESTIMATE_PX = 34
const VIRTUAL_ROW_OVERSCAN = 10
const VIRTUAL_VIEWPORT_HEIGHT_FALLBACK_PX = 720

const props = withDefaults(defineProps<{
  quotation: QuotationDraft
  summaries: MajorItemSummary[]
  totals: QuotationTotals
  globalMarkupRate: number
  exchangeRates: ExchangeRateTable
  variant?: QuotationItemsTableVariant
  showColgroup?: boolean
  hideTopLevelGroupDetail?: boolean
}>(), {
  variant: 'classic',
  showColgroup: false,
  hideTopLevelGroupDetail: false,
})
const continuousPreview = inject(quotationContinuousPreviewKey, null)
const tableBodyRef = useTemplateRef<HTMLTableSectionElement>('tableBody')
const virtualScrollMargin = shallowRef(0)

const fixedColumnDefinitions: FixedColumnDefinition[] = [
  {
    id: 'no',
    className: 'col-no',
    labelKey: 'quotations.document.table.no',
    mixedLabelKey: 'quotations.document.table.noShort',
  },
  {
    id: 'description',
    className: 'col-description',
    labelKey: 'quotations.document.table.description',
  },
  {
    id: 'quantity',
    className: 'col-qty',
    labelKey: 'quotations.document.table.qty',
  },
  {
    id: 'unit',
    className: 'col-unit',
    labelKey: 'quotations.document.table.unit',
  },
]

const singleTaxColumnDefinitions: SingleTaxColumnDefinition[] = [
  {
    id: 'unitPrice',
    className: 'col-money',
    labelKey: 'quotations.document.table.unitPrice',
  },
  {
    id: 'amount',
    className: 'col-money',
    labelKey: 'quotations.document.table.amount',
  },
]

const { t: documentT, locale: documentLocale } = useI18n({
  useScope: 'local',
  inheritLocale: false,
  locale: DEFAULT_LOCALE,
  messages,
})

watch(
  () => props.quotation.header.documentLocale,
  (nextLocale) => {
    documentLocale.value = nextLocale
  },
  { immediate: true },
)

const outputSettings = computed(() => normalizeQuotationOutputSettings(props.quotation.outputSettings))
const previewRows = computed(() =>
  createQuotationPreviewRows(props.quotation.majorItems, props.summaries, {
    itemDetailLevel: outputSettings.value.itemDetailLevel,
  }),
)
const currentDocumentLocale = computed(
  () => props.quotation.header.documentLocale as SupportedLocale,
)
const isMixedTaxMode = computed(() => props.quotation.totalsConfig.taxMode === 'mixed')
const showMixedTaxHeaderNotes = computed(() => currentDocumentLocale.value === 'en-US')
const visibleMixedTaxColumnDefinitions = computed(() =>
  isMixedTaxMode.value
    ? getMixedTaxDocumentColumnDefinitions(props.quotation.totalsConfig.mixedTaxColumns)
    : [],
)
const calculationTotalsConfig = computed(() =>
  createCalculationTotalsConfig(props.quotation.totalsConfig),
)
const mixedTaxValueLabels = computed(() => ({
  mixed: documentT('quotations.document.mixedTax'),
  mixedEffective: (rate: string) =>
    documentT('quotations.document.mixedTaxEffective', { rate }),
}))
const rowPricingByKey = computed(() => new Map(
  createQuotationPreviewRowPricingMap(
    props.quotation.majorItems,
    props.globalMarkupRate,
    props.exchangeRates,
    calculationTotalsConfig.value,
    { itemDetailLevel: outputSettings.value.itemDetailLevel },
  ),
))

const displayRows = computed<DisplayRow[]>(() =>
  previewRows.value.map((row, rowIndex) => {
    const pricing = getRowPricing(row)
    const parent = row.ancestors.at(-1)

    return {
      rowIndex,
      row,
      classes: [
        `row-${row.type}`,
        `row-level-${row.level}`,
        {
          'row-group': row.isGroup,
          'row-detail': row.level === 3,
          'row-included': row.level > 1,
          'row-hides-descendants': row.hasHiddenDescendants,
        },
      ],
      showDetail: Boolean(row.detail),
      ancestorBreadcrumb: row.ancestors
        .map((ancestor) => `${ancestor.itemNumber} ${ancestor.description}`)
        .join(' › '),
      parentItemNumber: parent?.itemNumber ?? '',
      parentDescription: parent?.description ?? '',
      unitPriceDisplay: getMoneyDisplayValue(getQuotationPreviewRowUnitPrice(row, pricing)),
      amountDisplay: getMoneyDisplayValue(getQuotationPreviewRowAmount(row, pricing)),
      mixedTaxCells: visibleMixedTaxColumnDefinitions.value.map((column) => ({
        column,
        value: getMixedTaxColumnDisplayValue(row, column),
      })),
    }
  }),
)

const mixedTaxLayout = computed(() => getQuotationDocumentTableLayout(
  visibleMixedTaxColumnDefinitions.value.map((column) => ({
    kind: column.valueKind,
    header: documentT(column.headerLabelKey),
    values: displayRows.value
      .filter((displayRow) => displayRow.row.type !== 'section')
      .map((displayRow) =>
        displayRow.mixedTaxCells.find((cell) => cell.column.id === column.id)?.value ?? '',
      ),
  })),
  displayRows.value.map((displayRow) =>
    displayRow.row.quantity === null ? '' : String(displayRow.row.quantity),
  ),
))
const usesCompactPriceBreakdown = computed(
  () => isMixedTaxMode.value && mixedTaxLayout.value.compactPriceBreakdown,
)
const isWideMixedTaxTable = computed(
  () => isMixedTaxMode.value && visibleMixedTaxColumnDefinitions.value.length >= 5,
)
const previewColumnCount = computed(() => {
  if (!isMixedTaxMode.value) return 6
  return usesCompactPriceBreakdown.value ? 5 : 4 + visibleMixedTaxColumnDefinitions.value.length
})
const hasOnlyTopLevelItemRows = computed(() => {
  const itemRows = previewRows.value.filter((row) => row.type !== 'section')
  return itemRows.length > 0 && itemRows.every((row) => row.level === 1)
})
const detailLevelNotice = computed(() => {
  if (outputSettings.value.itemDetailLevel === 1) {
    return documentT('quotations.document.table.detailLevel1Notice')
  }
  if (outputSettings.value.itemDetailLevel === 2) {
    return documentT('quotations.document.table.detailLevel2Notice')
  }
  return ''
})
const tableClasses = computed(() => [
  'quotation-table',
  `quotation-table-${props.variant}`,
  isMixedTaxMode.value
    ? `table-mixed-tax-columns-${visibleMixedTaxColumnDefinitions.value.length}`
    : 'table-single-tax',
  {
    'table-mixed-tax': isMixedTaxMode.value,
    'table-mixed-tax-wide': isWideMixedTaxTable.value,
    'table-price-breakdown': usesCompactPriceBreakdown.value,
    'table-price-breakdown-narrow': usesCompactPriceBreakdown.value && !isWideMixedTaxTable.value,
    'table-summary-only': hasOnlyTopLevelItemRows.value,
  },
])
const tableStyle = computed(() => {
  if (isMixedTaxMode.value) {
    return {
      '--mixed-qty-column-width': `${mixedTaxLayout.value.quantityColumnWidth}px`,
      '--mixed-unit-column-width': `${mixedTaxLayout.value.unitColumnWidth}px`,
      '--mixed-tax-column-width': `${mixedTaxLayout.value.taxColumnWidth}px`,
      '--mixed-money-column-width': `${mixedTaxLayout.value.moneyColumnWidth}px`,
    }
  }

  const moneyValues = displayRows.value.flatMap((row) => [row.unitPriceDisplay, row.amountDisplay])
  return {
    '--single-money-column-width': `${getSingleTaxMoneyColumnWidth(moneyValues)}px`,
  }
})

const shouldVirtualizeRows = computed(() =>
  continuousPreview !== null && displayRows.value.length > VIRTUAL_ROW_THRESHOLD,
)
const rowVirtualizer = useVirtualizer<HTMLElement, HTMLTableRowElement>(
  computed(() => ({
    count: shouldVirtualizeRows.value ? displayRows.value.length : 0,
    getScrollElement: () => continuousPreview?.scrollElement.value ?? null,
    estimateSize: (index: number) =>
      displayRows.value[index]?.row.type === 'section'
        ? VIRTUAL_SECTION_ROW_ESTIMATE_PX
        : VIRTUAL_ROW_ESTIMATE_PX,
    getItemKey: (index: number) => displayRows.value[index]?.row.key ?? index,
    initialRect: {
      width: 0,
      height: VIRTUAL_VIEWPORT_HEIGHT_FALLBACK_PX / getContinuousPreviewScale(),
    },
    initialOffset: () =>
      (continuousPreview?.scrollElement.value?.scrollTop ?? 0) / getContinuousPreviewScale(),
    measureElement: (element: HTMLTableRowElement) => {
      const rectHeight = element.getBoundingClientRect().height
      const height = rectHeight > 0
        ? rectHeight / getContinuousPreviewScale()
        : element.offsetHeight
      return height > 0 ? height : VIRTUAL_ROW_ESTIMATE_PX
    },
    observeElementRect: observeVirtualScrollRect,
    observeElementOffset: observeVirtualScrollOffset,
    scrollToFn: scrollVirtualPreviewTo,
    overscan: VIRTUAL_ROW_OVERSCAN,
    scrollMargin: virtualScrollMargin.value,
    useAnimationFrameWithResizeObserver: true,
  })),
)
const virtualRows = computed(() =>
  shouldVirtualizeRows.value ? rowVirtualizer.value.getVirtualItems() : [],
)
const renderedDisplayRows = computed(() => {
  if (!shouldVirtualizeRows.value) {
    return displayRows.value
  }

  return virtualRows.value.flatMap((virtualRow) => {
    const row = displayRows.value[virtualRow.index]
    return row ? [row] : []
  })
})
const virtualPaddingTop = computed(() =>
  shouldVirtualizeRows.value
    ? Math.max(0, (virtualRows.value[0]?.start ?? virtualScrollMargin.value) - virtualScrollMargin.value)
    : 0,
)
const virtualPaddingBottom = computed(() => {
  if (!shouldVirtualizeRows.value) return 0

  const lastVirtualRow = virtualRows.value.at(-1)
  return lastVirtualRow
    ? Math.max(
        0,
        rowVirtualizer.value.getTotalSize()
          - (lastVirtualRow.end - virtualScrollMargin.value),
      )
    : 0
})

watch(
  () => [
    props.quotation.totalsConfig.mixedTaxColumns,
    props.quotation.totalsConfig.taxMode,
    props.quotation.header.documentLocale,
    props.variant,
  ],
  () => {
    if (!shouldVirtualizeRows.value) return

    void nextTick(() => {
      updateVirtualScrollMargin()
      rowVirtualizer.value.measure()
    })
  },
  { flush: 'post' },
)

function getRowPricing(row: QuotationPreviewRow) {
  return rowPricingByKey.value.get(row.key) ?? EMPTY_QUOTATION_PREVIEW_ROW_PRICING
}

function getMixedTaxColumnDisplayValue(
  row: QuotationPreviewRow,
  column: MixedTaxDocumentColumnDefinition,
) {
  const value = getMixedTaxDocumentColumnValue(
    column.id,
    row,
    getRowPricing(row),
    mixedTaxValueLabels.value,
  )

  return value.kind === 'money' ? getMoneyDisplayValue(value.value) : value.value
}

function getMoneyDisplayValue(value: number | null) {
  return value === null
    ? ''
    : formatCurrency(value, props.quotation.header.currency, currentDocumentLocale.value)
}

function getMoneyValueClasses(value: string) {
  return [
    'money-value',
    {
      'money-value-long': value.length >= 14,
      'money-value-extra-long': value.length >= 18,
    },
  ]
}

function getMixedHeaderLabelKey(column: FixedColumnDefinition) {
  return column.mixedLabelKey ?? column.labelKey
}

function isLongUnit(value: string) {
  return value.length > 10
}

function getContinuousPreviewScale() {
  const scale = continuousPreview?.scale.value ?? 1
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

function measureVirtualRow(ref: Element | ComponentPublicInstance | null) {
  if (ref instanceof HTMLTableRowElement) {
    rowVirtualizer.value.measureElement(ref)
  }
}

function updateVirtualScrollMargin() {
  const body = continuousPreview?.scrollElement.value
  const tableBody = tableBodyRef.value

  if (!body || !tableBody) {
    virtualScrollMargin.value = 0
    return
  }

  const bodyRect = body.getBoundingClientRect()
  const tableBodyRect = tableBody.getBoundingClientRect()
  const nextMargin = Math.max(
    0,
    (tableBodyRect.top - bodyRect.top + body.scrollTop) / getContinuousPreviewScale(),
  )

  if (Math.abs(nextMargin - virtualScrollMargin.value) > 0.5) {
    virtualScrollMargin.value = nextMargin
  }
}

function observeVirtualScrollRect(
  instance: Virtualizer<HTMLElement, HTMLTableRowElement>,
  callback: (rect: Rect) => void,
) {
  const element = instance.scrollElement
  if (!element) return

  let frameId: number | null = null
  const flushRect = () => {
    frameId = null
    const rect = element.getBoundingClientRect()
    const scale = getContinuousPreviewScale()
    callback({
      width: (element.clientWidth || rect.width || 1024) / scale,
      height: (element.clientHeight || rect.height || VIRTUAL_VIEWPORT_HEIGHT_FALLBACK_PX) / scale,
    })
  }
  const updateRect = () => {
    if (frameId !== null) return
    frameId = element.ownerDocument.defaultView?.requestAnimationFrame(flushRect) ?? null
    if (frameId === null) flushRect()
  }
  flushRect()

  const ResizeObserverCtor = element.ownerDocument.defaultView?.ResizeObserver
  const observer = ResizeObserverCtor ? new ResizeObserverCtor(updateRect) : null
  observer?.observe(element)
  const stopScaleWatch = continuousPreview
    ? watch(continuousPreview.scale, updateRect, { flush: 'post' })
    : () => {}

  return () => {
    observer?.disconnect()
    stopScaleWatch()
    if (frameId !== null) {
      element.ownerDocument.defaultView?.cancelAnimationFrame(frameId)
    }
  }
}

function observeVirtualScrollOffset(
  instance: Virtualizer<HTMLElement, HTMLTableRowElement>,
  callback: (offset: number, isScrolling: boolean) => void,
) {
  const element = instance.scrollElement
  if (!element) return

  const updateOffset = () => {
    updateVirtualScrollMargin()
    callback(element.scrollTop / getContinuousPreviewScale(), false)
  }
  updateOffset()
  element.addEventListener('scroll', updateOffset, { passive: true })
  const stopScaleWatch = continuousPreview
    ? watch(continuousPreview.scale, updateOffset, { flush: 'post' })
    : () => {}

  return () => {
    element.removeEventListener('scroll', updateOffset)
    stopScaleWatch()
  }
}

function scrollVirtualPreviewTo(
  offset: number,
  { adjustments = 0, behavior }: { adjustments?: number; behavior?: ScrollBehavior },
  instance: Virtualizer<HTMLElement, HTMLTableRowElement>,
) {
  instance.scrollElement?.scrollTo({
    top: (offset + adjustments) * getContinuousPreviewScale(),
    behavior,
  })
}
</script>

<template>
  <table
    :class="tableClasses"
    :style="tableStyle"
    :data-detail-level="outputSettings.itemDetailLevel"
    :aria-rowcount="displayRows.length + 1"
  >
    <caption v-if="detailLevelNotice" class="detail-level-notice">
      {{ detailLevelNotice }}
    </caption>
    <colgroup>
      <col class="ledger-col-no" />
      <col class="ledger-col-description" />
      <col class="ledger-col-qty" />
      <col class="ledger-col-unit" />
      <col v-if="usesCompactPriceBreakdown" class="ledger-col-pricing" />
      <template v-else-if="isMixedTaxMode">
        <col
          v-for="column in visibleMixedTaxColumnDefinitions"
          :key="column.id"
          :class="column.colClass"
        />
      </template>
      <template v-else>
        <col class="ledger-col-money" />
        <col class="ledger-col-money" />
      </template>
    </colgroup>
    <thead>
      <tr>
        <th
          v-for="column in fixedColumnDefinitions"
          :key="column.id"
          :class="column.className"
          scope="col"
        >
          <span v-if="isMixedTaxMode" class="column-heading">
            <span class="column-heading-label">{{ documentT(getMixedHeaderLabelKey(column)) }}</span>
          </span>
          <span v-else>{{ documentT(column.labelKey) }}</span>
        </th>
        <th v-if="usesCompactPriceBreakdown" class="col-pricing" scope="col">
          <span class="column-heading">
            <span class="column-heading-label">{{ documentT('quotations.document.table.pricingDetails') }}</span>
            <span class="column-heading-note">{{ quotation.header.currency }}</span>
          </span>
        </th>
        <template v-else-if="isMixedTaxMode">
          <th
            v-for="column in visibleMixedTaxColumnDefinitions"
            :key="column.id"
            :class="column.cellClass"
            scope="col"
          >
            <span class="column-heading">
              <span class="column-heading-label">{{ documentT(column.headerLabelKey) }}</span>
              <span
                v-if="showMixedTaxHeaderNotes && column.headerNoteKey"
                class="column-heading-note"
              >{{ documentT(column.headerNoteKey) }}</span>
              <span
                v-else-if="showMixedTaxHeaderNotes"
                class="column-heading-note column-heading-note-spacer"
                aria-hidden="true"
              >&nbsp;</span>
            </span>
          </th>
        </template>
        <template v-else>
          <th
            v-for="column in singleTaxColumnDefinitions"
            :key="column.id"
            :class="column.className"
            scope="col"
          >
            {{ documentT(column.labelKey) }}
          </th>
        </template>
      </tr>
    </thead>
    <tbody ref="tableBody">
      <tr
        v-if="virtualPaddingTop > 0"
        class="quotation-virtual-spacer-row"
        aria-hidden="true"
      >
        <td :colspan="previewColumnCount" :style="{ height: `${virtualPaddingTop}px` }" />
      </tr>
      <tr
        v-for="displayRow in renderedDisplayRows"
        :key="displayRow.row.key"
        :ref="shouldVirtualizeRows ? measureVirtualRow : undefined"
        :class="displayRow.classes"
        :data-index="shouldVirtualizeRows ? displayRow.rowIndex : undefined"
        :aria-rowindex="displayRow.rowIndex + 2"
        :data-row-key="displayRow.row.key"
        :data-item-number="displayRow.row.itemNumber"
        :data-parent-number="displayRow.parentItemNumber || undefined"
        :data-parent-description="displayRow.parentDescription || undefined"
        :data-parent-path="displayRow.ancestorBreadcrumb || undefined"
        :data-row-level="displayRow.row.level"
        :data-is-group="displayRow.row.isGroup ? 'true' : 'false'"
      >
        <template v-if="displayRow.row.type === 'section'">
          <td class="section-cell" :colspan="previewColumnCount">
            <span class="section-band">{{ displayRow.row.description }}</span>
          </td>
        </template>
        <template v-else>
          <td :class="['col-no', `col-no-level-${displayRow.row.level}`]">
            {{ displayRow.row.itemNumber }}
          </td>
          <td class="col-description">
            <div :class="['item-description', `item-description-level-${displayRow.row.level}`]">
              <strong class="item-title">{{ displayRow.row.description }}</strong>
              <span v-if="displayRow.showDetail" class="item-detail">{{ displayRow.row.detail }}</span>
            </div>
          </td>
          <td class="col-qty">
            {{ displayRow.row.quantity === null ? '' : displayRow.row.quantity }}
          </td>
          <td
            :class="[
              'col-unit',
              { 'col-unit-long': isLongUnit(displayRow.row.quantityUnit) },
            ]"
          >{{ displayRow.row.quantityUnit }}</td>
          <td v-if="usesCompactPriceBreakdown" class="col-pricing">
            <div class="price-breakdown">
              <div
                v-for="cell in displayRow.mixedTaxCells"
                :key="cell.column.id"
                class="price-breakdown-entry"
                :data-column-id="cell.column.id"
              >
                <span class="price-breakdown-label">
                  {{ documentT(cell.column.headerLabelKey) }}
                  <small v-if="showMixedTaxHeaderNotes && cell.column.headerNoteKey">
                    {{ documentT(cell.column.headerNoteKey) }}
                  </small>
                </span>
                <span
                  v-if="cell.value"
                  :class="cell.column.valueKind === 'money' ? getMoneyValueClasses(cell.value) : 'tax-value'"
                >{{ cell.value }}</span>
                <span v-else class="empty-value" aria-hidden="true">—</span>
              </div>
            </div>
          </td>
          <template v-else-if="isMixedTaxMode">
            <td
              v-for="cell in displayRow.mixedTaxCells"
              :key="cell.column.id"
              :class="cell.column.cellClass"
              :data-column-id="cell.column.id"
            >
              <span
                v-if="cell.value"
                :class="cell.column.valueKind === 'money' ? getMoneyValueClasses(cell.value) : 'tax-value'"
              >{{ cell.value }}</span>
            </td>
          </template>
          <template v-else>
            <td class="col-money">
              <span
                v-if="displayRow.unitPriceDisplay"
                :class="getMoneyValueClasses(displayRow.unitPriceDisplay)"
              >{{ displayRow.unitPriceDisplay }}</span>
            </td>
            <td class="col-money">
              <span
                v-if="displayRow.amountDisplay"
                :class="getMoneyValueClasses(displayRow.amountDisplay)"
              >{{ displayRow.amountDisplay }}</span>
            </td>
          </template>
        </template>
      </tr>
      <tr
        v-if="virtualPaddingBottom > 0"
        class="quotation-virtual-spacer-row"
        aria-hidden="true"
      >
        <td :colspan="previewColumnCount" :style="{ height: `${virtualPaddingBottom}px` }" />
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.quotation-table {
  --table-accent: var(--preview-accent, #355a70);
  --table-border: var(--preview-line, #d8dee4);
  --table-border-strong: var(--preview-line-strong, #9aa9b4);
  --table-header-bg: var(--preview-surface, #f4f6f7);
  --table-header-color: var(--preview-ink, #17222a);
  --table-section-bg: var(--preview-accent-soft, #e8eef1);
  --table-section-color: var(--preview-ink, #17222a);
  --table-level-one-bg: var(--preview-surface-strong, #f2f5f6);
  width: 100%;
  max-width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  border-top: 1px solid var(--table-border-strong);
  color: var(--preview-ink, #17222a);
  font-size: 12px;
}

.quotation-table-technical-bid {
  table-layout: fixed;
}

.quotation-table-executive-summary {
  --table-accent: #a48652;
  --table-border: #c7cfd7;
  --table-border-strong: #17253b;
  --table-header-bg: #17253b;
  --table-header-color: #ffffff;
  --table-section-bg: #e9edf1;
  --table-section-color: #17253b;
  --table-level-one-bg: #f5f6f8;
}

.quotation-table-luminous {
  --table-accent: #147d92;
  --table-border: #bcd2d7;
  --table-border-strong: #147d92;
  --table-header-bg: #ffffff;
  --table-header-color: #0d3950;
  --table-section-bg: #eaf4f6;
  --table-section-color: #0d3950;
  --table-level-one-bg: #f4f8f9;
}

.quotation-table-signal {
  --table-accent: #6e2635;
  --table-border: #cbbfc2;
  --table-border-strong: #211d20;
  --table-header-bg: #6e2635;
  --table-header-color: #ffffff;
  --table-section-bg: #211d20;
  --table-section-color: #ffffff;
  --table-level-one-bg: #f3ecee;
}

.quotation-table-technical-bid {
  --table-accent: #b86432;
  --table-border: #b9cbd2;
  --table-border-strong: #75909b;
  --table-header-bg: #dfe9ed;
  --table-header-color: #132735;
  --table-section-bg: #294c61;
  --table-section-color: #ffffff;
  --table-level-one-bg: #edf3f5;
}

.quotation-table-atelier {
  --table-accent: #435548;
  --table-border: #c9cec9;
  --table-border-strong: #2c2925;
  --table-header-bg: #ffffff;
  --table-header-color: #565b57;
  --table-section-bg: #eef1ee;
  --table-section-color: #2c2925;
  --table-level-one-bg: #f6f7f5;
}

.quotation-table-classic {
  --table-accent: #2b3833;
  --table-border: #c5cac7;
  --table-border-strong: #2b3833;
  --table-header-bg: #ffffff;
  --table-header-color: #171c1a;
  --table-section-bg: #f4f5f3;
  --table-section-color: #171c1a;
  --table-level-one-bg: #f7f7f5;
}

.detail-level-notice {
  caption-side: top;
  padding: 7px 9px;
  border: 1px solid var(--table-border);
  border-bottom: 0;
  background: var(--table-section-bg);
  color: var(--table-section-color);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.35;
  text-align: left;
  overflow-wrap: anywhere;
}

.quotation-table thead {
  display: table-header-group;
}

.quotation-table th,
.quotation-table td {
  min-width: 0;
  border-bottom: 1px solid var(--table-border);
  vertical-align: top;
}

.quotation-table th {
  padding: 7px 5px;
  border-top: 1px solid var(--table-border-strong);
  border-bottom: 2px solid var(--table-border-strong);
  background: var(--table-header-bg);
  color: var(--table-header-color);
  font-size: 10.67px;
  font-weight: 750;
  line-height: 1.18;
  text-align: left;
  overflow-wrap: anywhere;
}

.quotation-table td {
  padding: 8px 6px;
  background: #ffffff;
  line-height: 1.3;
}

.ledger-col-no,
.col-no {
  width: 44px;
}

.ledger-col-description,
.col-description {
  width: auto;
}

.ledger-col-qty,
.col-qty {
  width: var(--mixed-qty-column-width, 58px);
}

.ledger-col-unit,
.col-unit {
  width: var(--mixed-unit-column-width, 74px);
}

.ledger-col-tax,
.col-tax {
  width: var(--mixed-tax-column-width, 72px);
}

.ledger-col-money,
.col-money {
  width: var(--mixed-money-column-width, var(--single-money-column-width, 128px));
}

.ledger-col-pricing,
.col-pricing {
  width: 54%;
}

.col-no {
  color: var(--preview-muted, #66717a);
  font-weight: 650;
  white-space: nowrap;
}

.col-description {
  min-width: 0;
  text-align: left;
  overflow-wrap: anywhere;
}

.quotation-table-technical-bid .col-description {
  min-width: 0;
  overflow-wrap: anywhere;
}

.col-qty,
.col-unit,
.col-tax {
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.col-qty {
  overflow-wrap: anywhere;
}

.col-unit {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: normal;
}

.quotation-table td.col-unit-long {
  font-size: 10.67px;
  line-height: 1.2;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: normal;
}

.col-money {
  text-align: right;
}

.column-heading {
  display: grid;
  min-width: 0;
  gap: 2px;
  align-content: end;
}

.col-qty .column-heading,
.col-unit .column-heading,
.col-tax .column-heading {
  text-align: center;
}

.col-money .column-heading,
.col-pricing .column-heading {
  text-align: right;
}

.column-heading-label,
.column-heading-note {
  min-width: 0;
  overflow-wrap: anywhere;
}

.column-heading-note {
  color: inherit;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.15;
  opacity: 0.78;
}

.column-heading-note-spacer {
  visibility: hidden;
}

.section-cell {
  padding: 7px 0;
  background: var(--table-section-bg);
}

.section-band {
  display: block;
  max-width: 100%;
  padding: 5px 10px;
  border-left: 4px solid var(--table-accent);
  background: var(--table-section-bg);
  color: var(--table-section-color);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.row-level-1 td {
  border-top: 1px solid var(--table-border-strong);
  background: var(--table-level-one-bg);
}

.item-description {
  position: relative;
  display: grid;
  min-width: 0;
  max-width: 100%;
  gap: 4px;
}

.item-description-level-1 {
  padding-left: 8px;
  border-left: 3px solid var(--table-accent);
}

.item-description-level-2 {
  padding-left: 22px;
}

.item-description-level-3 {
  padding-left: 36px;
}

.item-description-level-2::before,
.item-description-level-3::before {
  content: '';
  position: absolute;
  top: 3px;
  bottom: 3px;
  border-left: 1px solid var(--table-border-strong);
}

.item-description-level-2::before {
  left: 9px;
}

.item-description-level-3::before {
  left: 15px;
  border-left-style: double;
  border-left-width: 3px;
}

.item-title,
.item-detail {
  min-width: 0;
  max-width: 100%;
  white-space: pre-line;
  overflow-wrap: anywhere;
  word-break: normal;
}

.item-description-level-1 .item-title {
  font-size: 13px;
  font-weight: 800;
  line-height: 1.25;
}

.item-description-level-2 .item-title {
  font-size: 12px;
  font-weight: 700;
  line-height: 1.28;
}

.item-description-level-3 .item-title {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
}

.item-detail {
  color: var(--preview-muted, #66717a);
  font-size: 10.67px;
  line-height: 1.35;
}

.money-value,
.tax-value {
  display: inline-block;
  max-width: 100%;
  color: var(--preview-ink, #17222a);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
}

.money-value {
  white-space: nowrap;
}

.row-level-1 .money-value {
  font-weight: 750;
}

.row-level-2.row-group .money-value {
  font-weight: 650;
}

.row-level-2:not(.row-group) .money-value,
.row-level-3 .money-value {
  font-weight: 500;
}

.table-mixed-tax th,
.table-mixed-tax td {
  padding-right: 4px;
  padding-left: 4px;
}

.table-mixed-tax .col-money,
.table-mixed-tax .col-tax {
  text-align: right;
}

.table-mixed-tax .tax-value {
  white-space: normal;
  overflow-wrap: anywhere;
}

.price-breakdown {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px 14px;
}

.table-price-breakdown-narrow .price-breakdown {
  grid-template-columns: minmax(0, 1fr);
}

.price-breakdown-entry {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 0;
  gap: 8px;
  align-items: baseline;
  padding-bottom: 3px;
  border-bottom: 1px dotted var(--table-border);
}

.price-breakdown-label {
  min-width: 0;
  color: var(--preview-muted, #66717a);
  font-size: 10.67px;
  font-weight: 650;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.price-breakdown-label small {
  display: block;
  font-size: 10px;
  font-weight: 500;
}

.price-breakdown-entry .money-value,
.price-breakdown-entry .tax-value {
  justify-self: end;
  text-align: right;
}

.quotation-virtual-spacer-row > td {
  border: 0;
  padding: 0;
}

.empty-value {
  color: var(--preview-soft, #929aa0);
}

@media print {
  .quotation-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
</style>
