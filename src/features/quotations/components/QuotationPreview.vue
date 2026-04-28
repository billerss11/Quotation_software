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
import { getQuotationPreviewRowPricing } from '../utils/quotationPreviewPricing'
import { shouldShowQuotationPreviewDiscount } from '../utils/quotationPreviewSummary'
import { createQuotationPreviewRows } from '../utils/quotationPreviewRows'
import type { QuotationPreviewRow } from '../utils/quotationPreviewRows'

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
const showDiscountRow = computed(() => shouldShowQuotationPreviewDiscount(props.totals.discountAmount))

function getRowPricing(row: QuotationPreviewRow) {
  return getQuotationPreviewRowPricing(
    props.quotation.majorItems,
    row.key,
    props.globalMarkupRate,
    props.exchangeRates,
  )
}

function getRowUnitPrice(row: QuotationPreviewRow) {
  return getRowPricing(row).unitPrice
}

function getRowAmount(row: QuotationPreviewRow) {
  return getRowPricing(row).amount ?? row.amount
}

function isGroupRow(row: QuotationPreviewRow) {
  return getRowPricing(row).isGroup
}
</script>

<template>
  <article class="quotation-document" :style="{ '--preview-accent': quotation.branding.accentColor }">
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
      <table class="quotation-table">
        <thead>
          <tr>
            <th class="col-no">{{ documentT('quotations.document.table.no') }}</th>
            <th>{{ documentT('quotations.document.table.description') }}</th>
            <th class="col-qty">{{ documentT('quotations.document.table.qty') }}</th>
            <th class="col-unit">{{ documentT('quotations.document.table.unit') }}</th>
            <th class="col-money">{{ documentT('quotations.document.table.unitPrice') }}</th>
            <th class="col-money">{{ documentT('quotations.document.table.amount') }}</th>
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
            <td class="col-money">
              <span v-if="getRowUnitPrice(row) !== null">
                {{ formatCurrency(getRowUnitPrice(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            <td class="col-money">
              <span v-if="getRowAmount(row) !== null">
                {{ formatCurrency(getRowAmount(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
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
        <div>
          <dt>{{ documentT('quotations.document.tax') }}</dt>
          <dd>{{ formatCurrency(totals.taxAmount, quotation.header.currency, currentDocumentLocale) }}</dd>
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
  display: grid;
  gap: 28px;
  min-height: 1120px;
  padding: 48px;
  border: 1px solid #d7dee8;
  background: #ffffff;
  color: #172033;
}

.document-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 28px;
  padding-bottom: 24px;
  border-bottom: 4px solid var(--preview-accent);
}

.company-block {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.logo-box {
  display: grid;
  width: 150px;
  height: 78px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #cbd5e1;
  color: #64748b;
  font-size: 12px;
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
  font-size: 22px;
}

.company-details p,
.meta-box p,
.terms-box p {
  color: #64748b;
}

.company-details {
  display: grid;
  gap: 4px;
}

.terms-text {
  white-space: pre-line;
}

.quotation-title-block {
  display: grid;
  justify-items: end;
  gap: 14px;
  text-align: right;
}

.quotation-title-block h1 {
  color: #0f172a;
  font-size: 38px;
  line-height: 1;
  text-transform: uppercase;
}

.quotation-title-block dl {
  display: grid;
  gap: 6px;
  width: 100%;
}

.quotation-title-block dl div,
.totals-box div {
  display: flex;
  justify-content: space-between;
  gap: 20px;
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
  gap: 20px;
}

.meta-box {
  display: grid;
  gap: 6px;
  min-height: 120px;
  padding: 18px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

.meta-label {
  color: var(--preview-accent);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.meta-box strong {
  color: #0f172a;
  font-size: 17px;
}

.quotation-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.quotation-table th {
  padding: 12px 10px;
  border-bottom: 2px solid #cbd5e1;
  color: #334155;
  font-size: 12px;
  text-align: left;
  text-transform: uppercase;
}

.quotation-table td {
  padding: 12px 10px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}

.col-no {
  width: 82px;
  white-space: nowrap;
}

.col-qty {
  width: 56px;
  text-align: center;
}

.col-unit {
  width: 88px;
  text-align: center;
}

.col-money {
  width: 140px;
  text-align: right;
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
  font-size: 15px;
  font-weight: 900;
}

.row-major .col-no {
  color: var(--preview-accent);
  font-weight: 900;
}

.row-sub .item-description {
  padding-left: 12px;
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
  padding-left: 6px;
}

.row-group:not(.row-major) .item-description strong {
  color: #172033;
  font-size: 14px;
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
  gap: 4px;
}

.item-description span {
  color: #64748b;
  font-size: 13px;
  white-space: pre-line;
}

.item-description strong {
  white-space: pre-line;
}

.summary-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 32px;
  align-items: start;
}

.terms-box {
  display: grid;
  gap: 8px;
  padding-top: 4px;
}

.terms-box h3 {
  color: #0f172a;
  font-size: 15px;
}

.totals-box {
  display: grid;
  gap: 10px;
  padding: 18px;
  border: 1px solid #dbe5ef;
  background: #f8fafc;
}

.grand-total {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 2px solid var(--preview-accent);
}

.grand-total dt,
.grand-total dd {
  color: #0f172a;
  font-size: 20px;
}

.document-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 48px;
  margin-top: auto;
  padding-top: 46px;
}

.signature-line {
  border-top: 1px solid #94a3b8;
  padding-top: 10px;
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}
</style>
