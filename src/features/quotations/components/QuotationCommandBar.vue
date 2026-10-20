<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationHeader, QuotationRevision } from '../types'
import type { QuotationWorkspaceMode } from '../composables/useQuotationWorkspace'

const props = defineProps<{
  header: QuotationHeader
  statusMessage: string
  currentFilePath: string
  workspaceMode: QuotationWorkspaceMode
  hasImportReport: boolean
  importReportIssueCount: number
  importReportHasErrors: boolean
  filesVisible: boolean
  revisions?: readonly QuotationRevision[]
  workingRevisionNumber?: number
  selectedRevisionId?: string | null
  revisionHistoryUnavailable?: boolean
}>()

const emit = defineEmits<{
  openFiles: []
  openPreview: []
  openEditor: []
  openAnalysis: []
  openImportReport: []
  openRevisions: []
  selectRevision: [id: string | null]
}>()

const { t } = useI18n()
const viewingSavedRevision = computed(() => Boolean(props.selectedRevisionId))
const revisionOptions = computed(() => [
  {
    value: 'working',
    label: t('quotations.revisions.workingOption', { number: props.workingRevisionNumber ?? props.header.revisionNumber ?? 1 }),
  },
  ...[...(props.revisions ?? [])].sort((left, right) => right.revisionNumber - left.revisionNumber).map(revision => ({
    value: `saved:${revision.id}`,
    label: t('quotations.revisions.savedOption', { number: revision.revisionNumber }),
  })),
])

function selectRevision(value: string) {
  emit('selectRevision', value.startsWith('saved:') ? value.slice(6) : null)
}

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
</script>

<template>
  <section class="command-bar" :aria-label="t('quotations.commandBar.aria')">
    <div class="command-context">
      <div class="quote-context" translate="no">
        <h1 class="quote-project" :title="projectLine">{{ projectLine }}</h1>
        <div class="quote-meta">
          <span class="quote-number" :title="header.quotationNumber">{{ header.quotationNumber }}</span>
          <span class="quote-customer" :title="customerLine">{{ customerLine }}</span>
          <span class="quote-file" :title="props.currentFilePath || fileName">{{ fileName }}</span>
        </div>
      </div>

      <div class="revision-actions" role="group" :aria-label="t('quotations.revisions.title')">
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
          :aria-label="t('quotations.revisions.open')"
          v-tooltip.bottom="t('quotations.revisions.manage')"
          severity="secondary"
          text
          @click="emit('openRevisions')"
        />
      </div>
    </div>

    <div class="command-toolbar">
      <div class="workspace-toggle" role="tablist" :aria-label="t('quotations.commandBar.workspaceAria')">
        <button
          class="workspace-toggle-button"
          :class="{ 'workspace-toggle-button-active': props.workspaceMode === 'editor' }"
          type="button"
          role="tab"
          :aria-selected="props.workspaceMode === 'editor'"
          :disabled="viewingSavedRevision"
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
          :disabled="viewingSavedRevision"
          @click="emit('openAnalysis')"
        >
          <i class="pi pi-chart-bar" aria-hidden="true" />
          <span>{{ t('quotations.workspace.modes.analysis') }}</span>
        </button>
      </div>

      <div class="command-actions">
        <Button
          v-if="props.hasImportReport"
          :disabled="viewingSavedRevision"
          icon="pi pi-exclamation-triangle"
          :severity="props.importReportHasErrors ? 'danger' : 'secondary'"
          text
          rounded
          :aria-label="t('quotations.csv.report.open')"
          v-tooltip.bottom="t('quotations.csv.report.openWithCount', { count: props.importReportIssueCount })"
          @click="emit('openImportReport')"
        />

        <Button
          class="preview-action"
          icon="pi pi-eye"
          :aria-label="t('quotations.commandBar.preview')"
          :label="t('quotations.commandBar.preview')"
          severity="secondary"
          outlined
          v-tooltip.bottom="`${t('quotations.commandBar.preview')}  ·  Ctrl + P`"
          @click="emit('openPreview')"
        />
        <Button
          icon="pi pi-folder-open"
          :label="t('quotations.files.title')"
          :aria-label="t('quotations.files.openAria')"
          aria-haspopup="dialog"
          :aria-expanded="props.filesVisible"
          @click="emit('openFiles')"
        />
      </div>
    </div>
    <div v-if="statusMessage" class="command-status" role="status" aria-live="polite">
      {{ statusMessage }}
    </div>
  </section>
</template>

<style scoped>
.command-bar {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 224px auto auto;
  align-items: center;
  min-width: 0;
  gap: 8px 16px;
  padding: 10px 14px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
}

.command-context,
.command-toolbar {
  display: contents;
}

.quote-context {
  min-width: 0;
}

.quote-number {
  color: var(--text-muted);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.quote-project {
  overflow: hidden;
  margin: 0;
  color: var(--text-strong);
  font-size: 18px;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.025em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-meta {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.quote-number,
.quote-customer,
.quote-file {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-file {
  color: var(--text-subtle);
}

.revision-actions {
  display: flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  gap: 4px;
}

.revision-selector {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 224px;
  font-size: 12px;
}

.revision-selector :deep(.p-select-label) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.revision-actions :deep(.p-button) {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  padding: 0;
}

.workspace-toggle {
  display: inline-flex;
  min-width: 0;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-md);
  background: var(--surface-raised);
}

.workspace-toggle-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  min-width: 0;
  gap: 6px;
  padding: 5px 11px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.workspace-toggle-button:hover:not(:disabled) {
  color: var(--text-strong);
  background: var(--surface-hover);
}

.workspace-toggle-button-active {
  background: var(--surface-card);
  color: var(--accent-hover);
  box-shadow: var(--shadow-control);
}

.workspace-toggle-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.workspace-toggle-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.command-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  gap: 6px;
}

.command-actions :deep(.p-button) {
  flex: 0 0 auto;
  min-height: 34px;
  padding: 6px 11px;
  border-radius: var(--radius-md);
  font-size: 12px;
}

.command-actions :deep(.p-button-label) {
  white-space: nowrap;
  font-weight: 600;
}

.command-actions :deep(.p-button-icon),
.revision-actions :deep(.p-button-icon) {
  font-size: 13px;
}

.command-actions :deep(.p-button.p-button-rounded) {
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: var(--radius-md);
}

.command-status {
  grid-column: 1 / -1;
  min-width: 0;
  padding-top: 6px;
  border-top: 1px solid var(--surface-border);
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

@media (max-width: 1100px) {
  .command-bar {
    grid-template-columns: minmax(0, 1fr) 224px;
  }

  .workspace-toggle {
    justify-self: start;
  }
}

@media (max-width: 600px) {
  .command-bar {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    padding: 10px;
  }

  .quote-context,
  .revision-actions {
    grid-column: 1 / -1;
  }

  .revision-selector {
    max-width: none;
  }

  .command-actions {
    justify-content: flex-start;
    gap: 4px;
  }

  .command-actions :deep(.p-button) { padding-inline: 8px; }
  .preview-action :deep(.p-button-label) { display: none; }
  .preview-action { width: 34px; }
}

@media (max-width: 480px) {
  .command-bar { grid-template-columns: minmax(0, 1fr); }
}
</style>
