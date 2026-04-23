<script setup lang="ts">
import Button from 'primevue/button'

import { formatCurrency } from '@/shared/utils/formatters'

import type { QuotationHeader, QuotationTotals } from '../types'

defineProps<{
  header: QuotationHeader
  totals: QuotationTotals
  statusMessage: string
}>()

const emit = defineEmits<{
  createNew: []
  save: []
  loadLatest: []
  print: []
  logoSelected: [event: Event]
}>()
</script>

<template>
  <section class="command-bar" aria-label="Quotation commands">
    <div class="quote-context">
      <div class="quote-number">{{ header.quotationNumber }}</div>
      <div class="quote-meta">
        <strong>{{ header.projectName || 'Untitled quotation' }}</strong>
        <span>{{ header.customerCompany || header.customerName || 'No customer selected' }}</span>
      </div>
    </div>

    <div class="quote-total">
      <span>Total</span>
      <strong>{{ formatCurrency(totals.grandTotal, header.currency) }}</strong>
    </div>

    <div class="command-actions">
      <Button icon="pi pi-file-plus" severity="secondary" text rounded aria-label="New" @click="emit('createNew')" />
      <Button icon="pi pi-save" rounded aria-label="Save" @click="emit('save')" />
      <Button
        icon="pi pi-folder-open"
        severity="secondary"
        text
        rounded
        aria-label="Load latest"
        @click="emit('loadLatest')"
      />
      <Button icon="pi pi-print" severity="secondary" text rounded aria-label="Print" @click="emit('print')" />
      <label class="logo-button" aria-label="Upload logo">
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
