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
import { createCalculationTotalsConfig } from '../../utils/quotationTaxes'

type QuotationItemsTableVariant = 'legacy' | 'technical-bid' | 'executive-summary'

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
  variant: 'legacy',
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

const previewRows = computed(() => createQuotationPreviewRows(props.quotation.majorItems, props.summaries))
const currentDocumentLocale = computed(() => props.quotation.header.documentLocale as SupportedLocale)
const isMixedTaxMode = computed(() => props.quotation.totalsConfig.taxMode === 'mixed')
const showMixedTaxHeaderNotes = computed(() => currentDocumentLocale.value === 'en-US')
const visibleMixedTaxColumnDefinitions = computed(() =>
  isMixedTaxMode.value
    ? getMixedTaxDocumentColumnDefinitions(props.quotation.totalsConfig.mixedTaxColumns)
    : [],
)
const previewColumnCount = computed(() => (isMixedTaxMode.value ? 4 + visibleMixedTaxColumnDefinitions.value.length : 6))
const calculationTotalsConfig = computed(() => createCalculationTotalsConfig(props.quotation.totalsConfig))
const rowPricingByKey = computed(() => new Map(
  createQuotationPreviewRowPricingMap(
    props.quotation.majorItems,
    props.globalMarkupRate,
    props.exchangeRates,
    calculationTotalsConfig.value,
  ),
))
const discountRatio = computed(() => {
  if (props.totals.subtotalAfterMarkup <= 0 || props.totals.discountAmount <= 0) {
    return 0
  }

  return Math.min(props.totals.discountAmount / props.totals.subtotalAfterMarkup, 1)
})
const tableClasses = computed(() => [
  'quotation-table',
  `quotation-table-${props.variant}`,
  { 'table-mixed-tax': isMixedTaxMode.value },
])
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
    discountRatio.value,
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
</script>

<template>
  <table :class="tableClasses">
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
          <td>
            <div :class="['item-description', `item-description-level-${displayRow.row.level}`]">
              <strong class="item-title">{{ displayRow.row.description }}</strong>
              <span v-if="displayRow.showDetail" class="item-detail">{{ displayRow.row.detail }}</span>
            </div>
          </td>
          <td class="col-qty">{{ displayRow.row.quantity === null ? '' : displayRow.row.quantity }}</td>
          <td class="col-unit">{{ displayRow.row.quantityUnit }}</td>
          <td
            v-for="cell in displayRow.mixedTaxCells"
            :key="cell.column.id"
            :class="cell.column.cellClass"
          >
            <span
              v-if="cell.value"
              :class="{ 'money-value': cell.column.valueKind === 'money' }"
            >
              {{ cell.value }}
            </span>
          </td>
          <td v-if="!isMixedTaxMode" class="col-money">
            <span v-if="displayRow.unitPriceDisplay" class="money-value">
              {{ displayRow.unitPriceDisplay }}
            </span>
          </td>
          <td v-if="!isMixedTaxMode" class="col-money">
            <span v-if="displayRow.amountDisplay" class="money-value">
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
}

.col-qty {
  width: 52px;
  text-align: center;
}

.col-unit {
  width: 72px;
  text-align: center;
}

.col-tax {
  width: 44px;
  text-align: center;
}

.col-money {
  width: 108px;
  text-align: right;
  white-space: nowrap;
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
  width: 36px;
}

.table-mixed-tax .col-unit {
  width: 40px;
}

.table-mixed-tax .col-tax {
  width: 42px;
}

.table-mixed-tax .col-money {
  width: 80px;
}

.table-mixed-tax .money-value {
  font-size: 10px;
  letter-spacing: 0;
}

.table-mixed-tax .column-heading {
  display: inline-grid;
  grid-template-rows: minmax(8.8px, auto) 8px;
  align-items: end;
  justify-items: center;
  min-height: 18px;
  gap: 1px;
  line-height: 1;
}

.table-mixed-tax .col-no .column-heading,
.table-mixed-tax .col-description .column-heading {
  justify-items: start;
}

.table-mixed-tax .col-money .column-heading {
  justify-items: end;
}

.table-mixed-tax .column-heading-label {
  line-height: 1;
}

.table-mixed-tax .column-heading-note {
  color: var(--preview-soft);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;
  min-height: 8px;
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
  width: 92px;
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
  width: 29px;
}

.quotation-table-executive-summary.table-mixed-tax .col-unit,
.quotation-table-executive-summary.table-mixed-tax .ledger-col-unit {
  width: 32px;
}

.quotation-table-executive-summary.table-mixed-tax .col-tax,
.quotation-table-executive-summary.table-mixed-tax .ledger-col-tax {
  width: 33px;
}

.quotation-table-executive-summary.table-mixed-tax .col-money,
.quotation-table-executive-summary.table-mixed-tax .ledger-col-money {
  width: 66px;
}

.quotation-table-executive-summary.table-mixed-tax .column-heading {
  grid-template-rows: minmax(7.8px, auto) 7.4px;
  justify-items: end;
  min-height: 16.2px;
}

.quotation-table-executive-summary.table-mixed-tax .col-no .column-heading,
.quotation-table-executive-summary.table-mixed-tax .col-description .column-heading,
.quotation-table-executive-summary.table-mixed-tax .col-qty .column-heading,
.quotation-table-executive-summary.table-mixed-tax .col-unit .column-heading,
.quotation-table-executive-summary.table-mixed-tax .col-tax .column-heading {
  justify-items: start;
}

.quotation-table-executive-summary.table-mixed-tax .column-heading-note {
  min-height: 7.4px;
  color: var(--exec-soft, var(--preview-soft));
  font-size: 7px;
  font-weight: 700;
}

.quotation-table-executive-summary.table-mixed-tax .money-value {
  display: block;
  font-size: 7.9px;
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

.quotation-table-technical-bid {
  table-layout: auto;
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
  min-width: 250px;
}

.quotation-table-technical-bid .col-qty {
  width: 42px;
}

.quotation-table-technical-bid .col-unit {
  width: 48px;
}

.quotation-table-technical-bid .col-money {
  width: 84px;
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
  width: 92px;
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
  background: #182332;
}

.quotation-table-technical-bid .row-level-1 td {
  border-top: 0;
  border-bottom-color: rgb(247 239 226 / 14%);
  background: #182332;
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
  width: 28px;
}

.quotation-table-technical-bid.table-mixed-tax .col-unit,
.quotation-table-technical-bid.table-mixed-tax .ledger-col-unit {
  width: 31px;
}

.quotation-table-technical-bid.table-mixed-tax .col-tax,
.quotation-table-technical-bid.table-mixed-tax .ledger-col-tax {
  width: 31px;
}

.quotation-table-technical-bid.table-mixed-tax .col-money,
.quotation-table-technical-bid.table-mixed-tax .ledger-col-money {
  width: 64px;
}

.quotation-table-technical-bid.table-mixed-tax .money-value {
  display: block;
  font-size: 7.8px;
  line-height: 1.15;
}

.quotation-table-technical-bid.table-mixed-tax .column-heading {
  grid-template-rows: minmax(7.7px, auto) 7.4px;
  justify-items: end;
  min-height: 16.1px;
}

.quotation-table-technical-bid.table-mixed-tax .col-no .column-heading,
.quotation-table-technical-bid.table-mixed-tax .col-description .column-heading,
.quotation-table-technical-bid.table-mixed-tax .col-qty .column-heading,
.quotation-table-technical-bid.table-mixed-tax .col-unit .column-heading,
.quotation-table-technical-bid.table-mixed-tax .col-tax .column-heading {
  justify-items: start;
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
</style>
