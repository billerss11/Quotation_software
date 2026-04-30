<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency, formatPercent } from '@/shared/utils/formatters'

import type { CurrencyCode } from '../types'
import type { QuotationAnalysisMajorItemRow } from '../utils/quotationAnalysis'

const props = defineProps<{
  rows: QuotationAnalysisMajorItemRow[]
  currency: CurrencyCode
}>()

const emit = defineEmits<{
  selectItem: [payload: { itemId: string }]
}>()

const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)

function selectItem(itemId: string) {
  emit('selectItem', { itemId })
}
</script>

<template>
  <div class="margin-table-wrap">
    <table class="margin-table" :aria-label="t('quotations.analysis.marginTableAria')">
      <thead>
        <tr>
          <th>{{ t('quotations.analysis.marginTable.item') }}</th>
          <th>{{ t('quotations.analysis.marginTable.cost') }}</th>
          <th>{{ t('quotations.analysis.marginTable.revenue') }}</th>
          <th>{{ t('quotations.analysis.marginTable.profit') }}</th>
          <th>{{ t('quotations.analysis.marginTable.margin') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in props.rows" :key="row.itemId">
          <td>
            <button
              class="margin-row-link"
              type="button"
              :data-item-id="row.itemId"
              @click="selectItem(row.itemId)"
            >
              {{ row.itemName || t('quotations.analysis.unnamedItem') }}
            </button>
          </td>
          <td>{{ formatCurrency(row.baseSubtotal, props.currency, currentLocale) }}</td>
          <td>{{ formatCurrency(row.subtotal, props.currency, currentLocale) }}</td>
          <td>{{ formatCurrency(row.profitAmount, props.currency, currentLocale) }}</td>
          <td>{{ formatPercent(row.grossMarginRate, currentLocale) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.margin-table-wrap {
  overflow-x: auto;
}

.margin-table {
  width: 100%;
  border-collapse: collapse;
}

.margin-table th,
.margin-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--surface-border);
  color: var(--text-body);
  font-size: 13px;
  text-align: left;
}

.margin-table th {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.margin-row-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--info);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.margin-row-link:hover {
  color: #1d4ed8;
}
</style>
