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
import { getQuotationDocumentPageSizePx } from '../../utils/quotationDocumentPage'
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
const documentPageSize = getQuotationDocumentPageSizePx()
const documentStyle = computed(() => ({
  '--preview-accent': props.quotation.branding.accentColor,
  '--quotation-page-width': `${documentPageSize.width}px`,
  '--quotation-page-min-height': `${documentPageSize.height}px`,
}))
</script>

<template>
  <article class="quotation-document quotation-template-legacy" :style="documentStyle">
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
            <dt class="quotation-meta-label">{{ documentT('quotations.document.project') }}</dt>
            <dd class="quotation-meta-value">{{ quotation.header.projectName || documentT('quotations.document.projectFallback') }}</dd>
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
  grid-template-rows: max-content max-content minmax(0, 1fr) max-content;
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
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 5px 16px;
  padding: 8px 0 10px;
  border-bottom: 1px solid var(--preview-line);
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
  margin: 4px 0 0;
  padding-top: 6px;
  border-top: 1px solid var(--preview-line);
  color: var(--preview-muted);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-align: right;
}

</style>


