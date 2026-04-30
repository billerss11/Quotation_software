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
    return documentT('quotations.document.mixedTax')
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
          <h2>{{ companyProfile.companyName }}</h2>
          <p v-if="companyProfile.email">{{ companyProfile.email }}</p>
          <p v-if="companyProfile.phone">{{ companyProfile.phone }}</p>
        </div>
      </div>

      <div class="quotation-title-block">
        <h1>{{ documentT('quotations.document.title') }}</h1>
        <dl>
          <div>
            <dt>{{ documentT('quotations.document.number') }}</dt>
            <dd>{{ quotation.header.quotationNumber }} {{ documentT('quotations.document.revision') }} {{ quotation.header.revisionNumber ?? 1 }}</dd>
          </div>
          <div>
            <dt>{{ documentT('quotations.document.date') }}</dt>
            <dd>{{ formatIsoDate(quotation.header.quotationDate, currentDocumentLocale) }}</dd>
          </div>
          <div>
            <dt>{{ documentT('quotations.document.valid') }}</dt>
            <dd>{{ quotation.header.validityPeriod }}</dd>
          </div>
          <div>
            <dt>{{ documentT('quotations.document.currency') }}</dt>
            <dd>{{ quotation.header.currency }}</dd>
          </div>
        </dl>
      </div>
    </header>

    <section class="meta-band" :aria-label="documentT('quotations.document.partiesAria')">
      <div class="meta-box">
        <span class="meta-label">{{ documentT('quotations.document.preparedFor') }}</span>
        <strong>{{ quotation.header.customerCompany || quotation.header.contactPerson || documentT('quotations.document.customerFallback') }}</strong>
        <p>{{ quotation.header.contactPerson }}</p>
        <p>{{ quotation.header.contactDetails }}</p>
      </div>

      <div class="meta-box">
        <span class="meta-label">{{ documentT('quotations.document.project') }}</span>
        <strong>{{ quotation.header.projectName || documentT('quotations.document.projectFallback') }}</strong>
        <p>{{ documentT('quotations.document.quotationDate') }}: {{ formatIsoDate(quotation.header.quotationDate, currentDocumentLocale) }}</p>
        <p>{{ documentT('quotations.document.validity') }}: {{ quotation.header.validityPeriod }}</p>
      </div>
    </section>

    <section class="items-section" :aria-label="documentT('quotations.document.itemsAria')">
      <table :class="['quotation-table', { 'table-mixed-tax': isMixedTaxMode }]">
        <thead>
          <tr>
            <th class="col-no">{{ documentT('quotations.document.table.no') }}</th>
            <th>{{ documentT('quotations.document.table.description') }}</th>
            <th class="col-qty">{{ documentT('quotations.document.table.qty') }}</th>
            <th class="col-unit">{{ documentT('quotations.document.table.unit') }}</th>
            <th v-if="isMixedTaxMode" class="col-tax">{{ documentT('quotations.document.table.tax') }}</th>
            <th class="col-money">{{ documentT('quotations.document.table.unitPrice') }}</th>
            <th v-if="isMixedTaxMode" class="col-money">{{ documentT('quotations.document.table.unitPriceWithTax') }}</th>
            <th class="col-money">{{ documentT('quotations.document.table.amount') }}</th>
            <th v-if="isMixedTaxMode" class="col-money">{{ documentT('quotations.document.table.amountWithTax') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in previewRows"
            :key="row.key"
            :class="[`row-${row.type}`, { 'row-group': isGroupRow(row) }]"
          >
            <td class="col-no">{{ row.itemNumber }}</td>
            <td>
              <div class="item-description">
                <strong>{{ row.description }}</strong>
                <span v-if="row.detail">{{ row.detail }}</span>
              </div>
            </td>
            <td class="col-qty">{{ row.quantity === null ? '' : row.quantity }}</td>
            <td class="col-unit">{{ row.quantityUnit }}</td>
            <td v-if="isMixedTaxMode" class="col-tax">{{ getRowTaxLabel(row) }}</td>
            <td class="col-money">
              <span v-if="getRowUnitPrice(row) !== null">
                {{ formatCurrency(getRowUnitPrice(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            <td v-if="isMixedTaxMode" class="col-money">
              <span v-if="getRowUnitPriceWithTax(row) !== null">
                {{ formatCurrency(getRowUnitPriceWithTax(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            <td class="col-money">
              <span v-if="getRowAmount(row) !== null">
                {{ formatCurrency(getRowAmount(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            <td v-if="isMixedTaxMode" class="col-money">
              <span v-if="getRowAmountWithTax(row) !== null">
                {{ formatCurrency(getRowAmountWithTax(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="summary-section" :aria-label="documentT('quotations.document.summaryAria')">
      <div class="terms-box">
        <h3>{{ documentT('quotations.document.notesTerms') }}</h3>
        <p v-if="quotation.header.notes || !quotation.header.terms">
          {{
            quotation.header.notes ||
            documentT('quotations.document.defaultTerms')
          }}
        </p>
        <p v-if="quotation.header.terms" class="terms-text">{{ quotation.header.terms }}</p>
      </div>

      <dl class="totals-box">
        <div>
          <dt>{{ documentT('quotations.document.subtotal') }}</dt>
          <dd>{{ formatCurrency(totals.subtotalAfterMarkup, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div v-if="showDiscountRow">
          <dt>{{ documentT('quotations.document.discount') }}</dt>
          <dd>-{{ formatCurrency(totals.discountAmount, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div v-if="!isMixedTaxMode">
          <dt>{{ documentT('quotations.document.taxWithRate', { rate: singleTaxRateLabel }) }}</dt>
          <dd>{{ formatCurrency(totals.taxAmount, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div v-for="bucket in visibleTaxBuckets" :key="bucket.taxClassId">
          <dt>{{ documentT('quotations.document.taxBucket', { label: bucket.label }) }}</dt>
          <dd>{{ formatCurrency(bucket.taxAmount, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div class="grand-total">
          <dt>{{ documentT('quotations.document.total') }}</dt>
          <dd>{{ formatCurrency(totals.grandTotal, quotation.header.currency, currentDocumentLocale) }}</dd>
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
  width: var(--quotation-page-width);
  display: grid;
  gap: 20px;
  min-height: var(--quotation-page-min-height);
  margin: 0 auto;
  padding: 34px 38px 32px;
  border: 1px solid #d7dee8;
  background: #ffffff;
  color: #172033;
  font-size: 13px;
  line-height: 1.38;
}

.document-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 270px;
  gap: 20px;
  padding-bottom: 18px;
  border-bottom: 3px solid var(--preview-accent);
}

.company-block {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.logo-box {
  display: grid;
  width: 128px;
  height: 68px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #cbd5e1;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.logo-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.company-block h2,
.company-details p,
.quotation-title-block h1,
.quotation-title-block dl,
.meta-box p,
.terms-box h3,
.terms-box p,
.totals-box,
.document-footer span {
  margin: 0;
}

.company-block h2 {
  color: #0f172a;
  font-size: 18px;
  line-height: 1.15;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.company-details p,
.meta-box p,
.terms-box p {
  color: #64748b;
}

.company-details {
  display: grid;
  gap: 2px;
  font-size: 12px;
}

.terms-text {
  white-space: pre-line;
}

.quotation-title-block {
  display: grid;
  justify-items: end;
  gap: 10px;
  text-align: right;
}

.quotation-title-block h1 {
  color: #0f172a;
  font-size: 32px;
  line-height: 1;
  text-transform: uppercase;
}

.quotation-title-block dl {
  display: grid;
  gap: 4px;
  width: 100%;
  font-size: 12px;
}

.quotation-title-block dl div,
.totals-box div {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.quotation-title-block dl div {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: baseline;
}

.quotation-title-block dt,
.totals-box dt {
  color: #64748b;
}

.quotation-title-block dd,
.totals-box dd {
  margin: 0;
  color: #0f172a;
  font-weight: 800;
}

.meta-band {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.meta-box {
  display: grid;
  gap: 4px;
  min-height: 96px;
  padding: 14px 16px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

.meta-label {
  color: var(--preview-accent);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.meta-box strong {
  color: #0f172a;
  font-size: 15px;
}

.quotation-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.quotation-table th {
  padding: 9px 8px;
  border-bottom: 2px solid #cbd5e1;
  color: #334155;
  font-size: 11px;
  text-align: left;
  text-transform: uppercase;
}

.quotation-table td {
  padding: 8px 8px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}

/* Base column widths — single-tax layout (7 columns) */
.col-no {
  width: 72px;
  white-space: nowrap;
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
}

/* Compact layout for mixed-tax mode (9 columns: +TAX +Unit Price incl. tax) */
.table-mixed-tax {
  font-size: 11px;
}

.table-mixed-tax th {
  padding: 8px 5px;
  font-size: 10.5px;
}

.table-mixed-tax td {
  padding: 7px 5px;
}

.table-mixed-tax .col-no {
  width: 46px;
}

.table-mixed-tax .col-qty {
  width: 36px;
}

.table-mixed-tax .col-unit {
  width: 44px;
}

.table-mixed-tax .col-tax {
  width: 42px;
}

.table-mixed-tax .col-money {
  width: 88px;
}

.row-major {
  background: #eef4f8;
}

.row-major td {
  border-top: 2px solid #cbd5e1;
  border-bottom-color: #cbd5e1;
}

.row-major .item-description strong {
  color: #0f172a;
  font-size: 14px;
  font-weight: 900;
}

.row-major .col-no {
  color: var(--preview-accent);
  font-weight: 900;
}

.row-sub .item-description {
  padding-left: 8px;
}

.row-sub .item-description strong {
  font-weight: 600;
}

.row-group:not(.row-major) {
  background: #f8fafc;
}

.row-group:not(.row-major) td {
  border-top: 1px solid #d1dbe8;
  border-bottom-color: #d1dbe8;
}

.row-group:not(.row-major) .item-description {
  padding-left: 4px;
}

.row-group:not(.row-major) .item-description strong {
  color: #172033;
  font-size: 13px;
  font-weight: 850;
}

.row-group:not(.row-major) .col-no {
  color: #1d4ed8;
  font-weight: 850;
}

.row-sub:not(.row-group) .col-no {
  color: #475569;
}

.row-group .col-money span {
  color: #0f172a;
  font-weight: 900;
}

.item-description {
  display: grid;
  gap: 2px;
}

.item-description span {
  color: #64748b;
  font-size: 11px;
  line-height: 1.3;
  white-space: pre-line;
}

.item-description strong {
  white-space: pre-line;
}

.summary-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  gap: 24px;
  align-items: start;
}

.terms-box {
  display: grid;
  gap: 6px;
  padding-top: 2px;
}

.terms-box h3 {
  color: #0f172a;
  font-size: 14px;
}

.totals-box {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid #dbe5ef;
  background: #f8fafc;
}

.grand-total {
  margin-top: 4px;
  padding-top: 10px;
  border-top: 2px solid var(--preview-accent);
}

.grand-total dt,
.grand-total dd {
  color: #0f172a;
  font-size: 17px;
}

.document-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 40px;
  margin-top: auto;
  padding-top: 32px;
}

.signature-line {
  border-top: 1px solid #94a3b8;
  padding-top: 8px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}
</style>
