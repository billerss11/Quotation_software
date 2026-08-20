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

      <div
        v-if="primaryMetric"
        class="metrics-bar-item metrics-bar-primary"
        :class="{ 'metrics-bar-total': primaryMetric.kind === 'total' }"
      >
        <span>{{ primaryMetric.label }}</span>
        <strong>{{ primaryMetric.value }}</strong>
      </div>

      <div class="metrics-supporting-grid">
        <div
          v-for="metric in supportingMetrics"
          :key="`expanded-${props.summaryMode}-${metric.label}`"
          class="metrics-bar-item"
          :class="{ 'metrics-bar-item-tax': metric.kind === 'tax' }"
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
  gap: 4px 10px;
  padding: 2px 2px 0 65px;
}

.summary-mode-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  background: var(--surface-card);
  flex-shrink: 0;
}

.summary-mode-button {
  min-height: 21px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  transition:
    color 180ms cubic-bezier(0.32, 0.72, 0, 1),
    background-color 180ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 180ms cubic-bezier(0.32, 0.72, 0, 1);
}

.summary-mode-button:hover:not(.summary-mode-button-active) {
  color: var(--text-body);
  background: var(--surface-hover);
}

.summary-mode-button-active {
  background: var(--accent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 72%, black);
  color: var(--text-on-accent);
}

.summary-mode-button:active {
  transform: scale(0.96);
}

.summary-metric {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding: 1px 0;
}

.summary-metric-label,
.metrics-bar-item > span {
  color: var(--text-muted);
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.035em;
  white-space: nowrap;
}

.summary-metric-value,
.metrics-bar-item > strong {
  color: var(--text-strong);
  font-size: 12px;
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
  font-size: 13px !important;
  font-weight: 800 !important;
}

.item-metrics-shell {
  padding: 2px;
  border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--surface-border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 5%, var(--surface-muted));
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 70%),
    0 1px 3px rgb(15 23 42 / 4%);
}

.item-metrics-bar {
  display: grid;
  grid-template-columns: max-content minmax(132px, 0.9fr) minmax(0, 3.2fr);
  align-items: stretch;
  gap: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, white 68%, var(--surface-border));
  border-radius: 8px;
  background: var(--surface-card);
  flex-shrink: 0;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 82%),
    0 5px 14px rgb(15 23 42 / 5%);
}

.metrics-mode-column {
  display: grid;
  align-content: center;
  padding: 5px;
  background: color-mix(in srgb, var(--surface-muted) 68%, var(--surface-card));
}

.item-metrics-bar .summary-mode-toggle {
  width: max-content;
  border-color: color-mix(in srgb, var(--surface-border) 64%, transparent);
  background: var(--surface-card);
}

.item-metrics-bar .summary-mode-button {
  padding-inline: 6px;
}

.metrics-bar-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  min-width: 0;
  padding: 5px 7px;
}

.metrics-bar-item > span,
.metrics-bar-item > strong {
  overflow: hidden;
  line-height: 1.1;
  text-overflow: ellipsis;
}

.metrics-bar-item > span {
  display: -webkit-box;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.metrics-supporting-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  min-width: 0;
  border-left: 1px solid color-mix(in srgb, var(--surface-border) 58%, transparent);
}

.metrics-supporting-grid .metrics-bar-item {
  border-left: 1px solid color-mix(in srgb, var(--surface-border) 58%, transparent);
}

.metrics-supporting-grid .metrics-bar-item:first-child {
  border-left: 0;
}

.metrics-bar-primary {
  position: relative;
  padding: 6px 10px 6px 13px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 95%, #062b25), var(--accent-hover));
  border-left: 0;
  flex-shrink: 0;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 15%);
}

.metrics-bar-primary::before {
  position: absolute;
  inset: 7px auto 7px 6px;
  width: 2px;
  border-radius: 999px;
  background: rgb(255 255 255 / 38%);
  content: '';
}

.metrics-bar-primary > span,
.metrics-bar-primary > strong {
  color: var(--text-on-accent) !important;
}

.metrics-bar-primary > span {
  opacity: 0.72;
}

.metrics-bar-primary > strong {
  overflow: hidden;
  font-size: 14px !important;
  letter-spacing: -0.025em;
  text-overflow: ellipsis;
}

@container line-item-card (max-width: 600px) {
  .item-metrics-bar {
    grid-template-columns: max-content minmax(118px, 0.9fr) minmax(0, 1.8fr);
  }

  .metrics-supporting-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .metrics-supporting-grid .metrics-bar-item:nth-child(3n + 1) {
    border-left: 0;
  }

  .metrics-supporting-grid .metrics-bar-item:nth-child(n + 4) {
    border-top: 1px solid color-mix(in srgb, var(--surface-border) 58%, transparent);
  }
}

@container line-item-card (max-width: 520px) {
  .item-metrics-bar {
    grid-template-columns: max-content minmax(112px, 0.85fr) minmax(0, 1.5fr);
  }

  .metrics-supporting-grid {
    grid-column: auto;
    border-top: 0;
    border-left: 1px solid color-mix(in srgb, var(--surface-border) 58%, transparent);
  }

  .metrics-bar-item {
    padding: 6px 7px;
  }

  .metrics-bar-item > span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .metrics-bar-item > strong {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
