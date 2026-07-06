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
  MixedTaxDocumentColumn,
  QuotationDraft,
  QuotationRootItem,
  QuotationTotals,
} from '../../types'
import { normalizeMixedTaxDocumentColumns } from '../../utils/quotationDocumentColumns'
import { getQuotationDocumentPageSizePx } from '../../utils/quotationDocumentPage'
import { createQuotationPreviewRowPricingMap } from '../../utils/quotationPreviewPricing'
import { createCalculationTotalsConfig, formatTaxRatePercentage } from '../../utils/quotationTaxes'
import { createQuotationPreviewRows } from '../../utils/quotationPreviewRows'
import type { QuotationPreviewRow } from '../../utils/quotationPreviewRows'
import type { QuotationPreviewRowPricing } from '../../utils/quotationPreviewPricing'

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

const previewRows = computed(() => createQuotationPreviewRows(props.quotation.majorItems, props.summaries))
const currentDocumentLocale = computed(() => props.quotation.header.documentLocale as SupportedLocale)
const isMixedTaxMode = computed(() => props.quotation.totalsConfig.taxMode === 'mixed')
const showMixedTaxHeaderNotes = computed(() => currentDocumentLocale.value === 'en-US')
const visibleMixedTaxColumns = computed(() =>
  isMixedTaxMode.value
    ? normalizeMixedTaxDocumentColumns(props.quotation.totalsConfig.mixedTaxColumns)
    : [],
)
const previewColumnCount = computed(() => (isMixedTaxMode.value ? 4 + visibleMixedTaxColumns.value.length : 6))
const singleTaxRateLabel = computed(() => {
  const { taxClasses, defaultTaxClassId } = props.quotation.totalsConfig
  const resolved = (taxClasses ?? []).find((tc) => tc.id === defaultTaxClassId) ?? (taxClasses ?? [])[0]
  return resolved ? formatTaxRatePercentage(resolved.rate) : ''
})
const calculationTotalsConfig = computed(() => createCalculationTotalsConfig(props.quotation.totalsConfig))
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
const rowPricingByKey = computed(() => new Map(
  createQuotationPreviewRowPricingMap(
    props.quotation.majorItems,
    props.globalMarkupRate,
    props.exchangeRates,
    calculationTotalsConfig.value,
  ),
))
const documentPageSize = getQuotationDocumentPageSizePx()
const documentStyle = computed(() => ({
  '--preview-accent': props.quotation.branding.accentColor,
  '--quotation-page-width': `${documentPageSize.width}px`,
  '--quotation-page-min-height': `${documentPageSize.height}px`,
}))
const discountRatio = computed(() => {
  if (props.totals.subtotalAfterMarkup <= 0 || props.totals.discountAmount <= 0) {
    return 0
  }

  return Math.min(props.totals.discountAmount / props.totals.subtotalAfterMarkup, 1)
})
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

function getRowPricing(row: QuotationPreviewRow) {
  return rowPricingByKey.value.get(row.key) ?? EMPTY_ROW_PRICING
}

function hasMixedTaxColumn(column: MixedTaxDocumentColumn) {
  return visibleMixedTaxColumns.value.includes(column)
}

function getRowUnitPrice(row: QuotationPreviewRow) {
  const pricing = getRowPricing(row)

  if (!shouldShowRowPricing(row, pricing)) {
    return null
  }

  return pricing.unitPrice
}

function getRowAmount(row: QuotationPreviewRow) {
  const pricing = getRowPricing(row)

  if (!shouldShowRowPricing(row, pricing)) {
    return null
  }

  return pricing.amount ?? row.amount
}

function getRowAmountWithTax(row: QuotationPreviewRow) {
  const taxableAmount = getRowTaxableAmount(row)
  const taxAmount = getRowTaxAmount(row)

  if (taxableAmount === null || taxAmount === null) {
    return null
  }

  return roundMoney(taxableAmount + taxAmount)
}

function getRowTaxAmount(row: QuotationPreviewRow) {
  const pricing = getRowPricing(row)
  const preDiscountTaxAmount = getRowPreDiscountTaxAmount(row, pricing)

  if (preDiscountTaxAmount === null) {
    return null
  }

  return roundMoney(preDiscountTaxAmount * (1 - discountRatio.value))
}

function getRowUnitTax(row: QuotationPreviewRow) {
  const taxAmount = getRowTaxAmount(row)
  const quantity = row.quantity

  if (taxAmount === null || quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
    return null
  }

  return roundMoney(taxAmount / quantity)
}

function getRowTaxLabel(row: QuotationPreviewRow) {
  const pricing = getRowPricing(row)

  if (!shouldShowRowPricing(row, pricing)) {
    return ''
  }

  if (pricing.hasMixedTaxClasses) {
    return pricing.effectiveTaxRate !== null
      ? formatTaxRatePercentage(pricing.effectiveTaxRate)
      : documentT('quotations.document.mixedTax')
  }

  if (pricing.taxRate !== null) {
    return formatTaxRatePercentage(pricing.taxRate)
  }

  return ''
}

function isGroupRow(row: QuotationPreviewRow) {
  return getRowPricing(row).isGroup
}

function shouldShowRowPricing(row: QuotationPreviewRow, pricing = getRowPricing(row)) {
  return pricing.amount !== null || row.amount !== null
}

function getRowTaxableAmount(row: QuotationPreviewRow) {
  const amount = getRowAmount(row)

  if (amount === null) {
    return null
  }

  return roundMoney(amount * (1 - discountRatio.value))
}

function getRowPreDiscountTaxAmount(row: QuotationPreviewRow, pricing: QuotationPreviewRowPricing) {
  if (!shouldShowRowPricing(row, pricing)) {
    return null
  }

  if (pricing.amount !== null && pricing.amountWithTax !== null) {
    return roundMoney(pricing.amountWithTax - pricing.amount)
  }

  const amount = getRowAmount(row)
  const taxRate = pricing.effectiveTaxRate ?? pricing.taxRate

  if (amount === null || taxRate === null) {
    return null
  }

  return roundMoney(amount * (taxRate / 100))
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

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

const EMPTY_ROW_PRICING: QuotationPreviewRowPricing = {
  unitPrice: null,
  amount: null,
  isGroup: false,
  taxClassId: null,
  taxClassLabel: null,
  taxRate: null,
  effectiveTaxRate: null,
  hasMixedTaxClasses: false,
  unitPriceWithTax: null,
  amountWithTax: null,
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
      <table :class="['quotation-table', { 'table-mixed-tax': isMixedTaxMode }]">
        <colgroup>
          <col class="ledger-col-no" />
          <col class="ledger-col-description" />
          <col class="ledger-col-qty" />
          <col class="ledger-col-unit" />
          <col v-if="isMixedTaxMode && hasMixedTaxColumn('taxRate')" class="ledger-col-tax" />
          <col v-if="!isMixedTaxMode || hasMixedTaxColumn('unitPrice')" class="ledger-col-money" />
          <col v-if="isMixedTaxMode && hasMixedTaxColumn('unitTax')" class="ledger-col-money" />
          <col v-if="isMixedTaxMode && hasMixedTaxColumn('taxAmount')" class="ledger-col-money" />
          <col v-if="!isMixedTaxMode || hasMixedTaxColumn('netAmount')" class="ledger-col-money" />
          <col v-if="isMixedTaxMode && hasMixedTaxColumn('grossAmount')" class="ledger-col-money" />
        </colgroup>
        <thead>
          <tr class="ledger-repeat-row">
            <td :colspan="previewColumnCount">
              <span>{{ documentT('quotations.document.scopeLedger') }}</span>
              <strong>{{ ledgerStamp }}</strong>
            </td>
          </tr>
          <tr>
            <th class="col-no">
              <span v-if="isMixedTaxMode" class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.noShort') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note column-heading-note-spacer" aria-hidden="true"></span>
              </span>
              <span v-else>{{ documentT('quotations.document.table.no') }}</span>
            </th>
            <th class="col-description">
              <span v-if="isMixedTaxMode" class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.description') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note column-heading-note-spacer" aria-hidden="true"></span>
              </span>
              <span v-else>{{ documentT('quotations.document.table.description') }}</span>
            </th>
            <th class="col-qty">
              <span v-if="isMixedTaxMode" class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.qty') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note column-heading-note-spacer" aria-hidden="true"></span>
              </span>
              <span v-else>{{ documentT('quotations.document.table.qty') }}</span>
            </th>
            <th class="col-unit">
              <span v-if="isMixedTaxMode" class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.unit') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note column-heading-note-spacer" aria-hidden="true"></span>
              </span>
              <span v-else>{{ documentT('quotations.document.table.unit') }}</span>
            </th>
            <th v-if="isMixedTaxMode && hasMixedTaxColumn('taxRate')" class="col-tax">
              <span class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.taxRateShort') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note column-heading-note-spacer" aria-hidden="true"></span>
              </span>
            </th>
            <th v-if="!isMixedTaxMode || hasMixedTaxColumn('unitPrice')" class="col-money">
              <span v-if="isMixedTaxMode" class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.unitPriceShort') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note">{{ documentT('quotations.document.table.excludingTaxShort') }}</span>
              </span>
              <span v-else>{{ documentT('quotations.document.table.unitPrice') }}</span>
            </th>
            <th v-if="isMixedTaxMode && hasMixedTaxColumn('unitTax')" class="col-money">
              <span class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.unitTaxShort') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note column-heading-note-spacer" aria-hidden="true"></span>
              </span>
            </th>
            <th v-if="isMixedTaxMode && hasMixedTaxColumn('taxAmount')" class="col-money">
              <span class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.taxAmountShort') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note">{{ documentT('quotations.document.table.totalTaxShort') }}</span>
              </span>
            </th>
            <th v-if="!isMixedTaxMode || hasMixedTaxColumn('netAmount')" class="col-money">
              <span v-if="isMixedTaxMode" class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.amountBeforeTaxShort') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note">{{ documentT('quotations.document.table.excludingTaxShort') }}</span>
              </span>
              <span v-else>{{ documentT('quotations.document.table.amount') }}</span>
            </th>
            <th v-if="isMixedTaxMode && hasMixedTaxColumn('grossAmount')" class="col-money">
              <span class="column-heading">
                <span class="column-heading-label">{{ documentT('quotations.document.table.amountWithTaxShort') }}</span>
                <span v-if="showMixedTaxHeaderNotes" class="column-heading-note">{{ documentT('quotations.document.table.includingTaxShort') }}</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in previewRows"
            :key="row.key"
            :class="[
              `row-${row.type}`,
              `row-level-${row.level}`,
              {
                'row-group': isGroupRow(row),
                'row-detail': row.level === 3,
              },
            ]"
          >
            <template v-if="row.type === 'section'">
              <td class="section-cell" :colspan="previewColumnCount">
                <span class="section-band">{{ row.description }}</span>
              </td>
            </template>
            <template v-else>
            <td :class="['col-no', `col-no-level-${row.level}`]">{{ row.itemNumber }}</td>
            <td>
              <div :class="['item-description', `item-description-level-${row.level}`]">
                <strong class="item-title">{{ row.description }}</strong>
                <span v-if="row.detail && !(row.level === 1 && isGroupRow(row))" class="item-detail">{{ row.detail }}</span>
              </div>
            </td>
            <td class="col-qty">{{ row.quantity === null ? '' : row.quantity }}</td>
            <td class="col-unit">{{ row.quantityUnit }}</td>
            <td v-if="isMixedTaxMode && hasMixedTaxColumn('taxRate')" class="col-tax">{{ getRowTaxLabel(row) }}</td>
            <td v-if="!isMixedTaxMode || hasMixedTaxColumn('unitPrice')" class="col-money">
              <span v-if="getRowUnitPrice(row) !== null" class="money-value">
                {{ formatCurrency(getRowUnitPrice(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            <td v-if="isMixedTaxMode && hasMixedTaxColumn('unitTax')" class="col-money">
              <span v-if="getRowUnitTax(row) !== null" class="money-value">
                {{ formatCurrency(getRowUnitTax(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            <td v-if="isMixedTaxMode && hasMixedTaxColumn('taxAmount')" class="col-money">
              <span v-if="getRowTaxAmount(row) !== null" class="money-value">
                {{ formatCurrency(getRowTaxAmount(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            <td v-if="!isMixedTaxMode || hasMixedTaxColumn('netAmount')" class="col-money">
              <span v-if="getRowAmount(row) !== null" class="money-value">
                {{ formatCurrency(getRowAmount(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            <td v-if="isMixedTaxMode && hasMixedTaxColumn('grossAmount')" class="col-money">
              <span v-if="getRowAmountWithTax(row) !== null" class="money-value">
                {{ formatCurrency(getRowAmountWithTax(row) ?? 0, quotation.header.currency, currentDocumentLocale) }}
              </span>
            </td>
            </template>
          </tr>
        </tbody>
      </table>
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

.quotation-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
  border-top: 1px solid var(--preview-line-strong);
}

.quotation-table th {
  padding: 8px 8px 7px;
  border-bottom: 1px solid var(--preview-line-strong);
  background: var(--preview-surface);
  color: var(--preview-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-align: left;
  text-transform: uppercase;
}

.quotation-table th.col-money,
.quotation-table td.col-money {
  padding-left: 10px;
}

.quotation-table td {
  padding: 8px 8px;
  border-bottom: 1px solid var(--preview-line);
  vertical-align: top;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.section-cell {
  padding: 10px 0 !important;
  border-left: none !important;
  background: transparent;
}

.section-band {
  display: block;
  padding: 6px 11px;
  border-left: 4px solid var(--preview-accent);
  background: var(--preview-accent-soft);
  color: var(--preview-ink);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.col-no {
  width: 74px;
  white-space: nowrap;
  color: var(--preview-muted);
  font-weight: 700;
}

.col-qty {
  width: 52px;
  text-align: center;
}

.col-unit {
  width: 72px;
  text-align: center;
}

.col-tax {
  width: 44px;
  text-align: center;
}

.col-money {
  width: 108px;
  text-align: right;
  white-space: nowrap;
}

.table-mixed-tax {
  table-layout: fixed;
  font-size: 10.3px;
}

.table-mixed-tax th {
  padding: 7px 3px;
  font-size: 8.8px;
  letter-spacing: 0.02em;
  vertical-align: bottom;
  white-space: nowrap;
}

.table-mixed-tax td {
  padding: 8px 3px;
}

.table-mixed-tax .col-no {
  width: 44px;
}

.table-mixed-tax .col-qty {
  width: 36px;
}

.table-mixed-tax .col-unit {
  width: 40px;
}

.table-mixed-tax .col-tax {
  width: 42px;
}

.table-mixed-tax .ledger-col-tax {
  width: 42px;
}

.table-mixed-tax .col-money {
  width: 80px;
}

.table-mixed-tax .ledger-col-money {
  width: 80px;
}

.table-mixed-tax .money-value {
  font-size: 10px;
  letter-spacing: 0;
}

.table-mixed-tax .column-heading {
  display: inline-grid;
  grid-template-rows: minmax(8.8px, auto) 8px;
  align-items: end;
  justify-items: center;
  min-height: 18px;
  gap: 1px;
  line-height: 1;
}

.table-mixed-tax .col-no .column-heading,
.table-mixed-tax .col-description .column-heading {
  justify-items: start;
}

.table-mixed-tax .col-money .column-heading {
  justify-items: end;
}

.table-mixed-tax .column-heading-label {
  line-height: 1;
}

.table-mixed-tax .column-heading-note {
  color: var(--preview-soft);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;
  min-height: 8px;
  text-transform: none;
}

.table-mixed-tax .column-heading-note-spacer {
  visibility: hidden;
}

.table-mixed-tax .item-description {
  gap: 2px;
}

.table-mixed-tax .item-detail {
  font-size: 10.5px;
  line-height: 1.32;
}

.table-mixed-tax .item-description-level-1 {
  padding-left: 14px;
}

.table-mixed-tax .item-description-level-2 {
  padding-left: 18px;
}

.table-mixed-tax .item-description-level-2::before {
  left: 7px;
}

.table-mixed-tax .item-description-level-3 {
  padding-left: 24px;
}

.table-mixed-tax .item-description-level-3::before {
  left: 12px;
}

.item-description {
  display: grid;
  gap: 3px;
}

.item-title {
  white-space: pre-line;
}

.item-detail {
  color: var(--preview-muted);
  font-size: 11px;
  line-height: 1.34;
  white-space: pre-line;
}

.row-level-1 {
  background: var(--preview-surface-strong);
}

.row-section td {
  border-top: 1px solid var(--preview-line-strong);
  border-bottom: none;
}

.row-level-1 td {
  border-top: 1px solid var(--preview-line-strong);
  border-bottom-color: #d8e0ea;
}

.row-level-1 .col-no {
  color: var(--preview-accent);
  font-weight: 800;
}

.item-description-level-1 {
  position: relative;
  gap: 4px;
  padding: 2px 0 2px 16px;
}

.item-description-level-1::before {
  content: '';
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 0;
  width: 3px;
  background: var(--preview-accent);
}

.item-description-level-1 .item-title {
  color: var(--preview-ink);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.01em;
}

.row-level-2 td,
.row-level-3 td {
  background: #ffffff;
}

.row-level-2 .col-no {
  color: var(--preview-muted);
}

.item-description-level-2 {
  position: relative;
  gap: 4px;
  padding: 1px 0 1px 20px;
}

.item-description-level-2::before {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 7px;
  width: 1px;
  background: var(--preview-line-strong);
  opacity: 0.75;
}

.item-description-level-2 .item-title {
  color: var(--preview-ink);
  font-size: 13px;
  font-weight: 700;
}

.row-level-3 .col-no {
  color: var(--preview-soft);
}

.item-description-level-3 {
  position: relative;
  gap: 3px;
  padding: 1px 0 1px 28px;
}

.item-description-level-3::before {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 13px;
  border-left: 1px solid var(--preview-line-strong);
}

.item-description-level-3 .item-title {
  color: var(--preview-ink);
  font-size: 12px;
  font-weight: 600;
}

.money-value {
  color: var(--preview-ink);
  font-variant-numeric: tabular-nums;
}

.row-group .money-value,
.row-level-1 .money-value {
  font-weight: 800;
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

.quotation-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: auto;
  border: 1px solid var(--bid-line);
  background: #fffaf3;
  font-size: 11.2px;
}

.ledger-repeat-row {
  display: table-row;
}

.ledger-repeat-row td {
  padding: 8px 10px;
  border-bottom: 3px solid var(--bid-copper);
  background: var(--bid-night);
  color: var(--bid-cream);
  font-size: 10px;
}

.ledger-repeat-row span {
  color: var(--bid-teal);
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.ledger-repeat-row strong {
  float: right;
  max-width: 62%;
  overflow: hidden;
  color: var(--bid-cream);
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quotation-table th {
  padding: 7px 7px 6px;
  border-bottom: 1px solid #111827;
  background: #f2d6b7;
  color: #1a1410;
  font-size: 8.7px;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-align: left;
  text-transform: uppercase;
}

.quotation-table td {
  padding: 8px 7px;
  border-bottom: 1px solid #dfd3c4;
  vertical-align: top;
}

.quotation-table th.col-money,
.quotation-table td.col-money {
  padding-left: 8px;
}

.col-no {
  width: 62px;
  white-space: nowrap;
  color: var(--bid-copper-dark);
  font-weight: 950;
}

.col-description {
  min-width: 250px;
}

.col-qty {
  width: 42px;
  text-align: center;
}

.col-unit {
  width: 48px;
  text-align: center;
}

.col-tax {
  width: 44px;
  text-align: center;
}

.col-money {
  width: 84px;
  text-align: right;
  white-space: nowrap;
}

.ledger-col-no {
  width: 58px;
}

.ledger-col-description {
  width: auto;
}

.ledger-col-qty {
  width: 46px;
}

.ledger-col-unit {
  width: 54px;
}

.ledger-col-tax {
  width: 46px;
}

.ledger-col-money {
  width: 92px;
}

.section-cell {
  padding: 0 !important;
  border-bottom: 0 !important;
  background: var(--bid-night);
}

.section-band {
  display: block;
  padding: 9px 12px;
  border-left: 8px solid var(--bid-teal);
  background: var(--bid-night);
  color: var(--bid-cream);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.item-description {
  display: grid;
  gap: 3px;
}

.item-title {
  white-space: pre-line;
}

.item-detail {
  color: #5f6570;
  font-size: 10.6px;
  line-height: 1.31;
  white-space: pre-line;
}

.row-level-1 {
  background: #182332;
}

.row-level-1 td {
  border-top: 0;
  border-bottom-color: rgb(247 239 226 / 14%);
  background: #182332;
  color: var(--bid-cream);
}

.row-level-1 .col-no {
  color: var(--bid-teal);
  font-size: 13px;
}

.row-level-1 .item-detail {
  color: rgb(247 239 226 / 72%);
}

.row-level-1 .item-description-level-1 {
  padding: 2px 0 2px 17px;
  border-left: 4px solid var(--bid-copper);
}

.row-level-1 .item-description-level-1::before,
.item-description-level-2::before,
.item-description-level-3::before {
  content: none;
}

.row-level-1 .item-description-level-1 .item-title {
  color: #ffffff;
  font-size: 13.2px;
  font-weight: 950;
  line-height: 1.08;
}

.row-level-1 .money-value {
  color: #ffffff;
  font-weight: 950;
}

.row-level-2 td,
.row-level-3 td {
  background: #fffaf3;
}

.row-level-2 .col-no,
.row-level-3 .col-no {
  color: #87909d;
}

.item-description-level-2,
.item-description-level-3 {
  position: relative;
  padding-left: 16px;
}

.item-description-level-2 {
  border-left: 2px solid #c7a37f;
}

.item-description-level-3 {
  border-left: 2px solid #cfd6df;
}

.item-description-level-2 .item-title {
  color: var(--bid-ink);
  font-size: 13px;
  font-weight: 900;
}

.item-description-level-3 .item-title {
  color: #263244;
  font-size: 12px;
  font-weight: 850;
}

.money-value {
  color: var(--bid-ink);
  font-variant-numeric: tabular-nums;
}

.table-mixed-tax {
  table-layout: fixed;
  font-size: 9px;
}

.table-mixed-tax th {
  padding: 6px 3px;
  font-size: 7.7px;
  letter-spacing: 0.02em;
  vertical-align: bottom;
  white-space: nowrap;
}

.table-mixed-tax td {
  padding: 7px 3px;
}

.table-mixed-tax .col-no {
  width: 34px;
}

.table-mixed-tax .ledger-col-no {
  width: 34px;
}

.table-mixed-tax .col-qty {
  width: 28px;
}

.table-mixed-tax .ledger-col-qty {
  width: 28px;
}

.table-mixed-tax .col-unit {
  width: 31px;
}

.table-mixed-tax .ledger-col-unit {
  width: 31px;
}

.table-mixed-tax .col-tax {
  width: 31px;
}

.table-mixed-tax .ledger-col-tax {
  width: 31px;
}

.table-mixed-tax .col-money {
  width: 64px;
}

.table-mixed-tax .ledger-col-money {
  width: 64px;
}

.table-mixed-tax .money-value {
  display: block;
  font-size: 7.8px;
  line-height: 1.15;
  letter-spacing: 0;
}

.table-mixed-tax .column-heading {
  display: inline-grid;
  grid-template-rows: minmax(7.7px, auto) 7.4px;
  align-items: end;
  justify-items: end;
  min-height: 16.1px;
  gap: 1px;
  line-height: 1;
}

.table-mixed-tax .col-no .column-heading,
.table-mixed-tax .col-description .column-heading,
.table-mixed-tax .col-qty .column-heading,
.table-mixed-tax .col-unit .column-heading,
.table-mixed-tax .col-tax .column-heading {
  justify-items: start;
}

.table-mixed-tax .column-heading-label {
  line-height: 1;
}

.table-mixed-tax .column-heading-note {
  min-height: 7.4px;
  color: rgb(26 20 16 / 0.55);
  font-size: 7.1px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1;
  text-transform: none;
}

.table-mixed-tax .column-heading-note-spacer {
  visibility: hidden;
}

.table-mixed-tax .item-detail {
  font-size: 8.5px;
  line-height: 1.14;
}

.table-mixed-tax .item-description-level-2,
.table-mixed-tax .item-description-level-3 {
  padding-left: 12px;
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


