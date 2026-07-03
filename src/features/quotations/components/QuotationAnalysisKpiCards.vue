<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CurrencyCode } from '../types'
import type { QuotationAnalysisKpis } from '../utils/quotationAnalysis'
import { formatCurrency, formatPercent } from '@/shared/utils/formatters'
import type { SupportedLocale } from '@/shared/i18n/locale'

const props = defineProps<{
  kpis: QuotationAnalysisKpis
  currency: CurrencyCode
}>()

const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
const cards = computed(() => [
  {
    key: 'grandTotal',
    label: t('quotations.analysis.kpis.grandTotal'),
    value: formatCurrency(props.kpis.grandTotal, props.currency, currentLocale.value),
    variant: 'accent' as const,
  },
  {
    key: 'grossMarginAmount',
    label: t('quotations.analysis.kpis.grossMarginAmount'),
    value: formatCurrency(props.kpis.grossMarginAmount, props.currency, currentLocale.value),
    variant: props.kpis.grossMarginAmount < 0 ? 'danger' as const : 'positive' as const,
  },
  {
    key: 'grossMarginRate',
    label: t('quotations.analysis.kpis.grossMarginRate'),
    value: formatPercent(props.kpis.grossMarginRate, currentLocale.value),
    variant: props.kpis.grossMarginRate < 0 ? 'danger' as const : 'positive' as const,
  },
  {
    key: 'discountAmount',
    label: t('quotations.analysis.kpis.discountAmount'),
    value: formatCurrency(props.kpis.discountAmount, props.currency, currentLocale.value),
    variant: props.kpis.discountAmount > 0 ? 'warning' as const : 'default' as const,
  },
  {
    key: 'costCoverageRate',
    label: t('quotations.analysis.kpis.costCoverageRate'),
    value: formatPercent(props.kpis.costCoverageRate, currentLocale.value),
    variant: 'default' as const,
  },
])
</script>

<template>
  <section class="kpi-grid" :aria-label="t('quotations.analysis.kpiAria')">
    <article
      v-for="card in cards"
      :key="card.key"
      class="kpi-card"
      :class="`kpi-card-${card.variant}`"
    >
      <span class="kpi-label">{{ card.label }}</span>
      <strong class="kpi-value">{{ card.value }}</strong>
    </article>
  </section>
</template>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.kpi-card {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-card);
  box-shadow: var(--shadow-soft);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.kpi-card:hover {
  border-color: var(--surface-border-strong);
  box-shadow: var(--shadow-soft);
}

.kpi-card-accent {
  background: var(--accent-surface);
  border-color: var(--accent-soft);
}

.kpi-card-positive {
  background: var(--accent-surface);
  border-color: var(--accent-soft);
}

.kpi-card-warning {
  background: var(--warning-soft);
  border-color: var(--warning-border);
}

.kpi-card-danger {
  background: #fef2f2;
  border-color: #fecaca;
}

.kpi-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.3;
}

.kpi-card-accent .kpi-label,
.kpi-card-positive .kpi-label {
  color: var(--accent);
}

.kpi-card-warning .kpi-label {
  color: var(--warning);
}

.kpi-card-danger .kpi-label {
  color: #b91c1c;
}

.kpi-value {
  color: var(--text-strong);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.kpi-card-accent .kpi-value,
.kpi-card-positive .kpi-value {
  color: var(--accent);
  font-weight: 800;
}

.kpi-card-warning .kpi-value {
  color: var(--warning);
}

.kpi-card-danger .kpi-value {
  color: #b91c1c;
}

@media (max-width: 1320px) {
  .kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
