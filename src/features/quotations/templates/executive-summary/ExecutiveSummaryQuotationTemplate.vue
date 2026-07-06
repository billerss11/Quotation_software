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
const ledgerStamp = computed(() =>
  `${props.quotation.header.quotationNumber} / ${projectDisplayName.value}`,
)
</script>

<template>
  <article class="quotation-document quotation-template-executive-summary" :style="documentStyle">
    <header class="document-header">
      <div class="brand-block">
        <div class="logo-box">
          <img
            v-if="quotation.branding.logoDataUrl"
            class="logo-image"
            :src="quotation.branding.logoDataUrl"
            :alt="documentT('quotations.document.companyLogoAlt')"
          />
          <span v-else class="logo-placeholder">{{ documentT('quotations.document.companyLogoPlaceholder') }}</span>
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

      <div class="document-control">
        <p class="document-label">{{ documentT('quotations.document.documentControl') }}</p>
        <h1 class="quotation-number">{{ quotation.header.quotationNumber }}</h1>
        <dl class="control-grid">
          <div v-for="item in documentMetaItems" :key="item.key" class="control-item">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </div>
    </header>

    <section class="executive-band" :aria-label="documentT('quotations.document.partiesAria')">
      <div class="recipient-panel">
        <span class="panel-label">{{ documentT('quotations.document.preparedFor') }}</span>
        <strong class="panel-value">{{ customerDisplayName }}</strong>
        <p v-if="quotation.header.contactPerson" class="panel-detail">{{ quotation.header.contactPerson }}</p>
        <p v-if="quotation.header.contactDetails" class="panel-detail">{{ quotation.header.contactDetails }}</p>
      </div>

      <div class="project-panel">
        <span class="panel-label">{{ documentT('quotations.document.project') }}</span>
        <strong class="panel-value">{{ projectDisplayName }}</strong>
      </div>

      <dl class="total-panel">
        <div class="total-primary">
          <dt>{{ documentT('quotations.document.grandTotal') }}</dt>
          <dd>{{ formattedGrandTotal }}</dd>
        </div>
        <div class="snapshot-grid">
          <div v-for="item in commercialSnapshotItems" :key="item.key" class="snapshot-item">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </div>
      </dl>
    </section>

    <section class="items-section" :aria-label="documentT('quotations.document.itemsAria')">
      <div class="section-title-row">
        <span>{{ documentT('quotations.document.scopeLedger') }}</span>
        <strong>{{ ledgerStamp }}</strong>
      </div>
      <QuotationItemsTable
        :quotation="quotation"
        :summaries="summaries"
        :totals="totals"
        :global-markup-rate="globalMarkupRate"
        :exchange-rates="exchangeRates"
        variant="executive-summary"
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
  --exec-accent-soft: color-mix(in srgb, var(--preview-accent) 10%, #ffffff);
  --exec-accent-line: color-mix(in srgb, var(--preview-accent) 42%, #cfd7e3);
  --exec-ink: #172033;
  --exec-muted: #5b667a;
  --exec-soft: #8792a5;
  --exec-line: #d9e0ea;
  --exec-line-strong: #adb8c8;
  --exec-surface: #f5f7fa;
  --exec-surface-strong: #edf1f6;
  width: var(--quotation-page-width);
  display: grid;
  gap: 15px;
  min-height: var(--quotation-page-min-height);
  margin: 0 auto;
  padding: 28px 36px 30px;
  border: 1px solid #e8edf4;
  background: #ffffff;
  color: var(--exec-ink);
  font-family: Aptos, "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: 12px;
  line-height: 1.38;
}

.document-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 292px;
  gap: 24px;
  align-items: start;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--exec-line);
  box-shadow: inset 0 -5px 0 var(--exec-accent-soft);
}

.brand-block {
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr);
  gap: 17px;
  min-width: 0;
}

.logo-box {
  display: grid;
  width: 118px;
  height: 58px;
  place-items: center;
  padding: 8px;
  border: 1px solid var(--exec-line);
  border-radius: 8px;
  background: #ffffff;
  color: var(--exec-soft);
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
.document-control,
.recipient-panel,
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
.section-title-row span,
.summary-heading,
.total-primary dt,
.snapshot-item dt,
.control-item dt {
  margin: 0;
  color: var(--preview-accent);
  font-size: 9.5px;
  font-weight: 800;
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
  color: var(--exec-ink);
  font-size: 24px;
  font-weight: 850;
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.company-contact {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 13px;
  color: var(--exec-muted);
  font-size: 11px;
}

.document-control {
  justify-items: stretch;
  gap: 9px;
  text-align: right;
}

.quotation-number {
  margin: 0;
  color: var(--exec-ink);
  font-size: 31px;
  font-weight: 850;
  line-height: 1;
  overflow-wrap: anywhere;
}

.control-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  margin: 0;
}

.control-item {
  display: grid;
  gap: 2px;
  min-height: 38px;
  padding: 7px 9px;
  border: 1px solid var(--exec-line);
  border-radius: 8px;
  background: var(--exec-surface);
  text-align: left;
}

.control-item dd {
  margin: 0;
  color: var(--exec-ink);
  font-size: 12px;
  font-weight: 750;
}

.executive-band {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr) 292px;
  gap: 14px;
}

.recipient-panel,
.project-panel,
.total-panel {
  min-height: 116px;
  margin: 0;
  padding: 14px 15px;
  border: 1px solid var(--exec-line);
  border-radius: 8px;
  background: var(--exec-surface);
}

.recipient-panel,
.project-panel {
  gap: 5px;
  border-top: 4px solid var(--exec-accent-line);
}

.panel-value {
  color: var(--exec-ink);
  font-size: 17px;
  font-weight: 850;
  line-height: 1.12;
  overflow-wrap: anywhere;
}

.panel-detail,
.terms-copy,
.terms-text {
  color: var(--exec-muted);
}

.total-panel {
  display: grid;
  gap: 12px;
  border-color: var(--exec-accent-line);
  background: #ffffff;
}

.total-primary {
  display: grid;
  gap: 4px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--exec-line);
}

.total-primary dd {
  margin: 0;
  color: var(--exec-ink);
  font-size: 26px;
  font-weight: 850;
  line-height: 1;
  text-align: right;
}

.snapshot-grid {
  display: grid;
  gap: 6px;
}

.snapshot-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.snapshot-item dt {
  color: var(--exec-muted);
}

.snapshot-item dd {
  margin: 0;
  color: var(--exec-ink);
  font-weight: 750;
  text-align: right;
}

.items-section {
  display: grid;
  gap: 8px;
}

.section-title-row {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 7px;
  border-bottom: 2px solid var(--exec-accent-line);
}

.section-title-row strong {
  color: var(--exec-muted);
  font-size: 10.5px;
  font-weight: 750;
  text-align: right;
}

.summary-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 304px;
  gap: 22px;
  align-items: start;
  padding-top: 11px;
  border-top: 1px solid var(--exec-line);
}

.terms-box {
  gap: 8px;
  min-height: 132px;
  padding: 13px 0 0;
}

.summary-heading {
  color: var(--exec-ink);
}

.terms-text {
  white-space: pre-line;
}

.totals-box {
  display: grid;
  gap: 0;
  padding: 12px 16px 15px;
  border: 1px solid var(--exec-line);
  border-radius: 8px;
  background: #ffffff;
}

.totals-row,
.grand-total {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 7px 0;
  border-bottom: 1px solid var(--exec-line);
}

.totals-label {
  color: var(--exec-muted);
}

.totals-value {
  margin: 0;
  color: var(--exec-ink);
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
  color: var(--exec-ink);
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
  border-top: 1px solid var(--exec-line-strong);
  color: var(--exec-muted);
  font-size: 11.5px;
  font-weight: 750;
}
</style>
