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

const props = defineProps<{
  variant: 'collapsed' | 'expanded'
  summaryMode: SummaryMode
  summaryModeOptions: SummaryModeOption[]
  metrics: SummaryMetric[]
  summaryModeAriaLabel: string
  collapsedNestedItemCount?: number
  collapsedNestedItemCountLabel?: string
  collapsedNestedItemAriaLabel?: string
}>()

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
    <div class="summary-mode-toggle" :aria-label="props.summaryModeAriaLabel">
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
        'summary-metric-primary': metric === primaryMetric,
        'summary-metric-total': metric.kind === 'total',
      }"
    >
      <span class="summary-metric-label">{{ metric.label }}</span>
      <strong class="summary-metric-value">{{ metric.value }}</strong>
    </span>
  </div>

  <div v-else class="item-metrics-shell">
    <div class="item-metrics-bar">
      <div class="metrics-mode-column">
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
            'metrics-bar-primary': metric === primaryMetric,
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
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 18px;
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--surface-border);
}
.summary-mode-toggle {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  padding: 2px;
  border: 1px solid var(--surface-border);
  border-radius: 5px;
  background: var(--surface-card);
}
.summary-mode-button {
  min-height: 26px;
  padding: 0 9px;
  border: 0;
  border-radius: 3px;
  color: var(--text-muted);
  background: transparent;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.summary-mode-button:hover {
  background: var(--surface-hover);
}
.summary-mode-button-active {
  color: var(--accent-hover);
  background: var(--accent-surface);
}
.summary-mode-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.summary-metric {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.summary-metric-label, .metrics-bar-item > span {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
}
.summary-metric-value, .metrics-bar-item > strong {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
  line-height: 1.4;
}
.summary-metric-primary .summary-metric-value, .metrics-bar-primary > strong {
  color: var(--accent-emphasis);
  font-weight: 750;
}
.collapsed-nested-indicator {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-subtle);
  font-size: 11px;
}
.collapsed-nested-indicator strong {
  font-weight: 600;
}
.item-metrics-shell {
  margin-inline: -16px;
  padding-inline: 16px;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-raised);
}
.item-metrics-bar {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 12px 0;
  min-width: 0;
}
.metrics-mode-column {
  flex-shrink: 0;
}
.metrics-supporting-grid {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 12px 20px;
  min-width: 0;
}
.metrics-bar-item {
  display: grid;
  flex: 1 1 90px;
  align-content: start;
  gap: 4px;
  min-width: 0;
  text-align: right;
}
@container line-item-card (max-width: 640px) {
  .item-metrics-bar {
    align-items: start;
    gap: 12px;
  }
  .summary-mode-toggle {
    flex-direction: column;
  }
  .summary-mode-button {
    width: 100%;
  }
  .metrics-supporting-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .summary-metric {
    flex: 1 1 90px;
  }
}
@container line-item-card (max-width: 540px) {
  .item-metrics-shell {
    margin-inline: -10px;
    padding-inline: 10px;
  }
}
</style>
