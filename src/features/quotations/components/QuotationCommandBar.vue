<script setup lang="ts">
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import { computed, useTemplateRef } from 'vue'

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

const fileMenu = useTemplateRef<InstanceType<typeof Menu>>('fileMenuRef')
const dataMenu = useTemplateRef<InstanceType<typeof Menu>>('dataMenuRef')
const logoInput = useTemplateRef<HTMLInputElement>('logoInputRef')

const fileName = computed(() => {
  if (!props.currentFilePath) return 'Unsaved file'
  return props.currentFilePath.split(/[\\/]/).at(-1) || props.currentFilePath
})

const actions = computed(() => getCommandBarActions(props.hasNativeFileDialogs))

const fileMenuItems = computed(() => {
  const items = []
  if (actions.value.includes('new'))
    items.push({ label: 'New', icon: 'pi pi-file-plus', command: () => emit('createNew') })
  if (actions.value.includes('saveAs'))
    items.push({ label: 'Save As', icon: 'pi pi-save', command: () => emit('saveAs') })
  if (actions.value.includes('loadLatest'))
    items.push({ label: 'Load Latest', icon: 'pi pi-folder-open', command: () => emit('loadLatest') })
  return items
})

const dataMenuItems = computed(() => {
  const items = []
  if (actions.value.includes('importCsv'))
    items.push({ label: 'Import CSV', icon: 'pi pi-file-import', command: () => emit('importCsv') })
  if (actions.value.includes('exportCsvTemplate'))
    items.push({ label: 'Export CSV Template', icon: 'pi pi-file-export', command: () => emit('exportCsvTemplate') })
  if (actions.value.includes('importJson'))
    items.push({ label: 'Import JSON', icon: 'pi pi-upload', command: () => emit('importJson') })
  if (actions.value.includes('exportJson'))
    items.push({ label: 'Export JSON', icon: 'pi pi-download', command: () => emit('exportJson') })
  return items
})

function selectLogo() {
  logoInput.value?.click()
}
</script>

<template>
  <div class="command-bar-wrapper">
    <section class="command-bar" aria-label="Quotation commands">
      <div class="quote-context">
        <div class="quote-number">{{ header.quotationNumber }}</div>
        <div class="quote-meta">
          <strong>{{ header.projectName || 'Untitled quotation' }}</strong>
          <span>{{ header.customerCompany || header.customerName || 'No customer selected' }} · {{ fileName }}</span>
        </div>
      </div>

      <div class="command-actions">
        <Button
          v-if="actions.includes('save')"
          icon="pi pi-save"
          label="Save"
          rounded
          @click="emit('save')"
        />
        <Button
          v-else-if="actions.includes('downloadJson')"
          icon="pi pi-download"
          label="Download"
          rounded
          @click="emit('saveAs')"
        />

        <div class="actions-separator" />

        <Button
          icon="pi pi-folder"
          label="File"
          aria-label="Open file actions"
          aria-haspopup="menu"
          severity="secondary"
          text
          rounded
          @click="fileMenu?.toggle($event)"
        />
        <Menu ref="fileMenuRef" :model="fileMenuItems" popup />

        <Button
          icon="pi pi-arrows-h"
          label="Import / Export"
          aria-label="Open import and export actions"
          aria-haspopup="menu"
          severity="secondary"
          text
          rounded
          @click="dataMenu?.toggle($event)"
        />
        <Menu ref="dataMenuRef" :model="dataMenuItems" popup />

        <div class="actions-separator" />

        <Button
          v-if="actions.includes('print')"
          v-tooltip.bottom="'Print'"
          icon="pi pi-print"
          severity="secondary"
          text
          rounded
          aria-label="Print"
          @click="emit('print')"
        />
        <Button
          v-if="actions.includes('logo')"
          v-tooltip.bottom="'Upload logo'"
          icon="pi pi-image"
          severity="secondary"
          text
          rounded
          aria-label="Upload logo"
          @click="selectLogo"
        />
        <input
          v-if="actions.includes('logo')"
          ref="logoInputRef"
          class="logo-input"
          type="file"
          accept="image/*"
          aria-hidden="true"
          tabindex="-1"
          @change="emit('logoSelected', $event)"
        />
      </div>

      <div class="quote-total">
        <span>Total</span>
        <strong>{{ formatCurrency(totals.grandTotal, header.currency) }}</strong>
      </div>
    </section>

    <p v-if="statusMessage" class="status-strip" aria-live="polite">{{ statusMessage }}</p>
  </div>
</template>

<style scoped>
.command-bar-wrapper {
  display: grid;
  gap: 0;
}

.command-bar {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(0, auto) auto;
  gap: 16px;
  align-items: center;
  min-height: 60px;
  padding: 10px 18px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-card);
  box-shadow: var(--shadow-control);
}

.quote-context {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.quote-number {
  display: inline-grid;
  min-width: 110px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  background: var(--accent-surface);
  color: var(--accent-hover);
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

.quote-meta span {
  color: var(--text-muted);
  font-size: 13px;
}

.command-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  gap: 4px;
  flex-wrap: wrap;
}

.actions-separator {
  width: 1px;
  height: 28px;
  margin: 0 6px;
  background: var(--surface-border);
  flex-shrink: 0;
}

.quote-total {
  display: grid;
  min-width: 120px;
  justify-items: end;
  gap: 2px;
}

.quote-total span {
  color: var(--text-muted);
  font-size: 12px;
}

.quote-total strong {
  color: var(--text-strong);
  font-size: 22px;
  font-weight: 800;
}

.logo-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.status-strip {
  margin: 0;
  padding: 4px 18px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}

@media (max-width: 1320px) {
  .command-bar {
    grid-template-columns: minmax(220px, 1fr) auto;
  }

  .command-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .quote-total {
    align-self: start;
  }
}
</style>
