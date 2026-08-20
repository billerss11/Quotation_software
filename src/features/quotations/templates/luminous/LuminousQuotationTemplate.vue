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
  const resolved = (taxClasses ?? []).find((taxClass) => taxClass.id === defaultTaxClassId) ?? (taxClasses ?? [])[0]
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
  '--brand-accent': props.quotation.branding.accentColor,
  '--quotation-page-width': `${documentPageSize.width}px`,
  '--quotation-page-min-height': `${documentPageSize.height}px`,
}))
const customerDisplayName = computed(() =>
  props.quotation.header.customerCompany
  || props.quotation.header.contactPerson
  || documentT('quotations.document.customerFallback'),
)
const projectDisplayName = computed(() =>
  props.quotation.header.projectName || documentT('quotations.document.projectFallback'),
)
const formattedGrandTotal = computed(() =>
  formatCurrency(props.totals.grandTotal, props.quotation.header.currency, currentDocumentLocale.value),
)
const formattedSubtotal = computed(() =>
  formatCurrency(props.totals.subtotalAfterMarkup, props.quotation.header.currency, currentDocumentLocale.value),
)
const formattedTaxAmount = computed(() =>
  formatCurrency(props.totals.taxAmount, props.quotation.header.currency, currentDocumentLocale.value),
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
const commercialSnapshotItems = computed(() => [
  {
    key: 'subtotal',
    label: documentT('quotations.document.subtotal'),
    value: formattedSubtotal.value,
  },
  {
    key: 'tax',
    label: documentT('quotations.document.tax'),
    value: formattedTaxAmount.value,
  },
  {
    key: 'total',
    label: documentT('quotations.document.grandTotal'),
    value: formattedGrandTotal.value,
  },
])
</script>

<template>
  <article class="quotation-document quotation-template-luminous" :style="documentStyle">
    <header class="document-header">
      <div class="brand-panel">
        <div class="logo-box">
          <img
            v-if="quotation.branding.logoDataUrl"
            class="logo-image"
            :src="quotation.branding.logoDataUrl"
            :alt="documentT('quotations.document.companyLogoAlt')"
          />
          <span v-else>{{ documentT('quotations.document.companyLogoPlaceholder') }}</span>
        </div>
        <div class="company-details">
          <p class="document-label">{{ documentT('quotations.document.title') }}</p>
          <h2 class="company-name">{{ companyProfile.companyName }}</h2>
          <p class="company-contact">
            <span v-if="companyProfile.email">{{ companyProfile.email }}</span>
            <span v-if="companyProfile.phone">{{ companyProfile.phone }}</span>
          </p>
        </div>
      </div>

      <div class="quote-hero">
        <p class="document-label">{{ documentT('quotations.document.documentControl') }}</p>
        <h1 class="quotation-number">{{ quotation.header.quotationNumber }}</h1>
        <div class="project-reference">
          <span class="panel-label">{{ documentT('quotations.document.project') }}</span>
          <strong>{{ projectDisplayName }}</strong>
        </div>
        <dl class="meta-grid">
          <div v-for="item in documentMetaItems" :key="item.key" class="meta-item">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </div>
    </header>

    <section class="intro-band" :aria-label="documentT('quotations.document.partiesAria')">
      <div class="client-panel">
        <span class="panel-label">{{ documentT('quotations.document.preparedFor') }}</span>
        <strong class="panel-value">{{ customerDisplayName }}</strong>
        <div class="panel-details">
          <p v-if="quotation.header.contactPerson" class="panel-detail">{{ quotation.header.contactPerson }}</p>
          <p v-if="quotation.header.contactDetails" class="panel-detail">{{ quotation.header.contactDetails }}</p>
        </div>
      </div>

      <dl class="amount-panel">
        <div class="amount-primary">
          <dt>{{ documentT('quotations.document.grandTotal') }}</dt>
          <dd>{{ formattedGrandTotal }}</dd>
        </div>
        <div class="amount-secondary">
          <div v-for="item in commercialSnapshotItems" :key="item.key" class="snapshot-item">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </div>
      </dl>
    </section>

    <section class="items-section" :aria-label="documentT('quotations.document.itemsAria')">
      <div class="section-heading">
        <span>{{ documentT('quotations.document.scopeLedger') }}</span>
        <strong>{{ projectDisplayName }}</strong>
      </div>
      <QuotationItemsTable
        :quotation="quotation"
        :summaries="summaries"
        :totals="totals"
        :global-markup-rate="globalMarkupRate"
        :exchange-rates="exchangeRates"
        variant="luminous"
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
  --preview-accent: color-mix(in srgb, var(--brand-accent) 35%, #0ea5e9);
  --lum-accent-soft: color-mix(in srgb, var(--preview-accent) 11%, #ffffff);
  --lum-accent-line: color-mix(in srgb, var(--preview-accent) 35%, #c5ddea);
  --lum-ink: #15263c;
  --lum-muted: #5b6f86;
  --lum-soft: #859bb1;
  --lum-line: #d8e8f3;
  --lum-line-strong: #aec8da;
  --lum-paper: #f4faff;
  --lum-panel: #ffffff;
  width: var(--quotation-page-width);
  display: grid;
  grid-template-rows: max-content max-content minmax(0, 1fr) max-content;
  gap: 10px;
  min-height: var(--quotation-page-min-height);
  margin: 0 auto;
  padding: 20px 30px 26px;
  border: 1px solid #dcecf7;
  background:
    radial-gradient(circle at 90% 4%, var(--lum-accent-soft), transparent 30%),
    radial-gradient(circle at 8% 96%, rgb(14 165 233 / 0.05), transparent 26%),
    linear-gradient(180deg, #ffffff 0%, var(--lum-paper) 100%);
  color: var(--lum-ink);
  font-family: Aptos, "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: 12px;
  line-height: 1.38;
}

.document-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 270px;
  gap: 12px;
  align-items: start;
}

.brand-panel,
.quote-hero,
.client-panel,
.amount-panel,
.totals-box {
  border: 1px solid var(--lum-line);
  border-radius: 14px;
  background: rgb(255 255 255 / 0.88);
  box-shadow:
    0 0 0 4px rgb(14 165 233 / 0.035),
    inset 0 1px 0 #ffffff;
}

.brand-panel {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 12px;
  min-width: 0;
  padding: 9px;
  box-shadow:
    inset 5px 0 0 var(--preview-accent),
    inset 0 1px 0 #ffffff,
    0 0 0 4px rgb(14 165 233 / 0.035);
}

.logo-box {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  overflow: hidden;
  padding: 2px;
  border: 1px solid var(--lum-accent-line);
  border-radius: 11px;
  background: var(--lum-accent-soft);
  box-shadow: inset 0 1px 0 #ffffff;
  color: var(--lum-muted);
  font-size: 9px;
  font-weight: 800;
  text-align: center;
  text-transform: uppercase;
}

.logo-image {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: #ffffff;
  object-fit: contain;
  object-position: center;
}

.company-details,
.quote-hero,
.client-panel,
.terms-box {
  display: grid;
  align-content: start;
}

.company-details {
  gap: 3px;
  min-width: 0;
}

.document-label,
.panel-label,
.section-heading span,
.summary-heading,
.amount-primary dt,
.snapshot-item dt,
.meta-item dt {
  margin: 0;
  color: var(--preview-accent);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.company-name,
.company-contact,
.panel-detail,
.terms-copy,
.terms-text,
.totals-box {
  margin: 0;
}

.company-name {
  color: var(--lum-ink);
  font-size: 19px;
  font-weight: 850;
  line-height: 1.04;
  overflow-wrap: anywhere;
}

.company-contact {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 13px;
  color: var(--lum-muted);
  font-size: 11px;
}

.quote-hero {
  gap: 5px;
  padding: 9px;
  background:
    linear-gradient(135deg, #ffffff 0%, var(--lum-accent-soft) 100%);
}

.quotation-number {
  margin: 0;
  color: var(--lum-ink);
  font-size: 23px;
  font-weight: 850;
  line-height: 0.96;
  overflow-wrap: anywhere;
}

.project-reference {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px 10px;
  min-width: 0;
}

.project-reference strong {
  color: var(--lum-ink);
  font-size: 12px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px;
  margin: 0;
}

.meta-item {
  display: grid;
  gap: 2px;
  min-height: 0;
  padding: 3px 5px;
  border: 1px solid var(--lum-line);
  border-radius: 5px;
  background: #ffffff;
  box-shadow: inset 0 1px 0 #ffffff;
}

.meta-item dd {
  margin: 0;
  color: var(--lum-ink);
  font-size: 11px;
  font-weight: 750;
}

.intro-band {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 10px;
}

.client-panel,
.amount-panel {
  padding: 8px 10px;
}

.client-panel {
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  align-items: baseline;
  gap: 4px 12px;
  background:
    linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
}

.panel-value {
  color: var(--lum-ink);
  font-size: 15px;
  font-weight: 850;
  line-height: 1.12;
  overflow-wrap: anywhere;
}

.panel-details {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 10px;
  min-width: 0;
}

.panel-detail + .panel-detail {
  padding-left: 10px;
  border-left: 1px solid var(--lum-line-strong);
}

.panel-detail,
.terms-copy,
.terms-text {
  color: var(--lum-muted);
}

.amount-panel {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  align-items: center;
  gap: 10px;
  margin: 0;
  border-color: var(--lum-accent-line);
  background: #ffffff;
}

.amount-primary {
  display: grid;
  gap: 3px;
  padding-right: 10px;
  border-right: 1px solid var(--lum-line);
}

.amount-primary dd {
  margin: 0;
  color: var(--lum-ink);
  font-size: 21px;
  font-weight: 850;
  line-height: 1;
  text-align: right;
}

.amount-secondary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}

.snapshot-item {
  display: grid;
  gap: 1px;
  justify-items: end;
}

.snapshot-item dt {
  color: var(--lum-muted);
  font-size: 8.5px;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.snapshot-item dd {
  margin: 0;
  color: var(--lum-ink);
  font-weight: 750;
  font-size: 10px;
  white-space: nowrap;
  text-align: right;
}

.items-section {
  display: grid;
  align-content: start;
  gap: 8px;
}

.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  padding: 4px 0 5px;
  border-bottom: 1px solid var(--lum-accent-line);
}

.section-heading strong {
  color: var(--lum-muted);
  font-size: 10.5px;
  font-weight: 750;
  text-align: right;
}

.summary-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 304px;
  gap: 22px;
  align-items: start;
  padding-top: 10px;
  border-top: 1px solid var(--lum-line);
}

.terms-box {
  gap: 8px;
  min-height: 132px;
  padding-top: 12px;
}

.summary-heading {
  color: var(--lum-ink);
}

.terms-text {
  white-space: pre-line;
}

.totals-box {
  display: grid;
  gap: 0;
  padding: 13px 16px 15px;
}

.totals-row,
.grand-total {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 7px 0;
  border-bottom: 1px solid var(--lum-line);
}

.totals-label {
  color: var(--lum-muted);
}

.totals-value {
  margin: 0;
  color: var(--lum-ink);
  font-weight: 750;
  text-align: right;
}

.grand-total {
  align-items: baseline;
  flex-wrap: wrap;
  margin-top: 6px;
  padding-top: 13px;
  border-top: 2px solid var(--preview-accent);
  border-bottom: 0;
}

.grand-total .totals-label,
.grand-total .totals-value {
  color: var(--lum-ink);
  font-size: 18px;
  font-weight: 850;
}

.grand-total .chinese-total-amount {
  flex: 0 0 100%;
  margin: 4px 0 0;
  padding-top: 6px;
  border-top: 1px solid var(--lum-line);
  color: var(--lum-muted);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-align: right;
}

/* Technology consultancy: bright cobalt, optical white, and precise cyan. */
.quotation-document {
  --preview-accent: #11a7ba;
  --lum-accent-soft: #e2f4f6;
  --lum-accent-line: #8ccfd7;
  --lum-ink: #11334c;
  --lum-muted: #587086;
  --lum-soft: #8196a7;
  --lum-line: #d5e2e8;
  --lum-line-strong: #9fb6c1;
  --lum-paper: #f2f8fa;
  --lum-panel: #ffffff;
  border: 0;
  background:
    radial-gradient(circle at 96% 2%, rgb(17 167 186 / 0.14), transparent 28%),
    linear-gradient(180deg, #ffffff 0%, #f4f9fa 100%);
}

.document-header {
  grid-template-columns: minmax(0, 1.08fr) 270px;
  gap: 12px;
}

.brand-panel,
.quote-hero,
.client-panel,
.amount-panel,
.totals-box {
  border-radius: 10px;
}

.brand-panel {
  border-color: #0a5772;
  background: linear-gradient(135deg, #073c5c 0%, #096783 62%, #118fa0 100%);
  box-shadow:
    0 0 0 5px rgb(7 60 92 / 0.055),
    inset 0 1px 0 rgb(255 255 255 / 0.14);
}

.brand-panel .document-label {
  color: #79e0e7;
}

.brand-panel .company-name {
  color: #ffffff;
}

.brand-panel .company-contact {
  color: rgb(235 250 252 / 0.78);
}

.logo-box {
  border-color: rgb(255 255 255 / 0.38);
  border-radius: 7px;
  background: rgb(255 255 255 / 0.92);
  box-shadow:
    0 0 0 4px rgb(255 255 255 / 0.09),
    inset 0 1px 0 #ffffff;
  color: #41667a;
}

.quote-hero {
  border-color: #b8d2dc;
  border-top: 4px solid #11a7ba;
  background: #ffffff;
  box-shadow:
    0 0 0 5px rgb(17 167 186 / 0.04),
    inset 0 1px 0 #ffffff;
}

.quotation-number {
  color: #073c5c;
  letter-spacing: -0.02em;
}

.meta-item {
  border-radius: 5px;
  background: #f4f8fa;
}

.intro-band {
  grid-template-columns: minmax(0, 1fr) 400px;
}

.client-panel {
  border-color: #c9d9df;
  border-left: 5px solid #0b6f8a;
  background: #ffffff;
}

.amount-panel {
  border-color: #8ccfd7;
  background: linear-gradient(120deg, #dff3f5, #f4fbfc);
}

.amount-primary dd {
  color: #073c5c;
}

.section-heading {
  border-bottom: 3px solid #0b6f8a;
}

.section-heading > span {
  color: #0b6f8a;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.terms-box {
  min-height: 0;
  padding: 14px 16px;
  border: 1px solid #d4e2e7;
  border-radius: 10px;
  background: #ffffff;
}

.totals-box {
  border-color: #88bdc8;
  background: #ffffff;
  box-shadow:
    0 0 0 5px rgb(17 167 186 / 0.05),
    inset 0 1px 0 #ffffff;
}

.grand-total {
  border-top-color: #11a7ba;
  background: #e2f4f6;
}

</style>
