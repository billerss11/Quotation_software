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
    key: 'baseSubtotal',
    label: t('quotations.analysis.kpis.baseSubtotal'),
    value: formatCurrency(props.kpis.baseSubtotal, props.currency, currentLocale.value),
    variant: 'default' as const,
  },
  {
    key: 'markupAmount',
    label: t('quotations.analysis.kpis.markupAmount'),
    value: formatCurrency(props.kpis.markupAmount, props.currency, currentLocale.value),
    variant: 'positive' as const,
  },
  {
    key: 'discountAmount',
    label: t('quotations.analysis.kpis.discountAmount'),
    value: formatCurrency(props.kpis.discountAmount, props.currency, currentLocale.value),
    variant: props.kpis.discountAmount > 0 ? 'warning' as const : 'default' as const,
  },
  {
    key: 'taxAmount',
    label: t('quotations.analysis.kpis.taxAmount'),
    value: formatCurrency(props.kpis.taxAmount, props.currency, currentLocale.value),
    variant: 'default' as const,
  },
  {
    key: 'grandTotal',
    label: t('quotations.analysis.kpis.grandTotal'),
    value: formatCurrency(props.kpis.grandTotal, props.currency, currentLocale.value),
    variant: 'accent' as const,
  },
  {
    key: 'grossMarginRate',
    label: t('quotations.analysis.kpis.grossMarginRate'),
    value: formatPercent(props.kpis.grossMarginRate, currentLocale.value),
    variant: 'positive' as const,
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
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
}

.kpi-card {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
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

.kpi-label {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.kpi-card-accent .kpi-label,
.kpi-card-positive .kpi-label {
  color: var(--accent);
}

.kpi-card-warning .kpi-label {
  color: var(--warning);
}

.kpi-value {
  color: var(--text-strong);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.kpi-card-accent .kpi-value,
.kpi-card-positive .kpi-value {
  color: var(--accent);
  font-weight: 800;
}

.kpi-card-warning .kpi-value {
  color: var(--warning);
}

@media (max-width: 1320px) {
  .kpi-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
