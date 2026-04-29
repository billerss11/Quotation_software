<script setup lang="ts">
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationHeader } from '../types'
import { getCommandBarActions } from '../utils/commandBarActions'

const props = defineProps<{
  header: QuotationHeader
  statusMessage: string
  currentFilePath: string
  hasNativeFileDialogs: boolean
}>()

const emit = defineEmits<{
  createNew: []
  createRevision: []
  save: []
  saveAs: []
  importCsv: []
  exportCsv: []
  exportCsvTemplate: []
  importJson: []
  exportJson: []
  loadLatest: []
  openPreview: []
  exportPdf: []
  logoSelected: [event: Event]
}>()

const { t } = useI18n()
const fileMenu = useTemplateRef<InstanceType<typeof Menu>>('fileMenuRef')
const dataMenu = useTemplateRef<InstanceType<typeof Menu>>('dataMenuRef')
const logoInput = useTemplateRef<HTMLInputElement>('logoInputRef')

const fileName = computed(() => {
  if (!props.currentFilePath) return t('quotations.commandBar.unsavedFile')
  return props.currentFilePath.split(/[\\/]/).at(-1) || props.currentFilePath
})

const actions = computed(() => getCommandBarActions(props.hasNativeFileDialogs))

const fileMenuItems = computed(() => {
  const items = []
  if (actions.value.includes('new'))
    items.push({ label: t('quotations.commandBar.menu.new'), icon: 'pi pi-file-plus', command: () => emit('createNew') })
  if (actions.value.includes('new'))
    items.push({ label: t('quotations.commandBar.menu.createRevision'), icon: 'pi pi-copy', command: () => emit('createRevision') })
  if (actions.value.includes('saveAs'))
    items.push({ label: t('quotations.commandBar.menu.saveAs'), icon: 'pi pi-save', command: () => emit('saveAs') })
  if (actions.value.includes('loadLatest'))
    items.push({ label: t('quotations.commandBar.menu.loadLatest'), icon: 'pi pi-folder-open', command: () => emit('loadLatest') })
  return items
})

const dataMenuItems = computed(() => {
  const items = []
  if (actions.value.includes('importCsv'))
    items.push({ label: t('quotations.commandBar.menu.importCsv'), icon: 'pi pi-file-import', command: () => emit('importCsv') })
  if (actions.value.includes('exportCsv'))
    items.push({ label: t('quotations.commandBar.menu.exportCsv'), icon: 'pi pi-file-export', command: () => emit('exportCsv') })
  if (actions.value.includes('exportCsvTemplate'))
    items.push({ label: t('quotations.commandBar.menu.exportCsvTemplate'), icon: 'pi pi-file-export', command: () => emit('exportCsvTemplate') })
  if (actions.value.includes('importJson'))
    items.push({ label: t('quotations.commandBar.menu.importJson'), icon: 'pi pi-upload', command: () => emit('importJson') })
  if (actions.value.includes('exportJson'))
    items.push({ label: t('quotations.commandBar.menu.exportJson'), icon: 'pi pi-download', command: () => emit('exportJson') })
  return items
})

function selectLogo() {
  logoInput.value?.click()
}
</script>

<template>
  <div class="command-bar-wrapper">
    <section class="command-bar" :aria-label="t('quotations.commandBar.aria')">
      <div class="quote-context">
        <div class="quote-number">{{ header.quotationNumber }}</div>
        <div class="quote-meta">
          <strong>{{ header.projectName || t('quotations.commandBar.untitled') }}</strong>
          <span>{{ header.customerCompany || header.contactPerson || t('quotations.commandBar.noCustomer') }} · {{ fileName }}</span>
        </div>
      </div>

      <div class="command-actions">
        <Button
          v-if="actions.includes('save')"
          icon="pi pi-save"
          :label="t('quotations.commandBar.save')"
          rounded
          @click="emit('save')"
        />
        <Button
          v-else-if="actions.includes('downloadJson')"
          icon="pi pi-download"
          :label="t('quotations.commandBar.download')"
          rounded
          @click="emit('saveAs')"
        />

        <div class="actions-separator" />

        <Button
          icon="pi pi-folder"
          :label="t('quotations.commandBar.file')"
          :aria-label="t('quotations.commandBar.fileAria')"
          aria-haspopup="menu"
          severity="secondary"
          text
          rounded
          @click="fileMenu?.toggle($event)"
        />
        <Menu ref="fileMenuRef" :model="fileMenuItems" popup />

        <Button
          icon="pi pi-arrows-h"
          :label="t('quotations.commandBar.importExport')"
          :aria-label="t('quotations.commandBar.importExportAria')"
          aria-haspopup="menu"
          severity="secondary"
          text
          rounded
          @click="dataMenu?.toggle($event)"
        />
        <Menu ref="dataMenuRef" :model="dataMenuItems" popup />

        <div class="actions-separator" />

        <Button
          v-if="actions.includes('exportPdf')"
          icon="pi pi-eye"
          :label="t('quotations.commandBar.preview')"
          severity="secondary"
          outlined
          rounded
          @click="emit('openPreview')"
        />
        <Button
          v-if="actions.includes('exportPdf')"
          icon="pi pi-print"
          :label="t('quotations.commandBar.exportPdf')"
          severity="secondary"
          outlined
          rounded
          :aria-label="t('quotations.commandBar.exportPdf')"
          @click="emit('exportPdf')"
        />
        <Button
          v-if="actions.includes('logo')"
          v-tooltip.bottom="t('quotations.commandBar.uploadLogo')"
          icon="pi pi-image"
          severity="secondary"
          text
          rounded
          :aria-label="t('quotations.commandBar.uploadLogo')"
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
  grid-template-columns: minmax(280px, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 46px;
  padding: 7px 12px;
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
  min-width: 104px;
  height: 32px;
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
  flex-wrap: nowrap;
}

.command-actions :deep(.p-button) {
  flex: 0 0 auto;
  min-height: 34px;
  font-size: 0.92rem;
  padding-inline: 0.78rem;
  padding-block: 0.36rem;
}

.command-actions :deep(.p-button-label) {
  white-space: nowrap;
}

.command-actions :deep(.p-button-icon) {
  font-size: 0.95rem;
}

.actions-separator {
  width: 1px;
  height: 28px;
  margin: 0 6px;
  background: var(--surface-border);
  flex-shrink: 0;
}

.status-strip {
  margin: 0;
  padding: 10px 16px;
  border: 1px solid var(--surface-border);
  border-top: 0;
  border-radius: 0 0 8px 8px;
  background: rgb(248 250 252 / 80%);
  color: var(--text-body);
  font-size: 13px;
}

.logo-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

@media (max-width: 1180px) {
  .command-bar {
    grid-template-columns: 1fr;
  }

  .command-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
