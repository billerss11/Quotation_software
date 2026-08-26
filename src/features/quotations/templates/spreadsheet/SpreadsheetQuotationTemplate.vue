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

const columnCoordinates = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const

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
    <div class="column-ruler" aria-hidden="true">
      <span class="corner-coordinate"></span>
      <span
        v-for="coordinate in columnCoordinates"
        :key="coordinate"
        class="column-coordinate"
      >{{ coordinate }}</span>
    </div>

    <div class="sheet-row">
      <span class="row-coordinate" aria-hidden="true">1</span>
      <header class="worksheet-header">
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
            <p class="cell-label">{{ documentT('quotations.document.title') }}</p>
            <h2 class="company-name">{{ companyProfile.companyName }}</h2>
            <div class="company-contacts">
              <span v-if="companyProfile.email">{{ companyProfile.email }}</span>
              <span v-if="companyProfile.phone">{{ companyProfile.phone }}</span>
            </div>
          </div>
        </section>

        <section class="document-panel">
          <div class="document-title-cell">
            <span>{{ documentT('quotations.document.title') }}</span>
            <h1>{{ quotation.header.quotationNumber }}</h1>
          </div>
          <dl class="document-control-grid">
            <div v-for="item in documentMetaItems" :key="item.key" class="control-row">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
        </section>
      </header>
    </div>

    <div class="sheet-row">
      <span class="row-coordinate" aria-hidden="true">2</span>
      <section class="party-grid" :aria-label="documentT('quotations.document.partiesAria')">
        <span class="party-label">{{ documentT('quotations.document.preparedFor') }}</span>
        <div class="party-value customer-cell">
          <strong>{{ customerDisplayName }}</strong>
          <span v-if="quotation.header.contactPerson">{{ quotation.header.contactPerson }}</span>
          <span v-if="quotation.header.contactDetails">{{ quotation.header.contactDetails }}</span>
        </div>
        <span class="party-label">{{ documentT('quotations.document.project') }}</span>
        <strong class="party-value project-cell">{{ projectDisplayName }}</strong>
      </section>
    </div>

    <div class="sheet-row sheet-row-items">
      <span class="row-coordinate" aria-hidden="true">3</span>
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
    </div>

    <div class="sheet-row">
      <span class="row-coordinate" aria-hidden="true">4</span>
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
    </div>

    <div class="sheet-tabs" aria-hidden="true">
      <span class="sheet-tab">{{ documentT('quotations.document.title') }}</span>
      <span class="sheet-status">{{ quotation.header.quotationNumber }}</span>
    </div>
  </article>
</template>

<style scoped>
.quotation-document {
  --sheet-accent: color-mix(in srgb, var(--brand-accent) 62%, #176248);
  --sheet-accent-dark: color-mix(in srgb, var(--sheet-accent) 78%, #14392e);
  --sheet-accent-soft: color-mix(in srgb, var(--sheet-accent) 8%, #ffffff);
  --sheet-ink: #202a31;
  --sheet-muted: #68757e;
  --sheet-line: #d3d9dd;
  --sheet-line-strong: #929da5;
  --sheet-header: #eef2f1;
  --preview-accent: var(--sheet-accent);
  --preview-accent-soft: var(--sheet-accent-soft);
  --preview-ink: var(--sheet-ink);
  --preview-muted: var(--sheet-muted);
  --preview-soft: #89949b;
  --preview-line: var(--sheet-line);
  --preview-line-strong: var(--sheet-line-strong);
  --preview-surface: #f5f7f7;
  --preview-surface-strong: #edf2ef;
  display: grid;
  grid-template-rows: max-content max-content max-content minmax(260px, 1fr) max-content max-content;
  width: var(--quotation-page-width);
  min-height: var(--quotation-page-min-height);
  margin: 0 auto;
  padding: 20px 24px 24px;
  border: 1px solid #dce1e3;
  background: #ffffff;
  color: var(--sheet-ink);
  font-family: Aptos, "Segoe UI Variable", "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: 12px;
  line-height: 1.35;
}

.column-ruler {
  display: grid;
  grid-template-columns: 24px repeat(8, minmax(0, 1fr));
  height: 22px;
  border-top: 1px solid var(--sheet-line-strong);
  border-left: 1px solid var(--sheet-line-strong);
  background: var(--sheet-header);
  color: var(--sheet-muted);
  font-family: "Cascadia Mono", Consolas, monospace;
  font-size: 9px;
  line-height: 1;
}

.corner-coordinate,
.column-coordinate {
  display: grid;
  place-items: center;
  border-right: 1px solid var(--sheet-line);
  border-bottom: 1px solid var(--sheet-line-strong);
}

.corner-coordinate {
  position: relative;
}

.corner-coordinate::after {
  content: '';
  width: 0;
  height: 0;
  border-right: 5px solid transparent;
  border-bottom: 5px solid var(--sheet-line-strong);
}

.sheet-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
}

.sheet-row-items {
  min-height: 260px;
}

.row-coordinate {
  display: grid;
  place-items: start center;
  padding-top: 8px;
  border-right: 1px solid var(--sheet-line-strong);
  border-bottom: 1px solid var(--sheet-line-strong);
  border-left: 1px solid var(--sheet-line-strong);
  background: var(--sheet-header);
  color: var(--sheet-muted);
  font-family: "Cascadia Mono", Consolas, monospace;
  font-size: 9px;
}

.worksheet-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 292px;
  border-right: 1px solid var(--sheet-line-strong);
  border-bottom: 1px solid var(--sheet-line-strong);
}

.company-panel {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  min-width: 0;
  border-right: 1px solid var(--sheet-line-strong);
}

.logo-cell {
  display: grid;
  min-height: 116px;
  place-items: center;
  padding: 10px;
  border-right: 1px solid var(--sheet-line);
  background: var(--sheet-accent-soft);
}

.logo-image {
  display: block;
  width: 100%;
  height: 72px;
  object-fit: contain;
}

.logo-placeholder {
  color: var(--sheet-muted);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: center;
  text-transform: uppercase;
}

.company-copy {
  display: grid;
  align-content: center;
  gap: 5px;
  min-width: 0;
  padding: 15px 18px;
}

.cell-label,
.company-name,
.company-contacts,
.document-title-cell h1,
.document-title-cell span,
.terms-box h3,
.terms-box p,
.totals-box {
  margin: 0;
}

.cell-label,
.party-label,
.document-title-cell span {
  color: var(--sheet-muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.company-name {
  max-width: 100%;
  color: var(--sheet-ink);
  font-size: 19px;
  line-height: 1.12;
  overflow-wrap: anywhere;
}

.company-contacts {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 12px;
  color: var(--sheet-muted);
  font-size: 10.5px;
}

.document-panel {
  display: grid;
  grid-template-rows: max-content 1fr;
  min-width: 0;
}

.document-title-cell {
  padding: 12px 14px 11px;
  background: var(--sheet-accent-dark);
  color: #ffffff;
}

.document-title-cell span {
  color: color-mix(in srgb, #ffffff 72%, var(--sheet-accent));
}

.document-title-cell h1 {
  padding-top: 3px;
  font-family: "Bahnschrift SemiCondensed", "Arial Narrow", Aptos, sans-serif;
  font-size: 23px;
  line-height: 1;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
}

.document-control-grid {
  display: grid;
  margin: 0;
}

.control-row {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  min-width: 0;
  border-top: 1px solid var(--sheet-line);
}

.control-row dt,
.control-row dd {
  min-width: 0;
  margin: 0;
  padding: 5px 8px;
}

.control-row dt {
  border-right: 1px solid var(--sheet-line);
  background: var(--sheet-header);
  color: var(--sheet-muted);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
}

.control-row dd {
  font-family: "Cascadia Mono", Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.party-grid {
  display: grid;
  grid-template-columns: 92px minmax(0, 1.35fr) 76px minmax(0, 1fr);
  border-right: 1px solid var(--sheet-line-strong);
  border-bottom: 1px solid var(--sheet-line-strong);
}

.party-label,
.party-value {
  min-width: 0;
  padding: 9px 10px;
  border-right: 1px solid var(--sheet-line);
}

.party-label {
  display: grid;
  align-items: center;
  background: var(--sheet-header);
}

.party-value {
  display: grid;
  align-content: center;
  gap: 2px;
  overflow-wrap: anywhere;
}

.party-value strong,
.project-cell {
  color: var(--sheet-ink);
  font-size: 13px;
}

.customer-cell span {
  color: var(--sheet-muted);
  font-size: 10px;
}

.project-cell {
  border-right: 0;
}

.spreadsheet-items {
  min-width: 0;
  padding: 12px;
  border-right: 1px solid var(--sheet-line-strong);
  border-bottom: 1px solid var(--sheet-line-strong);
}

.spreadsheet-items :deep(.quotation-table-spreadsheet) {
  table-layout: fixed;
  border: 1px solid var(--sheet-line-strong);
  border-collapse: collapse;
  font-family: Aptos, "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: 10.5px;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet th) {
  padding: 7px 6px;
  border: 1px solid var(--sheet-line-strong);
  background: #e4ebe8;
  color: #3e4b51;
  font-size: 8.8px;
  letter-spacing: 0.04em;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet td) {
  padding: 7px 6px;
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

.spreadsheet-items :deep(.quotation-table-spreadsheet .section-cell) {
  padding: 0 !important;
  border: 1px solid var(--sheet-line-strong) !important;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .section-band) {
  padding: 6px 8px;
  border-left: 4px solid var(--sheet-accent);
  background: #e4ebe8;
  color: var(--sheet-ink);
}

.spreadsheet-items :deep(.quotation-table-spreadsheet .money-value) {
  font-family: "Cascadia Mono", Consolas, monospace;
  font-size: 10px;
  letter-spacing: -0.025em;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet.table-mixed-tax) {
  font-size: 9px;
}

.spreadsheet-items :deep(.quotation-table-spreadsheet.table-mixed-tax th),
.spreadsheet-items :deep(.quotation-table-spreadsheet.table-mixed-tax td) {
  padding-right: 3px;
  padding-left: 3px;
}

.summary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  break-inside: avoid;
  page-break-inside: avoid;
  border-right: 1px solid var(--sheet-line-strong);
  border-bottom: 1px solid var(--sheet-line-strong);
}

.terms-box {
  min-width: 0;
  padding: 13px 15px;
  border-right: 1px solid var(--sheet-line-strong);
}

.terms-box h3 {
  padding-bottom: 7px;
  border-bottom: 1px solid var(--sheet-line);
  color: var(--sheet-muted);
  font-size: 9px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
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
  grid-template-columns: minmax(0, 1fr) minmax(112px, max-content);
}

.totals-row dt,
.totals-row dd,
.grand-total-row dt,
.grand-total-row dd {
  min-width: 0;
  margin: 0;
  padding: 7px 9px;
  border-bottom: 1px solid var(--sheet-line);
}

.totals-row dt,
.grand-total-row dt {
  border-right: 1px solid var(--sheet-line);
  color: var(--sheet-muted);
}

.totals-row dd,
.grand-total-row dd {
  font-family: "Cascadia Mono", Consolas, monospace;
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
  border-color: color-mix(in srgb, #ffffff 24%, var(--sheet-accent-dark));
  color: #ffffff;
  font-size: 13px;
  font-weight: 800;
}

.grand-total-row .chinese-total-amount {
  grid-column: 1 / -1;
  padding-top: 7px;
  color: color-mix(in srgb, #ffffff 78%, var(--sheet-accent));
  font-family: Aptos, "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: 10px;
  line-height: 1.4;
  text-align: left;
}

.sheet-tabs {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  margin-left: 24px;
  padding: 0 8px;
  border-right: 1px solid var(--sheet-line-strong);
  border-bottom: 1px solid var(--sheet-line-strong);
  border-left: 1px solid var(--sheet-line-strong);
  background: #f1f3f4;
}

.sheet-tab {
  align-self: stretch;
  display: grid;
  place-items: center;
  min-width: 104px;
  padding: 0 15px;
  border-bottom: 3px solid var(--sheet-accent);
  background: #ffffff;
  color: var(--sheet-accent-dark);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sheet-status {
  margin-left: auto;
  color: var(--sheet-muted);
  font-family: "Cascadia Mono", Consolas, monospace;
  font-size: 8px;
}

@media print {
  .quotation-document {
    --sheet-accent: #3f6657;
    --sheet-accent-dark: #304d42;
    --sheet-accent-soft: #f0f4f2;
    border: 0;
  }
}
</style>
