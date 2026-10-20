<script setup lang="ts">
import { computed, useId, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationSupportPanelValue } from '../utils/quotationSupportPanels'
import { getQuotationSupportPanelGroups } from '../utils/quotationSupportPanels'

const activeTab = defineModel<QuotationSupportPanelValue>('activeTab', { default: 'pricing' })
defineProps<{ collapsible?: boolean }>()
const emit = defineEmits<{ collapse: [] }>()
const { t } = useI18n()
const id = useId()
const navigation = useTemplateRef<HTMLElement>('navigation')
const panelBody = useTemplateRef<HTMLElement>('panelBody')
const panels = computed(() => getQuotationSupportPanelGroups().flatMap(group => group.panels))

watch(activeTab, () => {
  if (panelBody.value) panelBody.value.scrollTop = 0
}, { flush: 'post' })

function navigateTabs(event: KeyboardEvent) {
  const index = panels.value.findIndex(panel => panel.value === activeTab.value)
  let nextIndex = index
  if (event.key === 'ArrowRight') nextIndex = (index + 1) % panels.value.length
  else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + panels.value.length) % panels.value.length
  else if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = panels.value.length - 1
  else return
  event.preventDefault()
  activeTab.value = panels.value[nextIndex]!.value
  navigation.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
}
</script>

<template>
  <aside class="quotation-support-panels" :aria-label="t('quotations.supportPanels.aria')">
    <header class="panel-heading">
      <h2>{{ t('quotations.supportPanels.title') }}</h2>
      <button v-if="collapsible" class="panel-collapse" type="button"
        :aria-label="t('quotations.workbench.collapseSupportPanels')"
        v-tooltip.left="t('quotations.workbench.collapseSupportPanels')" @click="emit('collapse')">
        <i class="pi pi-times" aria-hidden="true" />
      </button>
    </header>

    <nav ref="navigation" class="panel-tabs" role="tablist"
      :aria-label="t('quotations.supportPanels.panelsAria')" @keydown="navigateTabs">
      <button v-for="panel in panels" :id="`${id}-tab-${panel.value}`" :key="panel.value"
        class="panel-tab" :class="{ 'panel-tab-active': activeTab === panel.value }"
        type="button" role="tab" :aria-selected="activeTab === panel.value"
        :aria-controls="`${id}-body`" :tabindex="activeTab === panel.value ? 0 : -1"
        :aria-label="t(`quotations.supportPanels.panels.${panel.value}`)"
        :data-testid="`support-panel-${panel.value}`" @click="activeTab = panel.value">
        <i :class="panel.icon" aria-hidden="true" />
        <span>{{ t(`quotations.supportPanels.shortLabels.${panel.value}`) }}</span>
      </button>
    </nav>

    <div ref="panelBody" :id="`${id}-body`" class="panel-body" role="tabpanel"
      :aria-labelledby="`${id}-tab-${activeTab}`" tabindex="0">
      <div class="panel-intro">
        <h3>{{ t(`quotations.supportPanels.panels.${activeTab}`) }}</h3>
        <p>{{ t(`quotations.supportPanels.descriptions.${activeTab}`) }}</p>
      </div>
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
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  border-radius: 16px;
  background: var(--surface-card);
}
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 20px 12px; }
.panel-heading h2 { margin: 0; color: var(--text-strong); font-size: 16px; font-weight: 650; letter-spacing: -0.02em; }
.panel-collapse { display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 6px; background: transparent; color: var(--text-muted); cursor: pointer; }
.panel-collapse:hover { background: var(--surface-muted); color: var(--text-strong); }
.panel-tabs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); flex-shrink: 0; margin: 0 12px; border-bottom: 1px solid var(--surface-border); }
.panel-tab { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-width: 0; min-height: 62px; padding: 8px 2px 12px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--text-muted); font: inherit; font-size: 12px; font-weight: 500; cursor: pointer; transition: color 160ms cubic-bezier(.2,.8,.2,1); }
.panel-tab i { font-size: 15px; }
.panel-tab:hover { color: var(--text-strong); }
.panel-tab-active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 650; }
.panel-tab:focus-visible, .panel-collapse:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -3px; }
.panel-body { flex: 1; min-height: 0; overflow: auto; padding: 22px 20px; scrollbar-gutter: stable; }
.panel-body:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
.panel-intro { margin-bottom: 22px; }
.panel-intro h3 { margin: 0 0 6px; color: var(--text-strong); font-size: 19px; font-weight: 600; letter-spacing: -0.025em; }
.panel-intro p { margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.panel-body :deep(.field) { text-transform: none; letter-spacing: 0; font-size: 12px; font-weight: 500; }
.panel-body :deep(.p-inputtext), .panel-body :deep(.p-inputnumber-input), .panel-body :deep(.p-textarea) { padding: 8px 10px; font-size: 13px; line-height: 1.4; box-shadow: none; }
.panel-body :deep(.p-select-label) { padding: 8px 10px; font-size: 13px; }
.panel-body :deep(.p-inputnumber), .panel-body :deep(.p-select) { min-width: 0; max-width: 100%; }
@media (prefers-reduced-motion: reduce) { .panel-tab { transition: none; } }
</style>
