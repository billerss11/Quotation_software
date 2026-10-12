<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationRevision } from '../types'
import { createQuotationSnapshotPayload } from '../utils/quotationSnapshotPayload'
import QuotationPreview from './QuotationPreview.vue'

const props = defineProps<{
  revision: QuotationRevision
  workingRevisionNumber: number
  canRestore: boolean
  busy: boolean
}>()
const emit = defineEmits<{
  back: []
  restore: [id: string]
}>()
const { t } = useI18n()
const payload = computed(() => createQuotationSnapshotPayload(props.revision.quotation))
</script>

<template>
  <section class="saved-revision-view" :aria-label="t('quotations.revisions.viewingSaved', { number: props.revision.revisionNumber })">
    <header class="saved-revision-header">
      <div class="saved-revision-description" aria-live="polite">
        <strong>{{ t('quotations.revisions.viewingSaved', { number: props.revision.revisionNumber }) }}</strong>
        <span>{{ t('quotations.revisions.editSavedHint') }}</span>
      </div>
      <div class="saved-revision-actions">
        <Button
          severity="secondary"
          outlined
          :label="t('quotations.revisions.restore')"
          :disabled="props.busy || !props.canRestore"
          @click="emit('restore', props.revision.id)"
        />
        <Button
          icon="pi pi-arrow-left"
          :label="t('quotations.revisions.backToWorking', { number: props.workingRevisionNumber })"
          :disabled="props.busy"
          @click="emit('back')"
        />
      </div>
    </header>
    <div class="saved-revision-scroll">
      <div class="saved-revision-document">
        <QuotationPreview v-bind="payload" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.saved-revision-view {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--surface-panel);
}

.saved-revision-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--surface-border);
}

.saved-revision-description {
  display: grid;
  gap: 4px;
  color: var(--text-strong);
}

.saved-revision-description span {
  font-size: 13px;
  color: var(--text-muted);
}

.saved-revision-actions {
  display: flex;
  gap: 8px;
}

.saved-revision-scroll {
  min-height: 0;
  overflow: auto;
  background: var(--surface-muted);
}

.saved-revision-document {
  width: max-content;
  margin: 0 auto;
  padding: 20px;
}
</style>
