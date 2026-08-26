<script setup lang="ts">
import { computed, watch } from 'vue'
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
import { createQuotationPreviewRowPricingMap } from '../../utils/quotationPreviewPricing'
import type { QuotationPreviewRowPricing } from '../../utils/quotationPreviewPricing'
import { createQuotationPreviewRows, type QuotationPreviewRow } from '../../utils/quotationPreviewRows'
import { normalizeQuotationOutputSettings } from '../../utils/quotationOutputSettings'
import { createCalculationTotalsConfig } from '../../utils/quotationTaxes'

type QuotationItemsTableVariant = 'classic' | 'technical-bid' | 'executive-summary' | 'luminous' | 'signal' | 'atelier' | 'spreadsheet'

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
  row: QuotationPreviewRow
  classes: Array<string | Record<string, boolean>>
  showDetail: boolean
  unitPriceDisplay: string
  amountDisplay: string
  mixedTaxCells: Array<{
    column: MixedTaxDocumentColumnDefinition
    value: string
  }>
}

const props = withDefaults(defineProps<{
  quotation: QuotationDraft
  summaries: MajorItemSummary[]
  totals: QuotationTotals
  globalMarkupRate: number
  exchangeRates: ExchangeRateTable
  variant?: QuotationItemsTableVariant
  showColgroup?: boolean
  showLedgerRepeatRow?: boolean
  ledgerStamp?: string
  hideTopLevelGroupDetail?: boolean
}>(), {
  variant: 'classic',
  showColgroup: false,
  showLedgerRepeatRow: false,
  ledgerStamp: '',
  hideTopLevelGroupDetail: false,
})

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
const currentDocumentLocale = computed(() => props.quotation.header.documentLocale as SupportedLocale)
const isMixedTaxMode = computed(() => props.quotation.totalsConfig.taxMode === 'mixed')
const showMixedTaxHeaderNotes = computed(() => currentDocumentLocale.value === 'en-US')
const visibleMixedTaxColumnDefinitions = computed(() =>
  isMixedTaxMode.value
    ? getMixedTaxDocumentColumnDefinitions(props.quotation.totalsConfig.mixedTaxColumns)
    : [],
)
const isWideMixedTaxTable = computed(() => visibleMixedTaxColumnDefinitions.value.length >= 5)
const previewColumnCount = computed(() => (isMixedTaxMode.value ? 4 + visibleMixedTaxColumnDefinitions.value.length : 6))
const hasOnlyTopLevelItemRows = computed(() => {
  const itemRows = previewRows.value.filter((row) => row.type !== 'section')

  return itemRows.length > 0 && itemRows.every((row) => row.level === 1)
})
const calculationTotalsConfig = computed(() => createCalculationTotalsConfig(props.quotation.totalsConfig))
const rowPricingByKey = computed(() => new Map(
  createQuotationPreviewRowPricingMap(
    props.quotation.majorItems,
    props.globalMarkupRate,
    props.exchangeRates,
    calculationTotalsConfig.value,
    { itemDetailLevel: outputSettings.value.itemDetailLevel },
  ),
))
const tableClasses = computed(() => [
  'quotation-table',
  `quotation-table-${props.variant}`,
  isMixedTaxMode.value ? `table-mixed-tax-columns-${visibleMixedTaxColumnDefinitions.value.length}` : '',
  {
    'table-mixed-tax': isMixedTaxMode.value,
    'table-mixed-tax-wide': isWideMixedTaxTable.value,
    'table-summary-only': hasOnlyTopLevelItemRows.value,
  },
])
const tableStyle = computed(() => {
  if (!isMixedTaxMode.value) {
    return {}
  }

  const columnLayout = getMixedTaxColumnLayout(visibleMixedTaxColumnDefinitions.value.length)

  return {
    '--mixed-qty-column-width': `${columnLayout.qtyColumnWidth}px`,
    '--mixed-unit-column-width': `${columnLayout.unitColumnWidth}px`,
    '--mixed-tax-column-width': `${columnLayout.taxColumnWidth}px`,
    '--mixed-money-column-width': `${columnLayout.moneyColumnWidth}px`,
    '--mixed-meta-font-size': `${columnLayout.metaFontSize}px`,
    '--mixed-money-font-size': `${columnLayout.moneyFontSize}px`,
  }
})
const displayRows = computed<DisplayRow[]>(() =>
  previewRows.value.map((row) => {
    const pricing = getRowPricing(row)

    return {
      row,
      classes: [
        `row-${row.type}`,
        `row-level-${row.level}`,
        {
          'row-group': pricing.isGroup,
          'row-detail': row.level === 3,
        },
      ],
      showDetail: shouldShowDetail(row, pricing),
      unitPriceDisplay: getMoneyDisplayValue(getQuotationPreviewRowUnitPrice(row, pricing)),
      amountDisplay: getMoneyDisplayValue(getQuotationPreviewRowAmount(row, pricing)),
      mixedTaxCells: visibleMixedTaxColumnDefinitions.value.map((column) => ({
        column,
        value: getMixedTaxColumnDisplayValue(row, pricing, column),
      })),
    }
  }),
)

function getRowPricing(row: QuotationPreviewRow) {
  return rowPricingByKey.value.get(row.key) ?? EMPTY_QUOTATION_PREVIEW_ROW_PRICING
}

function shouldShowDetail(row: QuotationPreviewRow, pricing: QuotationPreviewRowPricing) {
  return Boolean(row.detail) && !(props.hideTopLevelGroupDetail && row.level === 1 && pricing.isGroup)
}

function getMixedHeaderLabelKey(column: FixedColumnDefinition) {
  return column.mixedLabelKey ?? column.labelKey
}

function getMixedTaxColumnDisplayValue(
  row: QuotationPreviewRow,
  pricing: QuotationPreviewRowPricing,
  column: MixedTaxDocumentColumnDefinition,
) {
  const value = getMixedTaxDocumentColumnValue(
    column.id,
    row,
    pricing,
    documentT('quotations.document.mixedTax'),
  )

  if (value.kind === 'money') {
    return getMoneyDisplayValue(value.value)
  }

  return value.value
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

function getMixedTaxColumnLayout(visibleColumnCount: number) {
  if (visibleColumnCount <= 2) {
    return {
      qtyColumnWidth: 52,
      unitColumnWidth: 54,
      taxColumnWidth: 58,
      moneyColumnWidth: 124,
      metaFontSize: 11.8,
      moneyFontSize: 12.2,
    }
  }

  if (visibleColumnCount <= 4) {
    return {
      qtyColumnWidth: 48,
      unitColumnWidth: 50,
      taxColumnWidth: 54,
      moneyColumnWidth: 108,
      metaFontSize: 11.2,
      moneyFontSize: 11.3,
    }
  }

  if (visibleColumnCount <= 6) {
    return {
      qtyColumnWidth: 44,
      unitColumnWidth: 46,
      taxColumnWidth: 50,
      moneyColumnWidth: 92,
      metaFontSize: 10.5,
      moneyFontSize: 10.6,
    }
  }

  return {
    qtyColumnWidth: 40,
    unitColumnWidth: 42,
    taxColumnWidth: 46,
    moneyColumnWidth: 80,
    metaFontSize: 10,
    moneyFontSize: 10,
  }
}
</script>

<template>
  <table :class="tableClasses" :style="tableStyle">
    <colgroup v-if="showColgroup">
      <col class="ledger-col-no" />
      <col class="ledger-col-description" />
      <col class="ledger-col-qty" />
      <col class="ledger-col-unit" />
      <col
        v-for="column in visibleMixedTaxColumnDefinitions"
        :key="column.id"
        :class="column.colClass"
      />
      <col v-if="!isMixedTaxMode" class="ledger-col-money" />
      <col v-if="!isMixedTaxMode" class="ledger-col-money" />
    </colgroup>
    <thead>
      <tr v-if="showLedgerRepeatRow" class="ledger-repeat-row">
        <td :colspan="previewColumnCount">
          <span>{{ documentT('quotations.document.scopeLedger') }}</span>
          <strong>{{ ledgerStamp }}</strong>
        </td>
      </tr>
      <tr>
        <th
          v-for="column in fixedColumnDefinitions"
          :key="column.id"
          :class="column.className"
        >
          <span v-if="isMixedTaxMode" class="column-heading">
            <span class="column-heading-label">{{ documentT(getMixedHeaderLabelKey(column)) }}</span>
            <span v-if="showMixedTaxHeaderNotes" class="column-heading-note column-heading-note-spacer" aria-hidden="true"></span>
          </span>
          <span v-else>{{ documentT(column.labelKey) }}</span>
        </th>
        <th
          v-for="column in visibleMixedTaxColumnDefinitions"
          :key="column.id"
          :class="column.cellClass"
        >
          <span class="column-heading">
            <span class="column-heading-label">{{ documentT(column.headerLabelKey) }}</span>
            <span v-if="showMixedTaxHeaderNotes && column.headerNoteKey" class="column-heading-note">{{ documentT(column.headerNoteKey) }}</span>
            <span v-else-if="showMixedTaxHeaderNotes" class="column-heading-note column-heading-note-spacer" aria-hidden="true"></span>
          </span>
        </th>
        <template v-if="!isMixedTaxMode">
          <th
            v-for="column in singleTaxColumnDefinitions"
            :key="column.id"
            :class="column.className"
          >
            {{ documentT(column.labelKey) }}
          </th>
        </template>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="displayRow in displayRows"
        :key="displayRow.row.key"
        :class="displayRow.classes"
      >
        <template v-if="displayRow.row.type === 'section'">
          <td class="section-cell" :colspan="previewColumnCount">
            <span class="section-band">{{ displayRow.row.description }}</span>
          </td>
        </template>
        <template v-else>
          <td :class="['col-no', `col-no-level-${displayRow.row.level}`]">{{ displayRow.row.itemNumber }}</td>
          <td class="col-description">
            <div :class="['item-description', `item-description-level-${displayRow.row.level}`]">
              <strong class="item-title">{{ displayRow.row.description }}</strong>
              <span v-if="displayRow.showDetail" class="item-detail">{{ displayRow.row.detail }}</span>
            </div>
          </td>
          <td class="col-qty">{{ displayRow.row.quantity === null ? '' : displayRow.row.quantity }}</td>
          <td
            :class="[
              'col-unit',
              { 'col-unit-long': displayRow.row.quantityUnit.length >= 9 },
            ]"
          >{{ displayRow.row.quantityUnit }}</td>
          <td
            v-for="cell in displayRow.mixedTaxCells"
            :key="cell.column.id"
            :class="cell.column.cellClass"
          >
            <span
              v-if="cell.value"
              :class="cell.column.valueKind === 'money' ? getMoneyValueClasses(cell.value) : undefined"
            >
              {{ cell.value }}
            </span>
          </td>
          <td v-if="!isMixedTaxMode" class="col-money">
            <span v-if="displayRow.unitPriceDisplay" :class="getMoneyValueClasses(displayRow.unitPriceDisplay)">
              {{ displayRow.unitPriceDisplay }}
            </span>
          </td>
          <td v-if="!isMixedTaxMode" class="col-money">
            <span v-if="displayRow.amountDisplay" :class="getMoneyValueClasses(displayRow.amountDisplay)">
              {{ displayRow.amountDisplay }}
            </span>
          </td>
        </template>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.quotation-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
  border-top: 1px solid var(--preview-line-strong);
}

.quotation-table thead {
  display: table-header-group;
}

.quotation-table th {
  padding: 8px 8px 7px;
  border-bottom: 1px solid var(--preview-line-strong);
  background: var(--preview-surface);
  color: var(--preview-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-align: left;
  text-transform: uppercase;
}

.quotation-table th.col-money,
.quotation-table td.col-money {
  padding-left: 10px;
}

.quotation-table td {
  padding: 8px 8px;
  border-bottom: 1px solid var(--preview-line);
  vertical-align: top;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.section-cell {
  padding: 10px 0 !important;
  border-left: none !important;
  background: transparent;
}

.section-band {
  display: block;
  padding: 6px 11px;
  border-left: 4px solid var(--preview-accent);
  background: var(--preview-accent-soft);
  color: var(--preview-ink);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.col-no {
  width: 74px;
  white-space: nowrap;
  color: var(--preview-muted);
  font-weight: 700;
  text-align: left;
}

.col-description {
  text-align: left;
}

.col-qty {
  width: 52px;
  text-align: center;
}

.col-unit {
  width: 72px;
  overflow-wrap: anywhere;
  text-align: center;
}

.col-tax {
  width: 44px;
  text-align: center;
}

.col-money {
  width: 128px;
  text-align: right;
  white-space: normal;
  overflow-wrap: anywhere;
}

.col-qty,
.col-tax,
.money-value {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}

.table-mixed-tax {
  table-layout: fixed;
  font-size: 10.3px;
}

.table-mixed-tax th {
  padding: 7px 3px;
  font-size: 8.8px;
  letter-spacing: 0.02em;
  vertical-align: bottom;
  white-space: nowrap;
}

.table-mixed-tax td {
  padding: 8px 3px;
}

.table-mixed-tax .col-no {
  width: 44px;
}

.table-mixed-tax .col-qty {
  width: var(--mixed-qty-column-width, 40px);
}

.table-mixed-tax .col-unit {
  width: var(--mixed-unit-column-width, 42px);
}

.table-mixed-tax .col-tax {
  width: var(--mixed-tax-column-width, 46px);
}

.table-mixed-tax .col-money {
  width: var(--mixed-money-column-width, 84px);
}

.table-mixed-tax td.col-qty,
.table-mixed-tax td.col-unit,
.table-mixed-tax td.col-tax {
  font-size: var(--mixed-meta-font-size, 10px);
  font-weight: 700;
  line-height: 1.16;
}

.table-mixed-tax .money-value {
  display: block;
  font-size: var(--mixed-money-font-size, 10.1px);
  line-height: 1.16;
  letter-spacing: 0;
}

.table-mixed-tax .column-heading {
  display: inline-grid;
  grid-template-rows: minmax(8.8px, auto) 8px;
  align-items: end;
  justify-items: center;
  width: 100%;
  min-height: 18px;
  gap: 1px;
  text-align: center;
  line-height: 1;
}

.table-mixed-tax .col-no .column-heading,
.table-mixed-tax .col-description .column-heading {
  justify-items: start;
  text-align: left;
}

.table-mixed-tax .col-money .column-heading {
  justify-items: end;
  text-align: right;
}

.table-mixed-tax .column-heading-label {
  text-align: inherit;
  line-height: 1;
}

.table-mixed-tax .column-heading-note {
  color: var(--preview-soft);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;
  min-height: 8px;
  text-align: inherit;
  text-transform: none;
}

.table-mixed-tax .column-heading-note-spacer {
  visibility: hidden;
}

.table-mixed-tax .item-description {
  gap: 2px;
}

.table-mixed-tax .item-detail {
  font-size: 10.5px;
  line-height: 1.32;
}

.table-mixed-tax .item-description-level-1 {
  padding-left: 14px;
}

.table-mixed-tax .item-description-level-2 {
  padding-left: 18px;
}

.table-mixed-tax .item-description-level-2::before {
  left: 7px;
}

.table-mixed-tax .item-description-level-3 {
  padding-left: 24px;
}

.table-mixed-tax .item-description-level-3::before {
  left: 12px;
}

.quotation-table-classic.table-mixed-tax {
  font-size: 9px;
}

.quotation-table-classic.table-mixed-tax th {
  padding: 6px 3px;
  font-size: 7.8px;
  letter-spacing: 0;
}

.quotation-table-classic.table-mixed-tax td {
  padding: 7px 3px;
}

.quotation-table-classic.table-mixed-tax .col-no {
  width: 34px;
}

.quotation-table-classic.table-mixed-tax .col-qty {
  width: var(--mixed-qty-column-width, 40px);
}

.quotation-table-classic.table-mixed-tax .col-unit {
  width: var(--mixed-unit-column-width, 42px);
}

.quotation-table-classic.table-mixed-tax .col-tax {
  width: var(--mixed-tax-column-width, 46px);
}

.quotation-table-classic.table-mixed-tax .col-money {
  width: var(--mixed-money-column-width, 84px);
}

.quotation-table-classic.table-mixed-tax .column-heading {
  grid-template-rows: minmax(7.8px, auto) 7.4px;
  min-height: 16.2px;
}

.quotation-table-classic.table-mixed-tax .column-heading-note {
  min-height: 7.4px;
  font-size: 7px;
}

.quotation-table-classic.table-mixed-tax .money-value {
  display: block;
  font-size: var(--mixed-money-font-size, 10.1px);
  line-height: 1.16;
}

.quotation-table-classic.table-mixed-tax .item-detail {
  font-size: 8.8px;
  line-height: 1.18;
}

.quotation-table-classic.table-mixed-tax .item-description-level-2 {
  padding-left: 12px;
}

.quotation-table-classic.table-mixed-tax .item-description-level-3 {
  padding-left: 24px;
}

.quotation-table-legacy.table-mixed-tax .item-description-level-3 {
  padding-left: 20px;
}

.item-description {
  display: grid;
  gap: 3px;
}

.item-title {
  white-space: pre-line;
}

.item-detail {
  color: var(--preview-muted);
  font-size: 11px;
  line-height: 1.34;
  white-space: pre-line;
}

.row-level-1 {
  background: var(--preview-surface-strong);
}

.row-section td {
  border-top: 1px solid var(--preview-line-strong);
  border-bottom: none;
}

.row-level-1 td {
  border-top: 1px solid var(--preview-line-strong);
  border-bottom-color: #d8e0ea;
}

.row-level-1 .col-no {
  color: var(--preview-accent);
  font-weight: 800;
}

.item-description-level-1 {
  position: relative;
  gap: 4px;
  padding: 2px 0 2px 16px;
}

.item-description-level-1::before {
  content: '';
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 0;
  width: 3px;
  background: var(--preview-accent);
}

.item-description-level-1 .item-title {
  color: var(--preview-ink);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.01em;
}

.row-level-2 td,
.row-level-3 td {
  background: #ffffff;
}

.row-level-2 .col-no {
  color: var(--preview-muted);
}

.item-description-level-2 {
  position: relative;
  gap: 4px;
  padding: 1px 0 1px 20px;
}

.item-description-level-2::before {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 7px;
  width: 1px;
  background: var(--preview-line-strong);
  opacity: 0.75;
}

.item-description-level-2 .item-title {
  color: var(--preview-ink);
  font-size: 13px;
  font-weight: 700;
}

.row-level-3 .col-no {
  color: var(--preview-soft);
}

.item-description-level-3 {
  position: relative;
  gap: 3px;
  padding: 1px 0 1px 28px;
}

.item-description-level-3::before {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 13px;
  border-left: 1px solid var(--preview-line-strong);
}

.item-description-level-3 .item-title {
  color: var(--preview-ink);
  font-size: 12px;
  font-weight: 600;
}

.money-value {
  color: var(--preview-ink);
  display: block;
  font-size: 13px;
  line-height: 1.18;
  font-variant-numeric: tabular-nums;
}

.row-group .money-value,
.row-level-1 .money-value {
  font-weight: 800;
}

.quotation-table-executive-summary {
  table-layout: auto;
  overflow: hidden;
  border: 1px solid var(--exec-line, var(--preview-line));
  border-top: 0;
  border-radius: 8px;
  background: #ffffff;
  font-size: 11.4px;
}

.quotation-table-executive-summary th {
  padding: 8px 7px;
  border-bottom: 2px solid var(--exec-accent-line, var(--preview-accent));
  background: #ffffff;
  color: var(--exec-muted, var(--preview-muted));
  font-size: 9.4px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.quotation-table-executive-summary td {
  padding: 8px 7px;
  border-bottom: 1px solid var(--exec-line, var(--preview-line));
}

.quotation-table-executive-summary th.col-money,
.quotation-table-executive-summary td.col-money {
  padding-left: 8px;
}

.quotation-table-executive-summary .ledger-col-no,
.quotation-table-executive-summary .col-no {
  width: 54px;
}

.quotation-table-executive-summary .ledger-col-description,
.quotation-table-executive-summary .col-description {
  width: auto;
}

.quotation-table-executive-summary .ledger-col-qty,
.quotation-table-executive-summary .col-qty {
  width: 46px;
}

.quotation-table-executive-summary .ledger-col-unit,
.quotation-table-executive-summary .col-unit {
  width: 54px;
}

.quotation-table-executive-summary .ledger-col-tax,
.quotation-table-executive-summary .col-tax {
  width: 44px;
}

.quotation-table-executive-summary .ledger-col-money,
.quotation-table-executive-summary .col-money {
  width: 122px;
}

.quotation-table-executive-summary .section-cell {
  padding: 0 !important;
  border-bottom: 1px solid var(--exec-line, var(--preview-line)) !important;
}

.quotation-table-executive-summary .section-band {
  padding: 7px 10px;
  border-left: 5px solid var(--preview-accent);
  background: var(--exec-accent-soft, var(--preview-accent-soft));
  color: var(--exec-ink, var(--preview-ink));
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0;
}

.quotation-table-executive-summary .row-level-1 td {
  border-top: 0;
  background: var(--exec-surface-strong, var(--preview-surface-strong));
}

.quotation-table-executive-summary .row-level-1 .col-no {
  color: var(--preview-accent);
  font-weight: 850;
}

.quotation-table-executive-summary .item-description-level-1 {
  padding-left: 13px;
}

.quotation-table-executive-summary .item-description-level-1::before {
  top: 4px;
  bottom: 4px;
  width: 2px;
}

.quotation-table-executive-summary .item-description-level-1 .item-title {
  font-size: 13px;
  font-weight: 850;
  line-height: 1.16;
}

.quotation-table-executive-summary .item-description-level-2 {
  padding-left: 17px;
}

.quotation-table-executive-summary .item-description-level-2::before {
  left: 6px;
  background: var(--exec-line-strong, var(--preview-line-strong));
}

.quotation-table-executive-summary .item-description-level-2 .item-title {
  font-size: 12.5px;
  font-weight: 750;
}

.quotation-table-executive-summary .item-description-level-3 {
  padding-left: 23px;
}

.quotation-table-executive-summary .item-description-level-3::before {
  left: 11px;
}

.quotation-table-executive-summary .item-detail {
  color: var(--exec-muted, var(--preview-muted));
  font-size: 10.7px;
}

.quotation-table-executive-summary .money-value {
  color: var(--exec-ink, var(--preview-ink));
}

.quotation-table-executive-summary.table-mixed-tax {
  table-layout: fixed;
  font-size: 9px;
}

.quotation-table-executive-summary.table-mixed-tax th {
  padding: 6px 3px;
  font-size: 7.8px;
  letter-spacing: 0;
  vertical-align: bottom;
  white-space: nowrap;
}

.quotation-table-executive-summary.table-mixed-tax td {
  padding: 7px 3px;
}

.quotation-table-executive-summary.table-mixed-tax .col-no,
.quotation-table-executive-summary.table-mixed-tax .ledger-col-no {
  width: 34px;
}

.quotation-table-executive-summary.table-mixed-tax .col-qty,
.quotation-table-executive-summary.table-mixed-tax .ledger-col-qty {
  width: var(--mixed-qty-column-width, 40px);
}

.quotation-table-executive-summary.table-mixed-tax .col-unit,
.quotation-table-executive-summary.table-mixed-tax .ledger-col-unit {
  width: var(--mixed-unit-column-width, 42px);
}

.quotation-table-executive-summary.table-mixed-tax .col-tax,
.quotation-table-executive-summary.table-mixed-tax .ledger-col-tax {
  width: var(--mixed-tax-column-width, 46px);
}

.quotation-table-executive-summary.table-mixed-tax .col-money,
.quotation-table-executive-summary.table-mixed-tax .ledger-col-money {
  width: var(--mixed-money-column-width, 84px);
}

.quotation-table-executive-summary.table-mixed-tax .column-heading {
  grid-template-rows: minmax(7.8px, auto) 7.4px;
  justify-items: end;
  min-height: 16.2px;
  text-align: right;
}

.quotation-table-executive-summary.table-mixed-tax .col-no .column-heading,
.quotation-table-executive-summary.table-mixed-tax .col-description .column-heading {
  justify-items: start;
  text-align: left;
}

.quotation-table-executive-summary.table-mixed-tax .col-qty .column-heading,
.quotation-table-executive-summary.table-mixed-tax .col-unit .column-heading,
.quotation-table-executive-summary.table-mixed-tax .col-tax .column-heading {
  justify-items: center;
  text-align: center;
}

.quotation-table-executive-summary.table-mixed-tax .column-heading-note {
  min-height: 7.4px;
  color: var(--exec-soft, var(--preview-soft));
  font-size: 7px;
  font-weight: 700;
}

.quotation-table-executive-summary.table-mixed-tax .money-value {
  display: block;
  font-size: var(--mixed-money-font-size, 10.1px);
  line-height: 1.16;
}

.quotation-table-executive-summary.table-mixed-tax .item-detail {
  font-size: 8.8px;
  line-height: 1.18;
}

.quotation-table-executive-summary.table-mixed-tax .item-description-level-2,
.quotation-table-executive-summary.table-mixed-tax .item-description-level-3 {
  padding-left: 12px;
}

.quotation-table-executive-summary.table-mixed-tax .item-description-level-3 {
  padding-left: 20px;
}

.quotation-table-luminous {
  table-layout: auto;
  overflow: hidden;
  border: 1px solid var(--lum-line, var(--preview-line));
  border-radius: 8px;
  background: #ffffff;
  font-size: 11.4px;
  border-top: 1px solid var(--lum-line, var(--preview-line));
}

.quotation-table-luminous th {
  padding: 8px 7px;
  border-bottom: 1px solid var(--lum-accent-line, var(--preview-accent));
  background:
    linear-gradient(180deg, #ffffff 0%, var(--lum-accent-soft, var(--preview-accent-soft)) 100%);
  color: var(--lum-muted, var(--preview-muted));
  font-size: 9.2px;
  font-weight: 850;
  letter-spacing: 0;
  text-transform: uppercase;
}

.quotation-table-luminous td {
  padding: 8px 7px;
  border-bottom: 1px solid var(--lum-line, var(--preview-line));
}

.quotation-table-luminous th.col-money,
.quotation-table-luminous td.col-money {
  padding-left: 8px;
}

.quotation-table-luminous .ledger-col-no,
.quotation-table-luminous .col-no {
  width: 52px;
}

.quotation-table-luminous .ledger-col-description,
.quotation-table-luminous .col-description {
  width: auto;
}

.quotation-table-luminous .ledger-col-qty,
.quotation-table-luminous .col-qty {
  width: 46px;
}

.quotation-table-luminous .ledger-col-unit,
.quotation-table-luminous .col-unit {
  width: 54px;
}

.quotation-table-luminous .ledger-col-tax,
.quotation-table-luminous .col-tax {
  width: 44px;
}

.quotation-table-luminous .ledger-col-money,
.quotation-table-luminous .col-money {
  width: 122px;
}

.quotation-table-luminous .section-cell {
  padding: 0 !important;
  border-bottom: 1px solid var(--lum-line, var(--preview-line)) !important;
}

.quotation-table-luminous .section-band {
  padding: 8px 11px;
  border-left: 5px solid var(--preview-accent);
  background: #ffffff;
  color: var(--lum-ink, var(--preview-ink));
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0;
  box-shadow: inset 0 -1px 0 var(--lum-accent-soft, var(--preview-accent-soft));
}

.quotation-table-luminous .row-level-1 td {
  border-top: 0;
  background: var(--lum-paper, var(--preview-surface-strong));
}

.quotation-table-luminous .row-level-1 .col-no {
  color: var(--preview-accent);
  font-weight: 850;
}

.quotation-table-luminous .item-description-level-1 {
  padding-left: 13px;
}

.quotation-table-luminous .item-description-level-1::before {
  top: 4px;
  bottom: 4px;
  width: 2px;
  border-radius: 2px;
}

.quotation-table-luminous .item-description-level-1 .item-title {
  color: var(--lum-ink, var(--preview-ink));
  font-size: 13px;
  font-weight: 850;
  line-height: 1.16;
}

.quotation-table-luminous .item-description-level-2 {
  padding-left: 17px;
}

.quotation-table-luminous .item-description-level-2::before {
  left: 6px;
  background: var(--lum-line-strong, var(--preview-line-strong));
}

.quotation-table-luminous .item-description-level-2 .item-title {
  color: var(--lum-ink, var(--preview-ink));
  font-size: 12.5px;
  font-weight: 750;
}

.quotation-table-luminous .item-description-level-3 {
  padding-left: 23px;
}

.quotation-table-luminous .item-description-level-3::before {
  left: 11px;
}

.quotation-table-luminous .item-description-level-3 .item-title {
  color: var(--lum-ink, var(--preview-ink));
}

.quotation-table-luminous .item-detail {
  color: var(--lum-muted, var(--preview-muted));
  font-size: 10.7px;
}

.quotation-table-luminous .money-value {
  color: var(--lum-ink, var(--preview-ink));
  font-size: 13.2px;
}

.quotation-table-luminous.table-mixed-tax {
  table-layout: fixed;
  font-size: 9px;
}

.quotation-table-luminous.table-mixed-tax th {
  padding: 6px 3px;
  font-size: 7.8px;
  letter-spacing: 0;
  vertical-align: bottom;
  white-space: nowrap;
}

.quotation-table-luminous.table-mixed-tax td {
  padding: 7px 3px;
}

.quotation-table-luminous.table-mixed-tax .col-no,
.quotation-table-luminous.table-mixed-tax .ledger-col-no {
  width: 34px;
}

.quotation-table-luminous.table-mixed-tax .col-qty,
.quotation-table-luminous.table-mixed-tax .ledger-col-qty {
  width: var(--mixed-qty-column-width, 40px);
}

.quotation-table-luminous.table-mixed-tax .col-unit,
.quotation-table-luminous.table-mixed-tax .ledger-col-unit {
  width: var(--mixed-unit-column-width, 42px);
}

.quotation-table-luminous.table-mixed-tax .col-tax,
.quotation-table-luminous.table-mixed-tax .ledger-col-tax {
  width: var(--mixed-tax-column-width, 46px);
}

.quotation-table-luminous.table-mixed-tax .col-money,
.quotation-table-luminous.table-mixed-tax .ledger-col-money {
  width: var(--mixed-money-column-width, 84px);
}

.quotation-table-luminous.table-mixed-tax .column-heading {
  grid-template-rows: minmax(7.8px, auto) 7.4px;
  justify-items: end;
  min-height: 16.2px;
  text-align: right;
}

.quotation-table-luminous.table-mixed-tax .col-no .column-heading,
.quotation-table-luminous.table-mixed-tax .col-description .column-heading {
  justify-items: start;
  text-align: left;
}

.quotation-table-luminous.table-mixed-tax .col-qty .column-heading,
.quotation-table-luminous.table-mixed-tax .col-unit .column-heading,
.quotation-table-luminous.table-mixed-tax .col-tax .column-heading {
  justify-items: center;
  text-align: center;
}

.quotation-table-luminous.table-mixed-tax .column-heading-note {
  min-height: 7.4px;
  color: var(--lum-soft, var(--preview-soft));
  font-size: 7px;
  font-weight: 700;
}

.quotation-table-luminous.table-mixed-tax .money-value {
  display: block;
  font-size: var(--mixed-money-font-size, 10.1px);
  line-height: 1.16;
}

.quotation-table-luminous.table-mixed-tax .item-detail {
  font-size: 8.8px;
  line-height: 1.18;
}

.quotation-table-luminous.table-mixed-tax .item-description-level-2,
.quotation-table-luminous.table-mixed-tax .item-description-level-3 {
  padding-left: 12px;
}

.quotation-table-luminous.table-mixed-tax .item-description-level-3 {
  padding-left: 20px;
}

.quotation-table-technical-bid {
  table-layout: fixed;
  border: 1px solid var(--bid-line);
  background: #fffaf3;
  font-size: 11.2px;
  border-top: 1px solid var(--bid-line);
}

.quotation-table-technical-bid .ledger-repeat-row {
  display: table-row;
}

.quotation-table-technical-bid .ledger-repeat-row td {
  padding: 8px 10px;
  border-bottom: 3px solid var(--bid-copper);
  background: var(--bid-night);
  color: var(--bid-cream);
  font-size: 10px;
}

.quotation-table-technical-bid .ledger-repeat-row span {
  color: var(--bid-teal);
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.quotation-table-technical-bid .ledger-repeat-row strong {
  float: right;
  max-width: 62%;
  overflow: hidden;
  color: var(--bid-cream);
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quotation-table-technical-bid th {
  padding: 7px 7px 6px;
  border-bottom: 1px solid #111827;
  background: #f2d6b7;
  color: #1a1410;
  font-size: 8.7px;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-align: left;
  text-transform: uppercase;
}

.quotation-table-technical-bid td {
  padding: 8px 7px;
  border-bottom: 1px solid #dfd3c4;
  vertical-align: top;
}

.quotation-table-technical-bid th.col-money,
.quotation-table-technical-bid td.col-money {
  padding-left: 8px;
}

.quotation-table-technical-bid .col-no {
  width: 62px;
  color: var(--bid-copper-dark);
  font-weight: 950;
}

.quotation-table-technical-bid .col-description {
  min-width: 0;
  overflow-wrap: anywhere;
}

.quotation-table-technical-bid .col-qty {
  width: 46px;
}

.quotation-table-technical-bid .col-unit {
  width: 54px;
}

.quotation-table-technical-bid .col-money {
  width: 116px;
}

.quotation-table-technical-bid .ledger-col-no {
  width: 58px;
}

.quotation-table-technical-bid .ledger-col-description {
  width: auto;
}

.quotation-table-technical-bid .ledger-col-qty {
  width: 46px;
}

.quotation-table-technical-bid .ledger-col-unit {
  width: 54px;
}

.quotation-table-technical-bid .ledger-col-tax {
  width: 46px;
}

.quotation-table-technical-bid .ledger-col-money {
  width: 116px;
}

.quotation-table-technical-bid .section-cell {
  padding: 0 !important;
  border-bottom: 0 !important;
  background: var(--bid-night);
}

.quotation-table-technical-bid .section-band {
  padding: 9px 12px;
  border-left: 8px solid var(--bid-teal);
  background: var(--bid-night);
  color: var(--bid-cream);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.13em;
}

.quotation-table-technical-bid .item-detail {
  color: #5f6570;
  font-size: 10.6px;
  line-height: 1.31;
}

.quotation-table-technical-bid .row-level-1 {
  background: var(--bid-night-2);
}

.quotation-table-technical-bid .row-level-1 td {
  border-top: 0;
  border-bottom-color: rgb(247 239 226 / 14%);
  background: var(--bid-night-2);
  color: var(--bid-cream);
}

.quotation-table-technical-bid .row-level-1 .col-no {
  color: var(--bid-teal);
  font-size: 13px;
}

.quotation-table-technical-bid .row-level-1 .item-detail {
  color: rgb(247 239 226 / 72%);
}

.quotation-table-technical-bid .row-level-1 .item-description-level-1 {
  padding: 2px 0 2px 17px;
  border-left: 4px solid var(--bid-copper);
}

.quotation-table-technical-bid .row-level-1 .item-description-level-1::before,
.quotation-table-technical-bid .item-description-level-2::before,
.quotation-table-technical-bid .item-description-level-3::before {
  content: none;
}

.quotation-table-technical-bid .row-level-1 .item-description-level-1 .item-title {
  color: #ffffff;
  font-size: 13.2px;
  font-weight: 950;
  line-height: 1.08;
}

.quotation-table-technical-bid .row-level-1 .money-value {
  color: #ffffff;
  font-weight: 950;
}

.quotation-table-technical-bid .row-level-2 td,
.quotation-table-technical-bid .row-level-3 td {
  background: #fffaf3;
}

.quotation-table-technical-bid .row-level-2 .col-no,
.quotation-table-technical-bid .row-level-3 .col-no {
  color: #87909d;
}

.quotation-table-technical-bid .item-description-level-2,
.quotation-table-technical-bid .item-description-level-3 {
  position: relative;
  padding-left: 16px;
}

.quotation-table-technical-bid .item-description-level-2 {
  border-left: 2px solid #c7a37f;
}

.quotation-table-technical-bid .item-description-level-3 {
  border-left: 2px solid #cfd6df;
}

.quotation-table-technical-bid .item-description-level-2 .item-title {
  color: var(--bid-ink);
  font-size: 13px;
  font-weight: 900;
}

.quotation-table-technical-bid .item-description-level-3 .item-title {
  color: #263244;
  font-size: 12px;
  font-weight: 850;
}

.quotation-table-technical-bid .money-value {
  color: var(--bid-ink);
}

.quotation-table-technical-bid.table-mixed-tax {
  table-layout: fixed;
  font-size: 9px;
}

.quotation-table-technical-bid.table-mixed-tax th {
  padding: 6px 3px;
  font-size: 7.7px;
  letter-spacing: 0.02em;
  vertical-align: bottom;
  white-space: nowrap;
}

.quotation-table-technical-bid.table-mixed-tax td {
  padding: 7px 3px;
}

.quotation-table-technical-bid.table-mixed-tax .col-no,
.quotation-table-technical-bid.table-mixed-tax .ledger-col-no {
  width: 34px;
}

.quotation-table-technical-bid.table-mixed-tax .col-qty,
.quotation-table-technical-bid.table-mixed-tax .ledger-col-qty {
  width: var(--mixed-qty-column-width, 40px);
}

.quotation-table-technical-bid.table-mixed-tax .col-unit,
.quotation-table-technical-bid.table-mixed-tax .ledger-col-unit {
  width: var(--mixed-unit-column-width, 42px);
}

.quotation-table-technical-bid.table-mixed-tax .col-tax,
.quotation-table-technical-bid.table-mixed-tax .ledger-col-tax {
  width: var(--mixed-tax-column-width, 46px);
}

.quotation-table-technical-bid.table-mixed-tax .col-money,
.quotation-table-technical-bid.table-mixed-tax .ledger-col-money {
  width: var(--mixed-money-column-width, 84px);
}

.quotation-table-technical-bid.table-mixed-tax .money-value {
  display: block;
  font-size: var(--mixed-money-font-size, 10.1px);
  line-height: 1.15;
}

.quotation-table-technical-bid.table-mixed-tax .column-heading {
  grid-template-rows: minmax(7.7px, auto) 7.4px;
  justify-items: end;
  min-height: 16.1px;
  text-align: right;
}

.quotation-table-technical-bid.table-mixed-tax .col-no .column-heading,
.quotation-table-technical-bid.table-mixed-tax .col-description .column-heading {
  justify-items: start;
  text-align: left;
}

.quotation-table-technical-bid.table-mixed-tax .col-qty .column-heading,
.quotation-table-technical-bid.table-mixed-tax .col-unit .column-heading,
.quotation-table-technical-bid.table-mixed-tax .col-tax .column-heading {
  justify-items: center;
  text-align: center;
}

.quotation-table-technical-bid.table-mixed-tax .column-heading-note {
  min-height: 7.4px;
  color: rgb(26 20 16 / 0.55);
  font-size: 7.1px;
  font-weight: 800;
}

.quotation-table-technical-bid.table-mixed-tax .item-detail {
  font-size: 8.5px;
  line-height: 1.14;
}

.quotation-table-technical-bid.table-mixed-tax .item-description-level-2,
.quotation-table-technical-bid.table-mixed-tax .item-description-level-3 {
  padding-left: 12px;
}

.quotation-table-signal {
  table-layout: auto;
  border: 1px solid var(--signal-line-strong, #919b91);
  background: #ffffff;
  font-size: 11.1px;
  border-top: 1px solid var(--signal-line-strong, #919b91);
}

.quotation-table-signal th {
  padding: 7px 6px;
  border-bottom: 2px solid var(--signal-ink, #15181c);
  background: var(--signal-ink, #121316);
  color: #ffffff;
  font-size: 8.4px;
  font-weight: 850;
  letter-spacing: 0;
  text-transform: uppercase;
}

.quotation-table-signal td {
  padding: 7px 6px;
  border-bottom: 1px solid var(--signal-line, #cfd7cc);
}

.quotation-table-signal th.col-money,
.quotation-table-signal td.col-money {
  padding-left: 8px;
}

.quotation-table-signal .ledger-col-no,
.quotation-table-signal .col-no {
  width: 46px;
}

.quotation-table-signal .ledger-col-description,
.quotation-table-signal .col-description {
  width: auto;
}

.quotation-table-signal .ledger-col-qty,
.quotation-table-signal .col-qty {
  width: 42px;
}

.quotation-table-signal .ledger-col-unit,
.quotation-table-signal .col-unit {
  width: 48px;
}

.quotation-table-signal .ledger-col-tax,
.quotation-table-signal .col-tax {
  width: 40px;
}

.quotation-table-signal .ledger-col-money,
.quotation-table-signal .col-money {
  width: 118px;
}

.quotation-table-signal .section-cell {
  padding: 0 !important;
  border-bottom: 1px solid var(--signal-line-strong, #919b91) !important;
  background: var(--signal-ink, #121316);
}

.quotation-table-signal .section-band {
  padding: 8px 10px;
  border-left: 5px solid var(--signal-accent, var(--preview-accent));
  background: var(--signal-ink, #121316);
  color: #ffffff;
  font-size: 9.6px;
  font-weight: 850;
  letter-spacing: 0;
}

.quotation-table-signal .row-level-1 td {
  border-top: 0;
  border-bottom-color: var(--signal-line-strong, #919b91);
  background: var(--signal-accent-soft, #f1f5ec);
  color: var(--signal-ink, #121316);
}

.quotation-table-signal .row-level-1 .col-no {
  color: var(--signal-accent, var(--preview-accent));
  font-size: 11.4px;
  font-weight: 850;
}

.quotation-table-signal .row-level-1 .item-description-level-1 {
  padding: 2px 0 2px 12px;
  border-left: 3px solid var(--signal-accent, var(--preview-accent));
}

.quotation-table-signal .row-level-1 .item-description-level-1::before,
.quotation-table-signal .item-description-level-2::before,
.quotation-table-signal .item-description-level-3::before {
  content: none;
}

.quotation-table-signal .row-level-1 .item-description-level-1 .item-title {
  color: var(--signal-ink, #121316);
  font-size: 12.8px;
  font-weight: 850;
  line-height: 1.12;
}

.quotation-table-signal .row-level-2 td,
.quotation-table-signal .row-level-3 td {
  background: #ffffff;
}

.quotation-table-signal .row-level-2 .col-no,
.quotation-table-signal .row-level-3 .col-no {
  color: var(--signal-soft, #8f978b);
}

.quotation-table-signal .item-description-level-2,
.quotation-table-signal .item-description-level-3 {
  position: relative;
  padding-left: 13px;
}

.quotation-table-signal .item-description-level-2 {
  border-left: 2px solid var(--signal-accent, var(--preview-accent));
}

.quotation-table-signal .item-description-level-3 {
  border-left: 1px solid var(--signal-line, #cfd7cc);
}

.quotation-table-signal .item-description-level-2 .item-title {
  color: var(--signal-ink, #121316);
  font-size: 12.1px;
  font-weight: 750;
}

.quotation-table-signal .item-description-level-3 .item-title {
  color: var(--signal-ink, #121316);
  font-size: 11.4px;
  font-weight: 700;
}

.quotation-table-signal .item-detail {
  color: var(--signal-muted, #5e665b);
  font-size: 10px;
  line-height: 1.24;
}

.quotation-table-signal .money-value {
  color: var(--signal-ink, #121316);
  font-weight: 750;
}

.quotation-table-signal.table-mixed-tax {
  table-layout: fixed;
  font-size: 8.4px;
}

.quotation-table-signal.table-mixed-tax th {
  padding: 5px 2px;
  font-size: 6.9px;
  letter-spacing: 0;
  vertical-align: bottom;
  white-space: nowrap;
}

.quotation-table-signal.table-mixed-tax td {
  padding: 6px 2px;
}

.quotation-table-signal.table-mixed-tax .col-no,
.quotation-table-signal.table-mixed-tax .ledger-col-no {
  width: 28px;
}

.quotation-table-signal.table-mixed-tax .col-qty,
.quotation-table-signal.table-mixed-tax .ledger-col-qty {
  width: 32px;
}

.quotation-table-signal.table-mixed-tax .col-unit,
.quotation-table-signal.table-mixed-tax .ledger-col-unit {
  width: 34px;
}

.quotation-table-signal.table-mixed-tax .col-tax,
.quotation-table-signal.table-mixed-tax .ledger-col-tax {
  width: 34px;
}

.quotation-table-signal.table-mixed-tax .col-money,
.quotation-table-signal.table-mixed-tax .ledger-col-money {
  width: 68px;
}

.quotation-table-signal.table-mixed-tax .money-value {
  display: block;
  font-size: var(--mixed-money-font-size, 10.1px);
  line-height: 1.12;
}

.quotation-table-signal.table-mixed-tax .column-heading {
  grid-template-rows: minmax(7px, auto) 7px;
  justify-items: end;
  min-height: 14px;
  text-align: right;
}

.quotation-table-signal.table-mixed-tax .col-no .column-heading,
.quotation-table-signal.table-mixed-tax .col-description .column-heading {
  justify-items: start;
  text-align: left;
}

.quotation-table-signal.table-mixed-tax .col-qty .column-heading,
.quotation-table-signal.table-mixed-tax .col-unit .column-heading,
.quotation-table-signal.table-mixed-tax .col-tax .column-heading {
  justify-items: center;
  text-align: center;
}

.quotation-table-signal.table-mixed-tax .column-heading-note {
  min-height: 7px;
  color: rgb(255 255 255 / 0.72);
  font-size: 6.5px;
  font-weight: 700;
}

.quotation-table-signal.table-mixed-tax .item-detail {
  font-size: 8px;
  line-height: 1.12;
}

.quotation-table-signal.table-mixed-tax .item-description-level-2,
.quotation-table-signal.table-mixed-tax .item-description-level-3 {
  padding-left: 10px;
}

.quotation-table-atelier {
  table-layout: fixed;
  border: 0;
  border-top: 1px solid var(--atelier-line-strong, var(--preview-line-strong));
  background: transparent;
  font-size: 10.6px;
}

.quotation-table-atelier th {
  padding: 7px 6px 6px;
  border-bottom: 1px solid var(--atelier-line-strong, var(--preview-line-strong));
  background: transparent;
  color: var(--atelier-muted, var(--preview-muted));
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.11em;
}

.quotation-table-atelier td {
  padding: 7px 6px;
  border-bottom-color: var(--atelier-line, var(--preview-line));
}

.quotation-table-atelier th.col-money,
.quotation-table-atelier td.col-money {
  padding-left: 7px;
}

.quotation-table-atelier .ledger-col-no,
.quotation-table-atelier .col-no {
  width: 42px;
}

.quotation-table-atelier .ledger-col-description,
.quotation-table-atelier .col-description {
  width: auto;
}

.quotation-table-atelier .ledger-col-qty,
.quotation-table-atelier .col-qty {
  width: 42px;
}

.quotation-table-atelier .ledger-col-unit,
.quotation-table-atelier .col-unit {
  width: 48px;
}

.quotation-table-atelier .ledger-col-tax,
.quotation-table-atelier .col-tax {
  width: 40px;
}

.quotation-table-atelier .ledger-col-money,
.quotation-table-atelier .col-money {
  width: 112px;
}

.quotation-table-atelier .section-cell {
  padding: 7px 0 5px !important;
  border-bottom: 0 !important;
  background: transparent;
}

.quotation-table-atelier .section-band {
  padding: 6px 9px;
  border-left: 3px solid var(--atelier-accent, var(--preview-accent));
  background: var(--atelier-accent-soft, var(--preview-accent-soft));
  color: var(--atelier-ink, var(--preview-ink));
  font-size: 9px;
  letter-spacing: 0.12em;
}

.quotation-table-atelier .row-level-1 td {
  border-top: 1px solid var(--atelier-line-strong, var(--preview-line-strong));
  border-bottom-color: var(--atelier-line-strong, var(--preview-line-strong));
  background: var(--atelier-accent-soft, var(--preview-accent-soft));
}

.quotation-table-atelier .row-level-1 .col-no {
  color: var(--atelier-accent, var(--preview-accent));
  font-weight: 800;
}

.quotation-table-atelier .item-description-level-1,
.quotation-table-atelier .item-description-level-2,
.quotation-table-atelier .item-description-level-3 {
  padding-left: 11px;
}

.quotation-table-atelier .item-description-level-1 {
  border-left: 2px solid var(--atelier-accent, var(--preview-accent));
}

.quotation-table-atelier .item-description-level-2 {
  border-left: 1px solid var(--atelier-line-strong, var(--preview-line-strong));
}

.quotation-table-atelier .item-description-level-3 {
  border-left: 1px solid var(--atelier-line, var(--preview-line));
}

.quotation-table-atelier .item-description-level-1::before,
.quotation-table-atelier .item-description-level-2::before,
.quotation-table-atelier .item-description-level-3::before {
  content: none;
}

.quotation-table-atelier .item-description-level-1 .item-title {
  color: var(--atelier-ink, var(--preview-ink));
  font-size: 11.5px;
  font-weight: 800;
}

.quotation-table-atelier .item-description-level-2 .item-title {
  color: var(--atelier-ink, var(--preview-ink));
  font-size: 11px;
  font-weight: 750;
}

.quotation-table-atelier .item-description-level-3 .item-title {
  color: var(--atelier-ink, var(--preview-ink));
  font-size: 10.5px;
  font-weight: 700;
}

.quotation-table-atelier .item-detail {
  color: var(--atelier-muted, var(--preview-muted));
  font-size: 9px;
  line-height: 1.22;
}

.quotation-table-atelier .money-value {
  color: var(--atelier-ink, var(--preview-ink));
  font-weight: 750;
}

.quotation-table-atelier.table-mixed-tax {
  table-layout: fixed;
  font-size: 8.9px;
}

.quotation-table-atelier.table-mixed-tax th {
  padding: 5px 2px;
  font-size: 7.3px;
  letter-spacing: 0.04em;
  vertical-align: bottom;
  white-space: nowrap;
}

.quotation-table-atelier.table-mixed-tax td {
  padding: 6px 3px;
}

.quotation-table-atelier.table-mixed-tax .col-no,
.quotation-table-atelier.table-mixed-tax .ledger-col-no {
  width: 30px;
}

.quotation-table-atelier.table-mixed-tax .col-qty,
.quotation-table-atelier.table-mixed-tax .ledger-col-qty {
  width: 34px;
}

.quotation-table-atelier.table-mixed-tax .col-unit,
.quotation-table-atelier.table-mixed-tax .ledger-col-unit,
.quotation-table-atelier.table-mixed-tax .col-tax,
.quotation-table-atelier.table-mixed-tax .ledger-col-tax {
  width: 36px;
}

.quotation-table-atelier.table-mixed-tax .col-money,
.quotation-table-atelier.table-mixed-tax .ledger-col-money {
  width: 72px;
}

.quotation-table-atelier.table-mixed-tax .money-value {
  display: block;
  font-size: var(--mixed-money-font-size, 10.1px);
  line-height: 1.15;
}

.quotation-table-atelier.table-mixed-tax .column-heading {
  grid-template-rows: minmax(7.4px, auto) 7px;
  min-height: 14.4px;
}

.quotation-table-atelier.table-mixed-tax .column-heading-note {
  min-height: 7px;
  color: color-mix(in srgb, var(--atelier-muted, var(--preview-muted)) 72%, transparent);
  font-size: 6.7px;
  font-weight: 750;
}

.quotation-table-atelier.table-mixed-tax .item-detail {
  font-size: 8.3px;
  line-height: 1.16;
}

/* Keep sparse mixed-tax layouts wide enough for long currency values. */
.quotation-table.table-mixed-tax-columns-1 :is(.col-qty, .ledger-col-qty),
.quotation-table.table-mixed-tax-columns-2 :is(.col-qty, .ledger-col-qty) {
  width: var(--mixed-qty-column-width, 52px);
}

.quotation-table.table-mixed-tax-columns-1 :is(.col-unit, .ledger-col-unit),
.quotation-table.table-mixed-tax-columns-2 :is(.col-unit, .ledger-col-unit) {
  width: var(--mixed-unit-column-width, 54px);
}

.quotation-table.table-mixed-tax-columns-1 :is(.col-tax, .ledger-col-tax),
.quotation-table.table-mixed-tax-columns-2 :is(.col-tax, .ledger-col-tax) {
  width: var(--mixed-tax-column-width, 58px);
}

.quotation-table.table-mixed-tax-columns-1 :is(.col-money, .ledger-col-money),
.quotation-table.table-mixed-tax-columns-2 :is(.col-money, .ledger-col-money) {
  width: var(--mixed-money-column-width, 124px);
}

/* Preserve the description column when every optional money column is visible. */
.quotation-table.table-mixed-tax-wide :is(.col-no, .ledger-col-no) {
  width: 34px;
}

.quotation-table.table-mixed-tax-wide :is(.col-qty, .ledger-col-qty) {
  width: 38px;
}

.quotation-table.table-mixed-tax-wide :is(.col-unit, .ledger-col-unit) {
  width: 75px;
}

.quotation-table.table-mixed-tax-wide :is(.col-tax, .ledger-col-tax) {
  width: 44px;
}

.quotation-table.table-mixed-tax-wide :is(.col-money, .ledger-col-money) {
  width: 82px;
}

.quotation-table.table-mixed-tax-wide {
  font-size: 10px;
}

.quotation-table.table-mixed-tax-wide th {
  padding: 6px 3px;
  font-size: 8.5px;
  letter-spacing: 0.025em;
}

.quotation-table.table-mixed-tax-wide td {
  padding-right: 4px;
  padding-left: 4px;
}

.quotation-table.table-mixed-tax-wide .money-value {
  font-size: 10px;
}

.quotation-table.table-mixed-tax-wide td.col-unit {
  font-size: 9.5px;
}

.quotation-table.table-mixed-tax-wide .column-heading-note {
  font-size: 7.5px;
}

.quotation-table.table-mixed-tax-wide .item-detail {
  font-size: 8.7px;
}

.quotation-table .money-value.money-value-long {
  font-size: 10px;
  letter-spacing: -0.02em;
  overflow-wrap: normal;
  white-space: nowrap;
}

.quotation-table .money-value.money-value-extra-long {
  font-size: 9px;
}

.quotation-table td.col-unit-long {
  padding-right: 3px;
  padding-left: 3px;
  font-size: 9px;
  line-height: 1.15;
  overflow-wrap: normal;
  word-break: normal;
}

.quotation-table.table-summary-only .row-level-1:not(.row-section) td {
  border-top: 0;
  border-bottom-color: var(--preview-line);
  background: #ffffff;
  color: var(--preview-ink);
}

.quotation-table.table-summary-only .row-level-1:not(.row-section):nth-child(even) td {
  background: color-mix(in srgb, var(--preview-surface) 36%, #ffffff);
}

.quotation-table.table-summary-only .row-level-1:not(.row-section) .col-no {
  color: var(--preview-muted);
  font-size: inherit;
  font-weight: 800;
}

.quotation-table.table-summary-only .row-level-1:not(.row-section) .item-description-level-1 {
  padding-left: 14px;
  border-left: 3px solid var(--preview-accent);
}

.quotation-table.table-summary-only .row-level-1:not(.row-section) .item-description-level-1::before {
  content: none;
}

.quotation-table.table-summary-only .row-level-1:not(.row-section) .item-description-level-1 .item-title {
  color: var(--preview-ink);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.18;
}

.quotation-table.table-summary-only .row-level-1:not(.row-section) .item-detail {
  color: var(--preview-muted);
}

.quotation-table.table-summary-only .row-level-1:not(.row-section) .money-value {
  color: var(--preview-ink);
  font-weight: 800;
}

.quotation-table-technical-bid.table-summary-only .row-level-1:not(.row-section) td,
.quotation-table-technical-bid.table-summary-only .row-level-1:not(.row-section):nth-child(even) td {
  border-bottom-color: #dfd3c4;
  background: #fffaf3;
  color: var(--bid-ink);
}

.quotation-table-technical-bid.table-summary-only .row-level-1:not(.row-section):nth-child(even) td {
  background: #fbf1e4;
}

.quotation-table-technical-bid.table-summary-only .row-level-1:not(.row-section) .col-no {
  color: var(--bid-copper-dark);
  font-size: inherit;
}

.quotation-table-technical-bid.table-summary-only .row-level-1:not(.row-section) .item-description-level-1 {
  border-left-color: var(--bid-copper);
}

.quotation-table-technical-bid.table-summary-only .row-level-1:not(.row-section) .item-description-level-1 .item-title,
.quotation-table-technical-bid.table-summary-only .row-level-1:not(.row-section) .money-value {
  color: var(--bid-ink);
}

.quotation-table-technical-bid.table-summary-only .row-level-1:not(.row-section) .item-detail {
  color: #5f6570;
}

.quotation-table-signal.table-summary-only .row-level-1:not(.row-section) td,
.quotation-table-signal.table-summary-only .row-level-1:not(.row-section):nth-child(even) td {
  border-bottom-color: var(--signal-grid, #d7dbd0);
  background: #ffffff;
  color: var(--signal-ink, #121316);
}

.quotation-table-signal.table-summary-only .row-level-1:not(.row-section):nth-child(even) td {
  background: color-mix(in srgb, var(--signal-lime, #d9ff3f) 16%, #ffffff);
}

.quotation-table-signal.table-summary-only .row-level-1:not(.row-section) .col-no {
  color: var(--signal-soft, #8f978b);
  font-size: inherit;
}

.quotation-table-signal.table-summary-only .row-level-1:not(.row-section) .item-description-level-1 {
  border-left-color: var(--signal-red, #ff4f43);
}

.quotation-table-signal.table-summary-only .row-level-1:not(.row-section) .item-description-level-1 .item-title,
.quotation-table-signal.table-summary-only .row-level-1:not(.row-section) .money-value {
  color: var(--signal-ink, #121316);
}

/* Professional redesign palettes: each ledger belongs to its document system. */
.quotation-table-classic {
  border-color: #aeb2af;
  background: #ffffff;
}

.quotation-table-classic th {
  border-top: 2px solid #2b3833;
  border-bottom: 1px solid #2b3833;
  background: #ffffff;
  color: #171c1a;
}

.quotation-table-classic .section-cell,
.quotation-table-classic .section-band {
  background: #f4f5f3;
  color: #171c1a;
}

.quotation-table-classic .section-band {
  border-left-color: #2b3833;
}

.quotation-table-classic .row-level-1 td {
  border-bottom-color: #bfc3c0;
  background: #f7f7f5;
}

.quotation-table-classic .row-level-1 .item-title,
.quotation-table-classic .row-level-1 .money-value {
  color: #171c1a;
}

.quotation-table-technical-bid {
  border-color: #b9c9cf;
  background: #ffffff;
}

.quotation-table-technical-bid .ledger-repeat-row td {
  border-bottom-color: #c2773f;
  background: #294c61;
  color: #ffffff;
}

.quotation-table-technical-bid th {
  border-bottom-color: #8fa6b0;
  background: #d8e5e9;
  color: #173246;
}

.quotation-table-technical-bid .section-cell,
.quotation-table-technical-bid .section-band {
  background: #cbdde2;
  color: #173246;
}

.quotation-table-technical-bid .section-band {
  border-left-color: #c2773f;
}

.quotation-table-technical-bid .row-level-1,
.quotation-table-technical-bid .row-level-1 td {
  border-bottom-color: #b7cbd2;
  background: #e7f0f2;
  color: #173246;
}

.quotation-table-technical-bid .row-level-1 .col-no {
  color: #167e83;
}

.quotation-table-technical-bid .row-level-1 .item-detail {
  color: #5c6f7a;
}

.quotation-table-technical-bid .row-level-1 .item-description-level-1 .item-title,
.quotation-table-technical-bid .row-level-1 .money-value {
  color: #173246;
}

.quotation-table-executive-summary {
  border-color: #c9ced5;
  background: #fffefa;
}

.quotation-table-executive-summary th {
  border-bottom-color: #17253b;
  background: #243a58;
  color: #ffffff;
}

.quotation-table-executive-summary .section-cell,
.quotation-table-executive-summary .section-band {
  background: #17253b;
  color: #ffffff;
}

.quotation-table-executive-summary .section-band {
  border-left-color: #c8b17e;
}

.quotation-table-executive-summary .row-level-1 td {
  border-bottom-color: #d2c5a8;
  background: #eee7d9;
}

.quotation-table-executive-summary .row-level-1 .item-title,
.quotation-table-executive-summary .row-level-1 .money-value {
  color: #17253b;
}

.quotation-table-luminous {
  border-color: #b9cfd8;
  background: #ffffff;
}

.quotation-table-luminous th {
  border-bottom-color: #0b6f8a;
  background: #0b6f8a;
  background-image: none;
  color: #ffffff;
}

.quotation-table-luminous .section-cell,
.quotation-table-luminous .section-band {
  background: #073c5c;
  color: #ffffff;
}

.quotation-table-luminous .section-band {
  border-left-color: #43d0d7;
}

.quotation-table-luminous .row-level-1 td {
  border-bottom-color: #a9d4da;
  background: #e2f4f6;
}

.quotation-table-luminous .row-level-1 .item-title,
.quotation-table-luminous .row-level-1 .money-value {
  color: #11334c;
}

.quotation-table-signal {
  border-color: #9f8f7c;
  background: #fffdf8;
}

.quotation-table-signal th {
  background: #4a202a;
  color: #fffaf0;
}

.quotation-table-signal .section-cell,
.quotation-table-signal .section-band {
  background: #4a202a;
  color: #fffaf0;
}

.quotation-table-signal .section-band {
  border-left-color: #c8a367;
}

.quotation-table-signal .row-level-1 td {
  border-bottom-color: #cdbba6;
  background: #efe3d6;
}

.quotation-table-signal .row-level-1 .item-title,
.quotation-table-signal .row-level-1 .money-value {
  color: #4a202a;
}

.quotation-table-atelier {
  border-color: #b5a58f;
  background: #fffdf7;
}

.quotation-table-atelier th {
  border-bottom: 2px solid #30231f;
  background: transparent;
  color: #62564b;
}

.quotation-table-atelier .section-cell,
.quotation-table-atelier .section-band {
  background: #6f7448;
  color: #fffdf7;
}

.quotation-table-atelier .section-band {
  border-left-color: #a87845;
}

.quotation-table-atelier .row-level-1 td {
  border-bottom-color: #cfc5a9;
  background: #eeead8;
}

.quotation-table-atelier .row-level-1 .item-title,
.quotation-table-atelier .row-level-1 .money-value {
  color: #29221d;
}

/* PDF-safe table systems: solid fills, square geometry, standard weights, and integer text sizes. */
.quotation-table:not(.quotation-table-classic),
.quotation-table:not(.quotation-table-classic) *,
.quotation-table:not(.quotation-table-classic) *::before,
.quotation-table:not(.quotation-table-classic) *::after {
  border-radius: 0 !important;
  background-image: none !important;
  box-shadow: none !important;
  filter: none !important;
  text-shadow: none !important;
}

.quotation-table:not(.quotation-table-classic),
.quotation-table:not(.quotation-table-classic) * {
  letter-spacing: normal !important;
}

.quotation-table-executive-summary,
.quotation-table-luminous,
.quotation-table-signal,
.quotation-table-technical-bid,
.quotation-table-atelier {
  overflow: visible;
}

.quotation-table:not(.quotation-table-classic) th,
.quotation-table:not(.quotation-table-classic) .section-band,
.quotation-table:not(.quotation-table-classic) .item-title,
.quotation-table:not(.quotation-table-classic) .money-value,
.quotation-table:not(.quotation-table-classic) .col-no {
  font-weight: 700;
}

.quotation-table-executive-summary,
.quotation-table-luminous,
.quotation-table-technical-bid {
  font-size: 11px;
}

.quotation-table-signal,
.quotation-table-atelier {
  font-size: 10px;
}

.quotation-table-executive-summary th,
.quotation-table-luminous th,
.quotation-table-signal th,
.quotation-table-technical-bid th,
.quotation-table-atelier th {
  font-size: 8px;
  font-weight: 700;
}

.quotation-table-executive-summary .item-detail,
.quotation-table-luminous .item-detail,
.quotation-table-signal .item-detail,
.quotation-table-technical-bid .item-detail {
  font-size: 10px;
  line-height: 1.3;
}

.quotation-table-atelier .item-detail {
  font-size: 9px;
  line-height: 1.3;
}

.quotation-table-executive-summary .item-description-level-1 .item-title,
.quotation-table-luminous .item-description-level-1 .item-title,
.quotation-table-signal .item-description-level-1 .item-title,
.quotation-table-technical-bid .item-description-level-1 .item-title {
  font-size: 12px;
  font-weight: 700;
}

.quotation-table-atelier .item-description-level-1 .item-title {
  font-size: 11px;
  font-weight: 700;
}

.quotation-table-executive-summary .money-value,
.quotation-table-luminous .money-value,
.quotation-table-signal .money-value,
.quotation-table-technical-bid .money-value,
.quotation-table-atelier .money-value {
  font-size: 11px;
}

.quotation-table:not(.quotation-table-classic).table-mixed-tax {
  font-size: 9px !important;
}

.quotation-table:not(.quotation-table-classic).table-mixed-tax th {
  font-size: 8px !important;
}

.quotation-table:not(.quotation-table-classic).table-mixed-tax td.col-qty,
.quotation-table:not(.quotation-table-classic).table-mixed-tax td.col-unit,
.quotation-table:not(.quotation-table-classic).table-mixed-tax td.col-tax,
.quotation-table:not(.quotation-table-classic).table-mixed-tax .money-value {
  font-size: 9px !important;
}

.quotation-table:not(.quotation-table-classic).table-mixed-tax .item-detail {
  font-size: 8px !important;
  line-height: 1.25;
}

/* Executive summary: formal navy ledger with a restrained gold registration rule. */
.quotation-table-executive-summary {
  border: 1px solid #aab3bf;
  background: #ffffff;
}

.quotation-table-executive-summary th {
  border-bottom: 2px solid #17253b;
  background: #17253b;
  color: #ffffff;
}

.quotation-table-executive-summary .section-cell {
  border-bottom-color: #aab3bf !important;
  background: #e9edf1;
}

.quotation-table-executive-summary .section-band {
  border-left-color: #a48652;
  background: #e9edf1;
  color: #17253b;
}

.quotation-table-executive-summary .row-level-1 td,
.quotation-table-executive-summary.table-summary-only .row-level-1:not(.row-section) td,
.quotation-table-executive-summary.table-summary-only .row-level-1:not(.row-section):nth-child(even) td {
  border-bottom-color: #c7cfd7;
  background: #f5f6f8;
  color: #17253b;
}

/* Luminous: open white ledger with cyan rules instead of filled cards. */
.quotation-table-luminous {
  border: 1px solid #9dbbc2;
  background: #ffffff;
}

.quotation-table-luminous th {
  border-top: 2px solid #147d92;
  border-bottom: 2px solid #147d92;
  background: #ffffff;
  color: #0d3950;
}

.quotation-table-luminous .section-cell {
  border-bottom-color: #9dbbc2 !important;
  background: #eaf4f6;
}

.quotation-table-luminous .section-band {
  border-left-color: #147d92;
  background: #eaf4f6;
  color: #0d3950;
}

.quotation-table-luminous .row-level-1 td,
.quotation-table-luminous.table-summary-only .row-level-1:not(.row-section) td,
.quotation-table-luminous.table-summary-only .row-level-1:not(.row-section):nth-child(even) td {
  border-bottom-color: #bcd2d7;
  background: #f4f8f9;
  color: #0d3950;
}

/* Signal: dense burgundy commercial schedule with high-contrast bands. */
.quotation-table-signal {
  border: 1px solid #a99ca0;
  background: #ffffff;
}

.quotation-table-signal th {
  border-bottom: 2px solid #211d20;
  background: #6e2635;
  color: #ffffff;
}

.quotation-table-signal .section-cell,
.quotation-table-signal .section-band {
  border-bottom-color: #6e2635 !important;
  background: #211d20;
  color: #ffffff;
}

.quotation-table-signal .section-band {
  border-left-color: #6e2635;
}

.quotation-table-signal .row-level-1 td,
.quotation-table-signal.table-summary-only .row-level-1:not(.row-section) td,
.quotation-table-signal.table-summary-only .row-level-1:not(.row-section):nth-child(even) td {
  border-bottom-color: #cbbfc2;
  background: #f3ecee;
  color: #211d20;
}

/* Technical bid: engineering schedule with blue-gray cells and rust hierarchy markers. */
.quotation-table-technical-bid {
  border: 1px solid #9fb2ba;
  background: #ffffff;
}

.quotation-table-technical-bid .ledger-repeat-row td {
  border-bottom: 3px solid #b86432;
  background: #294c61;
  color: #ffffff;
}

.quotation-table-technical-bid th {
  border-bottom: 2px solid #75909b;
  background: #dfe9ed;
  color: #132735;
}

.quotation-table-technical-bid .section-cell,
.quotation-table-technical-bid .section-band {
  border-bottom-color: #91a8b1 !important;
  background: #294c61;
  color: #ffffff;
}

.quotation-table-technical-bid .section-band {
  border-left-color: #b86432;
}

.quotation-table-technical-bid .row-level-1,
.quotation-table-technical-bid .row-level-1 td,
.quotation-table-technical-bid.table-summary-only .row-level-1:not(.row-section) td,
.quotation-table-technical-bid.table-summary-only .row-level-1:not(.row-section):nth-child(even) td {
  border-bottom-color: #b9cbd2;
  background: #edf3f5;
  color: #132735;
}

.quotation-table-technical-bid .row-level-1 .item-detail {
  color: #5c6d76;
}

/* Atelier: formal correspondence ledger with serif-adjacent restraint and an olive index. */
.quotation-table-atelier {
  border: 0;
  border-top: 1px solid #8b918b;
  background: #ffffff;
}

.quotation-table-atelier th {
  border-bottom: 2px solid #2c2925;
  background: #ffffff;
  color: #565b57;
}

.quotation-table-atelier .section-cell {
  border-bottom-color: #8b918b !important;
  background: #eef1ee;
}

.quotation-table-atelier .section-band {
  border-left-color: #435548;
  background: #eef1ee;
  color: #2c2925;
}

.quotation-table-atelier .row-level-1 td,
.quotation-table-atelier.table-summary-only .row-level-1:not(.row-section) td,
.quotation-table-atelier.table-summary-only .row-level-1:not(.row-section):nth-child(even) td {
  border-bottom-color: #c9cec9;
  background: #f6f7f5;
  color: #2c2925;
}

@media print {
  .quotation-table-classic,
  .quotation-table-classic th,
  .quotation-table-classic td,
  .quotation-table-classic .section-cell,
  .quotation-table-classic .section-band,
  .quotation-table-classic .row-level-1 td {
    background: #ffffff !important;
    color: #111111 !important;
  }

  .quotation-table-classic th {
    border-top: 2px solid #111111 !important;
    border-bottom: 1px solid #111111 !important;
  }
}
</style>
