<script setup lang="ts">
import Button from 'primevue/button'
import { useConfirm } from 'primevue/useconfirm'
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCompanyProfileLibrary } from '../composables/useCompanyProfileLibrary'
import CompanyProfileLibraryEditor from './CompanyProfileLibraryEditor.vue'
import CompanyProfileLibraryList from './CompanyProfileLibraryList.vue'

const {
  records,
  draft,
  selectedRecordId,
  editorMode,
  hasSelectedRecord,
  validationErrors,
  isDirty,
  selectRecord,
  startNewRecord,
  cancelDraft,
  saveDraft,
  deleteSelectedRecord,
} = useCompanyProfileLibrary()

const { t } = useI18n()
const confirm = useConfirm()
const statusMessage = shallowRef('')

function getDraftLabel() {
  return draft.value.companyName.trim() || t('companyProfiles.list.untitled')
}

function requestDiscard(action: () => void) {
  if (!isDirty.value) {
    action()
    return
  }

  confirm.require({
    header: t('companyProfiles.confirm.discardTitle'),
    message: t('companyProfiles.confirm.discardMessage'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: t('companyProfiles.confirm.keepEditing'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('companyProfiles.confirm.discard'), severity: 'danger' },
    accept: action,
  })
}

function handleSelect(recordId: string) {
  if (recordId === selectedRecordId.value) return
  requestDiscard(() => {
    selectRecord(recordId)
    statusMessage.value = ''
  })
}

function handleCreateRecord() {
  requestDiscard(() => {
    startNewRecord()
    statusMessage.value = t('companyProfiles.statuses.newReady')
  })
}

function handleSave() {
  const result = saveDraft()

  statusMessage.value = result.ok
    ? t('companyProfiles.statuses.saved', { name: getDraftLabel() })
    : t('companyProfiles.statuses.validationFailed')
}

function handleDelete() {
  const deletedLabel = getDraftLabel()

  confirm.require({
    header: t('companyProfiles.confirm.deleteTitle'),
    message: t('companyProfiles.confirm.deleteMessage', { name: deletedLabel }),
    icon: 'pi pi-trash',
    rejectProps: { label: t('companyProfiles.confirm.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('companyProfiles.confirm.delete'), severity: 'danger' },
    accept: () => {
      deleteSelectedRecord()
      statusMessage.value = t('companyProfiles.statuses.deleted', { name: deletedLabel })
    },
  })
}
</script>

<template>
  <section class="company-profiles-panel">
    <section class="toolbar-card" :aria-label="t('companyProfiles.toolbar.aria')">
      <div>
        <h2>{{ t('companyProfiles.toolbar.title') }}</h2>
        <p>{{ t('companyProfiles.toolbar.description') }}</p>
      </div>
      <Button icon="pi pi-plus" :label="t('companyProfiles.toolbar.newProfile')" @click="handleCreateRecord" />
    </section>

    <div v-if="statusMessage" class="status-banner" role="status" aria-live="polite">
      <i class="pi pi-info-circle" aria-hidden="true" />
      <span>{{ statusMessage }}</span>
    </div>

    <div class="management-layout">
      <CompanyProfileLibraryList :records="records" :selected-record-id="selectedRecordId" @select="handleSelect" />

      <CompanyProfileLibraryEditor
        v-if="editorMode !== 'idle'"
        v-model="draft"
        :mode="editorMode"
        :can-delete="hasSelectedRecord"
        :is-dirty="isDirty"
        :validation-errors="validationErrors"
        @save="handleSave"
        @cancel="cancelDraft"
        @delete="handleDelete"
      />
      <section v-else class="editor-empty" :aria-label="t('companyProfiles.editor.idleTitle')">
        <i class="pi pi-building" aria-hidden="true" />
        <h2>{{ t('companyProfiles.editor.idleTitle') }}</h2>
        <p>{{ t('companyProfiles.editor.idleDescription') }}</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.company-profiles-panel { display: grid; gap: 16px; min-width: 0; }
.toolbar-card { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; padding: 18px 22px; border: 1px solid var(--surface-border); border-radius: var(--radius-xl); background: var(--surface-card); box-shadow: var(--shadow-card); }
.toolbar-card div { display: grid; gap: 4px; }
.toolbar-card h2 { margin: 0; color: var(--text-strong); font-size: 18px; }
.toolbar-card p { margin: 0; max-width: 64ch; color: var(--text-muted); font-size: 13px; line-height: 1.5; }
.management-layout { display: grid; grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1.1fr); gap: 16px; min-width: 0; }
.status-banner { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border: 1px solid var(--accent-soft); border-radius: var(--radius-md); background: var(--accent-surface); color: var(--accent); font-size: 13px; font-weight: 600; }
.editor-empty { display: grid; place-items: center; align-content: center; gap: 8px; min-height: 320px; padding: 24px; border: 1px dashed var(--surface-border-strong); border-radius: var(--radius-xl); background: var(--surface-card); color: var(--text-muted); text-align: center; }
.editor-empty i { color: var(--accent); font-size: 28px; }
.editor-empty h2 { margin: 0; color: var(--text-strong); font-size: 15px; }
.editor-empty p { margin: 0; max-width: 40ch; font-size: 13px; line-height: 1.5; }
@media (max-width: 960px) { .management-layout { grid-template-columns: 1fr; } }
</style>
