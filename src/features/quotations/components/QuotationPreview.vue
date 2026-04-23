<script setup lang="ts">
import { computed } from 'vue'

import { formatCurrency } from '@/shared/utils/formatters'

import type { ExchangeRateTable, MajorItemSummary, QuotationDraft, QuotationTotals } from '../types'
import {
  calculateLineSellingAmount,
  calculateUnitSellingPrice,
  getEffectiveMarkupRate,
} from '../utils/quotationCalculations'

const props = defineProps<{
  quotation: QuotationDraft
  summaries: MajorItemSummary[]
  totals: QuotationTotals
  globalMarkupRate: number
  exchangeRates: ExchangeRateTable
}>()

const summaryByItemId = computed(() => new Map(props.summaries.map((summary) => [summary.itemId, summary])))

function getSubItemMarkupRate(itemId: string, subItemMarkupRate: number | undefined) {
  const item = props.quotation.majorItems.find((majorItem) => majorItem.id === itemId)
  return getEffectiveMarkupRate(subItemMarkupRate ?? item?.markupRate, props.globalMarkupRate)
}
</script>

<template>
  <section class="preview-panel" :style="{ '--preview-accent': quotation.branding.accentColor }">
    <header class="preview-header">
      <div class="logo-box">
        <img v-if="quotation.branding.logoDataUrl" :src="quotation.branding.logoDataUrl" alt="Company logo" />
        <span v-else>Logo</span>
      </div>
      <div class="preview-title-block">
        <h2>Quotation</h2>
        <p>{{ quotation.header.quotationNumber }}</p>
      </div>
    </header>

    <div class="preview-meta">
      <div>
        <span>Date</span>
        <strong>{{ quotation.header.quotationDate }}</strong>
      </div>
      <div>
        <span>Project</span>
        <strong>{{ quotation.header.projectName || 'Project name' }}</strong>
      </div>
      <div>
        <span>Validity</span>
        <strong>{{ quotation.header.validityPeriod }}</strong>
      </div>
      <div>
        <span>Customer</span>
        <strong>{{ quotation.header.customerCompany || quotation.header.customerName || 'Customer' }}</strong>
      </div>
    </div>

    <div class="preview-items">
      <article v-for="(item, itemIndex) in quotation.majorItems" :key="item.id" class="preview-item">
        <div class="preview-item-heading">
          <div>
            <h3>{{ itemIndex + 1 }}. {{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </div>
          <strong>
            {{ formatCurrency(summaryByItemId.get(item.id)?.subtotal ?? 0, quotation.header.currency) }}
          </strong>
        </div>

        <table v-if="item.subItems.length > 0" class="preview-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit selling price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="subItem in item.subItems" :key="subItem.id">
              <td>{{ subItem.description }}</td>
              <td>{{ subItem.quantity }}</td>
              <td>
                {{
                  formatCurrency(
                    calculateUnitSellingPrice(
                      subItem,
                      getSubItemMarkupRate(item.id, subItem.markupRate),
                      exchangeRates,
                    ),
                    quotation.header.currency,
                  )
                }}
              </td>
              <td>
                {{
                  formatCurrency(
                    calculateLineSellingAmount(
                      subItem,
                      getSubItemMarkupRate(item.id, subItem.markupRate),
                      exchangeRates,
                    ),
                    quotation.header.currency,
                  )
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>

    <footer class="preview-footer">
      <dl>
        <div>
          <dt>Subtotal</dt>
          <dd>{{ formatCurrency(totals.subtotalAfterMarkup, quotation.header.currency) }}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>-{{ formatCurrency(totals.discountAmount, quotation.header.currency) }}</dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd>{{ formatCurrency(totals.taxAmount, quotation.header.currency) }}</dd>
        </div>
        <div class="preview-total">
          <dt>Total</dt>
          <dd>{{ formatCurrency(totals.grandTotal, quotation.header.currency) }}</dd>
        </div>
      </dl>
      <p class="preview-notes">{{ quotation.header.notes }}</p>
    </footer>
  </section>
</template>

<style scoped>
.preview-panel {
  --preview-accent: #0f766e;
  display: grid;
  gap: 24px;
  min-height: 720px;
  padding: 34px;
  border: 1px solid #d9e2ef;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 48px rgb(15 23 42 / 10%);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 20px;
  border-bottom: 4px solid var(--preview-accent);
}

.logo-box {
  display: grid;
  width: 148px;
  height: 72px;
  place-items: center;
  border: 1px dashed #94a3b8;
  border-radius: 8px;
  color: #64748b;
  font-weight: 800;
}

.logo-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.preview-title-block {
  text-align: right;
}

.preview-title-block h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 34px;
}

.preview-title-block p {
  margin: 8px 0 0;
  color: #64748b;
  font-weight: 800;
}

.preview-meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.preview-meta div {
  display: grid;
  gap: 4px;
}

.preview-meta span {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.preview-meta strong {
  min-width: 0;
  color: var(--text-strong);
  overflow-wrap: anywhere;
}

.preview-items {
  display: grid;
  gap: 18px;
}

.preview-item {
  display: grid;
  gap: 12px;
}

.preview-item-heading {
  display: flex;
  justify-content: space-between;
  gap: 18px;
}

.preview-item h3,
.preview-item p {
  margin: 0;
}

.preview-item p {
  margin-top: 4px;
  color: #64748b;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.preview-table th,
.preview-table td {
  padding: 10px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
}

.preview-table th {
  color: #475569;
  font-size: 12px;
  text-transform: uppercase;
}

.preview-table td:last-child,
.preview-table th:last-child {
  text-align: right;
}

.preview-footer {
  display: grid;
  gap: 18px;
  margin-top: auto;
}

.preview-footer dl {
  display: grid;
  gap: 8px;
  margin: 0 0 0 auto;
  min-width: 280px;
}

.preview-footer div {
  display: flex;
  justify-content: space-between;
  gap: 24px;
}

.preview-footer dd {
  margin: 0;
  font-weight: 800;
}

.preview-total {
  padding-top: 10px;
  border-top: 2px solid var(--preview-accent);
  color: var(--text-strong);
  font-size: 22px;
}

.preview-notes {
  margin: 0;
  color: #475569;
  white-space: pre-wrap;
}
</style>
