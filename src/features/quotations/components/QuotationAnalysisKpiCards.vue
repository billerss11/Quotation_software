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
  },
  {
    key: 'markupAmount',
    label: t('quotations.analysis.kpis.markupAmount'),
    value: formatCurrency(props.kpis.markupAmount, props.currency, currentLocale.value),
  },
  {
    key: 'discountAmount',
    label: t('quotations.analysis.kpis.discountAmount'),
    value: formatCurrency(props.kpis.discountAmount, props.currency, currentLocale.value),
  },
  {
    key: 'taxAmount',
    label: t('quotations.analysis.kpis.taxAmount'),
    value: formatCurrency(props.kpis.taxAmount, props.currency, currentLocale.value),
  },
  {
    key: 'grandTotal',
    label: t('quotations.analysis.kpis.grandTotal'),
    value: formatCurrency(props.kpis.grandTotal, props.currency, currentLocale.value),
  },
  {
    key: 'grossMarginRate',
    label: t('quotations.analysis.kpis.grossMarginRate'),
    value: formatPercent(props.kpis.grossMarginRate, currentLocale.value),
  },
])
</script>

<template>
  <section class="kpi-grid" :aria-label="t('quotations.analysis.kpiAria')">
    <article v-for="card in cards" :key="card.key" class="kpi-card">
      <span class="kpi-label">{{ card.label }}</span>
      <strong class="kpi-value">{{ card.value }}</strong>
    </article>
  </section>
</template>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.kpi-card {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 96%), rgb(243 246 251 / 94%)),
    var(--surface-card);
  box-shadow: var(--shadow-control);
}

.kpi-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.kpi-value {
  color: var(--text-strong);
  font-size: 20px;
  line-height: 1.15;
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
