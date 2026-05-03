<script setup lang="ts">
import type { EChartsCoreOption } from 'echarts/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency, formatPercent } from '@/shared/utils/formatters'

import type { CurrencyCode } from '../types'
import type { QuotationAnalysisBridgeStep, QuotationAnalysisDataset } from '../utils/quotationAnalysis'
import QuotationAnalysisChart from './QuotationAnalysisChart.vue'
import QuotationAnalysisChartCard from './QuotationAnalysisChartCard.vue'
import QuotationAnalysisKpiCards from './QuotationAnalysisKpiCards.vue'
import QuotationAnalysisMarginTable from './QuotationAnalysisMarginTable.vue'

const props = defineProps<{
  analysis: QuotationAnalysisDataset
  currency: CurrencyCode
}>()

const emit = defineEmits<{
  selectItem: [payload: { itemId: string }]
}>()

const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
const costCoverageNote = computed(() => {
  if (!props.analysis.hasMeaningfulData || props.analysis.kpis.costCoverageRate >= 100) {
    return ''
  }

  return t('quotations.analysis.partialCostCoverage', {
    rate: formatPercent(props.analysis.kpis.costCoverageRate, currentLocale.value),
  })
})

const summaryStats = computed(() => [
  { key: 'majorItems', label: t('quotations.analysis.summary.majorItems'), value: props.analysis.compositionSummary.majorItemCount },
  { key: 'pricedLines', label: t('quotations.analysis.summary.pricedLines'), value: props.analysis.compositionSummary.pricedLineCount },
  { key: 'currencies', label: t('quotations.analysis.summary.currencies'), value: props.analysis.compositionSummary.currencyCount },
  { key: 'markupOverrides', label: t('quotations.analysis.summary.markupOverrides'), value: props.analysis.compositionSummary.markupOverrideCount },
])

const costDistributionOption = computed<EChartsCoreOption>(() => ({
  tooltip: {
    trigger: 'item',
    valueFormatter: (value: unknown) => formatCurrency(Number(value ?? 0), props.currency, currentLocale.value),
  },
  series: [
    {
      type: 'treemap',
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: { show: true, formatter: '{b}' },
      data: props.analysis.majorItemRows.map((row) => ({
        name: row.itemName || t('quotations.analysis.unnamedItem'),
        value: row.baseSubtotal,
        itemId: row.itemId,
      })),
    },
  ],
}))

const revenueProfitOption = computed<EChartsCoreOption>(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    valueFormatter: (value: unknown) => formatCurrency(Number(value ?? 0), props.currency, currentLocale.value),
  },
  legend: {
    bottom: 0,
  },
  grid: {
    top: 24,
    right: 20,
    bottom: 48,
    left: 64,
  },
  xAxis: {
    type: 'value',
  },
  yAxis: {
    type: 'category',
    data: props.analysis.majorItemRows.map((row) => row.itemName || t('quotations.analysis.unnamedItem')),
  },
  series: [
    {
      name: t('quotations.analysis.charts.revenueProfit.baseCostSeries'),
      type: 'bar',
      stack: 'revenue',
      itemStyle: { color: '#94a3b8' },
      data: props.analysis.majorItemRows.map((row) => ({
        value: row.baseSubtotal,
        itemId: row.itemId,
      })),
    },
    {
      name: t('quotations.analysis.charts.revenueProfit.profitSeries'),
      type: 'bar',
      stack: 'revenue',
      itemStyle: { color: '#10b981' },
      data: props.analysis.majorItemRows.map((row) => ({
        value: row.profitAmount,
        itemId: row.itemId,
      })),
    },
  ],
}))

const bridgeOption = computed<EChartsCoreOption>(() => {
  const labels = props.analysis.bridge.map((step) => t(`quotations.analysis.bridge.${step.key}`))
  const offsets = props.analysis.bridge.map((step) => {
    if (step.key === 'grandTotal') {
      return 0
    }

    return step.cumulativeStart
  })
  const values = props.analysis.bridge.map((step) => {
    if (step.key === 'grandTotal') {
      return step.amount
    }

    return Math.abs(step.amount)
  })

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const valueParam = Array.isArray(params) ? params.at(-1) : null
        const dataIndex = typeof valueParam?.dataIndex === 'number' ? valueParam.dataIndex : -1
        const step = props.analysis.bridge[dataIndex]

        if (!step) {
          return ''
        }

        return `${labels[dataIndex]}<br/>${formatCurrency(step.amount, props.currency, currentLocale.value)}`
      },
    },
    grid: {
      top: 20,
      right: 20,
      bottom: 44,
      left: 56,
    },
    xAxis: {
      type: 'category',
      data: labels,
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        type: 'bar',
        stack: 'waterfall',
        itemStyle: { color: 'transparent' },
        emphasis: { itemStyle: { color: 'transparent' } },
        data: offsets,
      },
      {
        type: 'bar',
        stack: 'waterfall',
        data: props.analysis.bridge.map((step, index) => ({
          value: values[index],
          itemStyle: {
            color:
              step.key === 'discountAmount'
                ? '#f59e0b'
                : step.key === 'grandTotal'
                  ? '#0f766e'
                  : '#10b981',
          },
        })),
      },
    ],
  }
})

const currencyExposureOption = computed<EChartsCoreOption>(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    valueFormatter: (value: unknown) => formatCurrency(Number(value ?? 0), props.currency, currentLocale.value),
  },
  legend: {
    bottom: 0,
  },
  grid: {
    top: 24,
    right: 20,
    bottom: 48,
    left: 64,
  },
  xAxis: {
    type: 'value',
  },
  yAxis: {
    type: 'category',
    data: props.analysis.currencyExposure.rows.map((row) => row.itemName || t('quotations.analysis.unnamedItem')),
  },
  series: props.analysis.currencyExposure.currencies.map((currency, index) => ({
    name: currency,
    type: 'bar',
    stack: 'currency',
    itemStyle: {
      color: ['#0f766e', '#2563eb', '#f59e0b', '#7c3aed'][index % 4],
    },
    data: props.analysis.currencyExposure.rows.map((row) => ({
      value: row.values[currency] ?? 0,
      itemId: row.itemId,
    })),
  })),
}))

function emitSelectItem(payload: { itemId: string }) {
  emit('selectItem', payload)
}
</script>

<template>
  <section class="analysis-view" :aria-label="t('quotations.analysis.aria')">
    <header class="analysis-hero">
      <div class="analysis-hero-copy">
        <p class="analysis-eyebrow">{{ t('quotations.workspace.modes.analysis') }}</p>
        <h2 class="analysis-title">{{ t('quotations.analysis.title') }}</h2>
        <p class="analysis-description">{{ t('quotations.analysis.description') }}</p>
        <p v-if="costCoverageNote" class="analysis-note">{{ costCoverageNote }}</p>
      </div>
      <div class="analysis-summary">
        <article v-for="stat in summaryStats" :key="stat.key" class="summary-pill">
          <span>{{ stat.label }}</span>
          <strong>{{ stat.value }}</strong>
        </article>
      </div>
    </header>

    <QuotationAnalysisKpiCards
      :kpis="props.analysis.kpis"
      :currency="props.currency"
    />

    <section
      v-if="!props.analysis.hasMeaningfulData"
      class="analysis-empty"
      :aria-label="t('quotations.analysis.emptyTitle')"
    >
      <h3 class="analysis-empty-title">{{ t('quotations.analysis.emptyTitle') }}</h3>
      <p class="analysis-empty-description">{{ t('quotations.analysis.emptyDescription') }}</p>
    </section>

    <div v-else class="analysis-grid">
      <QuotationAnalysisChartCard
        :title="t('quotations.analysis.charts.costDistribution.title')"
        :description="t('quotations.analysis.charts.costDistribution.description')"
      >
        <QuotationAnalysisChart
          :option="costDistributionOption"
          :chart-label="t('quotations.analysis.charts.costDistribution.aria')"
          @select="emitSelectItem"
        />
      </QuotationAnalysisChartCard>

      <QuotationAnalysisChartCard
        :title="t('quotations.analysis.charts.revenueProfit.title')"
        :description="t('quotations.analysis.charts.revenueProfit.description')"
      >
        <QuotationAnalysisChart
          :option="revenueProfitOption"
          :chart-label="t('quotations.analysis.charts.revenueProfit.aria')"
          @select="emitSelectItem"
        />
      </QuotationAnalysisChartCard>

      <QuotationAnalysisChartCard
        :title="t('quotations.analysis.charts.bridge.title')"
        :description="t('quotations.analysis.charts.bridge.description')"
      >
        <QuotationAnalysisChart
          :option="bridgeOption"
          :chart-label="t('quotations.analysis.charts.bridge.aria')"
        />
      </QuotationAnalysisChartCard>

      <QuotationAnalysisChartCard
        :title="t('quotations.analysis.charts.currencyExposure.title')"
        :description="t('quotations.analysis.charts.currencyExposure.description')"
      >
        <QuotationAnalysisChart
          :option="currencyExposureOption"
          :chart-label="t('quotations.analysis.charts.currencyExposure.aria')"
          @select="emitSelectItem"
        />
      </QuotationAnalysisChartCard>

      <QuotationAnalysisChartCard
        class="analysis-grid-span"
        :title="t('quotations.analysis.marginTable.title')"
        :description="t('quotations.analysis.marginTable.description')"
      >
        <QuotationAnalysisMarginTable
          :rows="props.analysis.majorItemRows"
          :currency="props.currency"
          @select-item="emitSelectItem"
        />
      </QuotationAnalysisChartCard>
    </div>
  </section>
</template>

<style scoped>
.analysis-view {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding-bottom: 8px;
}

.analysis-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--surface-border);
  border-radius: 18px;
  background:
    radial-gradient(circle at top left, rgb(16 185 129 / 14%), transparent 180px),
    linear-gradient(135deg, #ffffff, #eef7f3);
  box-shadow: var(--shadow-soft);
}

.analysis-hero-copy {
  min-width: 0;
}

.analysis-eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.analysis-title {
  margin: 6px 0 0;
  color: var(--text-strong);
  font-size: 26px;
  line-height: 1.1;
}

.analysis-description {
  max-width: 64ch;
  margin: 10px 0 0;
  color: var(--text-body);
  font-size: 14px;
  line-height: 1.55;
}

.analysis-note {
  max-width: 64ch;
  margin: 8px 0 0;
  color: var(--warning);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.analysis-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.summary-pill {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid rgb(15 23 42 / 8%);
  border-radius: 14px;
  background: rgb(255 255 255 / 78%);
}

.summary-pill span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.summary-pill strong {
  color: var(--text-strong);
  font-size: 18px;
}

.analysis-empty {
  display: grid;
  gap: 8px;
  padding: 28px;
  border: 1px dashed var(--surface-border-strong);
  border-radius: 16px;
  background: rgb(255 255 255 / 70%);
  text-align: center;
}

.analysis-empty-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 20px;
}

.analysis-empty-description {
  margin: 0;
  color: var(--text-body);
  font-size: 14px;
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.analysis-grid-span {
  grid-column: 1 / -1;
}

@media (max-width: 1180px) {
  .analysis-hero,
  .analysis-grid {
    grid-template-columns: 1fr;
  }

  .analysis-summary {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .analysis-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
