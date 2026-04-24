<script setup lang="ts">
import { computed } from 'vue'

import { formatCurrency } from '@/shared/utils/formatters'

import type {
  ExchangeRateTable,
  MajorItemSummary,
  QuotationDraft,
  QuotationMajorItem,
  QuotationSubItem,
  QuotationTotals,
} from '../types'
import {
  calculateLineSellingAmount,
  calculateUnitSellingPrice,
  getEffectiveMarkupRate,
} from '../utils/quotationCalculations'
import { createQuotationPreviewRows } from '../utils/quotationPreviewRows'
import type { QuotationPreviewRow } from '../utils/quotationPreviewRows'

const props = defineProps<{
  quotation: QuotationDraft
  summaries: MajorItemSummary[]
  totals: QuotationTotals
  globalMarkupRate: number
  exchangeRates: ExchangeRateTable
}>()

const previewRows = computed(() => createQuotationPreviewRows(props.quotation.majorItems, props.summaries))

function getRowUnitPrice(row: QuotationPreviewRow) {
  const subItemContext = findSubItemContext(row.key)

  if (subItemContext?.subItem.children.length) {
    return null
  }

  if (subItemContext) {
    return calculateUnitSellingPrice(
      subItemContext.subItem,
      getSubItemMarkupRate(subItemContext.majorItem, subItemContext.subItem),
      props.exchangeRates,
    )
  }

  const majorItem = findMajorItem(row.key)

  if (majorItem && majorItem.subItems.length === 0) {
    return calculateUnitSellingPrice(majorItem, getMajorMarkupRate(majorItem), props.exchangeRates)
  }

  return row.unitPrice
}

function getRowAmount(row: QuotationPreviewRow) {
  const subItemContext = findSubItemContext(row.key)

  if (subItemContext?.subItem.children.length) {
    return calculateNestedSubItemAmount(subItemContext.majorItem, subItemContext.subItem)
  }

  if (subItemContext) {
    return calculateLineSellingAmount(
      subItemContext.subItem,
      getSubItemMarkupRate(subItemContext.majorItem, subItemContext.subItem),
      props.exchangeRates,
    )
  }

  return row.amount
}

function isGroupRow(row: QuotationPreviewRow) {
  if (row.type === 'major') {
    return true
  }

  return Boolean(findSubItemContext(row.key)?.subItem.children.length)
}

function getMajorMarkupRate(item: QuotationMajorItem) {
  return getEffectiveMarkupRate(item.markupRate, props.globalMarkupRate)
}

function getSubItemMarkupRate(item: QuotationMajorItem, subItem: QuotationSubItem) {
  return getEffectiveMarkupRate(subItem.markupRate ?? item.markupRate, props.globalMarkupRate)
}

function findMajorItem(rowKey: string) {
  const itemId = rowKey.replace(/-(major|subtotal)$/, '')
  return props.quotation.majorItems.find((item) => item.id === itemId)
}

function findSubItemContext(rowKey: string) {
  const subItemId = rowKey.replace(/-sub$/, '')

  for (const majorItem of props.quotation.majorItems) {
    const subItem = findNestedSubItem(majorItem.subItems, subItemId)

    if (subItem) {
      return { majorItem, subItem }
    }
  }

  return null
}

function findNestedSubItem(items: QuotationSubItem[], subItemId: string): QuotationSubItem | null {
  for (const item of items) {
    if (item.id === subItemId) {
      return item
    }

    const child = findNestedSubItem(item.children, subItemId)

    if (child) {
      return child
    }
  }

  return null
}

function calculateNestedSubItemAmount(majorItem: QuotationMajorItem, item: QuotationSubItem): number {
  if (item.children.length === 0) {
    return calculateLineSellingAmount(item, getSubItemMarkupRate(majorItem, item), props.exchangeRates)
  }

  return item.children.reduce(
    (total, child) => total + calculateNestedSubItemAmount(majorItem, child),
    0,
  )
}

</script>

<template>
  <article class="quotation-document" :style="{ '--preview-accent': quotation.branding.accentColor }">
    <header class="document-header">
      <div class="company-block">
        <div class="logo-box">
          <img v-if="quotation.branding.logoDataUrl" :src="quotation.branding.logoDataUrl" alt="Company logo" />
          <span v-else>Company Logo</span>
        </div>
        <div>
          <h2>Your Company</h2>
          <p>Professional quotation</p>
        </div>
      </div>

      <div class="quotation-title-block">
        <h1>Quotation</h1>
        <dl>
          <div>
            <dt>No.</dt>
            <dd>{{ quotation.header.quotationNumber }}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{{ quotation.header.quotationDate }}</dd>
          </div>
          <div>
            <dt>Valid</dt>
            <dd>{{ quotation.header.validityPeriod }}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{{ quotation.header.currency }}</dd>
          </div>
        </dl>
      </div>
    </header>

    <section class="meta-band" aria-label="Quotation parties">
      <div class="meta-box">
        <span class="meta-label">Prepared For</span>
        <strong>{{ quotation.header.customerCompany || quotation.header.customerName || 'Customer' }}</strong>
        <p>{{ quotation.header.contactPerson || quotation.header.customerName }}</p>
        <p>{{ quotation.header.contactDetails }}</p>
      </div>

      <div class="meta-box">
        <span class="meta-label">Project</span>
        <strong>{{ quotation.header.projectName || 'Project name' }}</strong>
        <p>Quotation date: {{ quotation.header.quotationDate }}</p>
        <p>Validity: {{ quotation.header.validityPeriod }}</p>
      </div>
    </section>

    <section class="items-section" aria-label="Quotation items">
      <table class="quotation-table">
        <thead>
          <tr>
            <th class="col-no">No.</th>
            <th>Description</th>
            <th class="col-qty">Qty</th>
            <th class="col-money">Unit Price</th>
            <th class="col-money">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in previewRows"
            :key="row.key"
            :class="[`row-${row.type}`, { 'row-group': isGroupRow(row) }]"
          >
            <td class="col-no">{{ row.itemNumber }}</td>
            <td>
              <div class="item-description">
                <strong>{{ row.description }}</strong>
                <span v-if="row.detail">{{ row.detail }}</span>
              </div>
            </td>
            <td class="col-qty">{{ row.quantity ?? '' }}</td>
            <td class="col-money">
              <span v-if="getRowUnitPrice(row) !== null">
                {{ formatCurrency(getRowUnitPrice(row) ?? 0, quotation.header.currency) }}
              </span>
            </td>
            <td class="col-money">
              <span v-if="getRowAmount(row) !== null">
                {{ formatCurrency(getRowAmount(row) ?? 0, quotation.header.currency) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="summary-section" aria-label="Quotation summary">
      <div class="terms-box">
        <h3>Notes / Terms</h3>
        <p>{{ quotation.header.notes || 'Prices are valid for the stated validity period. Delivery and payment terms are subject to final confirmation.' }}</p>
      </div>

      <dl class="totals-box">
        <div>
          <dt>Subtotal</dt>
          <dd>{{ formatCurrency(totals.subtotalAfterMarkup, quotation.header.currency) }}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>-{{ formatCurrency(totals.discountAmount, quotation.header.currency) }}</dd>
        </div>
        <div>
          <dt>Tax / VAT</dt>
          <dd>{{ formatCurrency(totals.taxAmount, quotation.header.currency) }}</dd>
        </div>
        <div class="grand-total">
          <dt>Total</dt>
          <dd>{{ formatCurrency(totals.grandTotal, quotation.header.currency) }}</dd>
        </div>
      </dl>
    </section>

    <footer class="document-footer">
      <div class="signature-line">
        <span>Prepared by</span>
      </div>
      <div class="signature-line">
        <span>Accepted by</span>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.quotation-document {
  --preview-accent: #0f766e;
  display: grid;
  gap: 28px;
  min-height: 1120px;
  padding: 48px;
  border: 1px solid #d7dee8;
  background: #ffffff;
  color: #172033;
}

.document-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 28px;
  padding-bottom: 24px;
  border-bottom: 4px solid var(--preview-accent);
}

.company-block {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.logo-box {
  display: grid;
  width: 150px;
  height: 78px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #cbd5e1;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.logo-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.company-block h2,
.company-block p,
.quotation-title-block h1,
.quotation-title-block dl,
.meta-box p,
.terms-box h3,
.terms-box p,
.totals-box,
.document-footer span {
  margin: 0;
}

.company-block h2 {
  color: #0f172a;
  font-size: 22px;
}

.company-block p,
.meta-box p,
.terms-box p {
  color: #64748b;
}

.quotation-title-block {
  display: grid;
  justify-items: end;
  gap: 14px;
  text-align: right;
}

.quotation-title-block h1 {
  color: #0f172a;
  font-size: 38px;
  line-height: 1;
  text-transform: uppercase;
}

.quotation-title-block dl {
  display: grid;
  gap: 6px;
  width: 100%;
}

.quotation-title-block dl div,
.totals-box div {
  display: flex;
  justify-content: space-between;
  gap: 20px;
}

.quotation-title-block dt,
.totals-box dt {
  color: #64748b;
}

.quotation-title-block dd,
.totals-box dd {
  margin: 0;
  color: #0f172a;
  font-weight: 800;
}

.meta-band {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.meta-box {
  display: grid;
  gap: 6px;
  min-height: 120px;
  padding: 18px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

.meta-label {
  color: var(--preview-accent);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.meta-box strong {
  color: #0f172a;
  font-size: 17px;
}

.quotation-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.quotation-table th {
  padding: 12px 10px;
  border-bottom: 2px solid #cbd5e1;
  color: #334155;
  font-size: 12px;
  text-align: left;
  text-transform: uppercase;
}

.quotation-table td {
  padding: 12px 10px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}

.col-no {
  width: 82px;
  white-space: nowrap;
}

.col-qty {
  width: 72px;
  text-align: center;
}

.col-money {
  width: 140px;
  text-align: right;
}

.row-major {
  background: #eef4f8;
}

.row-major td {
  border-top: 2px solid #cbd5e1;
  border-bottom-color: #cbd5e1;
}

.row-major .item-description strong {
  color: #0f172a;
  font-size: 15px;
  font-weight: 900;
}

.row-major .col-no {
  color: var(--preview-accent);
  font-weight: 900;
}

.row-sub .item-description {
  padding-left: 12px;
}

.row-sub .item-description strong {
  font-weight: 600;
}

.row-group:not(.row-major) {
  background: #f8fafc;
}

.row-group:not(.row-major) td {
  border-top: 1px solid #d1dbe8;
  border-bottom-color: #d1dbe8;
}

.row-group:not(.row-major) .item-description {
  padding-left: 6px;
}

.row-group:not(.row-major) .item-description strong {
  color: #172033;
  font-size: 14px;
  font-weight: 850;
}

.row-group:not(.row-major) .col-no {
  color: #1d4ed8;
  font-weight: 850;
}

.row-sub:not(.row-group) .col-no {
  color: #475569;
}

.row-group .col-money span {
  color: #0f172a;
  font-weight: 900;
}

.row-subtotal {
  background: #ffffff;
}

.row-subtotal td {
  border-bottom: 1px solid #cbd5e1;
  color: #0f172a;
  font-weight: 850;
}

.item-description {
  display: grid;
  gap: 4px;
}

.item-description span {
  color: #64748b;
  font-size: 13px;
  white-space: pre-line;
}

.item-description strong {
  white-space: pre-line;
}

.summary-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 32px;
  align-items: start;
}

.terms-box {
  display: grid;
  gap: 8px;
  padding-top: 4px;
}

.terms-box h3 {
  color: #0f172a;
  font-size: 15px;
}

.totals-box {
  display: grid;
  gap: 10px;
  padding: 18px;
  border: 1px solid #dbe5ef;
  background: #f8fafc;
}

.grand-total {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 2px solid var(--preview-accent);
}

.grand-total dt,
.grand-total dd {
  color: #0f172a;
  font-size: 20px;
}

.document-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 48px;
  margin-top: auto;
  padding-top: 46px;
}

.signature-line {
  border-top: 1px solid #94a3b8;
  padding-top: 10px;
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}
</style>
