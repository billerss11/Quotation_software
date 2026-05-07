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
  QuotationDraft,
  QuotationTotals,
} from '../types'
import { getQuotationDocumentPageSizePx } from '../utils/quotationDocumentPage'
import { getQuotationPreviewRowPricing } from '../utils/quotationPreviewPricing'
import { createCalculationTotalsConfig, formatTaxRatePercentage } from '../utils/quotationTaxes'
import { shouldShowQuotationPreviewDiscount } from '../utils/quotationPreviewSummary'
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
const singleTaxRateLabel = computed(() => {
  const { taxClasses, defaultTaxClassId } = props.quotation.totalsConfig
  const resolved = (taxClasses ?? []).find((tc) => tc.id === defaultTaxClassId) ?? (taxClasses ?? [])[0]
  return resolved ? formatTaxRatePercentage(resolved.rate) : ''
})
const calculationTotalsConfig = computed(() => createCalculationTotalsConfig(props.quotation.totalsConfig))
const showDiscountRow = computed(() => shouldShowQuotationPreviewDiscount(props.totals.discountAmount))
const visibleTaxBuckets = computed(() =>
  isMixedTaxMode.value
    ? props.totals.taxBuckets.filter((bucket) => bucket.taxableSubtotal > 0)
    : [],
)
const rowPricingByKey = computed(() => new Map(
  previewRows.value.map((row) => [
    row.key,
    getQuotationPreviewRowPricing(
      props.quotation.majorItems,
      row.key,
      props.globalMarkupRate,
      props.exchangeRates,
      calculationTotalsConfig.value,
    ),
  ]),
))
const documentPageSize = getQuotationDocumentPageSizePx()
const documentStyle = computed(() => ({
  '--preview-accent': props.quotation.branding.accentColor,
  '--quotation-page-width': `${documentPageSize.width}px`,
  '--quotation-page-min-height': `${documentPageSize.height}px`,
}))

function getRowPricing(row: QuotationPreviewRow) {
  return rowPricingByKey.value.get(row.key) ?? EMPTY_ROW_PRICING
}

function getRowUnitPrice(row: QuotationPreviewRow) {
  return getRowPricing(row).unitPrice
}

function getRowAmount(row: QuotationPreviewRow) {
  return getRowPricing(row).amount ?? row.amount
}

function getRowAmountWithTax(row: QuotationPreviewRow) {
  return getRowPricing(row).amountWithTax
}

function getRowUnitPriceWithTax(row: QuotationPreviewRow) {
  return getRowPricing(row).unitPriceWithTax
}

function getRowTaxLabel(row: QuotationPreviewRow) {
  const pricing = getRowPricing(row)

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
              {{ isMixedTaxMode ? documentT('quotations.document.table.noShort') : documentT('quotations.document.table.no') }}
            </th>
            <th>{{ documentT('quotations.document.table.description') }}</th>
            <th class="col-qty">{{ documentT('quotations.document.table.qty') }}</th>
            <th class="col-unit">{{ documentT('quotations.document.table.unit') }}</th>
            <th v-if="isMixedTaxMode" class="col-tax">{{ documentT('quotations.document.table.tax') }}</th>
            <th class="col-money">{{ isMixedTaxMode ? documentT('quotations.document.table.unitPriceShort') : documentT('quotations.document.table.unitPrice') }}</th>
            <th v-if="isMixedTaxMode" class="col-money">{{ documentT('quotations.document.table.unitPriceWithTaxShort') }}</th>
            <th class="col-money">{{ documentT('quotations.document.table.amount') }}</th>
            <th v-if="isMixedTaxMode" class="col-money">{{ documentT('quotations.document.table.amountWithTaxShort') }}</th>
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
            <td :class="['col-no', `col-no-level-${row.level}`]">{{ row.itemNumber }}</td>
            <td>
              <div :class="['item-description', `item-description-level-${row.level}`]">
                <strong class="item-title">{{ row.description }}</strong>
                <span v-if="row.detail" class="item-detail">{{ row.detail }}</span>
              </div>
            </td>
            <td class="col-qty">{{ row.quantity === null ? '' : row.quantity }}</td>
            <td class="col-unit">{{ row.quantityUnit }}</td>
            <td v-if="isMixedTaxMode" class="col-tax">{{ getRowTaxLabel(row) }}</td>
            <td class="col-money">
              <span v-if="getRowUnitPrice(row) !== null" class="money-value">
                {{ formatCurrency(getRowUnitPrice(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            <td v-if="isMixedTaxMode" class="col-money">
              <span v-if="getRowUnitPriceWithTax(row) !== null" class="money-value">
                {{ formatCurrency(getRowUnitPriceWithTax(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            <td class="col-money">
              <span v-if="getRowAmount(row) !== null" class="money-value">
                {{ formatCurrency(getRowAmount(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            <td v-if="isMixedTaxMode" class="col-money">
              <span v-if="getRowAmountWithTax(row) !== null" class="money-value">
                {{ formatCurrency(getRowAmountWithTax(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
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
  --preview-ink: #0f172a;
  --preview-muted: #475569;
  --preview-soft: #94a3b8;
  --preview-line: #d7dee6;
  --preview-line-strong: #a8b4c1;
  --preview-grid-line: #edf2f7;
  --preview-surface: #f6f8fb;
  width: var(--quotation-page-width);
  display: grid;
  gap: 18px;
  min-height: var(--quotation-page-min-height);
  margin: 0 auto;
  padding: 28px 34px 30px;
  border: 1px solid var(--preview-line);
  background: #ffffff;
  color: var(--preview-ink);
  font-size: 13px;
  line-height: 1.42;
}

.document-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  gap: 18px;
  align-items: start;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--preview-accent);
}

.company-block {
  display: grid;
  grid-template-columns: 144px minmax(0, 1fr);
  gap: 18px;
  min-width: 0;
}

.logo-box {
  display: grid;
  width: 144px;
  height: 74px;
  place-items: center;
  padding: 10px;
  border: 1px solid var(--preview-line);
  background: linear-gradient(180deg, #ffffff, var(--preview-surface));
  color: var(--preview-soft);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
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
  gap: 4px;
  min-width: 0;
}

.company-kicker,
.quotation-title-kicker {
  margin: 0;
  color: var(--preview-accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.company-name {
  color: var(--preview-ink);
  font-size: 24px;
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
  gap: 8px;
  text-align: right;
}

.quotation-title {
  margin: 0;
  color: var(--preview-ink);
  font-size: 29px;
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
  padding: 5px 0;
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
}

.meta-box {
  display: grid;
  align-content: start;
  gap: 6px;
  min-height: 74px;
  padding: 10px 0 8px;
  border-top: 1px solid var(--preview-line);
}

.meta-label {
  color: var(--preview-accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
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
  border-collapse: collapse;
  font-size: 12px;
}

.quotation-table th {
  padding: 10px 8px 9px;
  border-top: 1px solid var(--preview-line);
  border-bottom: 1px solid var(--preview-line-strong);
  background: #fbfcfe;
  color: var(--preview-muted);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-align: left;
  text-transform: uppercase;
}

.quotation-table th + th,
.quotation-table td + td {
  border-left: 1px solid var(--preview-grid-line);
}

.quotation-table td {
  padding: 9px 8px;
  border-bottom: 1px solid var(--preview-line);
  vertical-align: top;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
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
  padding: 8px 4px;
  font-size: 9.4px;
  letter-spacing: 0.03em;
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
  line-height: 1.36;
  white-space: pre-line;
}

.row-level-1 {
  background: var(--preview-surface);
}

.row-level-1 td {
  border-top: 1px solid var(--preview-line-strong);
}

.row-level-1 .col-no {
  color: var(--preview-accent);
  font-weight: 800;
}

.item-description-level-1 {
  position: relative;
  gap: 4px;
  padding: 3px 0 3px 18px;
}

.item-description-level-1::before {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  width: 3px;
  border-radius: 999px;
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
  padding: 1px 0 1px 24px;
}

.item-description-level-2::before {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 10px;
  width: 2px;
  border-radius: 999px;
  background: var(--preview-line-strong);
  opacity: 0.7;
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
  padding: 1px 0 1px 34px;
}

.item-description-level-3::before {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 16px;
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
  grid-template-columns: minmax(0, 1fr) 290px;
  gap: 24px;
  align-items: start;
  padding-top: 4px;
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
  border-top: 3px solid var(--preview-accent);
  background: linear-gradient(180deg, #ffffff, var(--preview-surface));
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
