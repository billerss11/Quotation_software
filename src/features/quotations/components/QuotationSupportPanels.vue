<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationSupportPanelValue } from '../utils/quotationSupportPanels'
import { getQuotationSupportPanels } from '../utils/quotationSupportPanels'

const activeTab = defineModel<QuotationSupportPanelValue>('activeTab', { default: 'pricing' })
const { t } = useI18n()
const emit = defineEmits<{
  collapse: []
}>()
defineProps<{
  collapsible?: boolean
}>()
const panels = computed(() =>
  getQuotationSupportPanels().map((panel) => ({
    ...panel,
    label: t(`quotations.supportPanels.panels.${panel.value}`),
  })),
)
</script>

<template>
  <aside class="quotation-support-panels" :aria-label="t('quotations.supportPanels.aria')">
    <header class="panel-scope">
      <span class="panel-scope-label">
        <i class="pi pi-file-edit" aria-hidden="true" />
        {{ t('quotations.supportPanels.scopeLabel') }}
      </span>
      <button
        v-if="collapsible"
        type="button"
        class="panel-collapse"
        :aria-label="t('quotations.workbench.collapseSupportPanels')"
        v-tooltip.left="`${t('quotations.workbench.collapseSupportPanels')}  ·  Ctrl + B`"
        @click="emit('collapse')"
      >
        <i class="pi pi-angle-double-right" aria-hidden="true" />
      </button>
    </header>

    <div class="panel-tabs" role="tablist">
      <button
        v-for="panel in panels"
        :key="panel.value"
        class="panel-tab"
        :class="{ 'panel-tab-active': activeTab === panel.value }"
        role="tab"
        :aria-selected="activeTab === panel.value"
        type="button"
        @click="activeTab = panel.value"
      >
        <i :class="panel.icon" aria-hidden="true" />
        <span>{{ panel.label }}</span>
      </button>
    </div>

    <div class="panel-body">
      <slot :name="activeTab" />
    </div>
  </aside>
</template>

<style scoped>
.quotation-support-panels {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.panel-scope {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
  padding: 8px 12px;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-muted);
}

.panel-scope-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.panel-scope-label i {
  font-size: 11px;
  color: var(--accent);
}

.panel-collapse {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.panel-collapse:hover {
  color: var(--accent);
  background: var(--surface-hover);
}

.panel-collapse:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.panel-collapse i {
  font-size: 11px;
}

.panel-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 0;
  padding: 4px 6px 0;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-raised);
}

.panel-tab {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 6px 4px;
  margin-bottom: -1px;
  border: 0;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.panel-tab i {
  font-size: 12px;
}

.panel-tab:hover:not(.panel-tab-active) {
  color: var(--text-body);
  background: var(--surface-hover);
}

.panel-tab-active {
  color: var(--accent);
  background: var(--surface-card);
  border-bottom: 2px solid var(--accent);
  font-weight: 700;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 14px 16px;
}

/* Compact inputs inside the side rail */

.panel-body :deep(.p-inputtext),
.panel-body :deep(.p-inputnumber-input),
.panel-body :deep(.p-textarea) {
  padding: 5px 9px;
  font-size: 13px;
  line-height: 1.4;
}

.panel-body :deep(.p-select) {
  min-height: 0;
}

.panel-body :deep(.p-select-label) {
  padding: 5px 9px;
  font-size: 13px;
  line-height: 1.4;
}
</style>
