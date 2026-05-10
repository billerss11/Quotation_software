<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationSupportPanelGroupValue, QuotationSupportPanelValue } from '../utils/quotationSupportPanels'
import { getQuotationSupportPanelGroups } from '../utils/quotationSupportPanels'

const activeTab = defineModel<QuotationSupportPanelValue>('activeTab', { default: 'pricing' })
const { t } = useI18n()
const emit = defineEmits<{
  collapse: []
}>()
defineProps<{
  collapsible?: boolean
}>()
const panelGroups = computed(() =>
  getQuotationSupportPanelGroups().map((group) => ({
    ...group,
    label: t(`quotations.supportPanels.groups.${group.value}.label`),
    description: t(`quotations.supportPanels.groups.${group.value}.description`),
    panels: group.panels.map((panel) => ({
      ...panel,
      label: t(`quotations.supportPanels.panels.${panel.value}`),
    })),
  })),
)
const activeGroup = computed(() =>
  panelGroups.value.find((group) =>
    group.panels.some((panel) => panel.value === activeTab.value),
  ) ?? panelGroups.value[0],
)
const visiblePanels = computed(() => activeGroup.value?.panels ?? [])

function activateGroup(groupValue: QuotationSupportPanelGroupValue) {
  const group = panelGroups.value.find((entry) => entry.value === groupValue)
  const firstPanel = group?.panels[0]

  if (firstPanel) {
    activeTab.value = firstPanel.value
  }
}
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

    <div class="panel-groups" role="tablist" :aria-label="t('quotations.supportPanels.groupsAria')">
      <button
        v-for="group in panelGroups"
        :key="group.value"
        class="panel-group"
        :class="{ 'panel-group-active': activeGroup?.value === group.value }"
        role="tab"
        :aria-selected="activeGroup?.value === group.value"
        :aria-label="group.description"
        :data-testid="`support-group-${group.value}`"
        type="button"
        @click="activateGroup(group.value)"
      >
        <i :class="group.icon" aria-hidden="true" />
        <span>{{ group.label }}</span>
      </button>
    </div>

    <div class="panel-tabs" role="tablist" :aria-label="t('quotations.supportPanels.panelsAria')">
      <button
        v-for="panel in visiblePanels"
        :key="panel.value"
        class="panel-tab"
        :class="{ 'panel-tab-active': activeTab === panel.value }"
        role="tab"
        :aria-selected="activeTab === panel.value"
        :data-testid="`support-panel-${panel.value}`"
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

.panel-groups {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  padding: 10px 10px 8px;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-raised);
}

.panel-group {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 50px;
  padding: 7px 4px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  color: var(--text-muted);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}

.panel-group i {
  font-size: 14px;
}

.panel-group span {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
}

.panel-group:hover:not(.panel-group-active) {
  color: var(--text-body);
  background: var(--surface-hover);
}

.panel-group-active {
  color: var(--accent);
  background: var(--accent-surface);
  border-color: var(--accent-soft);
  font-weight: 700;
}

.panel-group:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.panel-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-card);
}

.panel-tab {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  padding: 5px 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}

.panel-tab i {
  flex-shrink: 0;
  font-size: 12px;
}

.panel-tab span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel-tab:hover:not(.panel-tab-active) {
  color: var(--text-body);
  background: var(--surface-hover);
}

.panel-tab-active {
  color: var(--accent);
  background: var(--accent-surface);
  border-color: var(--accent-soft);
  font-weight: 700;
}

.panel-tab:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
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
