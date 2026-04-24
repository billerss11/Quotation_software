<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import { formatCurrency } from '@/shared/utils/formatters'

import type { QuotationHeader, QuotationTotals } from '../types'
import { getCommandBarActions } from '../utils/commandBarActions'

const props = defineProps<{
  header: QuotationHeader
  totals: QuotationTotals
  statusMessage: string
  currentFilePath: string
  hasNativeFileDialogs: boolean
}>()

const emit = defineEmits<{
  createNew: []
  save: []
  saveAs: []
  importCsv: []
  exportCsvTemplate: []
  importJson: []
  exportJson: []
  loadLatest: []
  print: []
  logoSelected: [event: Event]
}>()

const fileName = computed(() => {
  if (!props.currentFilePath) {
    return 'Unsaved file'
  }

  return props.currentFilePath.split(/[\\/]/).at(-1) || props.currentFilePath
})

const actions = computed(() => getCommandBarActions(props.hasNativeFileDialogs))
</script>

<template>
  <section class="command-bar" aria-label="Quotation commands">
    <div class="quote-context">
      <div class="quote-number">{{ header.quotationNumber }}</div>
      <div class="quote-meta">
        <strong>{{ header.projectName || 'Untitled quotation' }}</strong>
        <span>{{ header.customerCompany || header.customerName || 'No customer selected' }} - {{ fileName }}</span>
      </div>
    </div>

    <div class="quote-total">
      <span>Total</span>
      <strong>{{ formatCurrency(totals.grandTotal, header.currency) }}</strong>
    </div>

    <div class="command-actions">
      <Button
        v-if="actions.includes('new')"
        icon="pi pi-file-plus"
        severity="secondary"
        text
        rounded
        aria-label="New"
        @click="emit('createNew')"
      />
      <Button
        v-if="actions.includes('save')"
        icon="pi pi-save"
        label="Save"
        rounded
        aria-label="Save"
        @click="emit('save')"
      />
      <Button
        v-if="actions.includes('saveAs')"
        icon="pi pi-save"
        label="Save As"
        severity="secondary"
        text
        rounded
        aria-label="Save as"
        @click="emit('saveAs')"
      />
      <Button
        v-if="actions.includes('downloadJson')"
        icon="pi pi-download"
        label="Download JSON"
        severity="secondary"
        text
        rounded
        aria-label="Download JSON"
        @click="emit('saveAs')"
      />
      <Button
        v-if="actions.includes('importCsv')"
        icon="pi pi-file-import"
        label="Import CSV"
        severity="secondary"
        text
        rounded
        aria-label="Import CSV"
        @click="emit('importCsv')"
      />
      <Button
        v-if="actions.includes('exportCsvTemplate')"
        icon="pi pi-file-export"
        label="Export CSV Template"
        severity="secondary"
        text
        rounded
        aria-label="Export CSV Template"
        @click="emit('exportCsvTemplate')"
      />
      <Button
        v-if="actions.includes('importJson')"
        icon="pi pi-upload"
        label="Import JSON"
        severity="secondary"
        text
        rounded
        aria-label="Import JSON"
        @click="emit('importJson')"
      />
      <Button
        v-if="actions.includes('exportJson')"
        icon="pi pi-download"
        label="Export JSON"
        severity="secondary"
        text
        rounded
        aria-label="Export JSON"
        @click="emit('exportJson')"
      />
      <Button
        v-if="actions.includes('loadLatest')"
        icon="pi pi-folder-open"
        severity="secondary"
        text
        rounded
        aria-label="Load latest"
        @click="emit('loadLatest')"
      />
      <Button
        v-if="actions.includes('print')"
        icon="pi pi-print"
        severity="secondary"
        text
        rounded
        aria-label="Print"
        @click="emit('print')"
      />
      <label v-if="actions.includes('logo')" class="logo-button" aria-label="Upload logo">
        <i class="pi pi-image" aria-hidden="true" />
        <input type="file" accept="image/*" @change="emit('logoSelected', $event)" />
      </label>
    </div>

    <p class="status-message" aria-live="polite">{{ statusMessage }}</p>
  </section>
</template>

<style scoped>
.command-bar {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) auto auto minmax(120px, auto);
  gap: 18px;
  align-items: center;
  min-height: 64px;
  padding: 10px 16px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: #ffffff;
}

.quote-context {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.quote-number {
  display: inline-grid;
  min-width: 112px;
  height: 40px;
  place-items: center;
  border-radius: 8px;
  background: #ecfdf5;
  color: #0f766e;
  font-weight: 850;
}

.quote-meta {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.quote-meta strong,
.quote-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-meta strong {
  color: var(--text-strong);
}

.quote-meta span,
.quote-total span,
.status-message {
  color: #64748b;
}

.quote-total {
  display: grid;
  justify-items: end;
  gap: 2px;
}

.quote-total strong {
  color: var(--text-strong);
  font-size: 20px;
}

.command-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.logo-button {
  display: inline-grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 999px;
  color: #334155;
  cursor: pointer;
}

.logo-button:hover {
  background: #f1f5f9;
}

.logo-button input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.status-message {
  min-width: 0;
  margin: 0;
  font-size: 13px;
  font-weight: 750;
  text-align: right;
}
</style>
