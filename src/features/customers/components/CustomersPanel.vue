<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCustomerLibrary } from '../composables/useCustomerLibrary'
import CustomerLibraryEditor from './CustomerLibraryEditor.vue'
import CustomerLibraryList from './CustomerLibraryList.vue'
import CustomerLibraryToolbar from './CustomerLibraryToolbar.vue'

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
} = useCustomerLibrary()

const { t } = useI18n()
const confirm = useConfirm()
const statusMessage = shallowRef('')

function getDraftLabel() {
  return draft.value.customerCompany.trim()
    || draft.value.contactPerson.trim()
    || t('customers.list.untitled')
}

function requestDiscard(action: () => void) {
  if (!isDirty.value) {
    action()
    return
  }

  confirm.require({
    header: t('customers.confirm.discardTitle'),
    message: t('customers.confirm.discardMessage'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: t('customers.confirm.keepEditing'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('customers.confirm.discard'), severity: 'danger' },
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
    statusMessage.value = t('customers.statuses.newReady')
  })
}

function handleSave() {
  const result = saveDraft()

  statusMessage.value = result.ok
    ? t('customers.statuses.saved', { name: getDraftLabel() })
    : t('customers.statuses.validationFailed')
}

function handleDelete() {
  const deletedLabel = getDraftLabel()

  confirm.require({
    header: t('customers.confirm.deleteTitle'),
    message: t('customers.confirm.deleteMessage', { name: deletedLabel }),
    icon: 'pi pi-trash',
    rejectProps: { label: t('customers.confirm.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('customers.confirm.delete'), severity: 'danger' },
    accept: () => {
      deleteSelectedRecord()
      statusMessage.value = t('customers.statuses.deleted', { name: deletedLabel })
    },
  })
}
</script>

<template>
  <section class="customers-panel">
    <CustomerLibraryToolbar :record-count="records.length" @create-record="handleCreateRecord" />

    <div v-if="statusMessage" class="status-banner" role="status" aria-live="polite">
      <i class="pi pi-info-circle" aria-hidden="true" />
      <span>{{ statusMessage }}</span>
    </div>

    <div class="management-layout">
      <CustomerLibraryList :records="records" :selected-record-id="selectedRecordId" @select="handleSelect" />

      <CustomerLibraryEditor
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
      <section v-else class="editor-empty" :aria-label="t('customers.editor.idleTitle')">
        <i class="pi pi-user-edit" aria-hidden="true" />
        <h2>{{ t('customers.editor.idleTitle') }}</h2>
        <p>{{ t('customers.editor.idleDescription') }}</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.customers-panel { display: grid; gap: 16px; min-width: 0; }
.management-layout { display: grid; grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1.1fr); gap: 16px; min-width: 0; }
.status-banner { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border: 1px solid var(--accent-soft); border-radius: var(--radius-md); background: var(--accent-surface); color: var(--accent); font-size: 13px; font-weight: 600; }
.editor-empty { display: grid; place-items: center; align-content: center; gap: 8px; min-height: 320px; padding: 24px; border: 1px dashed var(--surface-border-strong); border-radius: var(--radius-xl); background: var(--surface-card); color: var(--text-muted); text-align: center; }
.editor-empty i { color: var(--accent); font-size: 28px; }
.editor-empty h2 { margin: 0; color: var(--text-strong); font-size: 15px; }
.editor-empty p { margin: 0; max-width: 40ch; font-size: 13px; line-height: 1.5; }
@media (max-width: 960px) { .management-layout { grid-template-columns: 1fr; } }
</style>
