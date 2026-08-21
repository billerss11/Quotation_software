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
const chineseGrandTotal = computed(() =>
  currentDocumentLocale.value === 'zh-CN'
    ? formatChineseCurrencyAmount(props.totals.grandTotal, props.quotation.header.currency)
    : '',
)
const isMixedTaxMode = computed(() => props.quotation.totalsConfig.taxMode === 'mixed')
const singleTaxRateLabel = computed(() => {
  const { taxClasses, defaultTaxClassId } = props.quotation.totalsConfig
  const resolved = (taxClasses ?? []).find((tc) => tc.id === defaultTaxClassId) ?? (taxClasses ?? [])[0]
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
</script>

<template>
  <article class="quotation-document quotation-template-legacy">
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
            <dt class="quotation-meta-label">{{ documentT('quotations.document.revision') }}</dt>
            <dd class="quotation-meta-value">{{ quotation.header.revisionNumber ?? 1 }}</dd>
          </div>
          <div class="quotation-meta-item">
            <dt class="quotation-meta-label">{{ documentT('quotations.document.date') }}</dt>
            <dd class="quotation-meta-value">{{ formatIsoDate(quotation.header.quotationDate, currentDocumentLocale) }}</dd>
          </div>
          <div class="quotation-meta-item quotation-meta-item--project">
            <dt class="quotation-meta-label">{{ documentT('quotations.document.project') }}</dt>
            <dd class="quotation-meta-value">{{ quotation.header.projectName || documentT('quotations.document.projectFallback') }}</dd>
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
      <span class="meta-label">{{ documentT('quotations.document.preparedFor') }}</span>
      <strong class="meta-value">{{ quotation.header.customerCompany || quotation.header.contactPerson || documentT('quotations.document.customerFallback') }}</strong>
      <div class="meta-details">
        <p v-if="quotation.header.contactPerson" class="meta-detail">{{ quotation.header.contactPerson }}</p>
        <p v-if="quotation.header.contactDetails" class="meta-detail">{{ quotation.header.contactDetails }}</p>
      </div>
    </section>

    <section class="items-section" :aria-label="documentT('quotations.document.itemsAria')">
      <QuotationItemsTable
        :quotation="quotation"
        :summaries="summaries"
        :totals="totals"
        :global-markup-rate="globalMarkupRate"
        :exchange-rates="exchangeRates"
        variant="legacy"
        show-colgroup
        hide-top-level-group-detail
      />
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
  --preview-accent: color-mix(in srgb, var(--brand-accent) 58%, #0f5f65);
  --preview-accent-soft: color-mix(in srgb, var(--preview-accent) 9%, #fdfdfb);
  --preview-accent-line: color-mix(in srgb, var(--preview-accent) 38%, #c4d1cb);
  --preview-ink: #18201e;
  --preview-muted: #5e6864;
  --preview-soft: #8a948f;
  --preview-line: #dde4e0;
  --preview-line-strong: #aebcb5;
  --preview-surface: #f6f8f6;
  --preview-surface-strong: #edf2ef;
  width: var(--quotation-page-width);
  display: grid;
  grid-template-rows: max-content max-content minmax(0, 1fr) max-content;
  gap: 10px;
  min-height: var(--quotation-page-min-height);
  margin: 0 auto;
  padding: 18px 30px 24px;
  border: 1px solid #e0e7e3;
  background:
    radial-gradient(circle at 92% 3%, var(--preview-accent-soft), transparent 27%),
    #fdfdfb;
  color: var(--preview-ink);
  font-family: Aptos, "Segoe UI Variable", "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: 13px;
  line-height: 1.4;
}

.document-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 16px;
  align-items: start;
  padding-bottom: 8px;
  border-bottom: 3px solid var(--preview-accent);
}

.company-block {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 12px;
  min-width: 0;
}

.logo-box {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  overflow: hidden;
  padding: 2px;
  border: 1px solid var(--preview-accent-line);
  background: #ffffff;
  box-shadow:
    0 0 0 4px var(--preview-accent-soft),
    inset 0 1px 0 #ffffff;
  color: var(--preview-soft);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.logo-box img {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: #ffffff;
  object-fit: contain;
  object-position: center;
}

.company-block h2,
.company-details p,
.meta-band p,
.terms-box h3,
.terms-box p,
.totals-box {
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
  font-size: 19px;
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
  gap: 4px;
  text-align: right;
}

.quotation-title {
  margin: 0;
  color: var(--preview-ink);
  font-size: 24px;
  line-height: 1;
  letter-spacing: 0.01em;
}

.quotation-meta-list {
  margin: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  width: 100%;
  font-size: 12px;
}

.quotation-meta-item {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: baseline;
  gap: 10px;
  min-width: 0;
  padding: 3px 0;
  border-top: 1px solid var(--preview-line);
}

.quotation-meta-item--project {
  grid-column: auto;
}

.quotation-meta-label,
.totals-label {
  color: var(--preview-muted);
}

.quotation-meta-label {
  white-space: nowrap;
}

.quotation-meta-value,
.totals-value {
  margin: 0;
  color: var(--preview-ink);
  font-weight: 700;
}

.quotation-meta-value {
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: right;
}

.meta-band {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 13px;
  padding: 7px 10px;
  border: 1px solid var(--preview-line);
  border-left: 4px solid var(--preview-accent);
  background: #ffffff;
  box-shadow: inset 0 1px 0 #ffffff;
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
  overflow-wrap: anywhere;
}

.meta-details {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 10px;
  min-width: 0;
  color: var(--preview-muted);
}

.meta-detail + .meta-detail {
  padding-left: 10px;
  border-left: 1px solid var(--preview-line-strong);
}

.meta-detail,
.terms-copy,
.terms-text {
  color: var(--preview-muted);
}

.terms-text {
  white-space: pre-line;
}

.summary-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 24px;
  align-items: start;
  padding-top: 13px;
  border-top: 1px solid var(--preview-line);
}

.terms-box {
  display: grid;
  gap: 8px;
  padding: 13px 15px;
  border-left: 3px solid var(--preview-accent-line);
  background: var(--preview-surface);
  box-shadow: inset 0 1px 0 #ffffff;
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
  border-radius: 10px;
  background: #ffffff;
  box-shadow:
    0 0 0 4px var(--preview-accent-soft),
    inset 0 1px 0 #ffffff;
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
  flex-wrap: wrap;
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

.grand-total .chinese-total-amount {
  flex: 0 0 100%;
  margin: 8px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--preview-line);
  color: var(--preview-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
  text-align: left;
}

/* Toner-safe Swiss corporate: white paper, dark type, and structural rules. */
.quotation-document {
  --preview-accent: #2b3833;
  --preview-accent-soft: #f4f5f3;
  --preview-accent-line: #a9afac;
  --preview-ink: #171c1a;
  --preview-muted: #5d6461;
  --preview-soft: #858b88;
  --preview-line: #dedfdd;
  --preview-line-strong: #aeb2af;
  --preview-surface: #fafaf8;
  --preview-surface-strong: #f1f2ef;
  gap: 8px;
  padding: 0 30px 24px;
  border: 0;
  background: #ffffff;
}

.document-header {
  grid-template-columns: minmax(0, 1fr) 300px;
  margin: 0 -30px;
  padding: 10px 30px 9px;
  border-top: 3px solid var(--preview-ink);
  border-bottom: 1px solid var(--preview-line-strong);
  background: #ffffff;
}

.company-block {
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 10px;
}

.logo-box {
  width: 56px;
  height: 56px;
  border-color: var(--preview-line-strong);
  border-radius: 2px;
  background: #ffffff;
  box-shadow: inset 0 0 0 4px #f5f5f3;
}

.quotation-title-block {
  gap: 3px;
  padding-left: 14px;
  border-left: 1px solid var(--preview-line-strong);
}

.quotation-title {
  font-size: 22px;
  letter-spacing: -0.025em;
}

.quotation-meta-list {
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  padding-top: 4px;
  border-top: 1px solid var(--preview-line);
}

.quotation-meta-item {
  min-height: 0;
  padding: 3px 0;
}

.quotation-meta-item--project {
  grid-column: auto;
  order: -1;
  padding-bottom: 2px;
}

.meta-band {
  padding: 7px 0;
  border-top: 1px solid var(--preview-line-strong);
  border-bottom: 1px solid var(--preview-line-strong);
  border-left: 0;
  background: #ffffff;
  box-shadow: none;
}

.summary-section {
  padding-top: 15px;
  border-top: 1px solid var(--preview-line-strong);
}

.terms-box {
  padding: 14px 16px;
  border: 1px solid var(--preview-line);
  border-left: 3px solid var(--preview-ink);
  background: #ffffff;
}

.totals-box {
  border-color: var(--preview-line-strong);
  border-radius: 2px;
  background: #ffffff;
  box-shadow: none;
}

.grand-total {
  border-top-color: var(--preview-ink);
  background: #ffffff;
}

@media print {
  .quotation-document,
  .document-header,
  .meta-band,
  .terms-box,
  .totals-box,
  .grand-total {
    background: #ffffff !important;
    box-shadow: none !important;
  }
}

</style>
