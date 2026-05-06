<script setup lang="ts">
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationHeader } from '../types'
import type { QuotationWorkspaceMode } from '../composables/useQuotationWorkspace'
import { getCommandBarActions } from '../utils/commandBarActions'

const props = defineProps<{
  header: QuotationHeader
  statusMessage: string
  currentFilePath: string
  hasNativeFileDialogs: boolean
  supportsDirectPdfExport: boolean
  workspaceMode: QuotationWorkspaceMode
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
  openEditor: []
  openAnalysis: []
}>()

const { t } = useI18n()
const moreMenu = useTemplateRef<InstanceType<typeof Menu>>('moreMenuRef')
const logoInput = useTemplateRef<HTMLInputElement>('logoInputRef')

const fileName = computed(() => {
  if (!props.currentFilePath) return t('quotations.commandBar.unsavedFile')
  return props.currentFilePath.split(/[\\/]/).at(-1) || props.currentFilePath
})

const projectLine = computed(() => {
  const project = props.header.projectName?.trim() || t('quotations.commandBar.untitled')
  return project
})

const customerLine = computed(() => {
  const customer = props.header.customerCompany?.trim() || props.header.contactPerson?.trim()
  return customer || t('quotations.commandBar.noCustomer')
})

const actions = computed(() => getCommandBarActions(props.hasNativeFileDialogs))
const exportActionLabel = computed(() => (
  props.supportsDirectPdfExport ? t('quotations.commandBar.exportPdf') : t('quotations.commandBar.print')
))

interface SimpleMenuItem {
  label?: string
  icon?: string
  command?: () => void
  separator?: boolean
}

const moreMenuItems = computed<SimpleMenuItem[]>(() => {
  const items: SimpleMenuItem[] = []

  if (actions.value.includes('new')) {
    items.push({ label: t('quotations.commandBar.menu.new'), icon: 'pi pi-file-plus', command: () => emit('createNew') })
    items.push({ label: t('quotations.commandBar.menu.createRevision'), icon: 'pi pi-copy', command: () => emit('createRevision') })
  }
  if (actions.value.includes('saveAs')) {
    items.push({ label: t('quotations.commandBar.menu.saveAs'), icon: 'pi pi-save', command: () => emit('saveAs') })
  }
  if (actions.value.includes('loadLatest')) {
    items.push({ label: t('quotations.commandBar.menu.loadLatest'), icon: 'pi pi-folder-open', command: () => emit('loadLatest') })
  }

  const dataItems: SimpleMenuItem[] = []
  if (actions.value.includes('importCsv'))
    dataItems.push({ label: t('quotations.commandBar.menu.importCsv'), icon: 'pi pi-file-import', command: () => emit('importCsv') })
  if (actions.value.includes('exportCsv'))
    dataItems.push({ label: t('quotations.commandBar.menu.exportCsv'), icon: 'pi pi-file-export', command: () => emit('exportCsv') })
  if (actions.value.includes('exportCsvTemplate'))
    dataItems.push({ label: t('quotations.commandBar.menu.exportCsvTemplate'), icon: 'pi pi-file-export', command: () => emit('exportCsvTemplate') })
  if (actions.value.includes('importJson'))
    dataItems.push({ label: t('quotations.commandBar.menu.importJson'), icon: 'pi pi-upload', command: () => emit('importJson') })
  if (actions.value.includes('exportJson'))
    dataItems.push({ label: t('quotations.commandBar.menu.exportJson'), icon: 'pi pi-download', command: () => emit('exportJson') })

  if (items.length > 0 && dataItems.length > 0) {
    items.push({ separator: true })
  }
  items.push(...dataItems)

  if (actions.value.includes('logo')) {
    if (items.length > 0) items.push({ separator: true })
    items.push({
      label: t('quotations.commandBar.uploadLogo'),
      icon: 'pi pi-image',
      command: selectLogo,
    })
  }

  return items
})

function selectLogo() {
  logoInput.value?.click()
}
</script>

<template>
  <section class="command-bar" :aria-label="t('quotations.commandBar.aria')">
    <div class="quote-context" translate="no">
      <div class="quote-number" :aria-label="header.quotationNumber">
        {{ header.quotationNumber }}
      </div>
      <div class="quote-meta">
        <strong class="quote-project">{{ projectLine }}</strong>
        <span class="quote-customer">{{ customerLine }} · {{ fileName }}</span>
      </div>
    </div>

    <div class="workspace-toggle" role="tablist" :aria-label="t('quotations.commandBar.workspaceAria')">
      <button
        class="workspace-toggle-button"
        :class="{ 'workspace-toggle-button-active': props.workspaceMode === 'editor' }"
        type="button"
        role="tab"
        :aria-selected="props.workspaceMode === 'editor'"
        @click="emit('openEditor')"
      >
        <i class="pi pi-pencil" aria-hidden="true" />
        <span>{{ t('quotations.workspace.modes.editor') }}</span>
      </button>
      <button
        class="workspace-toggle-button"
        :class="{ 'workspace-toggle-button-active': props.workspaceMode === 'analysis' }"
        type="button"
        role="tab"
        :aria-selected="props.workspaceMode === 'analysis'"
        @click="emit('openAnalysis')"
      >
        <i class="pi pi-chart-bar" aria-hidden="true" />
        <span>{{ t('quotations.workspace.modes.analysis') }}</span>
      </button>
    </div>

    <div class="command-actions">
      <div v-if="statusMessage" class="status-pill" aria-live="polite">
        <span class="status-dot" aria-hidden="true" />
        <span class="status-text">{{ statusMessage }}</span>
      </div>

      <Button
        v-if="actions.includes('save')"
        icon="pi pi-save"
        :label="t('quotations.commandBar.save')"
        v-tooltip.bottom="`${t('quotations.commandBar.save')}  ·  Ctrl + S`"
        @click="emit('save')"
      />
      <Button
        v-else-if="actions.includes('downloadJson')"
        icon="pi pi-download"
        :label="t('quotations.commandBar.download')"
        v-tooltip.bottom="`${t('quotations.commandBar.download')}  ·  Ctrl + S`"
        @click="emit('saveAs')"
      />

      <Button
        v-if="actions.includes('exportPdf')"
        icon="pi pi-eye"
        :label="t('quotations.commandBar.preview')"
        severity="secondary"
        outlined
        v-tooltip.bottom="`${t('quotations.commandBar.preview')}  ·  Ctrl + P`"
        @click="emit('openPreview')"
      />
      <Button
        v-if="actions.includes('exportPdf')"
        icon="pi pi-file-pdf"
        :label="exportActionLabel"
        severity="secondary"
        outlined
        :aria-label="exportActionLabel"
        v-tooltip.bottom="exportActionLabel"
        @click="emit('exportPdf')"
      />

      <Button
        icon="pi pi-ellipsis-v"
        v-tooltip.bottom="t('quotations.commandBar.more')"
        :aria-label="t('quotations.commandBar.more')"
        aria-haspopup="menu"
        severity="secondary"
        text
        rounded
        @click="moreMenu?.toggle($event)"
      />
      <Menu ref="moreMenuRef" :model="moreMenuItems" popup />

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
</template>

<style scoped>
.command-bar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto auto;
  gap: 14px;
  align-items: center;
  min-height: 52px;
  padding: 8px 14px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.quote-context {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.quote-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 110px;
  height: 32px;
  flex: 0 0 auto;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  background: var(--accent-surface);
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  border: 1px solid var(--accent-soft);
}

.quote-meta {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.quote-project,
.quote-customer {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-project {
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
}

.quote-customer {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.3;
}

/* Workspace toggle ─ segmented control */

.workspace-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  background: var(--surface-muted);
}

.workspace-toggle-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.workspace-toggle-button i {
  font-size: 12px;
}

.workspace-toggle-button:hover:not(.workspace-toggle-button-active) {
  background: rgb(255 255 255 / 60%);
  color: var(--text-body);
}

.workspace-toggle-button-active {
  background: var(--surface-card);
  color: var(--accent);
  font-weight: 700;
  box-shadow: var(--shadow-control);
}

/* Action group */

.command-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  gap: 6px;
  flex-wrap: nowrap;
}

.command-actions :deep(.p-button) {
  flex: 0 0 auto;
  min-height: 32px;
  font-size: 13px;
  padding-inline: 0.7rem;
  padding-block: 0.32rem;
  border-radius: var(--radius-md);
}

.command-actions :deep(.p-button-label) {
  white-space: nowrap;
  font-weight: 600;
}

.command-actions :deep(.p-button-icon) {
  font-size: 13px;
}

.command-actions :deep(.p-button.p-button-rounded) {
  padding: 0;
  width: 32px;
  height: 32px;
  border-radius: 999px;
}

/* Status pill */

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 280px;
  padding: 4px 10px;
  border: 1px solid var(--accent-soft);
  border-radius: 999px;
  background: var(--accent-surface);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
}

.status-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse-dot 2.4s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.8); }
}

.logo-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

@media (max-width: 1280px) {
  .command-bar {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
  }

  .quote-context {
    grid-row: 1;
    grid-column: 1;
  }

  .workspace-toggle {
    grid-row: 1;
    grid-column: 2;
    justify-self: end;
  }

  .command-actions {
    grid-row: 2;
    grid-column: 1 / -1;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
}

@media (max-width: 760px) {
  .workspace-toggle-button span {
    display: none;
  }
}
</style>
