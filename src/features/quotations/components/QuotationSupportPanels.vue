<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationSupportPanelValue } from '../utils/quotationSupportPanels'
import { getQuotationSupportPanels } from '../utils/quotationSupportPanels'

const activeTab = shallowRef<QuotationSupportPanelValue>('pricing')
const { t } = useI18n()
const panels = computed(() =>
  getQuotationSupportPanels().map((panel) => ({
    ...panel,
    label: t(`quotations.supportPanels.panels.${panel.value}`),
  })),
)
</script>

<template>
  <aside class="quotation-support-panels" :aria-label="t('quotations.supportPanels.aria')">
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
  border-radius: 8px;
  background: var(--surface-card);
  box-shadow: var(--shadow-control);
}

.panel-tabs {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-raised);
}

.panel-tab {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 36px;
  padding: 0 8px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: color 0.13s, border-color 0.13s, background 0.13s;
  white-space: nowrap;
}

.panel-tab i {
  font-size: 12px;
}

.panel-tab:hover {
  color: var(--text-strong);
  background: var(--surface-hover);
}

.panel-tab-active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: var(--surface-card);
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 10px 10px;
}

/* ─── compact inputs scoped to the side-rail panels ─────────────────────── */

.panel-body :deep(.p-inputtext) {
  padding: 4px 8px;
  font-size: 13px;
  line-height: 1.4;
  min-height: 0;
}

.panel-body :deep(.p-inputnumber-input) {
  padding: 4px 8px;
  font-size: 13px;
  line-height: 1.4;
}

.panel-body :deep(.p-select) {
  min-height: 0;
}

.panel-body :deep(.p-select-label) {
  padding: 4px 8px;
  font-size: 13px;
  line-height: 1.4;
}

.panel-body :deep(.p-textarea) {
  padding: 4px 8px;
  font-size: 13px;
  line-height: 1.4;
}
</style>
