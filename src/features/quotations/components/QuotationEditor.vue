<script setup lang="ts">
import Button from 'primevue/button'
import { shallowRef } from 'vue'

import ExchangeRatePanel from './ExchangeRatePanel.vue'
import LineItemsTable from './LineItemsTable.vue'
import QuotationHeaderForm from './QuotationHeaderForm.vue'
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
    <section class="editor-toolbar">
      <div class="toolbar-actions">
        <Button icon="pi pi-file-plus" label="New" severity="secondary" outlined @click="startNewQuotation" />
        <Button icon="pi pi-save" label="Save" @click="saveDraft" />
        <Button icon="pi pi-folder-open" label="Load latest" severity="secondary" outlined @click="loadDraft" />
        <Button icon="pi pi-print" label="Print" severity="secondary" outlined @click="printQuotation" />
      </div>

      <label class="logo-upload">
        <i class="pi pi-image" aria-hidden="true" />
        <span>Logo</span>
        <input type="file" accept="image/*" @change="handleLogoSelected" />
      </label>

      <p class="status-message" aria-live="polite">{{ statusMessage }}</p>
    </section>

    <div class="editor-grid">
      <section class="editor-stack">
        <QuotationHeaderForm v-model="quotation.header" />
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

      <aside class="side-stack">
        <ExchangeRatePanel
          :exchange-rates="quotation.exchangeRates"
          :quotation-currency="quotation.header.currency"
          @update-rate="updateExchangeRate"
        />
        <TotalsPanel v-model="quotation.totalsConfig" :totals="totals" :currency="quotation.header.currency" />
        <QuotationPreview
          :quotation="quotation"
          :summaries="itemSummaries"
          :totals="totals"
          :global-markup-rate="quotation.totalsConfig.globalMarkupRate"
          :exchange-rates="quotation.exchangeRates"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.quotation-editor {
  display: grid;
  gap: 20px;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 68px;
  padding: 14px 18px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: #ffffff;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.logo-upload {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  color: #334155;
  cursor: pointer;
}

.logo-upload input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.status-message {
  margin: 0 0 0 auto;
  color: #0f766e;
  font-weight: 800;
}

.editor-grid {
  display: grid;
  grid-template-columns: minmax(680px, 1fr) minmax(420px, 520px);
  gap: 20px;
  align-items: start;
}

.editor-stack,
.side-stack {
  display: grid;
  gap: 20px;
}

@media print {
  .editor-toolbar,
  .editor-stack,
  :global(.app-sidebar),
  :global(.app-header) {
    display: none;
  }

  .quotation-editor,
  .editor-grid,
  .side-stack {
    display: block;
  }

  .editor-grid {
    grid-template-columns: 1fr;
  }
}
</style>
