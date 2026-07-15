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
const companyInitials = computed(() => createCompanyInitials(props.companyProfile.companyName))
const formattedGrandTotal = computed(() =>
  formatCurrency(props.totals.grandTotal, props.quotation.header.currency, currentDocumentLocale.value),
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

function createCompanyInitials(companyName: string) {
  const words = companyName
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 'Q'
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase()

  return words.slice(0, 2).map((word) => Array.from(word)[0]).join('').toUpperCase()
}
</script>

<template>
  <article class="quotation-document quotation-template-atelier" :style="documentStyle">
    <header class="atelier-header">
      <div class="brand-shell">
        <div class="brand-core">
          <img
            v-if="quotation.branding.logoDataUrl"
            class="brand-logo"
            :src="quotation.branding.logoDataUrl"
            :alt="documentT('quotations.document.companyLogoAlt')"
          />
          <span v-else class="brand-initials">{{ companyInitials }}</span>
        </div>
      </div>

      <div class="masthead">
        <p class="eyebrow">{{ documentT('quotations.document.title') }}</p>
        <h1 class="company-name">{{ companyProfile.companyName }}</h1>
        <p class="company-contact">
          <span v-if="companyProfile.email">{{ companyProfile.email }}</span>
          <span v-if="companyProfile.phone">{{ companyProfile.phone }}</span>
        </p>
      </div>

      <div class="document-number">
        <span>{{ documentT('quotations.document.number') }}</span>
        <strong>{{ quotation.header.quotationNumber }}</strong>
      </div>
    </header>

    <section class="hero-panel" :aria-label="documentT('quotations.document.documentControl')">
      <div class="hero-copy">
        <span class="eyebrow">{{ documentT('quotations.document.project') }}</span>
        <h2>{{ projectDisplayName }}</h2>
      </div>
      <div class="hero-total">
        <span>{{ documentT('quotations.document.grandTotal') }}</span>
        <strong>{{ formattedGrandTotal }}</strong>
      </div>
    </section>

    <section class="parties-panel" :aria-label="documentT('quotations.document.partiesAria')">
      <div class="recipient-block">
        <span class="eyebrow">{{ documentT('quotations.document.preparedFor') }}</span>
        <strong>{{ customerDisplayName }}</strong>
        <p v-if="quotation.header.contactPerson">{{ quotation.header.contactPerson }}</p>
        <p v-if="quotation.header.contactDetails">{{ quotation.header.contactDetails }}</p>
      </div>

      <dl class="meta-list">
        <div v-for="item in documentMetaItems" :key="item.key" class="meta-row">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </section>

    <section class="items-section" :aria-label="documentT('quotations.document.itemsAria')">
      <div class="section-heading">
        <span>{{ documentT('quotations.document.scopeLedger') }}</span>
        <i aria-hidden="true" />
      </div>
      <QuotationItemsTable
        :quotation="quotation"
        :summaries="summaries"
        :totals="totals"
        :global-markup-rate="globalMarkupRate"
        :exchange-rates="exchangeRates"
        variant="atelier"
        show-colgroup
        hide-top-level-group-detail
      />
    </section>

    <section class="closing-grid" :aria-label="documentT('quotations.document.summaryAria')">
      <div class="notes-panel">
        <span class="eyebrow">{{ documentT('quotations.document.notesTerms') }}</span>
        <p v-if="quotation.header.notes || !quotation.header.terms">
          {{ quotation.header.notes || documentT('quotations.document.defaultTerms') }}
        </p>
        <p v-if="quotation.header.terms" class="terms-text">{{ quotation.header.terms }}</p>
      </div>

      <dl class="totals-panel">
        <div class="total-row">
          <dt>{{ documentT('quotations.document.subtotal') }}</dt>
          <dd>{{ formatCurrency(totals.subtotalAfterMarkup, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div v-if="!isMixedTaxMode && totals.taxAmount > 0" class="total-row">
          <dt>{{ documentT('quotations.document.taxWithRate', { rate: singleTaxRateLabel }) }}</dt>
          <dd>{{ formatCurrency(totals.taxAmount, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div v-for="bucket in visibleTaxBuckets" :key="bucket.taxClassId" class="total-row">
          <dt>{{ documentT('quotations.document.taxBucket', { label: bucket.label }) }}</dt>
          <dd>{{ formatCurrency(bucket.taxAmount, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div v-for="charge in visibleExtraCharges" :key="charge.id" class="total-row">
          <dt>{{ charge.label || documentT('quotations.document.extraChargeFallback') }}</dt>
          <dd>{{ formatCurrency(charge.amount, quotation.header.currency, currentDocumentLocale) }}</dd>
        </div>
        <div class="grand-total">
          <dt>{{ documentT('quotations.document.total') }}</dt>
          <dd>{{ formattedGrandTotal }}</dd>
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
  --preview-accent: color-mix(in srgb, var(--brand-accent) 30%, #b7793f);
  --atelier-ink: #241f1a;
  --atelier-espresso: #342820;
  --atelier-paper: #fbf7ef;
  --atelier-surface: #fffdf8;
  --atelier-line: #ded4c6;
  --atelier-line-strong: #aa9986;
  --atelier-muted: #766a5e;
  --atelier-soft: #978a7c;
  --atelier-accent: var(--preview-accent);
  --atelier-accent-soft: color-mix(in srgb, var(--atelier-accent) 10%, #fffdf8);
  --preview-ink: var(--atelier-ink);
  --preview-muted: var(--atelier-muted);
  --preview-soft: var(--atelier-soft);
  --preview-line: var(--atelier-line);
  --preview-line-strong: var(--atelier-line-strong);
  --preview-surface: #f3ece1;
  --preview-surface-strong: #ede3d6;
  --preview-accent-soft: var(--atelier-accent-soft);
  width: var(--quotation-page-width);
  display: grid;
  grid-template-rows: max-content max-content max-content minmax(0, 1fr) max-content;
  gap: 18px;
  min-height: var(--quotation-page-min-height);
  margin: 0 auto;
  padding: 34px 38px 32px;
  border: 1px solid #e1d8cb;
  background:
    radial-gradient(circle at 12% 8%, rgb(154 104 66 / 0.055), transparent 30%),
    var(--atelier-paper);
  color: var(--atelier-ink);
  font-family: Aptos, "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: 11.5px;
  line-height: 1.4;
}

.atelier-header {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) 206px;
  gap: 20px;
  align-items: center;
}

.brand-shell {
  padding: 5px;
  border: 1px solid rgb(52 40 32 / 0.14);
  border-radius: 24px;
  background: rgb(52 40 32 / 0.045);
}

.brand-core {
  display: grid;
  place-items: center;
  height: 72px;
  overflow: hidden;
  border-radius: 19px;
  background: var(--atelier-espresso);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.14);
  color: #fffaf2;
}

.brand-logo {
  display: block;
  width: calc(100% - 4px);
  height: calc(100% - 4px);
  max-width: 100%;
  max-height: 100%;
  border-radius: 18px;
  background: #ffffff;
  object-fit: contain;
  object-position: center;
}

.brand-initials {
  font-family: "Iowan Old Style", "Palatino Linotype", "Noto Serif SC", serif;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.masthead {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.eyebrow,
.document-number span,
.hero-total span,
.meta-row dt,
.section-heading span,
.total-row dt,
.grand-total dt {
  margin: 0;
  color: var(--atelier-muted);
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.company-name {
  margin: 0;
  color: var(--atelier-ink);
  font-family: "Iowan Old Style", "Palatino Linotype", "Noto Serif SC", serif;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.02;
  overflow-wrap: anywhere;
}

.company-contact {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  color: var(--atelier-muted);
  font-size: 10.5px;
}

.document-number {
  display: grid;
  gap: 7px;
  justify-items: end;
  padding-left: 18px;
  border-left: 1px solid var(--atelier-line-strong);
  text-align: right;
}

.document-number strong {
  color: var(--atelier-ink);
  font-family: "Iowan Old Style", "Palatino Linotype", "Noto Serif SC", serif;
  font-size: 22px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.hero-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 250px;
  border-radius: 4px 28px 4px 4px;
  overflow: hidden;
  background: var(--atelier-espresso);
  color: #fffaf2;
}

.hero-copy {
  display: grid;
  align-content: end;
  gap: 10px;
  min-height: 150px;
  padding: 26px 30px;
  border-left: 7px solid var(--atelier-accent);
}

.hero-copy .eyebrow {
  color: color-mix(in srgb, var(--atelier-accent) 72%, #ffffff);
}

.hero-copy h2 {
  max-width: 540px;
  margin: 0;
  font-family: "Iowan Old Style", "Palatino Linotype", "Noto Serif SC", serif;
  font-size: 34px;
  font-weight: 500;
  line-height: 1.04;
  overflow-wrap: anywhere;
}

.hero-total {
  display: grid;
  align-content: end;
  gap: 8px;
  padding: 26px 28px;
  background: rgb(255 255 255 / 0.07);
}

.hero-total span {
  color: rgb(255 250 242 / 0.66);
}

.hero-total strong {
  color: #fffaf2;
  font-size: 20px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.parties-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 26px;
  padding: 18px 20px;
  border: 1px solid var(--atelier-line);
  border-radius: 18px;
  background: var(--atelier-surface);
  box-shadow: inset 0 1px 0 #ffffff;
}

.recipient-block {
  display: grid;
  align-content: start;
  gap: 4px;
  min-width: 0;
}

.recipient-block strong {
  margin: 3px 0;
  color: var(--atelier-ink);
  font-family: "Iowan Old Style", "Palatino Linotype", "Noto Serif SC", serif;
  font-size: 19px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.recipient-block p,
.notes-panel p {
  margin: 0;
  color: var(--atelier-muted);
}

.meta-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  margin: 0;
}

.meta-row {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--atelier-line);
}

.meta-row dd {
  margin: 0;
  color: var(--atelier-ink);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.items-section {
  display: grid;
  align-content: start;
  gap: 8px;
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 14px;
}

.section-heading i {
  flex: 1;
  height: 1px;
  background: var(--atelier-line-strong);
}

.closing-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  gap: 22px;
  align-items: start;
  padding-top: 6px;
}

.notes-panel {
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  border-left: 3px solid var(--atelier-accent);
  background: var(--atelier-accent-soft);
}

.terms-text {
  white-space: pre-line;
}

.totals-panel {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 5px;
  border: 1px solid rgb(52 40 32 / 0.12);
  border-radius: 20px;
  background: rgb(52 40 32 / 0.04);
}

.total-row,
.grand-total {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 11px;
}

.total-row + .total-row {
  border-top: 1px solid var(--atelier-line);
}

.total-row dd,
.grand-total dd {
  margin: 0;
  color: var(--atelier-ink);
  font-weight: 700;
  text-align: right;
}

.grand-total {
  flex-wrap: wrap;
  align-items: baseline;
  margin-top: 3px;
  border-radius: 14px;
  background: var(--atelier-espresso);
}

.grand-total dt,
.grand-total dd {
  color: #fffaf2;
  font-size: 15px;
  font-weight: 800;
}

.grand-total .chinese-total-amount {
  flex: 0 0 100%;
  padding-top: 7px;
  border-top: 1px solid rgb(255 250 242 / 0.2);
  color: rgb(255 250 242 / 0.76);
  font-size: 10px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
</style>
