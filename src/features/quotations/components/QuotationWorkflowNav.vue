<script setup lang="ts">
import { useI18n } from 'vue-i18n'

export type QuotationWorkflowStep = 'details' | 'items' | 'pricing' | 'review' | 'analysis'

defineProps<{ modelValue: QuotationWorkflowStep }>()
const emit = defineEmits<{ 'update:modelValue': [value: QuotationWorkflowStep] }>()
const { t } = useI18n()
const steps: QuotationWorkflowStep[] = ['details', 'items', 'pricing', 'review', 'analysis']

function handleKeydown(event: KeyboardEvent, index: number) {
  let next = index
  if (event.key === 'ArrowRight') next = (index + 1) % steps.length
  else if (event.key === 'ArrowLeft') next = (index + steps.length - 1) % steps.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = steps.length - 1
  else return
  event.preventDefault()
  emit('update:modelValue', steps[next]!)
  const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  buttons?.[next]?.focus()
}
</script>

<template>
  <nav class="workflow-nav" role="tablist" :aria-label="t('workspace.navigation')">
    <button
      v-for="(step, index) in steps"
      :id="`workflow-tab-${step}`"
      :key="step"
      type="button"
      role="tab"
      class="workflow-tab"
      :class="{ 'workflow-tab-active': modelValue === step, 'workflow-tab-analysis': step === 'analysis' }"
      :aria-selected="modelValue === step"
      :aria-controls="`workflow-panel-${step}`"
      :tabindex="modelValue === step ? 0 : -1"
      :data-testid="`workflow-${step}`"
      @click="emit('update:modelValue', step)"
      @keydown="handleKeydown($event, index)"
    >
      <i v-if="step === 'analysis'" class="pi pi-chart-bar" aria-hidden="true" />
      <span v-else class="workflow-number" aria-hidden="true">{{ index + 1 }}</span>
      <span>{{ t(`workspace.${step}`) }}</span>
    </button>
  </nav>
</template>

<style scoped>
.workflow-nav { display: flex; align-items: stretch; gap: 8px; min-width: 0; padding: 0 24px; background: var(--surface-card); border-bottom: 1px solid var(--surface-border); }
.workflow-tab { display: flex; align-items: center; justify-content: center; gap: 9px; min-height: 54px; padding: 0 18px; border: 0; border-bottom: 3px solid transparent; background: transparent; color: var(--text-muted); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.workflow-tab:hover { background: var(--surface-hover); color: var(--text-strong); }
.workflow-tab-active { color: var(--accent); border-bottom-color: var(--accent); }
.workflow-number { display: grid; place-items: center; width: 22px; height: 22px; border: 1px solid var(--surface-border); border-radius: 50%; font-size: 11px; font-variant-numeric: tabular-nums; }
.workflow-tab-active .workflow-number { background: var(--accent); border-color: var(--accent); color: var(--text-on-accent); }
.workflow-tab-analysis { margin-left: auto; }
.workflow-tab:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -5px; }
@media (max-width: 800px) { .workflow-nav { gap: 0; padding: 0 8px; } .workflow-tab { flex: 1; gap: 5px; padding: 0 8px; font-size: 12px; } .workflow-number { width: 18px; height: 18px; } }
@media (max-width: 520px) { .workflow-number, .workflow-tab i { display: none; } }
</style>
