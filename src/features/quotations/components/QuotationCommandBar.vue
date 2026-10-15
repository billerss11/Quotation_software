<script setup lang="ts">
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import Select from 'primevue/select'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationHeader, QuotationRevision } from '../types'
import type { QuotationWorkspaceMode } from '../composables/useQuotationWorkspace'
import { getCommandBarActions } from '../utils/commandBarActions'

const props = defineProps<{
  header: QuotationHeader
  statusMessage: string
  currentFilePath: string
  hasNativeFileDialogs: boolean
  supportsDirectPdfExport: boolean
  workspaceMode: QuotationWorkspaceMode
  hasImportReport: boolean
  importReportIssueCount: number
  importReportHasErrors: boolean
  hasGoodsReceiptItems: boolean
  revisions?: readonly QuotationRevision[]
  workingRevisionNumber?: number
  selectedRevisionId?: string | null
  revisionHistoryUnavailable?: boolean
}>()

const emit = defineEmits<{
  createNew: []
  save: []
  saveAs: []
  importLineItems: []
  exportCsv: []
  exportCsvTemplate: []
  importJson: []
  exportJson: []
  loadLatest: []
  openPreview: []
  exportPdf: []
  generateGoodsReceipt: []
  logoSelected: [event: Event]
  openEditor: []
  openAnalysis: []
  openImportReport: []
  openRevisions: []
  selectRevision: [id: string | null]
}>()

const { t } = useI18n()
const fileMenu = useTemplateRef<InstanceType<typeof Menu>>('fileMenuRef')
const toolsMenu = useTemplateRef<InstanceType<typeof Menu>>('toolsMenuRef')
const logoInput = useTemplateRef<HTMLInputElement>('logoInputRef')
const viewingSavedRevision = computed(() => Boolean(props.selectedRevisionId))
const actions = computed(() => getCommandBarActions(props.hasNativeFileDialogs))
const revisionOptions = computed(() => [
  {
    value: 'working',
    label: t('command.workingRevision', { number: props.workingRevisionNumber ?? props.header.revisionNumber ?? 1 }),
  },
  ...[...(props.revisions ?? [])].sort((left, right) => right.revisionNumber - left.revisionNumber).map(revision => ({
    value: `saved:${revision.id}`,
    label: t('command.savedRevision', { number: revision.revisionNumber }),
  })),
])
const fileName = computed(() => {
  if (!props.currentFilePath) return t('quotations.commandBar.unsavedFile')
  return props.currentFilePath.split(/[\\/]/).at(-1) || props.currentFilePath
})
const projectLine = computed(() => props.header.projectName?.trim() || t('quotations.commandBar.untitled'))
const customerLine = computed(() => (
  props.header.customerCompany?.trim() || props.header.contactPerson?.trim() || t('quotations.commandBar.noCustomer')
))
const exportActionLabel = computed(() => (
  props.supportsDirectPdfExport ? t('quotations.commandBar.exportPdf') : t('quotations.commandBar.print')
))

const fileMenuItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = []
  const disabled = viewingSavedRevision.value

  if (actions.value.includes('saveAs')) {
    items.push({ label: t('quotations.commandBar.menu.saveAs'), icon: 'pi pi-save', disabled, command: () => emit('saveAs') })
  }
  if (actions.value.includes('loadLatest')) {
    items.push({ label: t('quotations.commandBar.menu.loadLatest'), icon: 'pi pi-history', disabled, command: () => emit('loadLatest') })
  }
  if (actions.value.includes('exportJson')) {
    if (items.length) items.push({ separator: true })
    items.push({ label: t('quotations.commandBar.menu.exportJson'), icon: 'pi pi-download', disabled, command: () => emit('exportJson') })
  }
  if (actions.value.includes('logo')) {
    if (items.length) items.push({ separator: true })
    items.push({ label: t('quotations.commandBar.uploadLogo'), icon: 'pi pi-image', disabled, command: selectLogo })
  }

  return items
})

const toolsMenuItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = []
  const disabled = viewingSavedRevision.value

  if (actions.value.includes('importLineItems')) {
    items.push({ label: t('quotations.commandBar.menu.importLineItems'), icon: 'pi pi-file-import', disabled, command: () => emit('importLineItems') })
  }
  if (actions.value.includes('exportCsv')) {
    items.push({ label: t('quotations.commandBar.menu.exportCsv'), icon: 'pi pi-file-export', disabled, command: () => emit('exportCsv') })
  }
  if (actions.value.includes('exportCsvTemplate')) {
    items.push({ label: t('quotations.commandBar.menu.exportCsvTemplate'), icon: 'pi pi-file', disabled, command: () => emit('exportCsvTemplate') })
  }
  if (actions.value.includes('exportPdf')) {
    if (items.length) items.push({ separator: true })
    items.push({
      label: t('command.generateGoodsReceipt'),
      icon: 'pi pi-truck',
      disabled: disabled || !props.hasGoodsReceiptItems,
      command: () => emit('generateGoodsReceipt'),
    })
  }

  return items
})

function selectRevision(value: string) {
  emit('selectRevision', value.startsWith('saved:') ? value.slice(6) : null)
}

function selectLogo() {
  logoInput.value?.click()
}
</script>

<template>
  <section class="command-bar" :aria-label="t('quotations.commandBar.aria')">
    <div class="document-header">
      <div class="quote-context">
        <div class="document-title-line">
          <span class="quote-number" translate="no">{{ header.quotationNumber || t('command.newQuotation') }}</span>
          <span class="identity-divider" aria-hidden="true" />
          <h1 class="quote-project" :title="projectLine" translate="no">{{ projectLine }}</h1>
        </div>
        <div class="document-description">
          <span class="quote-customer" :title="customerLine" translate="no">{{ customerLine }}</span>
          <span class="description-divider" aria-hidden="true">·</span>
          <span class="file-context" :title="currentFilePath || fileName">
            <i :class="currentFilePath ? 'pi pi-file-check' : 'pi pi-file'" aria-hidden="true" />
            <span class="file-name" translate="no">{{ fileName }}</span>
          </span>
        </div>
      </div>

      <div class="output-actions" role="group" :aria-label="t('command.outputActions')">
        <Button
          v-if="actions.includes('save')"
          :disabled="viewingSavedRevision"
          icon="pi pi-save"
          :label="t('quotations.commandBar.save')"
          v-tooltip.bottom="`${t('quotations.commandBar.save')} · Ctrl + S`"
          @click="emit('save')"
        />
        <Button
          v-else-if="actions.includes('downloadJson')"
          :disabled="viewingSavedRevision"
          icon="pi pi-download"
          :label="t('quotations.commandBar.download')"
          v-tooltip.bottom="`${t('quotations.commandBar.download')} · Ctrl + S`"
          @click="emit('saveAs')"
        />
        <Button
          v-if="actions.includes('exportPdf')"
          icon="pi pi-eye"
          :label="t('quotations.commandBar.preview')"
          severity="secondary"
          outlined
          v-tooltip.bottom="`${t('quotations.commandBar.preview')} · Ctrl + P`"
          @click="emit('openPreview')"
        />
        <Button
          v-if="actions.includes('exportPdf')"
          icon="pi pi-file-pdf"
          :label="exportActionLabel"
          severity="secondary"
          outlined
          :disabled="viewingSavedRevision && !props.supportsDirectPdfExport"
          @click="emit('exportPdf')"
        />
      </div>
    </div>

    <div class="document-controls">
      <div class="file-actions" role="group" :aria-label="t('command.fileActions')">
        <Button
          v-if="actions.includes('new')"
          icon="pi pi-plus"
          :label="t('command.new')"
          :disabled="viewingSavedRevision"
          severity="secondary"
          text
          @click="emit('createNew')"
        />
        <Button
          v-if="actions.includes('importJson')"
          icon="pi pi-folder-open"
          :label="t('command.open')"
          :disabled="viewingSavedRevision"
          severity="secondary"
          text
          @click="emit('importJson')"
        />
        <Button
          icon="pi pi-angle-down"
          icon-pos="right"
          :label="t('command.fileMenu')"
          aria-haspopup="menu"
          aria-controls="quotation-file-menu"
          severity="secondary"
          text
          @click="fileMenu?.toggle($event)"
        />
        <Button
          icon="pi pi-angle-down"
          icon-pos="right"
          :label="t('command.toolsMenu')"
          aria-haspopup="menu"
          aria-controls="quotation-tools-menu"
          severity="secondary"
          text
          @click="toolsMenu?.toggle($event)"
        />
        <Button
          v-if="props.hasImportReport"
          :disabled="viewingSavedRevision"
          icon="pi pi-exclamation-triangle"
          :label="t('command.importReport', { count: props.importReportIssueCount })"
          :severity="props.importReportHasErrors ? 'danger' : 'secondary'"
          text
          :aria-label="t('quotations.csv.report.openWithCount', { count: props.importReportIssueCount })"
          @click="emit('openImportReport')"
        />
      </div>

      <span v-if="statusMessage" class="status-message" role="status" :title="statusMessage">{{ statusMessage }}</span>

      <div class="revision-controls" role="group" :aria-label="t('quotations.revisions.title')">
        <span v-if="viewingSavedRevision" class="read-only-label">{{ t('quotations.revisions.readOnlyBadge') }}</span>
        <Select
          class="revision-selector"
          :model-value="props.selectedRevisionId ? `saved:${props.selectedRevisionId}` : 'working'"
          :options="revisionOptions"
          option-label="label"
          option-value="value"
          :aria-label="t('quotations.revisions.selectRevision')"
          :disabled="props.revisionHistoryUnavailable"
          @update:model-value="selectRevision"
        />
        <Button
          icon="pi pi-history"
          :label="t('command.revisionHistory')"
          :aria-label="t('quotations.revisions.open')"
          severity="secondary"
          text
          @click="emit('openRevisions')"
        />
      </div>
    </div>

    <Menu id="quotation-file-menu" ref="fileMenuRef" :model="fileMenuItems" popup />
    <Menu id="quotation-tools-menu" ref="toolsMenuRef" :model="toolsMenuItems" popup />
    <input
      v-if="actions.includes('logo')"
      ref="logoInputRef"
      class="logo-input"
      type="file"
      accept="image/*"
      aria-hidden="true"
      tabindex="-1"
      :disabled="viewingSavedRevision"
      @change="emit('logoSelected', $event)"
    />
  </section>
</template>

<style scoped>
.command-bar {
  min-width: 0;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
}

.document-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-width: 0;
  padding: 12px 16px 10px;
}

.quote-context {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.document-title-line,
.document-description,
.file-context {
  display: flex;
  align-items: center;
  min-width: 0;
}

.document-title-line { gap: 12px; }

.quote-number {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.identity-divider {
  width: 1px;
  height: 16px;
  flex: 0 0 auto;
  background: var(--surface-border);
}

.quote-project {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 17px;
  font-weight: 650;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-description {
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.quote-customer,
.file-name,
.status-message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-customer { max-width: 260px; }
.file-context { gap: 5px; }
.file-context i { flex: 0 0 auto; font-size: 12px; }
.description-divider { color: var(--text-subtle); }

.output-actions,
.file-actions,
.revision-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.document-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 6px 10px;
  border-top: 1px solid var(--surface-border);
}

.file-actions { gap: 1px; }
.revision-controls { margin-inline-start: auto; }

.status-message {
  min-width: 0;
  color: var(--text-muted);
  font-size: 12px;
}

.read-only-label {
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.revision-selector {
  min-width: 155px;
  max-width: 180px;
  font-size: 13px;
}

.revision-selector :deep(.p-select-label) { padding-block: 6px; }

.command-bar :deep(.p-button) {
  min-height: 32px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.command-bar :deep(.p-button-label) { font-weight: 600; white-space: nowrap; }
.command-bar :deep(.p-button-icon) { font-size: 13px; }

.logo-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

@media (max-width: 1050px) {
  .document-header { gap: 12px; padding-inline: 12px; }
  .document-title-line { gap: 8px; }
  .document-controls { flex-wrap: wrap; gap: 4px 12px; }
  .status-message { flex-basis: 100%; order: 1; padding: 2px 6px; }
}

@media (max-width: 640px) {
  .document-header { align-items: flex-start; flex-direction: column; gap: 10px; }
  .quote-context { width: 100%; }
  .output-actions { align-self: stretch; }
  .output-actions :deep(.p-button) { flex: 1; }
  .revision-controls { margin-inline-start: 0; }
  .file-actions { flex-wrap: wrap; }
}
</style>
