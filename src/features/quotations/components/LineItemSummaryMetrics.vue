<script setup lang="ts">
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
        'summary-metric-total': metric.kind === 'total',
      }"
    >
      <span class="summary-metric-label">{{ metric.label }}</span>
      <strong class="summary-metric-value">{{ metric.value }}</strong>
    </span>
  </div>

  <div v-else class="item-metrics-bar">
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
    <template v-for="(metric, index) in props.metrics" :key="`expanded-${props.summaryMode}-${metric.label}`">
      <i v-if="index > 0" class="pi pi-angle-right metrics-bar-sep" aria-hidden="true" />
      <div
        class="metrics-bar-item"
        :class="{
          'metrics-bar-item-tax': metric.kind === 'tax',
          'metrics-bar-total': metric.kind === 'total',
        }"
      >
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
      </div>
    </template>
  </div>
</template>

<style scoped>
.card-header-summary {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  padding: 4px 2px 0;
}

.summary-mode-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  background: var(--surface-card);
  flex-shrink: 0;
}

.summary-mode-button {
  min-height: 24px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.summary-mode-button:hover:not(.summary-mode-button-active) {
  color: var(--text-body);
  background: rgb(255 255 255 / 60%);
}

.summary-mode-button-active {
  background: var(--accent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 72%, black);
  color: #ffffff;
}

.summary-metric {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.summary-metric-label,
.metrics-bar-item > span {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.summary-metric-value,
.metrics-bar-item > strong {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.collapsed-nested-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-subtle);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.collapsed-nested-indicator i {
  font-size: 11px;
}

.collapsed-nested-indicator strong {
  color: inherit;
  font-size: 12px;
}

.summary-metric-total .summary-metric-label,
.summary-metric-total .summary-metric-value,
.metrics-bar-total > span,
.metrics-bar-total > strong {
  color: var(--accent) !important;
}

.summary-metric-total .summary-metric-value,
.metrics-bar-total > strong {
  font-size: 14px !important;
  font-weight: 800 !important;
}

.item-metrics-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.item-metrics-bar .summary-mode-toggle {
  background: var(--surface-muted);
}

.metrics-bar-item {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.metrics-bar-sep {
  color: var(--text-subtle);
  font-size: 10px;
  align-self: center;
  flex-shrink: 0;
  opacity: 0.55;
}

.metrics-bar-total {
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  background: var(--accent-surface);
  border: 1px solid var(--accent-soft);
  flex-shrink: 0;
}

@container line-item-card (max-width: 700px) {
  .item-metrics-bar {
    gap: 6px;
    padding: 5px 8px;
  }
}

@container line-item-card (max-width: 520px) {
  .item-metrics-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .metrics-bar-total {
    margin-left: 0;
    align-self: stretch;
  }
}
</style>
