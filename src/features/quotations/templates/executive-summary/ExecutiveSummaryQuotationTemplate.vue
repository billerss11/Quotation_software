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
        <div class="project-reference">
          <span class="panel-label">{{ documentT('quotations.document.project') }}</span>
          <strong>{{ projectDisplayName }}</strong>
        </div>
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
        <div class="panel-details">
          <p v-if="quotation.header.contactPerson" class="panel-detail">{{ quotation.header.contactPerson }}</p>
          <p v-if="quotation.header.contactDetails" class="panel-detail">{{ quotation.header.contactDetails }}</p>
        </div>
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
  --preview-accent: color-mix(in srgb, var(--brand-accent) 34%, #6d5bd0);
  --exec-accent-soft: color-mix(in srgb, var(--preview-accent) 10%, #fdfcff);
  --exec-accent-line: color-mix(in srgb, var(--preview-accent) 42%, #d5d1e8);
  --exec-ink: #20233a;
  --exec-muted: #62647a;
  --exec-soft: #8d8fa7;
  --exec-line: #dedff0;
  --exec-line-strong: #b9bad2;
  --exec-surface: #f7f6fb;
  --exec-surface-strong: #efedf8;
  width: var(--quotation-page-width);
  display: grid;
  grid-template-rows: max-content max-content minmax(0, 1fr) max-content;
  gap: 15px;
  min-height: var(--quotation-page-min-height);
  margin: 0 auto;
  padding: 28px 36px 30px;
  border: 1px solid #e5e3f1;
  background: #fefeff;
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
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 17px;
  min-width: 0;
}

.logo-box {
  display: grid;
  width: 96px;
  height: 96px;
  place-items: center;
  overflow: hidden;
  padding: 2px;
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
.document-control,
.recipient-panel,
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
.totals-box {
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

.project-reference {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: flex-end;
  gap: 3px 10px;
  min-width: 0;
}

.project-reference strong {
  color: var(--exec-ink);
  font-size: 13px;
  font-weight: 800;
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
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 14px;
}

.recipient-panel,
.total-panel {
  margin: 0;
  padding: 11px 13px;
  border: 1px solid var(--exec-line);
  border-radius: 8px;
  background: var(--exec-surface);
}

.recipient-panel {
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  align-items: baseline;
  gap: 4px 12px;
  border-top: 4px solid var(--exec-accent-line);
}

.panel-value {
  color: var(--exec-ink);
  font-size: 17px;
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
  border-left: 1px solid var(--exec-line-strong);
}

.panel-detail,
.terms-copy,
.terms-text {
  color: var(--exec-muted);
}

.total-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.7fr);
  align-items: center;
  gap: 14px;
  border-color: var(--exec-accent-line);
  background: #ffffff;
}

.total-primary {
  display: grid;
  gap: 4px;
  padding-right: 14px;
  border-right: 1px solid var(--exec-line);
}

.total-primary dd {
  margin: 0;
  color: var(--exec-ink);
  font-size: 24px;
  font-weight: 850;
  line-height: 1;
  text-align: right;
}

.snapshot-grid {
  display: grid;
  gap: 6px;
}

.snapshot-item {
  display: grid;
  gap: 1px;
  justify-items: end;
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
  flex-wrap: wrap;
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

.grand-total .chinese-total-amount {
  flex: 0 0 100%;
  margin: 4px 0 0;
  padding-top: 6px;
  border-top: 1px solid var(--exec-line);
  color: var(--exec-muted);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-align: right;
}

</style>
