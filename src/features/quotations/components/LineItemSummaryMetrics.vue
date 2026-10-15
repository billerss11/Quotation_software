<script setup lang="ts">
import { computed } from 'vue'

type SummaryMode = 'totals' | 'unit'

type SummaryModeOption = {
  label: string
  value: SummaryMode
}

type SummaryMetric = {
  label: string
  value: string
  kind: 'default' | 'tax' | 'total'
}

const props = withDefaults(defineProps<{
  variant: 'collapsed' | 'expanded'
  summaryMode: SummaryMode
  summaryModeOptions: SummaryModeOption[]
  showSummaryModeControl?: boolean
  metrics: SummaryMetric[]
  summaryModeAriaLabel: string
  collapsedNestedItemCount?: number
  collapsedNestedItemCountLabel?: string
  collapsedNestedItemAriaLabel?: string
}>(), { showSummaryModeControl: true })

const emit = defineEmits<{
  setSummaryMode: [value: SummaryMode]
}>()

const primaryMetric = computed(() =>
  props.metrics.find((metric) => metric.kind === 'total')
  ?? props.metrics[Math.max(0, props.metrics.length - 2)],
)
const supportingMetrics = computed(() => props.metrics.filter((metric) => metric !== primaryMetric.value))
const expandedMetrics = computed(() => {
  const metrics = [...supportingMetrics.value]
  const taxMetricIndex = metrics.findIndex((metric) => metric.kind === 'tax')
  const insertionIndex = taxMetricIndex >= 0 ? taxMetricIndex + 1 : Math.max(0, metrics.length - 1)

  if (primaryMetric.value) {
    metrics.splice(insertionIndex, 0, primaryMetric.value)
  }

  return metrics
})
</script>

<template>
  <div v-if="props.variant === 'collapsed'" class="card-header-summary">
    <span
      v-if="(props.collapsedNestedItemCount ?? 0) > 0"
      class="collapsed-nested-indicator"
      :aria-label="props.collapsedNestedItemAriaLabel"
      :title="props.collapsedNestedItemAriaLabel"
    >
      <i class="pi pi-sitemap" aria-hidden="true" />
      <strong>{{ props.collapsedNestedItemCountLabel }}</strong>
    </span>
    <div v-if="props.showSummaryModeControl !== false" class="summary-mode-toggle" :aria-label="props.summaryModeAriaLabel">
      <button
        v-for="option in props.summaryModeOptions"
        :key="option.value"
        :data-summary-mode="option.value"
        type="button"
        class="summary-mode-button"
        :class="{ 'summary-mode-button-active': props.summaryMode === option.value }"
        :aria-pressed="props.summaryMode === option.value"
        @click="emit('setSummaryMode', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
    <span
      v-for="metric in props.metrics"
      :key="`collapsed-${props.summaryMode}-${metric.label}`"
      class="summary-metric"
      :class="{
        'summary-metric-tax': metric.kind === 'tax',
        'summary-metric-total': metric.kind === 'total',
      }"
    >
      <span class="summary-metric-label">{{ metric.label }}</span>
      <strong class="summary-metric-value">{{ metric.value }}</strong>
    </span>
  </div>

  <div v-else class="item-metrics-shell">
    <div class="item-metrics-bar">
      <div v-if="props.showSummaryModeControl !== false" class="metrics-mode-column">
        <div class="summary-mode-toggle" :aria-label="props.summaryModeAriaLabel">
          <button
            v-for="option in props.summaryModeOptions"
            :key="`expanded-${option.value}`"
            :data-summary-mode="option.value"
            type="button"
            class="summary-mode-button"
            :class="{ 'summary-mode-button-active': props.summaryMode === option.value }"
            :aria-pressed="props.summaryMode === option.value"
            @click="emit('setSummaryMode', option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="metrics-supporting-grid">
        <div
          v-for="metric in expandedMetrics"
          :key="`expanded-${props.summaryMode}-${metric.label}`"
          class="metrics-bar-item"
          :class="{
            'metrics-bar-item-tax': metric.kind === 'tax',
            'metrics-bar-total': metric.kind === 'total',
          }"
        >
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-header-summary {
  grid-column: 3 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 18px;
  padding-top: 4px;
}

.summary-mode-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  flex-shrink: 0;
}

.summary-mode-button {
  min-height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}

.summary-mode-button:hover,
.summary-mode-button-active {
  background: var(--surface-card);
  color: var(--text-strong);
}

.summary-mode-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.summary-metric {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.summary-metric-label,
.metrics-bar-item > span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
}

.summary-metric-value,
.metrics-bar-item > strong {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.collapsed-nested-indicator {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-muted);
  font-size: 12px;
}

.collapsed-nested-indicator strong {
  font-weight: 500;
}

.summary-metric-total .summary-metric-value,
.metrics-bar-total > strong {
  color: var(--accent);
  font-weight: 700;
}

.item-metrics-shell {
  min-width: 0;
  padding-block: 12px;
  border-top: 1px solid var(--surface-border);
  border-bottom: 1px solid var(--surface-border);
}

.item-metrics-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
  min-width: 0;
}

.metrics-mode-column {
  flex: 0 0 auto;
}

.metrics-supporting-grid {
  display: grid;
  flex: 1 1 600px;
  grid-template-columns: repeat(auto-fit, minmax(105px, 1fr));
  gap: 12px 16px;
  min-width: 0;
}

.metrics-bar-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  min-width: 0;
}

@container line-item-card (max-width: 620px) {
  .card-header-summary {
    grid-column: 1 / -1;
  }

  .metrics-supporting-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
