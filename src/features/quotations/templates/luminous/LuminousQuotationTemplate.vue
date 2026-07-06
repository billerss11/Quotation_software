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
  const resolved = (taxClasses ?? []).find((taxClass) => taxClass.id === defaultTaxClassId) ?? (taxClasses ?? [])[0]
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
        <p v-if="quotation.header.contactPerson" class="panel-detail">{{ quotation.header.contactPerson }}</p>
        <p v-if="quotation.header.contactDetails" class="panel-detail">{{ quotation.header.contactDetails }}</p>
      </div>

      <div class="project-panel">
        <span class="panel-label">{{ documentT('quotations.document.project') }}</span>
        <strong class="panel-value">{{ projectDisplayName }}</strong>
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
  --lum-accent-soft: color-mix(in srgb, var(--preview-accent) 11%, #ffffff);
  --lum-accent-line: color-mix(in srgb, var(--preview-accent) 35%, #c8d6e7);
  --lum-ink: #172235;
  --lum-muted: #5f6f84;
  --lum-soft: #8a99ad;
  --lum-line: #dce6f1;
  --lum-line-strong: #b9c7d8;
  --lum-paper: #f8fbff;
  --lum-panel: #ffffff;
  width: var(--quotation-page-width);
  display: grid;
  gap: 14px;
  min-height: var(--quotation-page-min-height);
  margin: 0 auto;
  padding: 30px 36px 31px;
  border: 1px solid #e5eef8;
  background:
    linear-gradient(180deg, #ffffff 0%, var(--lum-paper) 100%);
  color: var(--lum-ink);
  font-family: Aptos, "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: 12px;
  line-height: 1.38;
}

.document-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 304px;
  gap: 22px;
  align-items: stretch;
}

.brand-panel,
.quote-hero,
.client-panel,
.project-panel,
.amount-panel,
.totals-box {
  border: 1px solid var(--lum-line);
  border-radius: 8px;
  background: rgb(255 255 255 / 0.88);
}

.brand-panel {
  display: grid;
  grid-template-columns: 126px minmax(0, 1fr);
  gap: 18px;
  min-width: 0;
  padding: 16px;
  box-shadow: inset 5px 0 0 var(--preview-accent);
}

.logo-box {
  display: grid;
  width: 126px;
  height: 68px;
  place-items: center;
  padding: 9px;
  border: 1px solid var(--lum-accent-line);
  border-radius: 8px;
  background: var(--lum-accent-soft);
  color: var(--lum-muted);
  font-size: 9px;
  font-weight: 800;
  text-align: center;
  text-transform: uppercase;
}

.logo-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.company-details,
.quote-hero,
.client-panel,
.project-panel,
.terms-box {
  display: grid;
  align-content: start;
}

.company-details {
  gap: 5px;
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
  text-transform: uppercase;
}

.company-name,
.company-contact,
.panel-detail,
.terms-copy,
.terms-text,
.totals-box,
.document-footer span {
  margin: 0;
}

.company-name {
  color: var(--lum-ink);
  font-size: 25px;
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
  gap: 11px;
  padding: 16px;
  background:
    linear-gradient(135deg, #ffffff 0%, var(--lum-accent-soft) 100%);
}

.quotation-number {
  margin: 0;
  color: var(--lum-ink);
  font-size: 34px;
  font-weight: 850;
  line-height: 0.96;
  overflow-wrap: anywhere;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  margin: 0;
}

.meta-item {
  display: grid;
  gap: 2px;
  min-height: 35px;
  padding: 7px 8px;
  border: 1px solid var(--lum-line);
  border-radius: 8px;
  background: #ffffff;
}

.meta-item:first-child {
  grid-column: 1 / -1;
}

.meta-item dd {
  margin: 0;
  color: var(--lum-ink);
  font-size: 12px;
  font-weight: 750;
}

.intro-band {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.88fr) 304px;
  gap: 14px;
}

.client-panel,
.project-panel,
.amount-panel {
  min-height: 118px;
  padding: 14px 15px;
}

.client-panel,
.project-panel {
  gap: 5px;
  background:
    linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
}

.panel-value {
  color: var(--lum-ink);
  font-size: 17px;
  font-weight: 850;
  line-height: 1.12;
  overflow-wrap: anywhere;
}

.panel-detail,
.terms-copy,
.terms-text {
  color: var(--lum-muted);
}

.amount-panel {
  display: grid;
  gap: 11px;
  margin: 0;
  border-color: var(--lum-accent-line);
  background: #ffffff;
}

.amount-primary {
  display: grid;
  gap: 5px;
  padding-bottom: 11px;
  border-bottom: 1px solid var(--lum-line);
}

.amount-primary dd {
  margin: 0;
  color: var(--lum-ink);
  font-size: 27px;
  font-weight: 850;
  line-height: 1;
  text-align: right;
}

.amount-secondary {
  display: grid;
  gap: 6px;
}

.snapshot-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.snapshot-item dt {
  color: var(--lum-muted);
}

.snapshot-item dd {
  margin: 0;
  color: var(--lum-ink);
  font-weight: 750;
  text-align: right;
}

.items-section {
  display: grid;
  gap: 8px;
}

.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  padding: 10px 0 8px;
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

.document-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 42px;
  margin-top: auto;
  padding-top: 28px;
}

.signature-line {
  padding-top: 9px;
  border-top: 1px solid var(--lum-line-strong);
  color: var(--lum-muted);
  font-size: 11.5px;
  font-weight: 750;
}
</style>
