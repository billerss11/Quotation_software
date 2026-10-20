<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, useId, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { getCommandBarActions } from '../utils/commandBarActions'

const props = defineProps<{
  quotationNumber: string
  currentFilePath: string
  hasNativeFileDialogs: boolean
  supportsDirectPdfExport: boolean
  viewingSavedRevision: boolean
  hasSavedDrafts: boolean
  hasGoodsReceiptItems: boolean
  busy: boolean
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  createNew: []
  save: []
  saveAs: []
  importLineItems: []
  exportCsv: []
  importJson: []
  exportJson: []
  loadLatest: []
  exportPdf: []
  exportExcel: []
  generateGoodsReceipt: []
  logoSelected: [event: Event]
}>()

const { t } = useI18n()
const id = useId()
const logoInput = useTemplateRef<HTMLInputElement>('logoInput')
const actions = computed(() => getCommandBarActions(props.hasNativeFileDialogs))
const fileName = computed(() => props.currentFilePath.split(/[\\/]/).at(-1) || t('quotations.commandBar.unsavedFile'))
const cannotEdit = computed(() => props.viewingSavedRevision || props.busy)

interface FileAction {
  id: string
  icon: string
  format?: string
  disabled?: boolean
  hint?: string
  opensDialog?: boolean
  run: () => void
}

const groups = computed(() => [
  {
    id: 'openImport',
    icon: 'pi pi-folder-open',
    actions: [
      { id: 'openQuotation', icon: 'pi pi-folder-open', format: 'json', disabled: cannotEdit.value, run: () => emit('importJson') },
      { id: 'importLineItems', icon: 'pi pi-file-import', format: 'csvExcel', disabled: cannotEdit.value, opensDialog: true, run: () => emit('importLineItems') },
      {
        id: 'recoverDraft', icon: 'pi pi-history', disabled: cannotEdit.value || !props.hasSavedDrafts,
        hint: !props.hasSavedDrafts ? t('quotations.files.noSavedDraft') : undefined,
        run: () => emit('loadLatest'),
      },
    ] satisfies FileAction[],
  },
  {
    id: 'saveExport',
    icon: 'pi pi-file-export',
    actions: [
      {
        id: actions.value.includes('save') ? 'saveQuotation' : 'downloadQuotation', icon: 'pi pi-save', format: 'json', disabled: cannotEdit.value,
        run: () => actions.value.includes('save') ? emit('save') : emit('saveAs'),
      },
      {
        id: props.supportsDirectPdfExport ? 'exportPdf' : 'print', icon: 'pi pi-file-pdf', format: 'pdf',
        disabled: props.busy || (props.viewingSavedRevision && !props.supportsDirectPdfExport), run: () => emit('exportPdf'),
      },
      { id: 'exportExcel', icon: 'pi pi-file-excel', format: 'excel', disabled: props.busy, opensDialog: true, run: () => emit('exportExcel') },
      { id: 'exportCsv', icon: 'pi pi-table', format: 'csv', disabled: cannotEdit.value, run: () => emit('exportCsv') },
      {
        id: 'goodsReceipt', icon: 'pi pi-truck', disabled: cannotEdit.value || !props.hasGoodsReceiptItems,
        hint: !props.hasGoodsReceiptItems ? t('quotations.files.noReceiptItems') : undefined,
        opensDialog: true, run: () => emit('generateGoodsReceipt'),
      },
    ] satisfies FileAction[],
  },
])

let pendingDialogAction: (() => void) | undefined

function chooseAction(action: FileAction) {
  if (action.disabled || props.busy) return
  visible.value = false
  if (action.opensDialog) {
    // Let PrimeVue release focus and its scroll lock before opening the next dialog.
    pendingDialogAction = action.run
  } else {
    // File pickers need the original user gesture, so dispatch these immediately.
    action.run()
  }
}

function afterHide() {
  const run = pendingDialogAction
  pendingDialogAction = undefined
  if (!props.busy) run?.()
}

function selectLogo() {
  if (cannotEdit.value) return
  visible.value = false
  logoInput.value?.click()
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('quotations.files.title')"
    :draggable="false"
    :style="{ width: '860px', maxWidth: 'calc(100vw - 32px)' }"
    :closable="!props.busy"
    :close-on-escape="!props.busy"
    :close-button-props="{ 'aria-label': t('quotations.files.close'), text: true, severity: 'secondary' }"
    :aria-describedby="`${id}-description`"
    @after-hide="afterHide"
  >
    <div class="files-intro">
      <p :id="`${id}-description`" class="files-description">{{ t('quotations.files.description') }}</p>
      <div class="files-context" translate="no">
        <strong>{{ props.quotationNumber }}</strong>
        <span :title="props.currentFilePath || fileName">{{ fileName }}</span>
      </div>
    </div>
    <p v-if="props.viewingSavedRevision" class="files-notice" role="status">
      <i class="pi pi-lock" aria-hidden="true" />
      {{ t('quotations.files.savedRevisionHint') }}
    </p>

    <div class="files-groups">
      <section v-for="group in groups" :key="group.id" class="files-group" :aria-labelledby="`${id}-${group.id}`">
        <h2 :id="`${id}-${group.id}`" class="files-group-title">
          <i :class="group.icon" aria-hidden="true" />
          {{ t(`quotations.files.${group.id}`) }}
        </h2>
        <div v-for="action in group.actions" :key="action.id" class="file-action-wrap">
          <Button
            class="file-action"
            text
            :disabled="action.disabled"
            :aria-label="t(`quotations.files.actions.${action.id}.label`)"
            :aria-describedby="`${id}-${action.id}-description`"
            :data-testid="`file-action-${action.id}`"
            @click="chooseAction(action)"
          >
            <i :class="action.icon" class="file-action-icon" aria-hidden="true" />
            <span class="file-action-copy">
              <span class="file-action-heading">
                <strong>{{ t(`quotations.files.actions.${action.id}.label`) }}</strong>
                <span v-if="'format' in action" class="file-format">{{ t(`quotations.files.formats.${action.format}`) }}</span>
              </span>
              <span :id="`${id}-${action.id}-description`" class="file-action-description">
                {{ ('hint' in action && action.hint) || t(`quotations.files.actions.${action.id}.description`) }}
              </span>
            </span>
          </Button>
          <div v-if="action.id === 'saveQuotation'" class="file-save-options">
            <Button
              v-if="actions.includes('saveAs')"
              :label="t('quotations.files.actions.saveAs.label')"
              :title="t('quotations.files.actions.saveAs.description')"
              :disabled="cannotEdit"
              severity="secondary" text size="small" data-testid="file-action-saveAs"
              @click="chooseAction({ id: 'saveAs', icon: '', disabled: cannotEdit, run: () => emit('saveAs') })"
            />
            <Button
              v-if="actions.includes('exportJson')"
              :label="t('quotations.files.actions.exportCopy.label')"
              :title="t('quotations.files.actions.exportCopy.description')"
              :disabled="cannotEdit"
              severity="secondary" text size="small" data-testid="file-action-exportCopy"
              @click="chooseAction({ id: 'exportCopy', icon: '', disabled: cannotEdit, run: () => emit('exportJson') })"
            />
          </div>
        </div>
      </section>
    </div>

    <div class="files-utilities">
      <Button
        icon="pi pi-file-plus" :label="t('quotations.files.actions.newQuotation.label')"
        severity="secondary" text :disabled="cannotEdit" data-testid="file-action-newQuotation"
        @click="chooseAction({ id: 'newQuotation', icon: '', disabled: cannotEdit, run: () => emit('createNew') })"
      />
      <Button
        icon="pi pi-image" :label="t('quotations.files.actions.logo.label')"
        severity="secondary" text :disabled="cannotEdit" @click="selectLogo"
      />
    </div>
  </Dialog>
  <input ref="logoInput" class="logo-input" type="file" accept="image/*" aria-hidden="true" tabindex="-1" @change="emit('logoSelected', $event)" />
</template>

<style scoped>
.files-intro { margin-bottom: 24px; }
.files-description { margin: 0 0 12px; color: var(--text-muted); font-size: 13px; line-height: 1.5; }
.files-context { display: flex; align-items: baseline; gap: 12px; min-width: 0; font-size: 12px; }
.files-context strong { flex-shrink: 0; color: var(--text-strong); font-weight: 600; }
.files-context span { overflow: hidden; color: var(--text-muted); text-overflow: ellipsis; white-space: nowrap; }
.files-notice { display: flex; align-items: baseline; gap: 8px; margin: -8px 0 20px; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--surface-muted); color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.files-groups { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.files-group { min-width: 0; }
.files-group + .files-group { padding-left: 24px; border-left: 1px solid var(--surface-border); }
.files-group-title { display: flex; align-items: center; gap: 9px; margin: 0 0 12px; color: var(--text-strong); font-size: 15px; font-weight: 650; }
.files-group-title i { color: var(--accent); font-size: 15px; }
.file-action-wrap + .file-action-wrap { margin-top: 4px; }
.file-action { display: flex; align-items: flex-start; justify-content: flex-start; width: 100%; gap: 12px; padding: 12px 10px; border: 1px solid transparent; border-radius: var(--radius-md); background: transparent; color: var(--text-strong); text-align: left; }
.file-action:not(:disabled):hover { background: var(--surface-hover); border-color: var(--surface-border); }
.file-action:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
.file-action-icon { flex-shrink: 0; margin-top: 3px; color: var(--text-muted); font-size: 16px; }
.file-action-copy { flex: 1; min-width: 0; }
.file-action-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.file-action-heading strong { color: var(--text-strong); font-size: 13px; line-height: 1.5; font-weight: 600; }
.file-format { flex-shrink: 0; color: var(--text-muted); font-size: 10px; font-weight: 600; line-height: 1.5; }
.file-action-description { display: block; margin-top: 4px; color: var(--text-muted); font-size: 12px; line-height: 1.5; font-weight: 400; }
.file-save-options { display: flex; flex-wrap: wrap; gap: 4px; margin: -4px 0 8px 35px; }
.file-save-options :deep(.p-button) { padding: 4px 8px; font-size: 12px; }
.files-utilities { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--surface-border); }
.files-utilities :deep(.p-button) { font-size: 12px; }
.logo-input { display: none; }
@media (max-width: 640px) {
  .files-groups { grid-template-columns: 1fr; gap: 20px; }
  .files-group + .files-group { padding: 20px 0 0; border-left: 0; border-top: 1px solid var(--surface-border); }
  .files-intro { margin-bottom: 20px; }
}
</style>
