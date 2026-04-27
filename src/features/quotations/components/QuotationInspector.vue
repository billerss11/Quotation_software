<script setup lang="ts">
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import { shallowRef } from 'vue'

import type { QuotationInspectorTabValue } from '../utils/quotationInspectorTabs'
import { getQuotationInspectorTabs } from '../utils/quotationInspectorTabs'

const activeTab = shallowRef<QuotationInspectorTabValue>('totals')
const tabs = getQuotationInspectorTabs()

const emit = defineEmits<{
  previewActivated: []
}>()

function handleTabChange(value: string | number) {
  if (value === 'preview') {
    emit('previewActivated')
  }
}
</script>

<template>
  <aside class="quotation-inspector" aria-label="Quotation inspector">
    <Tabs v-model:value="activeTab" lazy @update:value="handleTabChange">
      <TabList>
        <Tab v-for="tab in tabs" :key="tab.value" :value="tab.value">
          <span class="tab-label">
            <i :class="tab.icon" aria-hidden="true" />
            <span>{{ tab.label }}</span>
          </span>
        </Tab>
      </TabList>

      <TabPanels>
        <TabPanel value="totals">
          <slot name="totals" />
        </TabPanel>
        <TabPanel value="rates">
          <slot name="rates" />
        </TabPanel>
        <TabPanel value="header">
          <slot name="header" />
        </TabPanel>
        <TabPanel value="preview">
          <slot name="preview" />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </aside>
</template>

<style scoped>
.quotation-inspector {
  position: sticky;
  top: 12px;
  max-height: calc(100vh - 122px);
  min-width: 0;
  border-radius: 8px;
  background: transparent;
  overflow: auto;
}

.quotation-inspector :deep(.p-tablist) {
  border: 1px solid var(--surface-border);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  background: #ffffff;
}

.quotation-inspector :deep(.p-tabs) {
  height: 100%;
}

.quotation-inspector :deep(.p-tablist-tab-list) {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.quotation-inspector :deep(.p-tab) {
  justify-content: center;
  min-height: 44px;
  min-width: 0;
  padding: 10px 6px;
  font-size: 14px;
}

.quotation-inspector :deep(.p-tabpanels) {
  padding: 0;
  background: transparent;
}

.quotation-inspector :deep(.p-tabpanel) {
  padding: 12px;
  display: grid;
  gap: 12px;
}

.tab-label {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
}

.tab-label span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .quotation-inspector {
    position: static;
    max-height: none;
  }
}
</style>
