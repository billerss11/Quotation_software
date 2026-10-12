<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationRevision } from '../types'

const props = defineProps<{
  visible: boolean
  revisions: readonly QuotationRevision[]
  currentRevisionNumber: number
  canMutate: boolean
  canExportPdf: boolean
  busy: boolean
  historyUnavailable: boolean
  statusMessage?: string
}>()

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  create: [note: string]
  preview: [id: string]
  exportPdf: [id: string]
  restore: [id: string]
  delete: [id: string]
}>()

const { t, locale } = useI18n()
const note = ref('')
const pendingDeleteId = ref<string | null>(null)
const mutationDisabled = computed(() => !props.canMutate || props.busy || props.historyUnavailable)
const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value, {
  dateStyle: 'medium',
  timeStyle: 'short',
}))
const savedRevisions = computed(() => [...props.revisions]
  .sort((left, right) => right.revisionNumber - left.revisionNumber)
  .map(revision => ({
    ...revision,
    formattedDate: dateFormatter.value.format(new Date(revision.createdAt)),
  })))

watch(() => props.visible, (visible) => {
  if (visible) note.value = ''
  pendingDeleteId.value = null
})
watch(() => props.currentRevisionNumber, () => {
  note.value = ''
  pendingDeleteId.value = null
})

function setVisible(visible: boolean) {
  if (!props.busy) emit('update:visible', visible)
}

function createRevision() {
  if (!mutationDisabled.value) emit('create', note.value.trim())
}

function requestDelete(id: string) {
  if (!mutationDisabled.value && props.revisions.some(revision => revision.id === id)) {
    pendingDeleteId.value = id
  }
}

function confirmDelete(id: string) {
  if (mutationDisabled.value || pendingDeleteId.value !== id) return
  if (!props.revisions.some(revision => revision.id === id)) return
  pendingDeleteId.value = null
  emit('delete', id)
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    modal
    :header="t('quotations.revisions.title')"
    :style="{ width: '760px' }"
    :breakpoints="{ '800px': '94vw' }"
    :closable="!props.busy"
    :close-on-escape="!props.busy"
    :close-button-props="{ 'aria-label': t('quotations.revisions.close') }"
    :dismissable-mask="false"
    @update:visible="setVisible"
  >
    <div class="revisions-dialog" :aria-busy="props.busy">
      <p
        v-if="props.statusMessage && (!props.historyUnavailable || props.statusMessage !== t('quotations.revisions.historyUnavailable'))"
        class="revision-notice"
        role="status"
      >
        {{ props.statusMessage }}
      </p>
      <p v-if="props.historyUnavailable" class="revision-notice" role="status">
        {{ t('quotations.revisions.historyUnavailable') }}
      </p>
      <p v-if="!props.canMutate" class="revision-notice" role="status">
        {{ t('quotations.revisions.desktopOnly') }}
      </p>

      <section class="working-revision">
        <h3 class="revision-heading">
          {{ t('quotations.revisions.workingRevision', { number: props.currentRevisionNumber }) }}
        </h3>
        <p class="revision-hint">{{ t('quotations.revisions.workingHint') }}</p>
        <form class="revision-create" @submit.prevent="createRevision">
          <label class="revision-note-field" for="quotation-revision-note">
            <span>{{ t('quotations.revisions.note') }}</span>
            <InputText
              id="quotation-revision-note"
              v-model="note"
              :placeholder="t('quotations.revisions.notePlaceholder')"
              :disabled="mutationDisabled"
            />
          </label>
          <Button
            type="submit"
            icon="pi pi-plus"
            :label="t('quotations.revisions.create')"
            :disabled="mutationDisabled"
          />
        </form>
        <p class="revision-hint">{{ t('quotations.revisions.createHint') }}</p>
      </section>

      <section class="saved-revisions">
        <h3 class="revision-heading">{{ t('quotations.revisions.savedTitle') }}</h3>
        <p class="revision-hint">{{ t('quotations.revisions.readOnly') }}</p>
        <p v-if="savedRevisions.length === 0 && !props.historyUnavailable" class="revision-hint">
          {{ t('quotations.revisions.empty') }}
        </p>
        <ul v-if="savedRevisions.length > 0" class="revision-list">
          <li v-for="revision in savedRevisions" :key="revision.id" class="revision-entry">
            <div class="revision-details">
              <strong>{{ t('quotations.revisions.revision', { number: revision.revisionNumber }) }}</strong>
              <time class="revision-date" :datetime="revision.createdAt">
                {{ t('quotations.revisions.savedAt', { date: revision.formattedDate }) }}
              </time>
              <p v-if="revision.note" class="revision-note" translate="no">{{ revision.note }}</p>
            </div>
            <div class="revision-actions">
              <Button
                severity="secondary"
                outlined
                icon="pi pi-eye"
                :label="t('quotations.revisions.preview')"
                :aria-label="t('quotations.revisions.previewAria', { number: revision.revisionNumber })"
                :disabled="props.busy"
                @click="emit('preview', revision.id)"
              />
              <Button
                severity="secondary"
                outlined
                icon="pi pi-file-pdf"
                :label="t('quotations.revisions.exportPdf')"
                :aria-label="t('quotations.revisions.exportPdfAria', { number: revision.revisionNumber })"
                :disabled="props.busy || !props.canExportPdf"
                @click="emit('exportPdf', revision.id)"
              />
              <Button
                severity="secondary"
                outlined
                icon="pi pi-replay"
                :label="t('quotations.revisions.restore')"
                :aria-label="t('quotations.revisions.restoreAria', { number: revision.revisionNumber })"
                :disabled="mutationDisabled"
                @click="emit('restore', revision.id)"
              />
              <Button
                severity="danger"
                text
                icon="pi pi-trash"
                :label="t('quotations.revisions.delete')"
                :aria-label="t('quotations.revisions.deleteAria', { number: revision.revisionNumber })"
                :aria-expanded="pendingDeleteId === revision.id"
                :disabled="mutationDisabled"
                @click="requestDelete(revision.id)"
              />
            </div>
            <div v-if="pendingDeleteId === revision.id" class="revision-delete-confirmation">
              <div role="alert">
                <strong>{{ t('quotations.revisions.confirmDelete', { number: revision.revisionNumber }) }}</strong>
                <p class="revision-hint">{{ t('quotations.revisions.deleteWarning') }}</p>
              </div>
              <div class="revision-actions">
                <Button
                  severity="secondary"
                  outlined
                  :label="t('quotations.revisions.cancelDelete')"
                  :disabled="props.busy"
                  @click="pendingDeleteId = null"
                />
                <Button
                  severity="danger"
                  :label="t('quotations.revisions.confirmDeleteAction')"
                  :disabled="mutationDisabled"
                  @click="confirmDelete(revision.id)"
                />
              </div>
            </div>
          </li>
        </ul>
        <p class="revision-hint">{{ t('quotations.revisions.restoreHint') }}</p>
      </section>
      <p v-if="props.busy" class="revision-hint" role="status">
        {{ t('quotations.revisions.operationInProgress') }}
      </p>
    </div>
    <template #footer>
      <Button
        severity="secondary"
        :label="t('quotations.revisions.close')"
        :disabled="props.busy"
        @click="setVisible(false)"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.revisions-dialog,
.working-revision,
.saved-revisions,
.revision-note-field,
.revision-details {
  display: grid;
  gap: 0.65rem;
}

.revisions-dialog {
  gap: 1.25rem;
}

.revision-heading,
.revision-hint,
.revision-note,
.revision-notice {
  margin: 0;
}

.revision-heading {
  color: var(--text-strong);
  font-size: 1rem;
}

.revision-hint,
.revision-date {
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.revision-notice {
  padding: 0.8rem 0.9rem;
  border-left: 4px solid var(--warning);
  background: var(--surface-hover);
  color: var(--text-body);
}

.revision-create,
.revision-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.5rem;
}

.revision-note-field {
  flex: 1 1 240px;
  min-width: 0;
}

.revision-list {
  display: grid;
  gap: 0.75rem;
  max-height: 360px;
  overflow: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}

.revision-entry {
  display: grid;
  gap: 0.8rem;
  padding: 0.9rem;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-card);
}

.revision-details {
  gap: 0.3rem;
}

.revision-delete-confirmation {
  display: grid;
  gap: 0.75rem;
  padding: 0.8rem;
  border-left: 3px solid var(--danger);
  background: var(--surface-hover);
}

.revision-note {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.revision-actions {
  justify-content: flex-end;
}
</style>
