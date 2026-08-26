<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CompanyProfile } from '@/shared/contracts/reusableLibrary'
import type { SupportedLocale } from '@/shared/i18n/locale'
import { DEFAULT_LOCALE } from '@/shared/i18n/locale'
import { messages } from '@/shared/i18n/messages'
import { formatCurrency, formatIsoDate } from '@/shared/utils/formatters'

import type {
  ExchangeRateTable,
  MajorItemSummary,
  QuotationDraft,
  QuotationTotals,
} from '../../types'
import { formatChineseCurrencyAmount } from '../../utils/chineseCurrencyAmount'
import { formatTaxRatePercentage } from '../../utils/quotationTaxes'
import QuotationItemsTable from '../shared/QuotationItemsTable.vue'

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

const currentDocumentLocale = computed(() => props.quotation.header.documentLocale as SupportedLocale)
const customerDisplayName = computed(() =>
  props.quotation.header.customerCompany
  || props.quotation.header.contactPerson
  || documentT('quotations.document.customerFallback'),
)
const projectDisplayName = computed(() =>
  props.quotation.header.projectName || documentT('quotations.document.projectFallback'),
)
const isMixedTaxMode = computed(() => props.quotation.totalsConfig.taxMode === 'mixed')
const singleTaxRateLabel = computed(() => {
  const { taxClasses, defaultTaxClassId } = props.quotation.totalsConfig
  const resolved = (taxClasses ?? []).find((taxClass) => taxClass.id === defaultTaxClassId)
    ?? (taxClasses ?? [])[0]

  return resolved ? formatTaxRatePercentage(resolved.rate) : ''
})
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
const chineseGrandTotal = computed(() =>
  currentDocumentLocale.value === 'zh-CN'
    ? formatChineseCurrencyAmount(props.totals.grandTotal, props.quotation.header.currency)
    : '',
)
const documentMetaItems = computed(() => [
  {
    key: 'revision',
    label: documentT('quotations.document.revision'),
    value: props.quotation.header.revisionNumber ?? 1,
  },
  {
    key: 'date',
    label: documentT('quotations.document.date'),
    value: formatIsoDate(props.quotation.header.quotationDate, currentDocumentLocale.value),
  },
  {
    key: 'valid',
    label: documentT('quotations.document.valid'),
    value: props.quotation.header.validityPeriod,
  },
  {
    key: 'currency',
    label: documentT('quotations.document.currency'),
    value: props.quotation.header.currency,
  },
])
</script>

<template>
  <article class="quotation-document quotation-template-spreadsheet">
    <header class="quotation-header">
      <section class="company-panel">
        <div class="logo-cell">
          <img
            v-if="quotation.branding.logoDataUrl"
            class="logo-image"
            :src="quotation.branding.logoDataUrl"
            :alt="documentT('quotations.document.companyLogoAlt')"
          />
          <span v-else class="logo-placeholder">
            {{ documentT('quotations.document.companyLogoPlaceholder') }}
          </span>
        </div>
        <div class="company-copy">
          <h2 class="company-name">{{ companyProfile.companyName }}</h2>
          <div class="company-contacts">
            <span v-if="companyProfile.email">{{ companyProfile.email }}</span>
            <span v-if="companyProfile.phone">{{ companyProfile.phone }}</span>
          </div>
        </div>
      </section>

      <section class="document-identity">
        <p>{{ documentT('quotations.document.title') }}</p>
        <h1>{{ quotation.header.quotationNumber }}</h1>
      </section>
    </header>

    <section class="commercial-band" :aria-label="documentT('quotations.document.partiesAria')">
      <div class="client-project-panel">
        <div class="detail-group">
          <span class="field-label">{{ documentT('quotations.document.preparedFor') }}</span>
          <strong>{{ customerDisplayName }}</strong>
          <span v-if="quotation.header.contactPerson" class="secondary-value">
            {{ quotation.header.contactPerson }}
          </span>
          <span v-if="quotation.header.contactDetails" class="secondary-value">
            {{ quotation.header.contactDetails }}
          </span>
        </div>
        <div class="detail-group project-group">
          <span class="field-label">{{ documentT('quotations.document.project') }}</span>
          <strong>{{ projectDisplayName }}</strong>
        </div>
      </div>

      <dl class="document-control-grid">
        <div v-for="item in documentMetaItems" :key="item.key" class="control-row">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>

      <div class="total-highlight">
        <span>{{ documentT('quotations.document.total') }}</span>
        <strong>{{ formatCurrency(totals.grandTotal, quotation.header.currency, currentDocumentLocale) }}</strong>
        <small>{{ quotation.header.currency }}</small>
      </div>
    </section>

    <section class="spreadsheet-items" :aria-label="documentT('quotations.document.itemsAria')">
      <QuotationItemsTable
        :quotation="quotation"
        :summaries="summaries"
        :totals="totals"
        :global-markup-rate="globalMarkupRate"
        :exchange-rates="exchangeRates"
        variant="spreadsheet"
        show-colgroup
        hide-top-level-group-detail
      />
    </section>

    <section class="summary-grid" :aria-label="documentT('quotations.document.summaryAria')">
      <div class="terms-box">
        <h3>{{ documentT('quotations.document.notesTerms') }}</h3>
        <p v-if="quotation.header.notes || !quotation.header.terms">
          {{ quotation.header.notes || documentT('quotations.document.defaultTerms') }}
        </p>
        <p v-if="quotation.header.terms" class="terms-text">{{ quotation.header.terms }}</p>
      </div>

      <dl class="totals-box">
        <div class="totals-row">
          <dt>{{ documentT('quotations.document.subtotal') }}</dt>
          <dd>{{ formatCurrency(totals.subtotalAfterMarkup, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div v-if="!isMixedTaxMode && totals.taxAmount > 0" class="totals-row">
          <dt>{{ documentT('quotations.document.taxWithRate', { rate: singleTaxRateLabel }) }}</dt>
          <dd>{{ formatCurrency(totals.taxAmount, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div v-for="bucket in visibleTaxBuckets" :key="bucket.taxClassId" class="totals-row">
          <dt>{{ documentT('quotations.document.taxBucket', { label: bucket.label }) }}</dt>
          <dd>{{ formatCurrency(bucket.taxAmount, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div v-for="charge in visibleExtraCharges" :key="charge.id" class="totals-row">
          <dt>{{ charge.label || documentT('quotations.document.extraChargeFallback') }}</dt>
          <dd>{{ formatCurrency(charge.amount, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div class="grand-total-row">
          <dt>{{ documentT('quotations.document.total') }}</dt>
          <dd>{{ formatCurrency(totals.grandTotal, quotation.header.currency, currentDocumentLocale) }}</dd>
          <dd v-if="chineseGrandTotal" class="chinese-total-amount">
            {{ documentT('quotations.document.amountInWords', { amount: chineseGrandTotal }) }}
          </dd>
        </div>
      </dl>
    </section>
  </article>
</template>

<style scoped>
.quotation-document {
  --sheet-accent: color-mix(in srgb, var(--brand-accent) 68%, #0f6458);
  --sheet-accent-dark: color-mix(in srgb, var(--sheet-accent) 72%, #172c2c);
  --sheet-accent-soft: color-mix(in srgb, var(--sheet-accent) 9%, #ffffff);
  --sheet-ink: #18262d;
  --sheet-muted: #62717a;
  --sheet-line: #d4dbdf;
  --sheet-line-strong: #9eabb2;
  --sheet-header: #eef3f2;
  --preview-accent: var(--sheet-accent);
  --preview-accent-soft: var(--sheet-accent-soft);
  --preview-ink: var(--sheet-ink);
  --preview-muted: var(--sheet-muted);
  --preview-soft: #87939a;
  --preview-line: var(--sheet-line);
  --preview-line-strong: var(--sheet-line-strong);
  --preview-surface: #f7f9f9;
  --preview-surface-strong: #edf2f1;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: var(--quotation-page-width);
  min-height: var(--quotation-page-min-height);
  margin: 0 auto;
  padding: 0 28px 30px;
  border: 1px solid #dce2e4;
  border-top: 6px solid var(--sheet-accent-dark);
  background: #ffffff;
  color: var(--sheet-ink);
  font-family: Aptos, "Segoe UI Variable", "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: 12px;
  line-height: 1.35;
}

.quotation-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: center;
  min-height: 108px;
  padding: 22px 0 20px;
  border-bottom: 1px solid var(--sheet-line-strong);
}

.company-panel {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.logo-cell {
  display: grid;
  width: 70px;
  height: 70px;
  box-sizing: border-box;
  place-items: center;
  padding: 8px;
  border: 1px solid var(--sheet-line-strong);
  background: var(--sheet-accent-soft);
}

.logo-image {
  display: block;
  width: 100%;
  height: 52px;
  object-fit: contain;
}

.logo-placeholder {
  color: var(--sheet-muted);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-align: center;
  text-transform: uppercase;
}

.company-copy {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.company-name,
.company-contacts,
.document-identity p,
.document-identity h1,
.terms-box h3,
.terms-box p,
.totals-box {
  margin: 0;
}

.company-name {
  max-width: 100%;
  font-family: "Bahnschrift SemiCondensed", "Arial Narrow", Aptos, sans-serif;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.company-contacts {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 14px;
  color: var(--sheet-muted);
  font-size: 10.5px;
}

.document-identity {
  min-width: 250px;
  padding: 7px 0 7px 22px;
  border-left: 4px solid var(--sheet-accent);
  text-align: right;
}

.document-identity p,
.field-label,
.total-highlight span,
.total-highlight small,
.terms-box h3 {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.document-identity p {
  color: var(--sheet-accent-dark);
}

.document-identity h1 {
  padding-top: 4px;
  font-family: "Bahnschrift SemiCondensed", "Arial Narrow", Aptos, sans-serif;
  font-size: 27px;
  line-height: 1;
  letter-spacing: 0.015em;
  overflow-wrap: anywhere;
}

.commercial-band {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 210px 220px;
  min-width: 0;
  margin-top: 16px;
  border: 1px solid var(--sheet-line-strong);
  break-inside: avoid;
  page-break-inside: avoid;
}

.client-project-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  min-width: 0;
  border-right: 1px solid var(--sheet-line-strong);
}

.detail-group {
  display: grid;
  align-content: start;
  gap: 3px;
  min-width: 0;
  padding: 13px 14px;
}

.project-group {
  border-left: 1px solid var(--sheet-line);
}

.field-label {
  color: var(--sheet-muted);
}

.detail-group strong {
  padding-top: 2px;
  font-size: 12.5px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.secondary-value {
  color: var(--sheet-muted);
  font-size: 9.5px;
  overflow-wrap: anywhere;
}

.document-control-grid {
  display: grid;
  min-width: 0;
  margin: 0;
  border-right: 1px solid var(--sheet-line-strong);
}

.control-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  min-width: 0;
}

.control-row + .control-row {
  border-top: 1px solid var(--sheet-line);
}

.control-row dt,
.control-row dd {
  display: grid;
  align-items: center;
  min-width: 0;
  margin: 0;
  padding: 5px 8px;
}

.control-row dt {
  border-right: 1px solid var(--sheet-line);
  background: var(--sheet-header);
  color: var(--sheet-muted);
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.control-row dd {
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.total-highlight {
  display: grid;
  align-content: center;
  justify-items: end;
  min-width: 0;
  padding: 14px 15px;
  background: var(--sheet-accent-dark);
  color: #ffffff;
  text-align: right;
}

.total-highlight span,
.total-highlight small {
  color: color-mix(in srgb, #ffffff 74%, var(--sheet-accent));
}

.total-highlight strong {
  max-width: 100%;
  padding: 5px 0 3px;
  font-family: "Bahnschrift SemiCondensed", "Arial Narrow", Aptos, sans-serif;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  overflow-wrap: anywhere;
}

.total-highlight small {
  font-size: 8px;
}

.spreadsheet-items {
  min-width: 0;
  min-height: 260px;
  margin-top: 18px;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet) {
  table-layout: fixed;
  border: 1px solid var(--sheet-line-strong);
  border-collapse: collapse;
  font-family: Aptos, "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: 10.5px;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet th) {
  padding: 8px 7px;
  border: 1px solid color-mix(in srgb, #ffffff 18%, var(--sheet-accent-dark));
  background: var(--sheet-accent-dark);
  color: #ffffff;
  font-size: 11px;
  letter-spacing: 0.04em;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet td) {
  padding: 8px 7px;
  border: 1px solid var(--sheet-line);
  background: #ffffff;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .ledger-col-no),
.spreadsheet-items :deep(.quotation-table-spreadsheet .col-no) {
  width: 46px;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .ledger-col-qty),
.spreadsheet-items :deep(.quotation-table-spreadsheet .col-qty) {
  width: 50px;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .ledger-col-unit),
.spreadsheet-items :deep(.quotation-table-spreadsheet .col-unit) {
  width: 56px;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .ledger-col-money),
.spreadsheet-items :deep(.quotation-table-spreadsheet .col-money) {
  width: 116px;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .row-level-1 td) {
  border-top-color: var(--sheet-line-strong);
  border-bottom-color: var(--sheet-line-strong);
  background: var(--sheet-accent-soft);
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .row-level-1 .item-title),
.spreadsheet-items :deep(.quotation-table-spreadsheet .row-level-1 .money-value) {
  font-size: 11.5px;
  font-weight: 800;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .item-title) {
  font-size: 10.5px;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .item-detail) {
  color: var(--sheet-muted);
  font-size: 9.5px;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .item-description-level-1),
.spreadsheet-items :deep(.quotation-table-spreadsheet .item-description-level-2),
.spreadsheet-items :deep(.quotation-table-spreadsheet .item-description-level-3) {
  border-left: 0 !important;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .item-description-level-1) {
  padding-left: 0 !important;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .item-description-level-2) {
  padding-left: 8px !important;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .item-description-level-3) {
  padding-left: 16px !important;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .item-description-level-1::before),
.spreadsheet-items :deep(.quotation-table-spreadsheet .item-description-level-2::before),
.spreadsheet-items :deep(.quotation-table-spreadsheet .item-description-level-3::before) {
  display: none;
  content: none;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .section-cell) {
  padding: 0 !important;
  border: 1px solid var(--sheet-line-strong) !important;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .section-band) {
  padding: 7px 9px;
  border-left: 4px solid var(--sheet-accent);
  background: var(--sheet-header);
  color: var(--sheet-ink);
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .money-value) {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: -0.015em;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet.table-mixed-tax) {
  font-size: 9px;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet.table-mixed-tax th),
.spreadsheet-items :deep(.quotation-table-spreadsheet.table-mixed-tax td) {
  padding-right: 3px;
  padding-left: 3px;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet.table-mixed-tax th) {
  font-size: 11px;
}

.summary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  margin-top: 18px;
  border: 1px solid var(--sheet-line-strong);
  border-top: 3px solid var(--sheet-accent);
  break-inside: avoid;
  page-break-inside: avoid;
}

.terms-box {
  min-width: 0;
  padding: 14px 16px;
  border-right: 1px solid var(--sheet-line-strong);
  background: #fafbfb;
}

.terms-box h3 {
  padding-bottom: 7px;
  border-bottom: 1px solid var(--sheet-line);
  color: var(--sheet-muted);
}

.terms-box p {
  padding-top: 8px;
  color: var(--sheet-muted);
  font-size: 10.5px;
  line-height: 1.5;
}

.terms-text {
  white-space: pre-line;
}

.totals-box {
  display: grid;
  align-content: start;
}

.totals-row,
.grand-total-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(120px, max-content);
}

.totals-row dt,
.totals-row dd,
.grand-total-row dt,
.grand-total-row dd {
  min-width: 0;
  margin: 0;
  padding: 8px 10px;
  border-bottom: 1px solid var(--sheet-line);
}

.totals-row dt,
.grand-total-row dt {
  border-right: 1px solid var(--sheet-line);
  color: var(--sheet-muted);
}

.totals-row dd,
.grand-total-row dd {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  overflow-wrap: anywhere;
  text-align: right;
}

.grand-total-row {
  background: var(--sheet-accent-dark);
  color: #ffffff;
}

.grand-total-row dt,
.grand-total-row dd {
  border-color: color-mix(in srgb, #ffffff 22%, var(--sheet-accent-dark));
  color: #ffffff;
  font-size: 13px;
  font-weight: 800;
}

.grand-total-row .chinese-total-amount {
  grid-column: 1 / -1;
  padding-top: 7px;
  color: color-mix(in srgb, #ffffff 78%, var(--sheet-accent));
  font-size: 10px;
  line-height: 1.4;
  text-align: left;
}

@media print {
  .quotation-document {
    --sheet-accent: #3f6657;
    --sheet-accent-dark: #304d42;
    --sheet-accent-soft: #f0f4f2;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
  }
}
</style>
