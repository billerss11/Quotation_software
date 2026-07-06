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
const isMixedTaxMode = computed(() => props.quotation.totalsConfig.taxMode === 'mixed')
const singleTaxRateLabel = computed(() => {
  const { taxClasses, defaultTaxClassId } = props.quotation.totalsConfig
  const resolved = (taxClasses ?? []).find((tc) => tc.id === defaultTaxClassId) ?? (taxClasses ?? [])[0]
  return resolved ? formatTaxRatePercentage(resolved.rate) : ''
})
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
const documentPageSize = getQuotationDocumentPageSizePx()
const documentStyle = computed(() => ({
  '--preview-accent': props.quotation.branding.accentColor,
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
const companyInitials = computed(() => createCompanyInitials(props.companyProfile.companyName))
const ledgerStamp = computed(() =>
  `${props.quotation.header.quotationNumber} / ${projectDisplayName.value} / ${formattedGrandTotal.value}`,
)
const documentMetaItems = computed(() => [
  {
    key: 'number',
    label: documentT('quotations.document.number'),
    value: props.quotation.header.quotationNumber,
  },
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
    key: 'currency',
    label: documentT('quotations.document.currency'),
    value: props.quotation.header.currency,
  },
])

function createCompanyInitials(companyName: string) {
  const words = companyName
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return 'Q'
  }

  if (words.length === 1) {
    return Array.from(words[0]).slice(0, 2).join('').toUpperCase()
  }

  return words.slice(0, 2).map((word) => Array.from(word)[0]).join('').toUpperCase()
}
</script>

<template>
  <article class="quotation-document quotation-template-technical-bid" :style="documentStyle">
    <header class="document-header">
      <div class="document-header-grid" aria-hidden="true" />
      <div class="company-block">
        <div class="logo-box">
          <img
            v-if="quotation.branding.logoDataUrl"
            class="logo-image"
            :src="quotation.branding.logoDataUrl"
            :alt="documentT('quotations.document.companyLogoAlt')"
          />
          <span v-else class="logo-initials">{{ companyInitials }}</span>
        </div>
        <div class="company-details">
          <p class="company-kicker">{{ documentT('quotations.document.title') }}</p>
          <h2 class="company-name">{{ companyProfile.companyName }}</h2>
          <p class="company-contact">
            <span v-if="companyProfile.email">{{ companyProfile.email }}</span>
            <span v-if="companyProfile.phone">{{ companyProfile.phone }}</span>
          </p>
        </div>
      </div>

      <div class="quotation-title-block">
        <p class="quotation-title-kicker">{{ documentT('quotations.document.documentControl') }}</p>
        <h1 class="quotation-title">{{ quotation.header.quotationNumber }}</h1>
        <dl class="quotation-meta-list">
          <div v-for="item in documentMetaItems" :key="item.key" class="quotation-meta-item">
            <dt class="quotation-meta-label">{{ item.label }}</dt>
            <dd class="quotation-meta-value">{{ item.value }}</dd>
          </div>
        </dl>
      </div>

      <div class="hero-total-card">
        <span class="hero-total-label">{{ documentT('quotations.document.grandTotal') }}</span>
        <strong class="hero-total-value">{{ formattedGrandTotal }}</strong>
        <span class="hero-total-project">{{ projectDisplayName }}</span>
      </div>
    </header>

    <section class="meta-band" :aria-label="documentT('quotations.document.partiesAria')">
      <div class="meta-box meta-box-client">
        <span class="meta-label">{{ documentT('quotations.document.preparedFor') }}</span>
        <strong class="meta-value">{{ customerDisplayName }}</strong>
        <p v-if="quotation.header.contactPerson" class="meta-detail">{{ quotation.header.contactPerson }}</p>
        <p v-if="quotation.header.contactDetails" class="meta-detail">{{ quotation.header.contactDetails }}</p>
      </div>

      <div class="meta-box meta-box-project">
        <span class="meta-label">{{ documentT('quotations.document.project') }}</span>
        <strong class="meta-value">{{ projectDisplayName }}</strong>
      </div>

      <dl class="snapshot-strip" :aria-label="documentT('quotations.document.commercialSnapshot')">
        <div v-for="item in commercialSnapshotItems" :key="item.key" class="snapshot-item">
          <dt class="snapshot-label">{{ item.label }}</dt>
          <dd class="snapshot-value">{{ item.value }}</dd>
        </div>
      </dl>
    </section>

    <section class="items-section" :aria-label="documentT('quotations.document.itemsAria')">
      <div class="ledger-title-block">
        <span class="ledger-kicker">{{ documentT('quotations.document.scopeLedger') }}</span>
        <strong class="ledger-stamp">{{ ledgerStamp }}</strong>
      </div>
      <QuotationItemsTable
        :quotation="quotation"
        :summaries="summaries"
        :totals="totals"
        :global-markup-rate="globalMarkupRate"
        :exchange-rates="exchangeRates"
        variant="technical-bid"
        show-colgroup
        show-ledger-repeat-row
        :ledger-stamp="ledgerStamp"
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

/* Bold technical-bid document skin. Keep these overrides after the legacy rules. */
.quotation-document {
  --preview-accent: var(--accent);
  --bid-ink: #121723;
  --bid-ink-soft: #2b3445;
  --bid-night: #101722;
  --bid-night-2: #172232;
  --bid-copper: #c77736;
  --bid-copper-dark: #8f471e;
  --bid-teal: #00a887;
  --bid-teal-dark: #00755f;
  --bid-cream: #f7efe2;
  --bid-paper: #fbf6ee;
  --bid-paper-2: #efe4d4;
  --bid-line: #d8c9b7;
  --bid-muted: #6b6259;
  width: var(--quotation-page-width);
  display: block;
  min-height: var(--quotation-page-min-height);
  margin: 0 auto;
  padding: 0;
  border: 0;
  background:
    linear-gradient(90deg, rgb(18 23 35 / 0.045) 1px, transparent 1px) 0 0 / 38px 38px,
    linear-gradient(0deg, rgb(18 23 35 / 0.035) 1px, transparent 1px) 0 0 / 38px 38px,
    var(--bid-paper);
  color: var(--bid-ink);
  font-family: Aptos, "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: 12px;
  line-height: 1.36;
}

.document-header {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 292px;
  gap: 20px 26px;
  align-items: stretch;
  overflow: hidden;
  padding: 22px 34px 20px;
  border: 0;
  background:
    linear-gradient(135deg, var(--bid-night) 0%, var(--bid-night-2) 58%, #2a170f 100%);
  color: var(--bid-cream);
}

.document-header::after {
  content: '';
  position: absolute;
  right: -72px;
  bottom: -110px;
  width: 340px;
  height: 220px;
  transform: rotate(-13deg);
  border: 1px solid rgb(247 239 226 / 18%);
  background:
    repeating-linear-gradient(
      90deg,
      rgb(199 119 54 / 0.24) 0,
      rgb(199 119 54 / 0.24) 10px,
      transparent 10px,
      transparent 22px
    );
}

.document-header-grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgb(247 239 226 / 0.05) 1px, transparent 1px) 0 0 / 34px 34px,
    linear-gradient(0deg, rgb(247 239 226 / 0.04) 1px, transparent 1px) 0 0 / 34px 34px;
  opacity: 0.8;
}

.company-block,
.quotation-title-block,
.hero-total-card {
  position: relative;
  z-index: 1;
}

.company-block {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  min-width: 0;
}

.logo-box {
  display: grid;
  width: 92px;
  height: 92px;
  place-items: center;
  padding: 10px;
  border: 1px solid rgb(247 239 226 / 36%);
  background:
    linear-gradient(135deg, var(--bid-cream) 0 48%, #e4b56d 48% 54%, #20140f 54% 100%);
  color: var(--bid-night);
  box-shadow: 10px 10px 0 rgb(0 168 135 / 0.32);
}

.logo-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.logo-initials {
  font-size: 26px;
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: 1;
}

.company-details {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  padding-top: 2px;
}

.company-kicker,
.quotation-title-kicker,
.meta-label,
.ledger-kicker,
.snapshot-label,
.hero-total-label {
  margin: 0;
  color: var(--bid-teal);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.company-name {
  margin: 0;
  max-width: 420px;
  color: var(--bid-cream);
  font-size: 25px;
  font-weight: 900;
  line-height: 0.96;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.company-contact {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 13px;
  margin: 0;
  color: rgb(247 239 226 / 76%);
  font-size: 10.5px;
}

.quotation-title-block {
  display: grid;
  justify-items: stretch;
  gap: 10px;
  text-align: right;
}

.quotation-title {
  margin: 0;
  color: #ffffff;
  font-size: 37px;
  font-weight: 900;
  line-height: 0.9;
  letter-spacing: 0.01em;
}

.quotation-meta-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
  margin: 0;
}

.quotation-meta-item {
  display: grid;
  gap: 2px;
  align-content: start;
  min-height: 36px;
  padding: 6px 8px;
  border: 1px solid rgb(247 239 226 / 16%);
  background: rgb(255 255 255 / 0.055);
}

.quotation-meta-item:first-child {
  grid-column: 1 / -1;
}

.quotation-meta-label,
.totals-label {
  color: rgb(247 239 226 / 62%);
  font-size: 8.8px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.quotation-meta-value,
.totals-value {
  margin: 0;
  color: var(--bid-cream);
  font-size: 12.5px;
  font-weight: 900;
}

.hero-total-card {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 3px 18px;
  align-items: end;
  margin-top: 3px;
  padding: 12px 18px;
  border-left: 7px solid var(--bid-teal);
  background:
    linear-gradient(90deg, var(--bid-copper) 0%, #df9a4d 48%, #f1c982 100%);
  color: #180f0a;
}

.hero-total-label {
  color: #2b1609;
}

.hero-total-value {
  grid-row: 1 / 3;
  grid-column: 2;
  align-self: center;
  font-size: 31px;
  font-weight: 950;
  letter-spacing: -0.01em;
  line-height: 0.95;
}

.hero-total-project {
  color: rgb(24 15 10 / 76%);
  font-size: 14px;
  font-weight: 800;
}

.meta-band {
  display: grid;
  grid-template-columns: 1fr 1fr 0.82fr;
  gap: 12px;
  padding: 14px 34px 14px;
  border: 0;
  background: linear-gradient(90deg, #efe0cc 0%, #f8eee0 100%);
}

.meta-box,
.snapshot-strip {
  min-height: 0;
  padding: 11px 13px;
  border: 1px solid var(--bid-line);
  background: rgb(251 246 238 / 86%);
}

.meta-box {
  display: grid;
  align-content: start;
  gap: 5px;
}

.meta-box-client {
  border-left: 6px solid var(--bid-copper);
}

.meta-box-project {
  border-left: 6px solid var(--bid-teal);
}

.meta-value {
  color: var(--bid-ink);
  font-size: 17px;
  font-weight: 900;
  line-height: 1.1;
}

.meta-detail,
.terms-copy,
.terms-text {
  margin: 0;
  color: var(--bid-muted);
}

.snapshot-strip {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
  margin: 0;
  padding: 0;
  border-color: var(--bid-night);
  background: var(--bid-night);
}

.snapshot-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  min-height: 27px;
  padding: 8px 10px;
  border-right: 0;
  border-bottom: 1px solid rgb(247 239 226 / 13%);
}

.snapshot-item:last-child {
  border-bottom: 0;
}

.snapshot-label {
  color: var(--bid-copper);
}

.snapshot-value {
  margin: 0;
  color: var(--bid-cream);
  font-size: 11.5px;
  font-weight: 900;
  line-height: 1.08;
}

.items-section {
  padding: 14px 34px 22px;
}

.ledger-title-block {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 10px;
  padding-bottom: 9px;
  border-bottom: 4px solid var(--bid-night);
}

.ledger-kicker {
  color: var(--bid-copper-dark);
}

.ledger-stamp {
  color: var(--bid-ink-soft);
  font-size: 11px;
  font-weight: 900;
  text-align: right;
}

.summary-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 306px;
  gap: 18px;
  align-items: stretch;
  padding: 18px 34px 20px;
  border: 0;
  background: #e9dccb;
}

.terms-box {
  display: grid;
  gap: 8px;
  align-content: start;
  padding: 17px 18px;
  border: 1px solid var(--bid-line);
  background: #fffaf3;
}

.summary-heading {
  margin: 0;
  color: var(--bid-copper-dark);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.terms-text {
  white-space: pre-line;
}

.totals-box {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-top: 0;
  background: var(--bid-night);
}

.totals-row,
.grand-total {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  padding: 10px 14px;
  border-bottom: 1px solid rgb(247 239 226 / 14%);
}

.totals-row .totals-label,
.grand-total .totals-label {
  color: rgb(247 239 226 / 62%);
}

.totals-row .totals-value,
.grand-total .totals-value {
  color: var(--bid-cream);
}

.grand-total {
  align-items: baseline;
  margin-top: 0;
  padding: 16px 14px;
  border-top: 5px solid var(--bid-copper);
  border-bottom: 0;
  background: linear-gradient(90deg, #111722, #23170f);
}

.grand-total .totals-label,
.grand-total .totals-value {
  color: #ffffff;
  font-size: 20px;
  font-weight: 950;
}

.document-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 28px;
  margin: 0;
  padding: 18px 34px 30px;
  border: 0;
  background: var(--bid-night);
}

.signature-line {
  padding-top: 10px;
  border-top: 1px solid rgb(247 239 226 / 42%);
  color: rgb(247 239 226 / 78%);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
</style>


