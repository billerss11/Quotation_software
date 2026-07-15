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
const companyInitials = computed(() => createCompanyInitials(props.companyProfile.companyName))
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
    key: 'total',
    label: documentT('quotations.document.grandTotal'),
    value: formattedGrandTotal.value,
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
  <article class="quotation-document quotation-template-signal" :style="documentStyle">
    <header class="document-header">
      <div class="ribbon-mark">
        <div class="mark-logo">
          <img
            v-if="quotation.branding.logoDataUrl"
            class="logo-image"
            :src="quotation.branding.logoDataUrl"
            :alt="documentT('quotations.document.companyLogoAlt')"
        />
          <span v-else class="mark-initials">{{ companyInitials }}</span>
        </div>
        <span class="ribbon-label">{{ documentT('quotations.document.title') }}</span>
      </div>

      <section class="company-block" :aria-label="documentT('quotations.document.documentControl')">
        <p class="document-kicker">{{ documentT('quotations.document.documentControl') }}</p>
        <h1 class="company-name">{{ companyProfile.companyName }}</h1>
        <p class="company-contact">
          <span v-if="companyProfile.email">{{ companyProfile.email }}</span>
          <span v-if="companyProfile.phone">{{ companyProfile.phone }}</span>
        </p>
        <div class="project-reference">
          <span class="block-label">{{ documentT('quotations.document.project') }}</span>
          <strong>{{ projectDisplayName }}</strong>
        </div>
      </section>

      <dl class="meta-board">
        <div v-for="item in documentMetaItems" :key="item.key" class="meta-item">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </header>

    <section class="client-strip" :aria-label="documentT('quotations.document.partiesAria')">
      <div class="client-block">
        <span class="block-label">{{ documentT('quotations.document.preparedFor') }}</span>
        <strong>{{ customerDisplayName }}</strong>
        <div class="client-details">
          <p v-if="quotation.header.contactPerson">{{ quotation.header.contactPerson }}</p>
          <p v-if="quotation.header.contactDetails">{{ quotation.header.contactDetails }}</p>
        </div>
      </div>

      <dl class="amount-block">
        <div v-for="item in commercialSnapshotItems" :key="item.key" class="amount-row">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </section>

    <section class="items-section" :aria-label="documentT('quotations.document.itemsAria')">
      <div class="section-strip">
        <span>{{ documentT('quotations.document.scopeLedger') }}</span>
        <strong>{{ projectDisplayName }}</strong>
      </div>
      <QuotationItemsTable
        :quotation="quotation"
        :summaries="summaries"
        :totals="totals"
        :global-markup-rate="globalMarkupRate"
        :exchange-rates="exchangeRates"
        variant="signal"
        show-colgroup
        hide-top-level-group-detail
      />
    </section>

    <section class="summary-section" :aria-label="documentT('quotations.document.summaryAria')">
      <div class="terms-panel">
        <h2>{{ documentT('quotations.document.notesTerms') }}</h2>
        <p v-if="quotation.header.notes || !quotation.header.terms">
          {{
            quotation.header.notes ||
            documentT('quotations.document.defaultTerms')
          }}
        </p>
        <p v-if="quotation.header.terms" class="terms-text">{{ quotation.header.terms }}</p>
      </div>

      <dl class="totals-board">
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
        <div class="grand-total">
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
  --preview-accent: color-mix(in srgb, var(--brand-accent) 35%, #d85645);
  --signal-ink: #191817;
  --signal-paper: #f7f4ef;
  --signal-panel: #ffffff;
  --signal-line: #ddd5cb;
  --signal-line-strong: #a89c90;
  --signal-muted: #665f58;
  --signal-soft: #8e857d;
  --signal-accent: var(--preview-accent);
  --signal-accent-soft: color-mix(in srgb, var(--signal-accent) 11%, #ffffff);
  width: var(--quotation-page-width);
  display: grid;
  grid-template-rows: max-content max-content minmax(0, 1fr) max-content;
  gap: 14px;
  min-height: var(--quotation-page-min-height);
  margin: 0 auto;
  padding: 28px 34px 30px;
  border: 1px solid #ded6cc;
  background:
    linear-gradient(90deg, rgb(21 24 28 / 0.035) 1px, transparent 1px) 0 0 / 24px 24px,
    var(--signal-paper);
  color: var(--signal-ink);
  font-family: Aptos, "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: 11.5px;
  line-height: 1.35;
}

.document-header {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) 240px;
  gap: 14px;
  align-items: stretch;
}

.ribbon-mark,
.company-block,
.meta-board,
.client-block,
.amount-block,
.terms-panel,
.totals-board {
  border: 1px solid var(--signal-line-strong);
  background: var(--signal-panel);
}

.ribbon-mark {
  display: grid;
  grid-template-rows: 62px 1fr;
  gap: 12px;
  padding: 10px;
  background: var(--signal-ink);
  color: #ffffff;
}

.mark-logo {
  display: grid;
  place-items: center;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 0.45);
  background: #ffffff;
  color: var(--signal-ink);
  font-size: 18px;
  font-weight: 900;
  line-height: 1;
  text-align: center;
}

.logo-image {
  display: block;
  width: calc(100% - 4px);
  height: calc(100% - 4px);
  max-width: 100%;
  max-height: 100%;
  background: #ffffff;
  object-fit: contain;
  object-position: center;
}

.ribbon-label {
  align-self: end;
  color: #ffffff;
  font-size: 9px;
  font-weight: 850;
  line-height: 1.12;
  text-transform: uppercase;
}

.company-block {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  padding: 17px 18px 18px;
  border-bottom: 6px solid var(--signal-accent);
}

.document-kicker,
.block-label,
.section-strip span,
.meta-item dt,
.amount-row dt,
.totals-row dt,
.grand-total dt {
  margin: 0;
  color: var(--signal-muted);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 0;
  text-transform: uppercase;
}

.document-kicker {
  color: var(--signal-accent);
}

.company-name {
  margin: 0;
  color: var(--signal-ink);
  font-size: 25px;
  font-weight: 850;
  line-height: 1.04;
  overflow-wrap: anywhere;
}

.company-contact,
.client-block p,
.terms-panel p {
  margin: 0;
  color: var(--signal-muted);
}

.company-contact {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 13px;
  font-size: 10.8px;
  font-weight: 650;
}

.project-reference {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px 10px;
  padding-top: 7px;
  border-top: 1px solid var(--signal-line);
  min-width: 0;
}

.project-reference strong {
  color: var(--signal-ink);
  font-size: 12.5px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.meta-board {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  margin: 0;
}

.meta-item {
  display: grid;
  align-content: center;
  gap: 3px;
  min-height: 48px;
  padding: 8px 9px;
  border-right: 1px solid var(--signal-line);
  border-bottom: 1px solid var(--signal-line);
}

.meta-item:first-child {
  grid-column: 1 / -1;
}

.meta-item:nth-child(3),
.meta-item:nth-child(5) {
  border-right: 0;
}

.meta-item:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.meta-item dd {
  margin: 0;
  color: var(--signal-ink);
  font-size: 11.4px;
  font-weight: 750;
  overflow-wrap: anywhere;
}

.client-strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 10px;
}

.client-block {
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  align-items: baseline;
  gap: 4px 12px;
  min-width: 0;
  padding: 10px 12px;
  border-left: 5px solid var(--signal-accent);
}

.client-block strong {
  color: var(--signal-ink);
  font-size: 16.5px;
  font-weight: 850;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.client-details {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 10px;
  min-width: 0;
}

.client-details p + p {
  padding-left: 10px;
  border-left: 1px solid var(--signal-line);
}

.amount-block {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin: 0;
}

.amount-row {
  display: grid;
  align-content: center;
  gap: 3px;
  min-width: 0;
  padding: 9px 10px;
  border-right: 1px solid var(--signal-line);
}

.amount-row:last-child {
  border-right: 0;
}

.amount-row dd {
  margin: 0;
  color: var(--signal-ink);
  font-weight: 800;
  overflow-wrap: anywhere;
}

.items-section {
  display: grid;
  gap: 8px;
}

.section-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 30px;
  padding: 7px 10px;
  border: 1px solid var(--signal-ink);
  background: var(--signal-ink);
}

.section-strip span {
  color: #ffffff;
}

.section-strip strong {
  color: #ffffff;
  font-size: 10.5px;
  font-weight: 750;
  text-align: right;
  overflow-wrap: anywhere;
}

.summary-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 286px;
  gap: 14px;
  align-items: start;
}

.terms-panel {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 118px;
  padding: 13px 14px;
}

.terms-panel h2 {
  margin: 0;
  color: var(--signal-ink);
  font-size: 12px;
  font-weight: 850;
  text-transform: uppercase;
}

.terms-text {
  white-space: pre-line;
}

.totals-board {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
}

.totals-row,
.grand-total {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--signal-line);
}

.totals-row dd,
.grand-total dd {
  margin: 0;
  color: var(--signal-ink);
  font-weight: 750;
  text-align: right;
}

.grand-total {
  align-items: baseline;
  flex-wrap: wrap;
  border-bottom: 0;
  background: var(--signal-accent-soft);
}

.grand-total dt,
.grand-total dd {
  color: var(--signal-ink);
  font-size: 16px;
  font-weight: 850;
}

.grand-total .chinese-total-amount {
  flex: 0 0 100%;
  margin: 4px 0 0;
  padding-top: 6px;
  border-top: 1px solid var(--signal-line);
  color: var(--signal-muted);
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-align: right;
}

</style>
