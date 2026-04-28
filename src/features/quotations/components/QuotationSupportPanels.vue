<script setup lang="ts">
import Accordion from 'primevue/accordion'
import AccordionContent from 'primevue/accordioncontent'
import AccordionHeader from 'primevue/accordionheader'
import AccordionPanel from 'primevue/accordionpanel'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationSupportPanelValue } from '../utils/quotationSupportPanels'
import { getQuotationSupportPanels } from '../utils/quotationSupportPanels'

const activePanels = shallowRef<QuotationSupportPanelValue[]>(['pricing'])
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
    <Accordion v-model:value="activePanels" multiple>
      <AccordionPanel v-for="panel in panels" :key="panel.value" :value="panel.value">
        <AccordionHeader>
          <span class="panel-label">
            <i :class="panel.icon" aria-hidden="true" />
            <span>{{ panel.label }}</span>
          </span>
        </AccordionHeader>
        <AccordionContent>
          <div class="panel-content">
            <slot :name="panel.value" />
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>
  </aside>
</template>

<style scoped>
.quotation-support-panels {
  position: sticky;
  top: 12px;
  max-height: calc(100vh - 122px);
  min-width: 0;
  overflow: auto;
}

.quotation-support-panels :deep(.p-accordion) {
  display: grid;
  gap: 10px;
}

.quotation-support-panels :deep(.p-accordionpanel) {
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-card);
  box-shadow: var(--shadow-control);
  overflow: hidden;
}

.quotation-support-panels :deep(.p-accordionheader) {
  min-height: 48px;
  padding: 0 14px;
  color: var(--text-strong);
  font-weight: 800;
}

.quotation-support-panels :deep(.p-accordioncontent-content) {
  padding: 0;
  border-top: 1px solid var(--surface-border);
}

.panel-label {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.panel-label span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-content {
  display: grid;
  gap: 12px;
  padding: 12px;
}

</style>
