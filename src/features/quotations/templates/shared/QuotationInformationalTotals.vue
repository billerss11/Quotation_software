<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency } from '@/shared/utils/formatters'

import type { ResolvedQuotationInformationalTotal } from '../../utils/quotationSummaryDisplay'

const props = defineProps<{
  rows: ResolvedQuotationInformationalTotal[]
  subtotalLabel: string
  note?: string
  currency: string
  locale: SupportedLocale
}>()

const { t: documentT } = useI18n({ useScope: 'parent' })
const informationalNote = computed(() => props.note === undefined
  ? documentT('quotations.summaryDisplay.documentNote', { subtotalLabel: props.subtotalLabel })
  : props.note)
</script>

<template>
  <div class="quotation-informational-totals">
    <dt class="informational-title">{{ documentT('quotations.summaryDisplay.documentTitle') }}</dt>
    <dd v-if="informationalNote.trim()" class="informational-note">{{ informationalNote }}</dd>
  </div>
  <div
    v-for="(row, index) in rows"
    :key="row.id"
    class="informational-row"
    :class="{ 'informational-row-last': index === rows.length - 1 }"
    :data-summary-id="row.id"
  >
    <dt class="informational-label">{{ row.label || documentT('quotations.summaryDisplay.untitled') }}</dt>
    <dd class="informational-amount">
      {{ row.amount === null ? documentT('common.emptyValue') : formatCurrency(row.amount, currency, locale) }}
    </dd>
  </div>
</template>

<style scoped>
.quotation-informational-totals {
  min-width: 0;
  padding: 8px 0 0;
}

.informational-title {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.35;
}

.informational-amount {
  margin: 0;
}

.informational-note {
  margin: 4px 0 6px;
  font-size: 10.67px;
  line-height: 1.35;
  opacity: 0.8;
  white-space: pre-wrap;
}

.informational-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, auto);
  gap: 10px;
  padding: 4px 0;
  font-size: 11px;
  line-height: 1.35;
}

.informational-row-last {
  padding-bottom: 10px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--preview-line, currentColor);
}

.informational-title,
.informational-note,
.informational-label,
.informational-amount {
  min-width: 0;
  overflow-wrap: anywhere;
}

.informational-amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
