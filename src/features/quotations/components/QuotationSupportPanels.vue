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
const showPanelTabs = computed(() => visiblePanels.value.length > 1)

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
      <div class="panel-scope-copy">
        <span class="panel-scope-label">
          <i :class="activeGroup?.icon ?? 'pi pi-file-edit'" aria-hidden="true" />
          {{ activeGroup?.label ?? t('quotations.supportPanels.scopeLabel') }}
        </span>
        <span class="panel-scope-description">
          {{ activeGroup?.description }}
        </span>
      </div>
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
        :aria-label="`${group.label}: ${group.description}`"
        :data-testid="`support-group-${group.value}`"
        type="button"
        @click="activateGroup(group.value)"
      >
        <i :class="group.icon" aria-hidden="true" />
        <span>{{ group.label }}</span>
      </button>
    </div>

    <div v-if="showPanelTabs" class="panel-tabs" role="tablist" :aria-label="t('quotations.supportPanels.panelsAria')">
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

    <div class="panel-body" :class="{ 'panel-body-single': !showPanelTabs }">
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
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-surface) 42%, white), var(--surface-card) 148px),
    var(--surface-card);
  box-shadow: var(--shadow-soft);
}

.panel-scope {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
  padding: 12px 12px 9px;
}

.panel-scope-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.panel-scope-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.2;
}

.panel-scope-label i {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border: 1px solid var(--accent-soft);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent-surface) 80%, white);
  color: var(--accent);
  font-size: 12px;
}

.panel-scope-description {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  gap: 4px;
  margin: 0 10px;
  padding: 3px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface-muted) 78%, white);
}

.panel-group {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 34px;
  padding: 6px 5px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.panel-group i {
  flex-shrink: 0;
  font-size: 12px;
}

.panel-group span {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
}

.panel-group:hover:not(.panel-group-active) {
  color: var(--text-body);
  background: rgb(255 255 255 / 68%);
}

.panel-group-active {
  color: var(--accent);
  background: var(--surface-card);
  border-color: var(--accent-soft);
  font-weight: 700;
  box-shadow: var(--shadow-control);
}

.panel-group:focus-visible {
  outline: 0;
  box-shadow:
    0 0 0 2px var(--accent-ring),
    var(--shadow-control);
}

.panel-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  padding: 9px 10px 10px;
}

.panel-tab {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  padding: 5px 7px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 11px;
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
  background: transparent;
  border-color: transparent;
  font-weight: 700;
}

.panel-tab-active::after {
  content: '';
  position: absolute;
  right: 10px;
  bottom: -10px;
  left: 10px;
  height: 2px;
  border-radius: 999px;
  background: var(--accent);
}

.panel-tab:focus-visible {
  outline: 0;
  box-shadow: 0 0 0 2px var(--accent-ring);
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 14px 16px;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-panel);
}

.panel-body-single {
  margin-top: 10px;
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
