<script setup lang="ts">
import type { EChartsCoreOption } from 'echarts/core'
import { computed, inject, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import {
  APP_THEME_ID_KEY,
  DEFAULT_APP_THEME_ID,
  getAppThemeDefinition,
} from '@/shared/theme/appTheme'
import { formatCurrency, formatPercent } from '@/shared/utils/formatters'

import type { CurrencyCode } from '../types'
import type {
  QuotationAnalysisAdvisory,
  QuotationAnalysisCurrencyExposureRow,
  QuotationAnalysisDataset,
  QuotationAnalysisMajorItemRow,
} from '../utils/quotationAnalysis'
import QuotationAnalysisChart from './QuotationAnalysisChart.vue'
import QuotationAnalysisChartCard from './QuotationAnalysisChartCard.vue'
import QuotationAnalysisKpiCards from './QuotationAnalysisKpiCards.vue'
import QuotationAnalysisMarginTable from './QuotationAnalysisMarginTable.vue'
import QuotationAnalysisScopeBrowser from './QuotationAnalysisScopeBrowser.vue'

const props = defineProps<{
  analysis: QuotationAnalysisDataset
  currency: CurrencyCode
}>()

const emit = defineEmits<{
  selectItem: [payload: { itemId: string }]
}>()

const ADVISORY_ITEM_LINK_LIMIT = 5
const ANALYSIS_ITEM_PREVIEW_LIMIT = 12
const ANALYSIS_CHART_RENDER_LIMIT = 80
const ANALYSIS_SCOPE_PAGE_SIZE = 80
const { t, locale } = useI18n()
const appThemeId = inject(APP_THEME_ID_KEY, computed(() => DEFAULT_APP_THEME_ID))
const chartTheme = computed(() => getAppThemeDefinition(appThemeId.value))
const chartColors = computed(() => chartTheme.value.chartColors)
const expandedAdvisoryTypes = shallowRef(new Set<QuotationAnalysisAdvisory['type']>())
const expandedAnalysisScopes = shallowRef(new Set<AnalysisScopeKey>())
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
const majorItemRowCount = computed(() => props.analysis.majorItemRows.length)
const currencyExposureRowCount = computed(() => props.analysis.currencyExposure.rows.length)
const costDistributionSourceRows = computed(() =>
  props.analysis.majorItemRows.filter((row) => row.baseSubtotal > 0),
)
const costDistributionRowCount = computed(() => costDistributionSourceRows.value.length)
const costDistributionRows = computed(() =>
  getVisibleAnalysisRows(costDistributionSourceRows.value, 'costDistribution'),
)
const revenueProfitRows = computed(() =>
  getVisibleAnalysisRows(props.analysis.majorItemRows, 'revenueProfit'),
)
const markupRows = computed(() =>
  getVisibleAnalysisRows(props.analysis.majorItemRows, 'markup'),
)
const marginTableRows = computed(() =>
  getVisibleAnalysisRows(props.analysis.majorItemRows, 'marginTable'),
)
const currencyExposureRows = computed(() =>
  getVisibleAnalysisRows(props.analysis.currencyExposure.rows, 'currencyExposure'),
)

function createChartTooltipStyle() {
  return {
    backgroundColor: chartTheme.value.chartSurfaceColor,
    borderColor: chartTheme.value.chartGridColor,
    textStyle: { color: chartTheme.value.chartTextColor },
  }
}

function createChartLegendStyle() {
  return {
    textStyle: { color: chartTheme.value.chartTextColor },
  }
}

function createChartAxisStyle() {
  return {
    axisLine: { lineStyle: { color: chartTheme.value.chartGridColor } },
    splitLine: { lineStyle: { color: chartTheme.value.chartGridColor } },
  }
}

const costDistributionOption = computed<EChartsCoreOption>(() => ({
  color: [...chartColors.value],
  tooltip: {
    ...createChartTooltipStyle(),
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
        borderColor: chartTheme.value.chartGridColor,
        borderWidth: 2,
        gapWidth: 2,
      },
      label: {
        show: true,
        formatter: '{b}',
        fontSize: 11,
      },
      data: costDistributionRows.value
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
    ...createChartTooltipStyle(),
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    valueFormatter: (value: unknown) => formatCurrency(Number(value ?? 0), props.currency, currentLocale.value),
  },
  legend: {
    ...createChartLegendStyle(),
    bottom: 0,
  },
  grid: {
    top: 18,
    right: 20,
    bottom: 48,
    left: 88,
  },
  xAxis: {
    ...createChartAxisStyle(),
    type: 'value',
    axisLabel: {
      color: chartTheme.value.chartTextColor,
      formatter: (value: number) => formatCurrency(value, props.currency, currentLocale.value),
    },
  },
  yAxis: {
    ...createChartAxisStyle(),
    type: 'category',
    axisLabel: { color: chartTheme.value.chartTextColor },
    data: revenueProfitRows.value.map((row) => formatItemName(row.itemName)),
  },
  dataZoom: createCategoryDataZoom(revenueProfitRows.value.length),
  series: [
    {
      name: t('quotations.analysis.charts.revenueProfit.baseCostSeries'),
      type: 'bar',
      stack: 'revenue',
      itemStyle: { color: chartColors.value[4]! },
      data: revenueProfitRows.value.map((row) => ({
        value: row.baseSubtotal,
        itemId: row.itemId,
      })),
    },
    {
      name: t('quotations.analysis.charts.revenueProfit.profitSeries'),
      type: 'bar',
      stack: 'revenue',
      itemStyle: { color: chartColors.value[0]! },
      data: revenueProfitRows.value.map((row) => ({
        value: row.profitAmount,
        itemId: row.itemId,
      })),
    },
  ],
}))

const markupOption = computed<EChartsCoreOption>(() => ({
  tooltip: {
    ...createChartTooltipStyle(),
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
    ...createChartAxisStyle(),
    type: 'value',
    axisLabel: {
      color: chartTheme.value.chartTextColor,
      formatter: (value: number) => formatPercent(value, currentLocale.value),
    },
  },
  yAxis: {
    ...createChartAxisStyle(),
    type: 'category',
    axisLabel: { color: chartTheme.value.chartTextColor },
    data: markupRows.value.map((row) => formatItemName(row.itemName)),
  },
  dataZoom: createCategoryDataZoom(markupRows.value.length),
  series: [
    {
      name: t('quotations.analysis.charts.markup.markupSeries'),
      type: 'bar',
      data: markupRows.value.map((row) => ({
        value: row.effectiveMarkupRate,
        itemId: row.itemId,
        itemStyle: {
          color: row.effectiveMarkupRate <= 0
            ? '#dc2626'
            : row.effectiveMarkupRate < 10
              ? '#d97706'
              : chartColors.value[0]!,
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
      ...createChartTooltipStyle(),
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
      ...createChartAxisStyle(),
      type: 'category',
      axisLabel: { color: chartTheme.value.chartTextColor },
      data: labels,
    },
    yAxis: {
      ...createChartAxisStyle(),
      type: 'value',
      axisLabel: {
        color: chartTheme.value.chartTextColor,
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
            color: step.key === 'grandTotal' ? chartColors.value[0]! : chartColors.value[1]!,
          },
        })),
      },
    ],
  }
})

const currencyExposureOption = computed<EChartsCoreOption>(() => ({
  tooltip: {
    ...createChartTooltipStyle(),
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    valueFormatter: (value: unknown) => formatCurrency(Number(value ?? 0), props.currency, currentLocale.value),
  },
  legend: {
    ...createChartLegendStyle(),
    bottom: 0,
  },
  grid: {
    top: 18,
    right: 20,
    bottom: 48,
    left: 88,
  },
  xAxis: {
    ...createChartAxisStyle(),
    type: 'value',
    axisLabel: {
      color: chartTheme.value.chartTextColor,
      formatter: (value: number) => formatCurrency(value, props.currency, currentLocale.value),
    },
  },
  yAxis: {
    ...createChartAxisStyle(),
    type: 'category',
    axisLabel: { color: chartTheme.value.chartTextColor },
    data: currencyExposureRows.value.map((row) => formatItemName(row.itemName)),
  },
  dataZoom: createCategoryDataZoom(currencyExposureRows.value.length),
  series: props.analysis.currencyExposure.currencies.map((currency, index) => ({
    name: currency,
    type: 'bar',
    stack: 'currency',
    itemStyle: {
      color: chartColors.value[index % chartColors.value.length],
    },
    data: currencyExposureRows.value.map((row) => ({
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

function toggleAnalysisScope(scopeKey: AnalysisScopeKey) {
  const next = new Set(expandedAnalysisScopes.value)

  if (next.has(scopeKey)) {
    next.delete(scopeKey)
  } else {
    next.add(scopeKey)
  }

  expandedAnalysisScopes.value = next
}

function isAnalysisScopeExpanded(scopeKey: AnalysisScopeKey) {
  return expandedAnalysisScopes.value.has(scopeKey)
}

function getVisibleAnalysisRows<T>(rows: T[], scopeKey: AnalysisScopeKey) {
  const limit = isAnalysisScopeExpanded(scopeKey)
    ? ANALYSIS_CHART_RENDER_LIMIT
    : ANALYSIS_ITEM_PREVIEW_LIMIT

  return rows.slice(0, limit)
}

function shouldShowAnalysisScopeToggle(totalCount: number) {
  return totalCount > ANALYSIS_ITEM_PREVIEW_LIMIT
}

function getAnalysisScopeLabel(scopeKey: AnalysisScopeKey, totalCount: number) {
  if (isAnalysisScopeExpanded(scopeKey)) {
    return t('quotations.analysis.scope.showFewerItems')
  }

  return t('quotations.analysis.scope.showAllItems', { count: totalCount })
}

function isAnalysisScopeChartCapped(scopeKey: AnalysisScopeKey, totalCount: number) {
  return isAnalysisScopeExpanded(scopeKey) && totalCount > ANALYSIS_CHART_RENDER_LIMIT
}

function getScopeAriaLabel(titleKey: string) {
  return t('quotations.analysis.scope.allItemsAria', {
    section: t(titleKey),
  })
}

function getCurrencyExposureDetail(row: QuotationAnalysisCurrencyExposureRow) {
  const parts = props.analysis.currencyExposure.currencies
    .map((currency) => ({
      currency,
      amount: row.values[currency] ?? 0,
    }))
    .filter(({ amount }) => amount > 0)
    .map(({ currency, amount }) =>
      `${currency} ${formatCurrency(amount, props.currency, currentLocale.value)}`,
    )

  return parts.join(' / ') || t('quotations.analysis.scope.noAmount')
}

function resolveCurrencyExposureScopeItem(row: unknown) {
  const exposureRow = row as QuotationAnalysisCurrencyExposureRow

  return {
    itemId: exposureRow.itemId,
    itemName: formatItemName(exposureRow.itemName),
    detail: getCurrencyExposureDetail(exposureRow),
  }
}

function resolveMarkupScopeItem(row: unknown) {
  const majorRow = row as QuotationAnalysisMajorItemRow

  return {
    itemId: majorRow.itemId,
    itemName: formatItemName(majorRow.itemName),
    detail: t('quotations.analysis.scope.markupDetail', {
      rate: formatPercent(majorRow.effectiveMarkupRate, currentLocale.value),
    }),
  }
}

function resolveRevenueProfitScopeItem(row: unknown) {
  const majorRow = row as QuotationAnalysisMajorItemRow

  return {
    itemId: majorRow.itemId,
    itemName: formatItemName(majorRow.itemName),
    detail: t('quotations.analysis.scope.revenueProfitDetail', {
      revenue: formatCurrency(majorRow.subtotal, props.currency, currentLocale.value),
      profit: formatCurrency(majorRow.profitAmount, props.currency, currentLocale.value),
    }),
  }
}

function resolveCostDistributionScopeItem(row: unknown) {
  const majorRow = row as QuotationAnalysisMajorItemRow

  return {
    itemId: majorRow.itemId,
    itemName: formatItemName(majorRow.itemName),
    detail: t('quotations.analysis.scope.costDetail', {
      cost: formatCurrency(majorRow.baseSubtotal, props.currency, currentLocale.value),
    }),
  }
}

function resolveMarginTableScopeItem(row: unknown) {
  const majorRow = row as QuotationAnalysisMajorItemRow

  return {
    itemId: majorRow.itemId,
    itemName: formatItemName(majorRow.itemName),
    detail: t('quotations.analysis.scope.marginDetail', {
      margin: formatPercent(majorRow.grossMarginRate, currentLocale.value),
      profit: formatCurrency(majorRow.profitAmount, props.currency, currentLocale.value),
    }),
  }
}

function createCategoryDataZoom(rowCount: number) {
  if (rowCount <= ANALYSIS_ITEM_PREVIEW_LIMIT) {
    return []
  }

  return [
    {
      type: 'slider',
      yAxisIndex: 0,
      right: 0,
      width: 14,
      startValue: 0,
      endValue: ANALYSIS_ITEM_PREVIEW_LIMIT - 1,
    },
    {
      type: 'inside',
      yAxisIndex: 0,
    },
  ]
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

type AnalysisScopeKey =
  | 'currencyExposure'
  | 'markup'
  | 'revenueProfit'
  | 'costDistribution'
  | 'marginTable'
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
        <template #actions>
          <button
            v-if="shouldShowAnalysisScopeToggle(currencyExposureRowCount)"
            class="scope-toggle-button"
            type="button"
            data-scope-key="currencyExposure"
            :aria-expanded="isAnalysisScopeExpanded('currencyExposure')"
            @click="toggleAnalysisScope('currencyExposure')"
          >
            {{ getAnalysisScopeLabel('currencyExposure', currencyExposureRowCount) }}
          </button>
        </template>
        <QuotationAnalysisChart
          :option="currencyExposureOption"
          :chart-label="t('quotations.analysis.charts.currencyExposure.aria')"
          @select="emitSelectItem"
        />
        <p
          v-if="isAnalysisScopeChartCapped('currencyExposure', currencyExposureRowCount)"
          class="scope-limit-note"
        >
          {{
            t('quotations.analysis.scope.chartLimitNote', {
              shown: ANALYSIS_CHART_RENDER_LIMIT,
              total: currencyExposureRowCount,
            })
          }}
        </p>
        <QuotationAnalysisScopeBrowser
          v-if="isAnalysisScopeExpanded('currencyExposure')"
          :rows="props.analysis.currencyExposure.rows"
          :resolve-item="resolveCurrencyExposureScopeItem"
          :page-size="ANALYSIS_SCOPE_PAGE_SIZE"
          :label="getScopeAriaLabel('quotations.analysis.charts.currencyExposure.title')"
          @select-item="emitSelectItem"
        />
      </QuotationAnalysisChartCard>

      <QuotationAnalysisChartCard
        :title="t('quotations.analysis.charts.markup.title')"
        :description="t('quotations.analysis.charts.markup.description')"
      >
        <template #actions>
          <button
            v-if="shouldShowAnalysisScopeToggle(majorItemRowCount)"
            class="scope-toggle-button"
            type="button"
            data-scope-key="markup"
            :aria-expanded="isAnalysisScopeExpanded('markup')"
            @click="toggleAnalysisScope('markup')"
          >
            {{ getAnalysisScopeLabel('markup', majorItemRowCount) }}
          </button>
        </template>
        <QuotationAnalysisChart
          :option="markupOption"
          :chart-label="t('quotations.analysis.charts.markup.aria')"
          @select="emitSelectItem"
        />
        <p
          v-if="isAnalysisScopeChartCapped('markup', majorItemRowCount)"
          class="scope-limit-note"
        >
          {{
            t('quotations.analysis.scope.chartLimitNote', {
              shown: ANALYSIS_CHART_RENDER_LIMIT,
              total: majorItemRowCount,
            })
          }}
        </p>
        <QuotationAnalysisScopeBrowser
          v-if="isAnalysisScopeExpanded('markup')"
          :rows="props.analysis.majorItemRows"
          :resolve-item="resolveMarkupScopeItem"
          :page-size="ANALYSIS_SCOPE_PAGE_SIZE"
          :label="getScopeAriaLabel('quotations.analysis.charts.markup.title')"
          @select-item="emitSelectItem"
        />
      </QuotationAnalysisChartCard>

      <QuotationAnalysisChartCard
        :title="t('quotations.analysis.charts.revenueProfit.title')"
        :description="t('quotations.analysis.charts.revenueProfit.description')"
      >
        <template #actions>
          <button
            v-if="shouldShowAnalysisScopeToggle(majorItemRowCount)"
            class="scope-toggle-button"
            type="button"
            data-scope-key="revenueProfit"
            :aria-expanded="isAnalysisScopeExpanded('revenueProfit')"
            @click="toggleAnalysisScope('revenueProfit')"
          >
            {{ getAnalysisScopeLabel('revenueProfit', majorItemRowCount) }}
          </button>
        </template>
        <QuotationAnalysisChart
          :option="revenueProfitOption"
          :chart-label="t('quotations.analysis.charts.revenueProfit.aria')"
          @select="emitSelectItem"
        />
        <p
          v-if="isAnalysisScopeChartCapped('revenueProfit', majorItemRowCount)"
          class="scope-limit-note"
        >
          {{
            t('quotations.analysis.scope.chartLimitNote', {
              shown: ANALYSIS_CHART_RENDER_LIMIT,
              total: majorItemRowCount,
            })
          }}
        </p>
        <QuotationAnalysisScopeBrowser
          v-if="isAnalysisScopeExpanded('revenueProfit')"
          :rows="props.analysis.majorItemRows"
          :resolve-item="resolveRevenueProfitScopeItem"
          :page-size="ANALYSIS_SCOPE_PAGE_SIZE"
          :label="getScopeAriaLabel('quotations.analysis.charts.revenueProfit.title')"
          @select-item="emitSelectItem"
        />
      </QuotationAnalysisChartCard>

      <QuotationAnalysisChartCard
        :title="t('quotations.analysis.charts.costDistribution.title')"
        :description="t('quotations.analysis.charts.costDistribution.description')"
      >
        <template #actions>
          <button
            v-if="shouldShowAnalysisScopeToggle(costDistributionRowCount)"
            class="scope-toggle-button"
            type="button"
            data-scope-key="costDistribution"
            :aria-expanded="isAnalysisScopeExpanded('costDistribution')"
            @click="toggleAnalysisScope('costDistribution')"
          >
            {{ getAnalysisScopeLabel('costDistribution', costDistributionRowCount) }}
          </button>
        </template>
        <QuotationAnalysisChart
          :option="costDistributionOption"
          :chart-label="t('quotations.analysis.charts.costDistribution.aria')"
          @select="emitSelectItem"
        />
        <p
          v-if="isAnalysisScopeChartCapped('costDistribution', costDistributionRowCount)"
          class="scope-limit-note"
        >
          {{
            t('quotations.analysis.scope.chartLimitNote', {
              shown: ANALYSIS_CHART_RENDER_LIMIT,
              total: costDistributionRowCount,
            })
          }}
        </p>
        <QuotationAnalysisScopeBrowser
          v-if="isAnalysisScopeExpanded('costDistribution')"
          :rows="costDistributionSourceRows"
          :resolve-item="resolveCostDistributionScopeItem"
          :page-size="ANALYSIS_SCOPE_PAGE_SIZE"
          :label="getScopeAriaLabel('quotations.analysis.charts.costDistribution.title')"
          @select-item="emitSelectItem"
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
        <template #actions>
          <button
            v-if="shouldShowAnalysisScopeToggle(majorItemRowCount)"
            class="scope-toggle-button"
            type="button"
            data-scope-key="marginTable"
            :aria-expanded="isAnalysisScopeExpanded('marginTable')"
            @click="toggleAnalysisScope('marginTable')"
          >
            {{ getAnalysisScopeLabel('marginTable', majorItemRowCount) }}
          </button>
        </template>
        <QuotationAnalysisMarginTable
          :rows="marginTableRows"
          :currency="props.currency"
          @select-item="emitSelectItem"
        />
        <p
          v-if="isAnalysisScopeChartCapped('marginTable', majorItemRowCount)"
          class="scope-limit-note"
        >
          {{
            t('quotations.analysis.scope.chartLimitNote', {
              shown: ANALYSIS_CHART_RENDER_LIMIT,
              total: majorItemRowCount,
            })
          }}
        </p>
        <QuotationAnalysisScopeBrowser
          v-if="isAnalysisScopeExpanded('marginTable')"
          :rows="props.analysis.majorItemRows"
          :resolve-item="resolveMarginTableScopeItem"
          :page-size="ANALYSIS_SCOPE_PAGE_SIZE"
          :label="getScopeAriaLabel('quotations.analysis.marginTable.title')"
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
  padding: 4px 4px 18px;
}

.analysis-header {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: 16px;
  align-items: stretch;
  padding: 18px 20px;
  border: 1px solid var(--surface-border);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(180deg, var(--surface-card) 0, var(--surface-raised) 100%),
    var(--surface-card);
  box-shadow: var(--shadow-card);
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
  border-radius: var(--radius-md);
  background: var(--surface-card);
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--accent) 36%, var(--surface-border));
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

.scope-toggle-button {
  flex: 0 0 auto;
  padding: 6px 10px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
}

.scope-toggle-button:hover {
  border-color: var(--accent);
  background: var(--accent-surface);
}

.scope-limit-note {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.advisory-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.advisory-card,
.advisory-empty {
  display: grid;
  gap: 7px;
  min-width: 0;
  min-height: 148px;
  padding: 14px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
  color: inherit;
  text-align: left;
  box-shadow: var(--shadow-card);
}

.advisory-card {
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.advisory-card:hover {
  border-color: var(--surface-border-strong);
  box-shadow: var(--shadow-soft);
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
  border-left: 4px solid var(--accent);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(180deg, var(--surface-card) 0, var(--surface-raised) 100%),
    var(--surface-card);
  box-shadow: var(--shadow-card);
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
  height: 10px;
  overflow: hidden;
  border-radius: var(--radius-xs);
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
  border-radius: var(--radius-lg);
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
  gap: 12px;
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
