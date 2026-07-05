<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { DEFAULT_LOCALE } from '@/shared/i18n/locale'
import { messages } from '@/shared/i18n/messages'
import { formatCurrency, formatIsoDate } from '@/shared/utils/formatters'
import type { CompanyProfile } from '@/shared/services/localCompanyProfileStorage'

import type {
  ExchangeRateTable,
  MajorItemSummary,
  MixedTaxDocumentColumn,
  QuotationDraft,
  QuotationRootItem,
  QuotationTotals,
} from '../types'
import { normalizeMixedTaxDocumentColumns } from '../utils/quotationDocumentColumns'
import { getQuotationDocumentPageSizePx } from '../utils/quotationDocumentPage'
import { createQuotationPreviewRowPricingMap } from '../utils/quotationPreviewPricing'
import { createCalculationTotalsConfig, formatTaxRatePercentage } from '../utils/quotationTaxes'
import { createQuotationPreviewRows } from '../utils/quotationPreviewRows'
import type { QuotationPreviewRow } from '../utils/quotationPreviewRows'
import type { QuotationPreviewRowPricing } from '../utils/quotationPreviewPricing'

const props = defineProps<{
  quotation: QuotationDraft
  summaries: MajorItemSummary[]
  totals: QuotationTotals
  globalMarkupRate: number
  exchangeRates: ExchangeRateTable
  companyProfile: CompanyProfile
}>()

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
const visibleMixedTaxColumns = computed(() =>
  isMixedTaxMode.value
    ? normalizeMixedTaxDocumentColumns(props.quotation.totalsConfig.mixedTaxColumns)
    : [],
)
const previewColumnCount = computed(() => (isMixedTaxMode.value ? 4 + visibleMixedTaxColumns.value.length : 6))
const singleTaxRateLabel = computed(() => {
  const { taxClasses, defaultTaxClassId } = props.quotation.totalsConfig
  const resolved = (taxClasses ?? []).find((tc) => tc.id === defaultTaxClassId) ?? (taxClasses ?? [])[0]
  return resolved ? formatTaxRatePercentage(resolved.rate) : ''
})
const calculationTotalsConfig = computed(() => createCalculationTotalsConfig(props.quotation.totalsConfig))
const showDiscountRow = computed(() => props.totals.discountAmount > 0)
const visibleTaxBuckets = computed(() =>
  isMixedTaxMode.value
    ? props.totals.taxBuckets.filter((bucket) => bucket.taxableSubtotal > 0)
    : [],
)
const visibleExtraCharges = computed(() =>
  (props.quotation.totalsConfig.extraCharges ?? []).filter((charge) =>
    Number.isFinite(charge.amount) && charge.amount > 0,
  ),
)
const rowPricingByKey = computed(() => new Map(
  createQuotationPreviewRowPricingMap(
    props.quotation.majorItems,
    props.globalMarkupRate,
    props.exchangeRates,
    calculationTotalsConfig.value,
  ),
))
const documentPageSize = getQuotationDocumentPageSizePx()
const documentStyle = computed(() => ({
  '--preview-accent': props.quotation.branding.accentColor,
  '--quotation-page-width': `${documentPageSize.width}px`,
  '--quotation-page-min-height': `${documentPageSize.height}px`,
}))
const discountRatio = computed(() => {
  if (props.totals.subtotalAfterMarkup <= 0 || props.totals.discountAmount <= 0) {
    return 0
  }

  return Math.min(props.totals.discountAmount / props.totals.subtotalAfterMarkup, 1)
})

function getRowPricing(row: QuotationPreviewRow) {
  return rowPricingByKey.value.get(row.key) ?? EMPTY_ROW_PRICING
}

function hasMixedTaxColumn(column: MixedTaxDocumentColumn) {
  return visibleMixedTaxColumns.value.includes(column)
}

function getRowUnitPrice(row: QuotationPreviewRow) {
  const pricing = getRowPricing(row)

  if (!shouldShowRowPricing(row, pricing)) {
    return null
  }

  return pricing.unitPrice
}

function getRowAmount(row: QuotationPreviewRow) {
  const pricing = getRowPricing(row)

  if (!shouldShowRowPricing(row, pricing)) {
    return null
  }

  return pricing.amount ?? row.amount
}

function getRowAmountWithTax(row: QuotationPreviewRow) {
  const taxableAmount = getRowTaxableAmount(row)
  const taxAmount = getRowTaxAmount(row)

  if (taxableAmount === null || taxAmount === null) {
    return null
  }

  return roundMoney(taxableAmount + taxAmount)
}

function getRowTaxAmount(row: QuotationPreviewRow) {
  const pricing = getRowPricing(row)
  const preDiscountTaxAmount = getRowPreDiscountTaxAmount(row, pricing)

  if (preDiscountTaxAmount === null) {
    return null
  }

  return roundMoney(preDiscountTaxAmount * (1 - discountRatio.value))
}

function getRowTaxLabel(row: QuotationPreviewRow) {
  const pricing = getRowPricing(row)

  if (!shouldShowRowPricing(row, pricing)) {
    return ''
  }

  if (pricing.hasMixedTaxClasses) {
    return pricing.effectiveTaxRate !== null
      ? formatTaxRatePercentage(pricing.effectiveTaxRate)
      : documentT('quotations.document.mixedTax')
  }

  if (pricing.taxRate !== null) {
    return formatTaxRatePercentage(pricing.taxRate)
  }

  return ''
}

function isGroupRow(row: QuotationPreviewRow) {
  return getRowPricing(row).isGroup
}

function shouldShowRowPricing(row: QuotationPreviewRow, pricing = getRowPricing(row)) {
  return pricing.amount !== null || row.amount !== null
}

function getRowTaxableAmount(row: QuotationPreviewRow) {
  const amount = getRowAmount(row)

  if (amount === null) {
    return null
  }

  return roundMoney(amount * (1 - discountRatio.value))
}

function getRowPreDiscountTaxAmount(row: QuotationPreviewRow, pricing: QuotationPreviewRowPricing) {
  if (!shouldShowRowPricing(row, pricing)) {
    return null
  }

  if (pricing.amount !== null && pricing.amountWithTax !== null) {
    return roundMoney(pricing.amountWithTax - pricing.amount)
  }

  const amount = getRowAmount(row)
  const taxRate = pricing.effectiveTaxRate ?? pricing.taxRate

  if (amount === null || taxRate === null) {
    return null
  }

  return roundMoney(amount * (taxRate / 100))
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

const EMPTY_ROW_PRICING: QuotationPreviewRowPricing = {
  unitPrice: null,
  amount: null,
  isGroup: false,
  taxClassId: null,
  taxClassLabel: null,
  taxRate: null,
  effectiveTaxRate: null,
  hasMixedTaxClasses: false,
  unitPriceWithTax: null,
  amountWithTax: null,
}
</script>

<template>
  <article class="quotation-document" :style="documentStyle">
    <header class="document-header">
      <div class="company-block">
        <div class="logo-box">
          <img v-if="quotation.branding.logoDataUrl" :src="quotation.branding.logoDataUrl" :alt="documentT('quotations.document.companyLogoAlt')" />
          <span v-else>{{ documentT('quotations.document.companyLogoPlaceholder') }}</span>
        </div>
        <div class="company-details">
          <p class="company-kicker">{{ documentT('quotations.document.title') }}</p>
          <h2 class="company-name">{{ companyProfile.companyName }}</h2>
          <p v-if="companyProfile.email" class="company-contact">{{ companyProfile.email }}</p>
          <p v-if="companyProfile.phone" class="company-contact">{{ companyProfile.phone }}</p>
        </div>
      </div>

      <div class="quotation-title-block">
        <p class="quotation-title-kicker">{{ documentT('quotations.document.title') }}</p>
        <h1 class="quotation-title">{{ quotation.header.quotationNumber }}</h1>
        <dl class="quotation-meta-list">
          <div class="quotation-meta-item">
            <dt class="quotation-meta-label">{{ documentT('quotations.document.number') }}</dt>
            <dd class="quotation-meta-value">{{ quotation.header.quotationNumber }}</dd>
          </div>
          <div class="quotation-meta-item">
            <dt class="quotation-meta-label">{{ documentT('quotations.document.revision') }}</dt>
            <dd class="quotation-meta-value">{{ quotation.header.revisionNumber ?? 1 }}</dd>
          </div>
          <div class="quotation-meta-item">
            <dt class="quotation-meta-label">{{ documentT('quotations.document.date') }}</dt>
            <dd class="quotation-meta-value">{{ formatIsoDate(quotation.header.quotationDate, currentDocumentLocale) }}</dd>
          </div>
          <div class="quotation-meta-item">
            <dt class="quotation-meta-label">{{ documentT('quotations.document.valid') }}</dt>
            <dd class="quotation-meta-value">{{ quotation.header.validityPeriod }}</dd>
          </div>
          <div class="quotation-meta-item">
            <dt class="quotation-meta-label">{{ documentT('quotations.document.currency') }}</dt>
            <dd class="quotation-meta-value">{{ quotation.header.currency }}</dd>
          </div>
        </dl>
      </div>
    </header>

    <section class="meta-band" :aria-label="documentT('quotations.document.partiesAria')">
      <div class="meta-box">
        <span class="meta-label">{{ documentT('quotations.document.preparedFor') }}</span>
        <strong class="meta-value">{{ quotation.header.customerCompany || quotation.header.contactPerson || documentT('quotations.document.customerFallback') }}</strong>
        <p v-if="quotation.header.contactPerson" class="meta-detail">{{ quotation.header.contactPerson }}</p>
        <p v-if="quotation.header.contactDetails" class="meta-detail">{{ quotation.header.contactDetails }}</p>
      </div>

      <div class="meta-box">
        <span class="meta-label">{{ documentT('quotations.document.project') }}</span>
        <strong class="meta-value">{{ quotation.header.projectName || documentT('quotations.document.projectFallback') }}</strong>
      </div>
    </section>

    <section class="items-section" :aria-label="documentT('quotations.document.itemsAria')">
      <table :class="['quotation-table', { 'table-mixed-tax': isMixedTaxMode }]">
        <thead>
          <tr>
            <th class="col-no">
              <span v-if="isMixedTaxMode" class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.noShort') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note column-heading-note-spacer" aria-hidden="true"></span>
              </span>
              <span v-else>{{ documentT('quotations.document.table.no') }}</span>
            </th>
            <th class="col-description">
              <span v-if="isMixedTaxMode" class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.description') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note column-heading-note-spacer" aria-hidden="true"></span>
              </span>
              <span v-else>{{ documentT('quotations.document.table.description') }}</span>
            </th>
            <th class="col-qty">
              <span v-if="isMixedTaxMode" class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.qty') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note column-heading-note-spacer" aria-hidden="true"></span>
              </span>
              <span v-else>{{ documentT('quotations.document.table.qty') }}</span>
            </th>
            <th class="col-unit">
              <span v-if="isMixedTaxMode" class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.unit') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note column-heading-note-spacer" aria-hidden="true"></span>
              </span>
              <span v-else>{{ documentT('quotations.document.table.unit') }}</span>
            </th>
            <th v-if="isMixedTaxMode && hasMixedTaxColumn('taxRate')" class="col-tax">
              <span class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.taxRateShort') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note column-heading-note-spacer" aria-hidden="true"></span>
              </span>
            </th>
            <th v-if="!isMixedTaxMode || hasMixedTaxColumn('unitPrice')" class="col-money">
              <span v-if="isMixedTaxMode" class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.unitPriceShort') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note">{{ documentT('quotations.document.table.excludingTaxShort') }}</span>
              </span>
              <span v-else>{{ documentT('quotations.document.table.unitPrice') }}</span>
            </th>
            <th v-if="isMixedTaxMode && hasMixedTaxColumn('taxAmount')" class="col-money">
              <span class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.taxAmountShort') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note column-heading-note-spacer" aria-hidden="true"></span>
              </span>
            </th>
            <th v-if="!isMixedTaxMode || hasMixedTaxColumn('netAmount')" class="col-money">
              <span v-if="isMixedTaxMode" class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.amountBeforeTaxShort') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note">{{ documentT('quotations.document.table.excludingTaxShort') }}</span>
              </span>
              <span v-else>{{ documentT('quotations.document.table.amount') }}</span>
            </th>
            <th v-if="isMixedTaxMode && hasMixedTaxColumn('grossAmount')" class="col-money">
              <span class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.amountWithTaxShort') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note">{{ documentT('quotations.document.table.includingTaxShort') }}</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in previewRows"
            :key="row.key"
            :class="[
              `row-${row.type}`,
              `row-level-${row.level}`,
              {
                'row-group': isGroupRow(row),
                'row-detail': row.level === 3,
              },
            ]"
          >
            <template v-if="row.type === 'section'">
              <td class="section-cell" :colspan="previewColumnCount">
                <span class="section-band">{{ row.description }}</span>
              </td>
            </template>
            <template v-else>
            <td :class="['col-no', `col-no-level-${row.level}`]">{{ row.itemNumber }}</td>
            <td>
              <div :class="['item-description', `item-description-level-${row.level}`]">
                <strong class="item-title">{{ row.description }}</strong>
                <span v-if="row.detail" class="item-detail">{{ row.detail }}</span>
              </div>
            </td>
            <td class="col-qty">{{ row.quantity === null ? '' : row.quantity }}</td>
            <td class="col-unit">{{ row.quantityUnit }}</td>
            <td v-if="isMixedTaxMode && hasMixedTaxColumn('taxRate')" class="col-tax">{{ getRowTaxLabel(row) }}</td>
            <td v-if="!isMixedTaxMode || hasMixedTaxColumn('unitPrice')" class="col-money">
              <span v-if="getRowUnitPrice(row) !== null" class="money-value">
                {{ formatCurrency(getRowUnitPrice(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            <td v-if="isMixedTaxMode && hasMixedTaxColumn('taxAmount')" class="col-money">
              <span v-if="getRowTaxAmount(row) !== null" class="money-value">
                {{ formatCurrency(getRowTaxAmount(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            <td v-if="!isMixedTaxMode || hasMixedTaxColumn('netAmount')" class="col-money">
              <span v-if="getRowAmount(row) !== null" class="money-value">
                {{ formatCurrency(getRowAmount(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            <td v-if="isMixedTaxMode && hasMixedTaxColumn('grossAmount')" class="col-money">
              <span v-if="getRowAmountWithTax(row) !== null" class="money-value">
                {{ formatCurrency(getRowAmountWithTax(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            </template>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="summary-section" :aria-label="documentT('quotations.document.summaryAria')">
      <div class="terms-box">
        <h3 class="summary-heading">{{ documentT('quotations.document.notesTerms') }}</h3>
        <p v-if="quotation.header.notes || !quotation.header.terms" class="terms-copy">
          {{
            quotation.header.notes ||
            documentT('quotations.document.defaultTerms')
          }}
        </p>
        <p v-if="quotation.header.terms" class="terms-text">{{ quotation.header.terms }}</p>
      </div>

      <dl class="totals-box">
        <div class="totals-row">
          <dt class="totals-label">{{ documentT('quotations.document.subtotal') }}</dt>
          <dd class="totals-value">{{ formatCurrency(totals.subtotalAfterMarkup, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div v-if="showDiscountRow" class="totals-row">
          <dt class="totals-label">{{ documentT('quotations.document.discount') }}</dt>
          <dd class="totals-value">-{{ formatCurrency(totals.discountAmount, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div v-if="!isMixedTaxMode && totals.taxAmount > 0" class="totals-row">
          <dt class="totals-label">{{ documentT('quotations.document.taxWithRate', { rate: singleTaxRateLabel }) }}</dt>
          <dd class="totals-value">{{ formatCurrency(totals.taxAmount, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div v-for="bucket in visibleTaxBuckets" :key="bucket.taxClassId" class="totals-row">
          <dt class="totals-label">{{ documentT('quotations.document.taxBucket', { label: bucket.label }) }}</dt>
          <dd class="totals-value">{{ formatCurrency(bucket.taxAmount, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div v-for="charge in visibleExtraCharges" :key="charge.id" class="totals-row">
          <dt class="totals-label">{{ charge.label || documentT('quotations.document.extraChargeFallback') }}</dt>
          <dd class="totals-value">{{ formatCurrency(charge.amount, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div class="grand-total">
          <dt class="totals-label">{{ documentT('quotations.document.total') }}</dt>
          <dd class="totals-value">{{ formatCurrency(totals.grandTotal, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
      </dl>
    </section>

    <footer class="document-footer">
      <div class="signature-line">
        <span>{{ documentT('quotations.document.preparedBy') }}</span>
      </div>
      <div class="signature-line">
        <span>{{ documentT('quotations.document.acceptedBy') }}</span>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.quotation-document {
  --preview-accent: var(--accent);
  --preview-accent-soft: color-mix(in srgb, var(--preview-accent) 9%, #ffffff);
  --preview-accent-line: color-mix(in srgb, var(--preview-accent) 38%, #cbd5e1);
  --preview-ink: #111827;
  --preview-muted: #4b5563;
  --preview-soft: #8a96a8;
  --preview-line: #e3e8ef;
  --preview-line-strong: #b9c3d0;
  --preview-surface: #f7f9fc;
  --preview-surface-strong: #eef2f7;
  width: var(--quotation-page-width);
  display: grid;
  gap: 14px;
  min-height: var(--quotation-page-min-height);
  margin: 0 auto;
  padding: 24px 34px 28px;
  border: 1px solid #eef2f7;
  background: #ffffff;
  color: var(--preview-ink);
  font-size: 13px;
  line-height: 1.4;
}

.document-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 276px;
  gap: 20px;
  align-items: start;
  padding-bottom: 12px;
  border-bottom: 3px solid var(--preview-accent);
}

.company-block {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  gap: 16px;
  min-width: 0;
}

.logo-box {
  display: grid;
  width: 128px;
  height: 64px;
  place-items: center;
  padding: 8px;
  border: 1px dashed #cbd5e1;
  background: #ffffff;
  color: var(--preview-soft);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.logo-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.company-block h2,
.company-details p,
.meta-box p,
.terms-box h3,
.terms-box p,
.totals-box,
.document-footer span {
  margin: 0;
}

.company-details {
  display: grid;
  align-content: center;
  gap: 3px;
  min-width: 0;
}

.company-kicker,
.quotation-title-kicker {
  margin: 0;
  color: var(--preview-accent);
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.company-name {
  color: var(--preview-ink);
  font-size: 22px;
  line-height: 1.12;
  word-break: normal;
  overflow-wrap: anywhere;
}

.company-contact {
  color: var(--preview-muted);
  font-size: 12px;
}

.quotation-title-block {
  display: grid;
  justify-items: end;
  gap: 7px;
  text-align: right;
}

.quotation-title {
  margin: 0;
  color: var(--preview-ink);
  font-size: 28px;
  line-height: 1;
  letter-spacing: 0.01em;
}

.quotation-meta-list {
  margin: 0;
  display: grid;
  gap: 0;
  width: 100%;
  font-size: 12px;
}

.quotation-meta-item {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: baseline;
  gap: 14px;
  padding: 4px 0;
  border-top: 1px solid var(--preview-line);
}

.quotation-meta-label,
.totals-label {
  color: var(--preview-muted);
}

.quotation-meta-value,
.totals-value {
  margin: 0;
  color: var(--preview-ink);
  font-weight: 700;
}

.meta-band {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  padding-bottom: 2px;
}

.meta-box {
  display: grid;
  align-content: start;
  gap: 5px;
  min-height: 60px;
  padding: 9px 0 6px;
  border-top: 1px solid var(--preview-line-strong);
}

.meta-label {
  color: var(--preview-accent);
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.meta-value {
  color: var(--preview-ink);
  font-size: 16px;
  line-height: 1.2;
}

.meta-detail,
.terms-copy,
.terms-text {
  color: var(--preview-muted);
}

.terms-text {
  white-space: pre-line;
}

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
  font-size: 10.8px;
}

.table-mixed-tax th {
  padding: 7px 4px;
  font-size: 9.2px;
  letter-spacing: 0.03em;
  vertical-align: bottom;
  white-space: nowrap;
}

.table-mixed-tax td {
  padding: 8px 4px;
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
  width: 44px;
}

.table-mixed-tax .col-money {
  width: 84px;
}

.table-mixed-tax .column-heading {
  display: inline-grid;
  grid-template-rows: minmax(9.2px, auto) 8.3px;
  align-items: end;
  justify-items: center;
  min-height: 18.5px;
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
  font-size: 8.3px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;
  min-height: 8.3px;
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

.summary-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 24px;
  align-items: start;
  padding-top: 8px;
  border-top: 1px solid var(--preview-line);
}

.terms-box {
  display: grid;
  gap: 8px;
  padding-top: 8px;
}

.summary-heading {
  color: var(--preview-ink);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.totals-box {
  display: grid;
  gap: 0;
  padding: 12px 16px 14px;
  border: 1px solid var(--preview-line);
  border-top: 4px solid var(--preview-accent);
  background: #ffffff;
}

.totals-row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 7px 0;
  border-bottom: 1px solid var(--preview-line);
}

.grand-total {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--preview-line-strong);
}

.grand-total .totals-label,
.grand-total .totals-value {
  color: var(--preview-ink);
  font-size: 18px;
  font-weight: 800;
}

.document-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 40px;
  margin-top: auto;
  padding-top: 28px;
  border-top: 1px solid var(--preview-line);
}

.signature-line {
  border-top: 1px solid var(--preview-line-strong);
  padding-top: 8px;
  color: var(--preview-muted);
  font-size: 12px;
  font-weight: 700;
}
</style>
