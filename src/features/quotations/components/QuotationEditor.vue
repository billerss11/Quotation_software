<script setup lang="ts">
import { shallowRef } from 'vue'

import ExchangeRatePanel from './ExchangeRatePanel.vue'
import LineItemsTable from './LineItemsTable.vue'
import QuotationCommandBar from './QuotationCommandBar.vue'
import QuotationHeaderForm from './QuotationHeaderForm.vue'
import QuotationInspector from './QuotationInspector.vue'
import QuotationPreview from './QuotationPreview.vue'
import TotalsPanel from './TotalsPanel.vue'
import { useQuotationEditor } from '../composables/useQuotationEditor'

const {
  quotation,
  savedDrafts,
  itemSummaries,
  totals,
  createNewQuotation,
  saveCurrentQuotation,
  loadLatestQuotation,
  updateExchangeRate,
  addMajorItem,
  addSubItem,
  removeMajorItem,
  removeSubItem,
  duplicateMajorItem,
  moveMajorItem,
  updateMajorItemField,
  updateSubItemField,
  setLogoDataUrl,
} = useQuotationEditor()

const statusMessage = shallowRef('')

function saveDraft() {
  saveCurrentQuotation()
  statusMessage.value = 'Saved locally'
}

function loadDraft() {
  loadLatestQuotation()
  statusMessage.value = savedDrafts.value.length > 0 ? 'Latest draft loaded' : 'No saved drafts yet'
}

function startNewQuotation() {
  createNewQuotation()
  statusMessage.value = 'New quotation ready'
}

function printQuotation() {
  window.print()
}

async function handleLogoSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (file) {
    setLogoDataUrl(await readFileAsDataUrl(file))
    statusMessage.value = 'Logo added to preview'
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsDataURL(file)
  })
}
</script>

<template>
  <div class="quotation-editor">
    <QuotationCommandBar
      :header="quotation.header"
      :totals="totals"
      :status-message="statusMessage"
      @create-new="startNewQuotation"
      @save="saveDraft"
      @load-latest="loadDraft"
      @print="printQuotation"
      @logo-selected="handleLogoSelected"
    />

    <div class="workbench-layout">
      <section class="workbench-main" aria-label="Line item workbench">
        <LineItemsTable
          :items="quotation.majorItems"
          :summaries="itemSummaries"
          :currency="quotation.header.currency"
          :global-markup-rate="quotation.totalsConfig.globalMarkupRate"
          :exchange-rates="quotation.exchangeRates"
          @add-major-item="addMajorItem"
          @add-sub-item="addSubItem"
          @remove-major-item="removeMajorItem"
          @remove-sub-item="removeSubItem"
          @duplicate-major-item="duplicateMajorItem"
          @move-major-item="moveMajorItem"
          @update-major-item-field="updateMajorItemField"
          @update-sub-item-field="updateSubItemField"
        />
      </section>

      <QuotationInspector>
        <template #totals>
          <TotalsPanel v-model="quotation.totalsConfig" :totals="totals" :currency="quotation.header.currency" />
        </template>
        <template #rates>
          <ExchangeRatePanel
            :exchange-rates="quotation.exchangeRates"
            :quotation-currency="quotation.header.currency"
            @update-rate="updateExchangeRate"
          />
        </template>
        <template #header>
          <QuotationHeaderForm v-model="quotation.header" />
        </template>
        <template #preview>
          <QuotationPreview
            :quotation="quotation"
            :summaries="itemSummaries"
            :totals="totals"
            :global-markup-rate="quotation.totalsConfig.globalMarkupRate"
            :exchange-rates="quotation.exchangeRates"
          />
        </template>
      </QuotationInspector>
    </div>
  </div>
</template>

<style scoped>
.quotation-editor {
  display: grid;
  gap: 12px;
  min-height: calc(100vh - 98px);
}

.workbench-layout {
  display: grid;
  grid-template-columns: minmax(760px, 1fr) 420px;
  gap: 12px;
  align-items: stretch;
  min-height: 0;
}

.workbench-main {
  min-width: 0;
  min-height: 0;
}

@media print {
  :global(.command-bar),
  .workbench-main,
  :global(.app-sidebar),
  :global(.app-header) {
    display: none;
  }

  .quotation-editor,
  .workbench-layout,
  :global(.quotation-inspector) {
    display: block;
  }

  .workbench-layout {
    grid-template-columns: 1fr;
  }
}
</style>
