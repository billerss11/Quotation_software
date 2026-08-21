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
  <article class="quotation-document quotation-template-technical-bid">
    <header class="document-header">
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
          <h2
            class="company-name"
            :class="{
              'company-name-long': companyProfile.companyName.length >= 36,
              'company-name-extra-long': companyProfile.companyName.length >= 60,
            }"
          >{{ companyProfile.companyName }}</h2>
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
        <strong
          class="hero-total-value"
          :class="{
            'hero-total-value-long': formattedGrandTotal.length >= 16,
            'hero-total-value-extra-long': formattedGrandTotal.length >= 20,
          }"
        >{{ formattedGrandTotal }}</strong>
        <span class="hero-total-project">{{ projectDisplayName }}</span>
      </div>
    </header>

    <section class="meta-band" :aria-label="documentT('quotations.document.partiesAria')">
      <div class="meta-box meta-box-client">
        <span class="meta-label">{{ documentT('quotations.document.preparedFor') }}</span>
        <strong class="meta-value">{{ customerDisplayName }}</strong>
        <div class="meta-details">
          <p v-if="quotation.header.contactPerson" class="meta-detail">{{ quotation.header.contactPerson }}</p>
          <p v-if="quotation.header.contactDetails" class="meta-detail">{{ quotation.header.contactDetails }}</p>
        </div>
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
  --preview-accent: color-mix(in srgb, var(--brand-accent) 28%, #0dc6a2);
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

/* Bold technical-bid document skin. Keep these overrides after the legacy rules. */
.quotation-document {
  --preview-accent: color-mix(in srgb, var(--brand-accent) 28%, #0dc6a2);
  --bid-ink: #121723;
  --bid-ink-soft: #2b3445;
  --bid-night: #3c5368;
  --bid-night-2: #536d83;
  --bid-copper: #d88943;
  --bid-copper-dark: #9a4f22;
  --bid-teal: #0dc6a2;
  --bid-teal-dark: #07816d;
  --bid-cream: #fff4e5;
  --bid-paper: #fbf3e8;
  --bid-paper-2: #eee0cf;
  --bid-line: #d9c6b0;
  --bid-muted: #6d6157;
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
  grid-template-columns: minmax(0, 1fr) 250px 180px;
  gap: 14px;
  align-items: stretch;
  overflow: hidden;
  padding: 13px 30px 12px;
  border: 0;
  background:
    linear-gradient(135deg, var(--bid-night) 0%, var(--bid-night-2) 58%, #79523e 100%);
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

.company-block,
.quotation-title-block,
.hero-total-card {
  position: relative;
  z-index: 1;
}

.company-block {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  min-width: 0;
}

.logo-box {
  display: grid;
  width: 62px;
  height: 62px;
  place-items: center;
  overflow: hidden;
  padding: 2px;
  border: 1px solid rgb(247 239 226 / 36%);
  background:
    linear-gradient(135deg, var(--bid-cream) 0 48%, #e4b56d 48% 54%, #684b3b 54% 100%);
  color: var(--bid-night);
  box-shadow:
    0 0 0 5px rgb(247 239 226 / 0.08),
    8px 8px 0 rgb(13 198 162 / 0.2),
    inset 0 1px 0 rgb(255 255 255 / 0.42);
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

.logo-initials {
  font-size: 26px;
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: 1;
}

.company-details {
  display: grid;
  align-content: start;
  gap: 4px;
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
  min-width: 0;
  max-width: 100%;
  color: var(--bid-cream);
  font-size: 20px;
  font-weight: 900;
  line-height: 0.96;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.company-name-long {
  font-size: 17px;
  line-height: 1;
}

.company-name-extra-long {
  width: 190px;
  max-width: 100%;
  font-size: 14px;
  line-height: 1.03;
  letter-spacing: -0.01em;
  word-break: break-word;
}

.company-contact {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 13px;
  min-width: 0;
  margin: 0;
  color: rgb(247 239 226 / 76%);
  font-size: 10.5px;
}

.company-contact span {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.quotation-title-block {
  display: grid;
  justify-items: stretch;
  gap: 6px;
  text-align: right;
}

.quotation-title {
  margin: 0;
  min-width: 0;
  color: #ffffff;
  font-size: 26px;
  font-weight: 900;
  line-height: 0.9;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
}

.quotation-meta-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  width: 100%;
  margin: 0;
}

.quotation-meta-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1px;
  align-content: start;
  min-width: 0;
  min-height: 26px;
  padding: 3px 6px;
  border: 1px solid rgb(247 239 226 / 16%);
  background: rgb(255 255 255 / 0.055);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.07);
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

.quotation-meta-value {
  min-width: 0;
  overflow-wrap: anywhere;
}

.totals-value {
  flex: 0 0 auto;
  white-space: nowrap;
}

.hero-total-card {
  grid-row: 1;
  grid-column: 3;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  align-items: start;
  gap: 4px;
  min-width: 0;
  margin-top: 0;
  padding: 7px 12px;
  border-left: 6px solid var(--bid-teal);
  background:
    linear-gradient(90deg, var(--bid-copper) 0%, #e9a958 48%, #f4cf88 100%);
  box-shadow:
    0 0 0 5px rgb(216 137 67 / 0.1),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
  color: #180f0a;
}

.hero-total-label {
  color: #2b1609;
}

.hero-total-value {
  grid-row: auto;
  grid-column: auto;
  align-self: auto;
  font-size: 20px;
  font-weight: 950;
  letter-spacing: -0.01em;
  line-height: 0.95;
  white-space: nowrap;
}

.hero-total-value-long {
  font-size: 16px;
}

.hero-total-value-extra-long {
  font-size: 13px;
}

.hero-total-project {
  color: rgb(24 15 10 / 76%);
  font-size: 12px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.meta-band {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 10px;
  padding: 7px 30px;
  border: 0;
  background: linear-gradient(90deg, #efe0cc 0%, #f8eee0 100%);
}

.meta-box,
.snapshot-strip {
  min-height: 0;
  padding: 6px 9px;
  border: 1px solid var(--bid-line);
  background: rgb(251 246 238 / 86%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.5);
}

.meta-box {
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  align-items: baseline;
  gap: 4px 12px;
}

.meta-box-client {
  border-left: 6px solid var(--bid-copper);
}

.meta-value {
  color: var(--bid-ink);
  font-size: 17px;
  font-weight: 900;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.meta-details {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 10px;
  min-width: 0;
}

.meta-detail + .meta-detail {
  padding-left: 10px;
  border-left: 1px solid var(--bid-line);
}

.meta-detail,
.terms-copy,
.terms-text {
  margin: 0;
  color: var(--bid-muted);
}

.snapshot-strip {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) repeat(2, minmax(0, 0.8fr));
  gap: 0;
  margin: 0;
  padding: 0;
  border-color: var(--bid-night);
  background: var(--bid-night);
}

.snapshot-item {
  display: grid;
  align-content: center;
  gap: 3px;
  min-width: 0;
  padding: 6px 8px;
  border-right: 1px solid rgb(247 239 226 / 13%);
}

.snapshot-item:last-child {
  border-right: 0;
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
  overflow-wrap: anywhere;
}

.items-section {
  padding: 10px 30px 18px;
}

.ledger-title-block {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 3px solid var(--bid-night);
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
  box-shadow:
    0 0 0 5px rgb(255 250 243 / 0.34),
    inset 0 1px 0 #ffffff;
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
  box-shadow:
    0 0 0 5px rgb(16 23 34 / 0.07),
    inset 0 1px 0 rgb(255 255 255 / 0.06);
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
  flex-wrap: wrap;
  margin-top: 0;
  padding: 16px 14px;
  border-top: 5px solid var(--bid-copper);
  border-bottom: 0;
  background: linear-gradient(90deg, #40596f, #76513e);
}

.grand-total .totals-label,
.grand-total .totals-value {
  color: #ffffff;
  font-size: 20px;
  font-weight: 950;
}

.grand-total .chinese-total-amount {
  flex: 0 0 100%;
  margin: 4px 0 0;
  padding-top: 7px;
  border-top: 1px solid rgb(247 239 226 / 24%);
  color: rgb(247 239 226 / 78%);
  font-size: 11px;
  font-weight: 750;
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-align: right;
}

/* Engineering blueprint: technical, light, and specification-led. */
.quotation-document {
  --preview-accent: #2f718a;
  --bid-ink: #173246;
  --bid-ink-soft: #3f5666;
  --bid-night: #294c61;
  --bid-night-2: #dce8ec;
  --bid-copper: #c2773f;
  --bid-copper-dark: #8b4d2f;
  --bid-teal: #167e83;
  --bid-teal-dark: #0f6268;
  --bid-cream: #fffdf9;
  --bid-paper: #f3f7f8;
  --bid-paper-2: #e6eef1;
  --bid-line: #bccbd1;
  --bid-muted: #5c6f7a;
  background:
    linear-gradient(90deg, rgb(31 78 99 / 0.045) 1px, transparent 1px) 0 0 / 28px 28px,
    linear-gradient(0deg, rgb(31 78 99 / 0.035) 1px, transparent 1px) 0 0 / 28px 28px,
    #f5f8f8;
}

.document-header {
  border-bottom: 1px solid #a9bcc4;
  border-left: 9px solid var(--bid-copper);
  background:
    linear-gradient(120deg, #eef4f5 0 62%, #dce8ec 62% 82%, #f0dfd2 82% 100%);
  color: var(--bid-ink);
}

.document-header::after {
  border-color: rgb(139 77 47 / 0.18);
  background: repeating-linear-gradient(
    90deg,
    rgb(194 119 63 / 0.18) 0,
    rgb(194 119 63 / 0.18) 10px,
    transparent 10px,
    transparent 22px
  );
}

.logo-box {
  border-color: #87a2ad;
  background: linear-gradient(135deg, #ffffff 0 48%, #d8a069 48% 54%, #547080 54% 100%);
  color: var(--bid-ink);
  box-shadow:
    0 0 0 5px rgb(41 76 97 / 0.06),
    8px 8px 0 rgb(194 119 63 / 0.14),
    inset 0 1px 0 #ffffff;
}

.company-name,
.quotation-title,
.quotation-meta-value {
  color: var(--bid-ink);
}

.company-contact {
  color: var(--bid-muted);
}

.company-kicker,
.quotation-title-kicker,
.meta-label,
.ledger-kicker,
.snapshot-label,
.hero-total-label {
  color: var(--bid-teal-dark);
}

.quotation-meta-item {
  border-color: rgb(41 76 97 / 0.18);
  background: rgb(255 255 255 / 0.66);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.82);
}

.quotation-meta-label {
  color: #5d727c;
}

.hero-total-card {
  border-left-color: var(--bid-teal);
  background: linear-gradient(90deg, #efd0aa 0%, #f4ddbd 56%, #f8e9d4 100%);
  box-shadow:
    0 0 0 5px rgb(194 119 63 / 0.07),
    inset 0 1px 0 #ffffff;
}

.meta-band {
  border-bottom: 1px solid var(--bid-line);
  background: #ffffff;
}

.meta-box,
.snapshot-strip {
  border-color: var(--bid-line);
  background: #f7fafb;
  box-shadow: inset 0 1px 0 #ffffff;
}

.snapshot-item {
  border-right-color: var(--bid-line);
}

.snapshot-label {
  color: var(--bid-copper-dark);
}

.snapshot-value {
  color: var(--bid-ink);
}

.ledger-title-block {
  border-bottom-color: var(--bid-copper);
}

.summary-section {
  background: #e8eff1;
}

.terms-box,
.totals-box {
  border: 1px solid #b9c8ce;
  background: #ffffff;
  box-shadow:
    0 0 0 5px rgb(41 76 97 / 0.04),
    inset 0 1px 0 #ffffff;
}

.totals-row,
.grand-total {
  border-bottom-color: #c9d5d9;
}

.totals-row .totals-label,
.grand-total .totals-label {
  color: var(--bid-muted);
}

.totals-row .totals-value,
.grand-total .totals-value {
  color: var(--bid-ink);
}

.grand-total {
  border-top-color: var(--bid-copper);
  background: linear-gradient(90deg, #dce8ec, #efdfd3);
}

.grand-total .chinese-total-amount {
  border-top-color: #bdcbd0;
  color: var(--bid-muted);
}

/* Tender schedule: engineering title blocks, revision cells, and square specification geometry. */
.quotation-document {
  --preview-accent: #b86432;
  --bid-ink: #132735;
  --bid-ink-soft: #40535f;
  --bid-night: #294c61;
  --bid-night-2: #dfe9ed;
  --bid-copper: #b86432;
  --bid-copper-dark: #8d4727;
  --bid-teal: #2f718a;
  --bid-teal-dark: #295e70;
  --bid-cream: #ffffff;
  --bid-paper: #ffffff;
  --bid-paper-2: #edf3f5;
  --bid-line: #b9c7cd;
  --bid-muted: #5c6d76;
  --preview-ink: var(--bid-ink);
  --preview-muted: var(--bid-muted);
  --preview-soft: #83929a;
  --preview-line: #d6e0e4;
  --preview-line-strong: var(--bid-line);
  --preview-surface: #f5f8f9;
  --preview-surface-strong: var(--bid-paper-2);
  --preview-accent-soft: #f3e7e1;
  background: #ffffff;
  color: var(--bid-ink);
  font-family: "Segoe UI", Arial, "Noto Sans SC", sans-serif;
  font-size: 11px;
  line-height: 1.38;
}

.quotation-document *,
.quotation-document *::before,
.quotation-document *::after {
  border-radius: 0 !important;
  background-image: none !important;
  box-shadow: none !important;
  filter: none !important;
  text-shadow: none !important;
}

.document-header {
  grid-template-columns: minmax(0, 1fr) 250px 180px;
  gap: 14px;
  overflow: visible;
  padding: 13px 30px 12px;
  border: 0;
  border-bottom: 1px solid var(--bid-line);
  border-left: 9px solid var(--bid-copper);
  background: #f1f5f6;
  color: var(--bid-ink);
}

.document-header::after {
  content: none;
}

.company-block,
.quotation-title-block,
.hero-total-card {
  position: static;
}

.logo-box {
  border: 1px solid #7f98a3;
  background: #ffffff;
  color: var(--bid-ink);
}

.company-kicker,
.quotation-title-kicker,
.meta-label,
.ledger-kicker,
.snapshot-label,
.hero-total-label {
  color: var(--bid-teal-dark);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.company-name {
  color: var(--bid-ink);
  font-size: 19px;
  font-weight: 700;
}

.company-name-long {
  font-size: 16px;
}

.company-name-extra-long {
  font-size: 13px;
  letter-spacing: normal;
}

.company-contact {
  color: var(--bid-muted);
  font-size: 10px;
}

.quotation-title {
  color: var(--bid-ink);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: normal;
}

.quotation-meta-item {
  padding: 4px 0;
  border: 0;
  border-top: 1px solid var(--bid-line);
  background: #f1f5f6;
}

.quotation-meta-label,
.totals-label {
  color: var(--bid-muted);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.quotation-meta-value,
.totals-value {
  color: var(--bid-ink);
  font-size: 12px;
  font-weight: 700;
}

.hero-total-card {
  padding: 8px 12px;
  border: 1px solid #d6b6a5;
  border-left: 6px solid var(--bid-copper);
  background: #f3e7e1;
  color: var(--bid-ink);
}

.hero-total-label,
.hero-total-project {
  color: var(--bid-muted);
}

.hero-total-value {
  color: var(--bid-ink);
  font-size: 19px;
  font-weight: 700;
  letter-spacing: normal;
}

.hero-total-value-long {
  font-size: 15px;
}

.hero-total-value-extra-long {
  font-size: 12px;
}

.meta-band {
  gap: 10px;
  padding: 7px 30px;
  border-bottom: 1px solid var(--bid-line);
  background: #ffffff;
}

.meta-box,
.snapshot-strip {
  padding: 6px 9px;
  border: 1px solid var(--bid-line);
  background: #ffffff;
}

.meta-box-client {
  border-left: 6px solid var(--bid-copper);
}

.meta-value {
  font-size: 15px;
  font-weight: 700;
}

.snapshot-strip {
  border-color: var(--bid-line);
  background: var(--bid-paper-2);
}

.snapshot-item {
  border-right-color: var(--bid-line);
}

.snapshot-label {
  color: var(--bid-copper-dark);
}

.snapshot-value {
  color: var(--bid-ink);
  font-size: 11px;
  font-weight: 700;
}

.ledger-title-block {
  border-bottom: 3px solid var(--bid-night);
}

.ledger-kicker {
  color: var(--bid-copper-dark);
}

.ledger-stamp {
  font-weight: 700;
}

.summary-section {
  grid-template-columns: minmax(0, 1fr) 306px;
  gap: 18px;
  padding: 16px 30px 20px;
  background: #f1f5f6;
}

.terms-box,
.totals-box {
  border: 1px solid var(--bid-line);
  background: #ffffff;
}

.summary-heading {
  color: var(--bid-copper-dark);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.totals-row,
.grand-total {
  border-bottom-color: #d6e0e4;
}

.totals-row .totals-label,
.grand-total .totals-label {
  color: var(--bid-muted);
}

.totals-row .totals-value,
.grand-total .totals-value {
  color: var(--bid-ink);
}

.grand-total {
  padding: 13px 14px;
  border-top: 4px solid var(--bid-copper);
  background: #e4ecef;
}

.grand-total .totals-label,
.grand-total .totals-value {
  color: var(--bid-ink);
  font-size: 18px;
  font-weight: 700;
}

.grand-total .chinese-total-amount {
  border-top-color: var(--bid-line);
  color: var(--bid-muted);
  font-size: 10px;
  font-weight: 700;
}

</style>
