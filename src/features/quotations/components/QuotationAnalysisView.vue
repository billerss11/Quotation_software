<script setup lang="ts">
import type { EChartsCoreOption } from 'echarts/core'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency, formatPercent } from '@/shared/utils/formatters'

import type { CurrencyCode } from '../types'
import type { QuotationAnalysisAdvisory, QuotationAnalysisDataset } from '../utils/quotationAnalysis'
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

const chartColors = ['#0f766e', '#2563eb', '#d97706', '#7c3aed', '#64748b']
const ADVISORY_ITEM_LINK_LIMIT = 5
const { t, locale } = useI18n()
const expandedAdvisoryTypes = shallowRef(new Set<QuotationAnalysisAdvisory['type']>())
const currentLocale = computed(() => locale.value as SupportedLocale)
const mixedTaxItemCount = computed(() =>
  props.analysis.majorItemRows.filter((row) => row.taxClassLabels.length > 1).length,
)
const summaryStats = computed(() => [
  {
    key: 'reviewItems',
    label: t('quotations.analysis.summary.reviewItems'),
    value: props.analysis.advisories.length,
  },
  {
    key: 'costVisibility',
    label: t('quotations.analysis.summary.costVisibility'),
    value: formatPercent(props.analysis.profitConfidence.costVisibilityRate, currentLocale.value),
  },
  {
    key: 'currencies',
    label: t('quotations.analysis.summary.currencies'),
    value: props.analysis.compositionSummary.currencyCount,
  },
  {
    key: 'taxMixes',
    label: t('quotations.analysis.summary.taxMixes'),
    value: mixedTaxItemCount.value,
  },
])
const advisoryCards = computed(() =>
  groupAdvisories(props.analysis.advisories).map((group) => {
    const isExpanded = expandedAdvisoryTypes.value.has(group.primary.type)
    const visibleItems = isExpanded
      ? group.items
      : group.items.slice(0, ADVISORY_ITEM_LINK_LIMIT)
    const itemLinks = visibleItems.map((advisory) => ({
      itemId: advisory.itemId,
      itemName: formatItemName(advisory.itemName),
      detail: getAdvisoryItemDetail(advisory),
    }))

    return {
      group,
      title: getAdvisoryTitle(group.primary),
      body: getAdvisoryBody(group),
      meta: getAdvisoryMeta(group),
      severityLabel: t(`quotations.analysis.advisories.severity.${group.severity}`),
      itemLinks,
      hiddenItemCount: Math.max(group.items.length - itemLinks.length, 0),
      isExpanded,
    }
  }),
)
const confidenceStats = computed(() => [
  {
    key: 'knownRevenue',
    label: t('quotations.analysis.confidence.knownRevenue'),
    value: formatCurrency(props.analysis.profitConfidence.knownCostRevenue, props.currency, currentLocale.value),
  },
  {
    key: 'finalPriceRevenue',
    label: t('quotations.analysis.confidence.finalPriceRevenue'),
    value: formatCurrency(
      props.analysis.profitConfidence.finalPriceRevenueWithoutCost,
      props.currency,
      currentLocale.value,
    ),
  },
  {
    key: 'finalPriceItems',
    label: t('quotations.analysis.confidence.finalPriceItems'),
    value: props.analysis.profitConfidence.finalPriceItemCountWithoutCost,
  },
])
const confidenceBarStyle = computed(() => ({
  width: `${clampPercent(props.analysis.profitConfidence.costVisibilityRate)}%`,
}))

const costDistributionOption = computed<EChartsCoreOption>(() => ({
  color: chartColors,
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
      itemStyle: {
        borderColor: '#ffffff',
        borderWidth: 2,
        gapWidth: 2,
      },
      label: {
        show: true,
        formatter: '{b}',
        fontSize: 11,
      },
      data: props.analysis.majorItemRows
        .filter((row) => row.baseSubtotal > 0)
        .map((row) => ({
          name: formatItemName(row.itemName),
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
    top: 18,
    right: 20,
    bottom: 48,
    left: 88,
  },
  xAxis: {
    type: 'value',
    axisLabel: {
      formatter: (value: number) => formatCurrency(value, props.currency, currentLocale.value),
    },
  },
  yAxis: {
    type: 'category',
    data: props.analysis.majorItemRows.map((row) => formatItemName(row.itemName)),
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
      itemStyle: { color: '#0f766e' },
      data: props.analysis.majorItemRows.map((row) => ({
        value: row.profitAmount,
        itemId: row.itemId,
      })),
    },
  ],
}))

const markupOption = computed<EChartsCoreOption>(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    valueFormatter: (value: unknown) => formatPercent(Number(value ?? 0), currentLocale.value),
  },
  grid: {
    top: 18,
    right: 24,
    bottom: 32,
    left: 88,
  },
  xAxis: {
    type: 'value',
    axisLabel: {
      formatter: (value: number) => formatPercent(value, currentLocale.value),
    },
  },
  yAxis: {
    type: 'category',
    data: props.analysis.majorItemRows.map((row) => formatItemName(row.itemName)),
  },
  series: [
    {
      name: t('quotations.analysis.charts.markup.markupSeries'),
      type: 'bar',
      data: props.analysis.majorItemRows.map((row) => ({
        value: row.effectiveMarkupRate,
        itemId: row.itemId,
        itemStyle: {
          color: row.effectiveMarkupRate <= 0
            ? '#dc2626'
            : row.effectiveMarkupRate < 10
              ? '#d97706'
              : '#0f766e',
        },
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
      top: 18,
      right: 20,
      bottom: 44,
      left: 64,
    },
    xAxis: {
      type: 'category',
      data: labels,
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => formatCurrency(value, props.currency, currentLocale.value),
      },
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
                ? '#d97706'
                : step.key === 'grandTotal'
                  ? '#0f766e'
                  : '#2563eb',
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
    top: 18,
    right: 20,
    bottom: 48,
    left: 88,
  },
  xAxis: {
    type: 'value',
    axisLabel: {
      formatter: (value: number) => formatCurrency(value, props.currency, currentLocale.value),
    },
  },
  yAxis: {
    type: 'category',
    data: props.analysis.currencyExposure.rows.map((row) => formatItemName(row.itemName)),
  },
  series: props.analysis.currencyExposure.currencies.map((currency, index) => ({
    name: currency,
    type: 'bar',
    stack: 'currency',
    itemStyle: {
      color: chartColors[index % chartColors.length],
    },
    data: props.analysis.currencyExposure.rows.map((row) => ({
      value: row.values[currency] ?? 0,
      itemId: row.itemId,
    })),
  })),
}))

function formatItemName(itemName: string) {
  return itemName || t('quotations.analysis.unnamedItem')
}

function getAdvisoryTitle(advisory: QuotationAnalysisAdvisory) {
  return t(`quotations.analysis.advisories.${advisory.type}.title`)
}

function getAdvisoryBody(group: AdvisoryGroup) {
  const advisory = group.primary
  const item = formatItemName(advisory.itemName)

  if (group.count > 1) {
    return t(`quotations.analysis.advisories.${advisory.type}.groupBody`, {
      count: group.count,
      item,
      threshold: formatPercent(advisory.threshold ?? 10, currentLocale.value),
    })
  }

  if (advisory.type === 'currency_mix') {
    return t('quotations.analysis.advisories.currency_mix.body', {
      item,
      currencies: advisory.currencies?.join(', ') ?? '',
    })
  }

  if (advisory.type === 'tax_mix') {
    return t('quotations.analysis.advisories.tax_mix.body', {
      item,
      taxClasses: advisory.taxClasses?.join(', ') ?? '',
    })
  }

  if (advisory.type === 'zero_markup') {
    return t('quotations.analysis.advisories.zero_markup.body', { item })
  }

  return t('quotations.analysis.advisories.low_markup.body', {
    item,
    rate: formatPercent(advisory.markupRate ?? 0, currentLocale.value),
    threshold: formatPercent(advisory.threshold ?? 10, currentLocale.value),
  })
}

function getAdvisoryMeta(group: AdvisoryGroup) {
  const advisory = group.primary

  if (group.count > 1) {
    if (advisory.type === 'currency_mix') {
      return t('quotations.analysis.advisories.currencyCount', { count: group.currencyCount })
    }

    if (advisory.type === 'tax_mix') {
      return t('quotations.analysis.advisories.taxClassCount', { count: group.taxClassCount })
    }

    return t('quotations.analysis.advisories.itemCount', { count: group.count })
  }

  if (advisory.type === 'currency_mix') {
    return advisory.currencies?.join(' / ') ?? ''
  }

  if (advisory.type === 'tax_mix') {
    return advisory.taxClasses?.join(' / ') ?? ''
  }

  if (typeof advisory.markupRate === 'number') {
    return formatPercent(advisory.markupRate, currentLocale.value)
  }

  return ''
}

function getAdvisoryItemDetail(advisory: QuotationAnalysisAdvisory) {
  if (advisory.type === 'currency_mix') {
    return advisory.currencies?.join(' / ') ?? ''
  }

  if (advisory.type === 'tax_mix') {
    return advisory.taxClasses?.join(' / ') ?? ''
  }

  if (typeof advisory.markupRate !== 'number') {
    return ''
  }

  const rate = formatPercent(advisory.markupRate, currentLocale.value)

  if (advisory.parentItemName) {
    return t('quotations.analysis.advisories.itemDetailWithParent', {
      detail: rate,
      parent: advisory.parentItemName,
    })
  }

  return rate
}

function groupAdvisories(advisories: QuotationAnalysisAdvisory[]): AdvisoryGroup[] {
  const groups = new Map<QuotationAnalysisAdvisory['type'], QuotationAnalysisAdvisory[]>()

  advisories.forEach((advisory) => {
    groups.set(advisory.type, [...(groups.get(advisory.type) ?? []), advisory])
  })

  return Array.from(groups.entries()).map(([, rows]) => {
    const primary = rows[0]
    const currencies = new Set(rows.flatMap((row) => row.currencies ?? []))
    const taxClasses = new Set(rows.flatMap((row) => row.taxClasses ?? []))

    return {
      primary,
      items: rows,
      count: rows.length,
      severity: rows.some((row) => row.severity === 'check') ? 'check' : 'review',
      currencyCount: currencies.size,
      taxClassCount: taxClasses.size,
    }
  })
}

function selectAdvisoryItem(itemId: string) {
  emit('selectItem', { itemId })
}

function toggleAdvisoryGroup(type: QuotationAnalysisAdvisory['type']) {
  const next = new Set(expandedAdvisoryTypes.value)

  if (next.has(type)) {
    next.delete(type)
  } else {
    next.add(type)
  }

  expandedAdvisoryTypes.value = next
}

function emitSelectItem(payload: { itemId: string }) {
  emit('selectItem', payload)
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(Math.max(value, 0), 100)
}

interface AdvisoryGroup {
  primary: QuotationAnalysisAdvisory
  items: QuotationAnalysisAdvisory[]
  count: number
  severity: QuotationAnalysisAdvisory['severity']
  currencyCount: number
  taxClassCount: number
}
</script>

<template>
  <section class="analysis-view" :aria-label="t('quotations.analysis.aria')">
    <header class="analysis-header">
      <div class="analysis-header-copy">
        <p class="analysis-eyebrow">{{ t('quotations.workspace.modes.analysis') }}</p>
        <h2 class="analysis-title">{{ t('quotations.analysis.title') }}</h2>
        <p class="analysis-description">{{ t('quotations.analysis.description') }}</p>
      </div>

      <div class="analysis-summary" :aria-label="t('quotations.analysis.summary.aria')">
        <article v-for="stat in summaryStats" :key="stat.key" class="summary-metric">
          <span>{{ stat.label }}</span>
          <strong>{{ stat.value }}</strong>
        </article>
      </div>
    </header>

    <section class="analysis-section" :aria-label="t('quotations.analysis.advisories.title')">
      <header class="section-heading">
        <div>
          <h3 class="section-title">{{ t('quotations.analysis.advisories.title') }}</h3>
          <p class="section-description">{{ t('quotations.analysis.advisories.description') }}</p>
        </div>
      </header>

      <div v-if="advisoryCards.length > 0" class="advisory-grid">
        <article
          v-for="card in advisoryCards"
          :key="card.group.primary.type"
          class="advisory-card"
          :class="`advisory-card-${card.group.severity}`"
          :data-advisory-type="card.group.primary.type"
        >
          <span class="advisory-status">{{ card.severityLabel }}</span>
          <strong class="advisory-title">{{ card.title }}</strong>
          <span class="advisory-body">{{ card.body }}</span>
          <span v-if="card.meta" class="advisory-meta">{{ card.meta }}</span>
          <div class="advisory-items" :aria-label="t('quotations.analysis.advisories.affectedItems')">
            <button
              v-for="item in card.itemLinks"
              :key="item.itemId"
              class="advisory-item-button"
              type="button"
              :data-item-id="item.itemId"
              @click="selectAdvisoryItem(item.itemId)"
            >
              <span class="advisory-item-name">{{ item.itemName }}</span>
              <span v-if="item.detail" class="advisory-item-detail">{{ item.detail }}</span>
            </button>
            <button
              v-if="card.hiddenItemCount > 0 || card.isExpanded"
              class="advisory-more-button"
              type="button"
              :aria-expanded="card.isExpanded"
              @click="toggleAdvisoryGroup(card.group.primary.type)"
            >
              {{
                card.isExpanded
                  ? t('quotations.analysis.advisories.showFewerItems')
                  : t('quotations.analysis.advisories.showMoreItems', { count: card.hiddenItemCount })
              }}
            </button>
          </div>
        </article>
      </div>

      <article v-else class="advisory-empty">
        <span class="advisory-status advisory-status-ok">{{ t('quotations.analysis.advisories.severity.ok') }}</span>
        <strong>{{ t('quotations.analysis.advisories.emptyTitle') }}</strong>
        <span>{{ t('quotations.analysis.advisories.emptyBody') }}</span>
      </article>
    </section>

    <QuotationAnalysisKpiCards
      :kpis="props.analysis.kpis"
      :currency="props.currency"
    />

    <section class="analysis-section confidence-section" :aria-label="t('quotations.analysis.confidence.title')">
      <header class="section-heading">
        <div>
          <h3 class="section-title">{{ t('quotations.analysis.confidence.title') }}</h3>
          <p class="section-description">{{ t('quotations.analysis.confidence.description') }}</p>
        </div>
        <strong class="confidence-rate">
          {{ formatPercent(props.analysis.profitConfidence.costVisibilityRate, currentLocale) }}
        </strong>
      </header>

      <div class="confidence-meter" aria-hidden="true">
        <span :style="confidenceBarStyle" />
      </div>

      <div class="confidence-stats">
        <article v-for="stat in confidenceStats" :key="stat.key" class="confidence-stat">
          <span>{{ stat.label }}</span>
          <strong>{{ stat.value }}</strong>
        </article>
      </div>
    </section>

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
        :title="t('quotations.analysis.charts.markup.title')"
        :description="t('quotations.analysis.charts.markup.description')"
      >
        <QuotationAnalysisChart
          :option="markupOption"
          :chart-label="t('quotations.analysis.charts.markup.aria')"
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
        class="analysis-grid-span"
        :title="t('quotations.analysis.charts.bridge.title')"
        :description="t('quotations.analysis.charts.bridge.description')"
      >
        <QuotationAnalysisChart
          :option="bridgeOption"
          :chart-label="t('quotations.analysis.charts.bridge.aria')"
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
  gap: 18px;
  min-width: 0;
  padding: 4px 4px 18px;
}

.analysis-header {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: 18px;
  align-items: stretch;
  padding: 18px 20px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-card);
  box-shadow: var(--shadow-soft);
}

.analysis-header-copy {
  min-width: 0;
}

.analysis-eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
}

.analysis-title {
  margin: 5px 0 0;
  color: var(--text-strong);
  font-size: 24px;
  font-weight: 800;
  line-height: 1.15;
}

.analysis-description {
  max-width: 68ch;
  margin: 8px 0 0;
  color: var(--text-body);
  font-size: 13px;
  line-height: 1.55;
}

.analysis-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.summary-metric {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-raised);
}

.summary-metric span,
.confidence-stat span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.3;
}

.summary-metric strong,
.confidence-stat strong {
  color: var(--text-strong);
  font-size: 19px;
  font-weight: 800;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.analysis-section {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.section-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 800;
}

.section-description {
  max-width: 72ch;
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.advisory-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.advisory-card,
.advisory-empty {
  display: grid;
  gap: 7px;
  min-width: 0;
  min-height: 148px;
  padding: 14px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-card);
  color: inherit;
  text-align: left;
  box-shadow: var(--shadow-soft);
}

.advisory-card {
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.advisory-card:hover {
  border-color: var(--surface-border-strong);
  box-shadow: var(--shadow-card);
}

.advisory-card-check {
  border-color: #fecaca;
}

.advisory-card-review {
  border-color: #fed7aa;
}

.advisory-status {
  width: max-content;
  max-width: 100%;
  padding: 3px 8px;
  border-radius: 999px;
  background: #fef3c7;
  color: #92400e;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
}

.advisory-card-check .advisory-status {
  background: #fee2e2;
  color: #b91c1c;
}

.advisory-status-ok {
  background: var(--accent-surface);
  color: var(--accent);
}

.advisory-title,
.advisory-empty strong {
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 800;
  line-height: 1.25;
}

.advisory-body,
.advisory-empty span:last-child {
  color: var(--text-body);
  font-size: 12px;
  line-height: 1.45;
}

.advisory-meta {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.advisory-items {
  display: grid;
  gap: 6px;
  align-self: end;
  min-width: 0;
  padding-top: 2px;
}

.advisory-item-button {
  display: grid;
  gap: 2px;
  min-width: 0;
  width: 100%;
  padding: 7px 9px;
  border: 1px solid var(--surface-border);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text-strong);
  cursor: pointer;
  text-align: left;
}

.advisory-item-button:hover {
  border-color: var(--accent);
  background: var(--accent-surface);
  color: var(--accent);
}

.advisory-item-name,
.advisory-item-detail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.advisory-item-name {
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
}

.advisory-item-detail {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
}

.advisory-item-button:hover .advisory-item-detail {
  color: var(--accent);
}

.advisory-more-button {
  width: 100%;
  padding: 7px 9px;
  border: 1px dashed var(--surface-border-strong);
  border-radius: 7px;
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
  cursor: pointer;
  text-align: left;
}

.advisory-more-button:hover {
  border-color: var(--accent);
  background: var(--accent-surface);
}

.confidence-section {
  padding: 14px 16px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-card);
  box-shadow: var(--shadow-soft);
}

.confidence-rate {
  color: var(--accent);
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.confidence-meter {
  width: 100%;
  height: 12px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-raised);
}

.confidence-meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}

.confidence-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.confidence-stat {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 10px 0 0;
  border-top: 1px solid var(--surface-border);
}

.analysis-empty {
  display: grid;
  gap: 8px;
  padding: 32px 24px;
  border: 1px dashed var(--surface-border-strong);
  border-radius: 8px;
  background: var(--surface-card);
  text-align: center;
}

.analysis-empty-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 18px;
  font-weight: 700;
}

.analysis-empty-description {
  margin: 0;
  color: var(--text-body);
  font-size: 13px;
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.analysis-grid-span {
  grid-column: 1 / -1;
}

@media (max-width: 1400px) {
  .advisory-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1180px) {
  .analysis-header,
  .analysis-grid {
    grid-template-columns: 1fr;
  }

  .analysis-summary {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .analysis-summary,
  .confidence-stats,
  .advisory-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .section-heading {
    display: grid;
  }
}
</style>
