<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { getQuotationDocumentPageSizePx } from '@/features/quotations/utils/quotationDocumentPage'

import type { GoodsReceiptDraft, GoodsReceiptPdfRow, GoodsReceiptTotalQuantity } from '../utils/goodsReceipt'

const props = defineProps<{
  draft: GoodsReceiptDraft
  rows: GoodsReceiptPdfRow[]
  totalQuantity: GoodsReceiptTotalQuantity | null
  branding: {
    logoDataUrl: string
    accentColor: string
  }
  variant: 'standard' | 'compact'
}>()

const { t } = useI18n()
const documentPageSize = getQuotationDocumentPageSizePx()
const documentStyle = computed(() => ({
  '--goods-receipt-accent': props.branding.accentColor || '#047857',
  '--quotation-page-width': `${documentPageSize.width}px`,
  '--quotation-page-min-height': `${documentPageSize.height}px`,
}))
const documentClasses = computed(() => [
  'goods-receipt-document',
  `goods-receipt-document--${props.variant}`,
])
const metaItems = computed(() => [
  { key: 'grNumber', label: t('goodsReceipts.document.grNumber'), value: props.draft.grNumber },
  { key: 'documentDate', label: t('goodsReceipts.document.documentDate'), value: props.draft.documentDate },
  { key: 'quotationNumber', label: t('goodsReceipts.document.quotationNumber'), value: props.draft.quotationNumber },
  { key: 'quotationDate', label: t('goodsReceipts.document.quotationDate'), value: props.draft.quotationDate },
  { key: 'projectName', label: t('goodsReceipts.document.projectName'), value: props.draft.projectName },
  { key: 'customerReference', label: t('goodsReceipts.document.customerReference'), value: props.draft.customerReference },
  { key: 'deliveryReference', label: t('goodsReceipts.document.deliveryReference'), value: props.draft.deliveryReference },
].filter((item) => item.value.trim().length > 0))
const partyItems = computed(() => [
  { key: 'receivingCompany', label: t('goodsReceipts.document.receivingCompany'), value: props.draft.receivingCompany },
  { key: 'deliveryAddress', label: t('goodsReceipts.document.deliveryAddress'), value: props.draft.deliveryAddress },
  { key: 'deliveryContact', label: t('goodsReceipts.document.deliveryContact'), value: props.draft.deliveryContact },
  { key: 'contactDetails', label: t('goodsReceipts.document.contactDetails'), value: props.draft.contactDetails },
  { key: 'supplierCompany', label: t('goodsReceipts.document.supplier'), value: props.draft.supplierCompany },
  { key: 'supplierContact', label: t('goodsReceipts.document.supplierContact'), value: props.draft.supplierContact },
].filter((item) => item.value.trim().length > 0))

function formatQuantity(quantity: number) {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2)
}
</script>

<template>
  <article :class="documentClasses" :style="documentStyle">
    <header class="goods-receipt-header">
      <div class="goods-receipt-brand">
        <div
          class="goods-receipt-logo"
          :class="{ 'goods-receipt-logo--image': props.branding.logoDataUrl }"
        >
          <img
            v-if="props.branding.logoDataUrl"
            :src="props.branding.logoDataUrl"
            :alt="t('goodsReceipts.document.companyLogoAlt')"
          />
          <span v-else>{{ t('goodsReceipts.document.companyLogoPlaceholder') }}</span>
        </div>
        <div class="goods-receipt-title-block">
          <p class="goods-receipt-kicker">{{ t('goodsReceipts.document.kicker') }}</p>
          <h1>{{ t('goodsReceipts.document.title') }}</h1>
        </div>
      </div>

      <dl class="goods-receipt-meta">
        <div v-for="item in metaItems" :key="item.key" class="goods-receipt-meta-row">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </header>

    <section class="goods-receipt-parties" :aria-label="t('goodsReceipts.document.partiesAria')">
      <div v-for="item in partyItems" :key="item.key" class="goods-receipt-party-item">
        <span>{{ item.label }}</span>
        <p>{{ item.value }}</p>
      </div>
    </section>

    <section class="goods-receipt-lines" :aria-label="t('goodsReceipts.document.linesAria')">
      <h2>{{ t('goodsReceipts.document.goodsReceived') }}</h2>
      <table class="goods-receipt-table">
        <thead>
          <tr>
            <th scope="col">{{ t('goodsReceipts.document.table.quotationItem') }}</th>
            <th scope="col">{{ t('goodsReceipts.document.table.description') }}</th>
            <th scope="col">{{ t('goodsReceipts.document.table.quantity') }}</th>
            <th scope="col">{{ t('goodsReceipts.document.table.unit') }}</th>
            <th scope="col">{{ t('goodsReceipts.document.table.remarks') }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in props.rows" :key="row.kind === 'group' ? row.key : row.lineId">
            <tr v-if="row.kind === 'group'" class="goods-receipt-group-row">
              <td>{{ row.itemNumber }}</td>
              <td
                colspan="4"
                :style="{ paddingInlineStart: `${8 + row.depth * 14}px` }"
              >
                {{ row.description }}
              </td>
            </tr>
            <tr v-else class="goods-receipt-detail-row">
              <td>{{ row.itemNumber }}</td>
              <td>{{ row.description }}</td>
              <td>{{ formatQuantity(row.quantity) }}</td>
              <td>{{ row.unit }}</td>
              <td>{{ row.remarks }}</td>
            </tr>
          </template>
          <tr v-if="props.totalQuantity" class="goods-receipt-total-row">
            <td />
            <td>{{ t('goodsReceipts.document.totalQuantity') }}</td>
            <td>{{ formatQuantity(props.totalQuantity.quantity) }}</td>
            <td>{{ props.totalQuantity.unit }}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="props.draft.remarks.trim()" class="goods-receipt-remarks">
      <h2>{{ t('goodsReceipts.document.generalRemarks') }}</h2>
      <p>{{ props.draft.remarks }}</p>
    </section>

    <footer class="goods-receipt-signatures">
      <section class="goods-receipt-signature-block">
        <h2>{{ t('goodsReceipts.document.receivingRepresentative') }}</h2>
        <p>{{ t('goodsReceipts.document.name') }}: ______________________________</p>
        <p>{{ t('goodsReceipts.document.signature') }}: __________________________</p>
        <p>{{ t('goodsReceipts.document.date') }}: _______________________________</p>
      </section>
      <section class="goods-receipt-signature-block">
        <h2>{{ t('goodsReceipts.document.supplierRepresentative') }}</h2>
        <p>{{ t('goodsReceipts.document.preparedBy') }}: {{ props.draft.preparedBy || '______________________________' }}</p>
        <p v-if="props.draft.supplierContact">{{ props.draft.supplierContact }}</p>
        <p>{{ t('goodsReceipts.document.date') }}: {{ props.draft.documentDate }}</p>
      </section>
    </footer>
  </article>
</template>

<style scoped>
.goods-receipt-document {
  --goods-receipt-accent: var(--accent);
  --goods-receipt-accent-soft: color-mix(in srgb, var(--goods-receipt-accent) 8%, #ffffff);
  --goods-receipt-line: #d8dee8;
  --goods-receipt-line-strong: #aeb8c6;
  --goods-receipt-ink: #111827;
  --goods-receipt-muted: #526071;
  width: var(--quotation-page-width);
  min-height: var(--quotation-page-min-height);
  display: grid;
  align-content: start;
  gap: 15px;
  margin: 0 auto;
  padding: 25px 34px 28px;
  border: 1px solid #eef2f7;
  background:
    radial-gradient(circle at 94% 2%, var(--goods-receipt-accent-soft), transparent 25%),
    #ffffff;
  color: var(--goods-receipt-ink);
  font-family: Aptos, "Segoe UI Variable", "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: 12px;
  line-height: 1.35;
}

.goods-receipt-document--compact {
  gap: 10px;
  padding: 20px 28px 24px;
  font-size: 11px;
  line-height: 1.28;
}

.goods-receipt-header {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 292px;
  gap: 18px;
  align-items: start;
  padding-bottom: 10px;
}

.goods-receipt-header::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: 0;
  left: 78px;
  height: 3px;
  background: var(--goods-receipt-accent);
}

.goods-receipt-brand {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  min-width: 0;
}

.goods-receipt-logo {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  width: 64px;
  height: 64px;
  place-items: center;
  padding: 7px;
  border: 1px solid color-mix(in srgb, var(--goods-receipt-accent) 34%, var(--goods-receipt-line));
  border-radius: 10px;
  background: var(--goods-receipt-accent-soft);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--goods-receipt-accent) 5%, transparent),
    inset 0 1px 0 #ffffff;
  color: #8a96a8;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  overflow: hidden;
}

.goods-receipt-logo--image {
  padding: 0;
  border: 0;
}

.goods-receipt-logo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.goods-receipt-kicker,
.goods-receipt-title-block h1,
.goods-receipt-lines h2,
.goods-receipt-remarks h2,
.goods-receipt-remarks p,
.goods-receipt-signature-block h2,
.goods-receipt-signature-block p {
  margin: 0;
}

.goods-receipt-kicker {
  color: var(--goods-receipt-accent);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.goods-receipt-title-block {
  display: grid;
  gap: 5px;
}

.goods-receipt-title-block h1 {
  font-size: 24px;
  line-height: 1.08;
}

.goods-receipt-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
  margin: 0;
}

.goods-receipt-meta-row {
  display: grid;
  gap: 1px;
  min-width: 0;
  padding: 3px 0;
  border-bottom: 1px solid var(--goods-receipt-line);
}

.goods-receipt-meta-row:first-child,
.goods-receipt-meta-row:nth-child(5) {
  grid-column: 1 / -1;
}

.goods-receipt-meta dt,
.goods-receipt-party-item span {
  color: var(--goods-receipt-muted);
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.goods-receipt-meta dd {
  margin: 0;
  font-weight: 700;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.goods-receipt-parties {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 22px;
  padding: 11px 14px;
  border: 1px solid var(--goods-receipt-line);
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff, var(--goods-receipt-accent-soft));
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--goods-receipt-accent) 4%, transparent),
    inset 0 1px 0 #ffffff;
}

.goods-receipt-party-item {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding-top: 6px;
  border-top: 1px solid var(--goods-receipt-line);
}

.goods-receipt-party-item p {
  margin: 0;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.goods-receipt-lines {
  display: grid;
  gap: 8px;
}

.goods-receipt-lines h2,
.goods-receipt-remarks h2,
.goods-receipt-signature-block h2 {
  color: var(--goods-receipt-accent);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.goods-receipt-lines > h2 {
  padding-bottom: 6px;
  border-bottom: 2px solid color-mix(in srgb, var(--goods-receipt-accent) 38%, var(--goods-receipt-line));
}

.goods-receipt-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.goods-receipt-table thead {
  display: table-header-group;
}

.goods-receipt-table th,
.goods-receipt-table td {
  padding: 7px 8px;
  border: 1px solid var(--goods-receipt-line);
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

.goods-receipt-document--compact .goods-receipt-table th,
.goods-receipt-document--compact .goods-receipt-table td {
  padding: 5px 6px;
}

.goods-receipt-table th {
  background: var(--goods-receipt-accent-soft);
  color: var(--goods-receipt-ink);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.goods-receipt-table th:nth-child(1),
.goods-receipt-table td:nth-child(1) {
  width: 86px;
  text-align: center;
}

.goods-receipt-table th:nth-child(3),
.goods-receipt-table td:nth-child(3) {
  width: 70px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.goods-receipt-table th:nth-child(4),
.goods-receipt-table td:nth-child(4) {
  width: 58px;
  text-align: center;
}

.goods-receipt-table th:nth-child(5),
.goods-receipt-table td:nth-child(5) {
  width: 132px;
}

.goods-receipt-total-row td {
  font-weight: 900;
  background: #f8fafc;
}

.goods-receipt-group-row {
  break-after: avoid-page;
  page-break-after: avoid;
}

.goods-receipt-group-row td {
  border-color: color-mix(in srgb, var(--goods-receipt-accent) 24%, var(--goods-receipt-line));
  background: var(--goods-receipt-accent-soft);
  color: var(--goods-receipt-ink);
  font-weight: 900;
}

.goods-receipt-detail-row,
.goods-receipt-total-row {
  break-inside: avoid;
  page-break-inside: avoid;
}

.goods-receipt-remarks {
  display: grid;
  gap: 5px;
  padding: 8px 10px;
  border: 1px solid var(--goods-receipt-line);
  border-radius: 10px;
  background: #fbfdff;
  box-shadow: inset 0 1px 0 #ffffff;
}

.goods-receipt-remarks p {
  white-space: pre-line;
}

.goods-receipt-signatures {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 28px;
  margin-top: auto;
  padding-top: 14px;
}

.goods-receipt-signature-block {
  display: grid;
  gap: 10px;
  min-height: 120px;
  padding: 12px 14px;
  border: 1px solid var(--goods-receipt-line-strong);
  border-radius: 12px;
  background: #ffffff;
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--goods-receipt-accent) 4%, transparent),
    inset 0 1px 0 #ffffff;
}

.goods-receipt-document--compact .goods-receipt-signature-block {
  min-height: 98px;
  gap: 7px;
  padding: 10px 12px;
  border-radius: 9px;
}

.goods-receipt-document--compact .goods-receipt-header {
  grid-template-columns: minmax(0, 1fr) 272px;
  gap: 14px;
  padding-bottom: 8px;
}

.goods-receipt-document--compact .goods-receipt-brand {
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 12px;
}

.goods-receipt-document--compact .goods-receipt-logo {
  width: 54px;
  height: 54px;
}

.goods-receipt-document--compact .goods-receipt-title-block h1 {
  font-size: 21px;
}

.goods-receipt-document--compact .goods-receipt-meta-row {
  padding: 2px 0;
}

.goods-receipt-document--compact .goods-receipt-parties {
  gap: 5px 16px;
  padding: 8px 11px;
  border-radius: 9px;
}

.goods-receipt-signature-block p {
  color: var(--goods-receipt-muted);
  white-space: pre-line;
}
</style>
