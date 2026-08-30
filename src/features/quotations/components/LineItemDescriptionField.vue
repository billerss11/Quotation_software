<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

const model = defineModel<string>({ required: true })
const props = defineProps<{
  historyTarget: string
  inputAriaLabel: string
  itemNumber: string
  placeholder: string
}>()
const emit = defineEmits<{
  blur: []
}>()

const { t } = useI18n()
const editorVisible = shallowRef(false)
const draftValue = shallowRef('')

function openEditor() {
  draftValue.value = model.value
  editorVisible.value = true
}

function cancelEditor() {
  editorVisible.value = false
  draftValue.value = model.value
}

function applyEditor() {
  model.value = draftValue.value
  emit('blur')
  editorVisible.value = false
}
</script>

<template>
  <div class="description-field-shell">
    <div class="description-field">
      <Textarea
        class="description-field-textarea"
        :data-history-target="props.historyTarget"
        :model-value="model"
        :aria-label="props.inputAriaLabel"
        rows="1"
        auto-resize
        :placeholder="props.placeholder"
        @update:model-value="model = $event"
        @blur="emit('blur')"
      />
      <Button
        v-tooltip.top="t('quotations.lineItems.descriptionEditor.open')"
        class="description-expand-button"
        type="button"
        icon="pi pi-expand"
        severity="secondary"
        text
        rounded
        :aria-label="t('quotations.lineItems.descriptionEditor.openAria', { itemNumber: props.itemNumber })"
        @click="openEditor"
      />
    </div>

    <Dialog
      v-if="editorVisible"
      v-model:visible="editorVisible"
      modal
      maximizable
      :draggable="false"
      class="description-editor-dialog"
      :header="t('quotations.lineItems.descriptionEditor.title', { itemNumber: props.itemNumber })"
      :style="{ width: '760px' }"
      :breakpoints="{ '800px': 'calc(100vw - 2rem)' }"
      @hide="cancelEditor"
    >
      <div class="description-editor-body">
        <p class="description-editor-hint">
          {{ t('quotations.lineItems.descriptionEditor.hint') }}
        </p>
        <Textarea
          v-model="draftValue"
          class="description-editor-textarea"
          :aria-label="props.inputAriaLabel"
          :placeholder="props.placeholder"
          rows="14"
          @keydown.ctrl.enter.prevent="applyEditor"
          @keydown.meta.enter.prevent="applyEditor"
        />
      </div>

      <template #footer>
        <div class="description-editor-actions">
          <Button
            type="button"
            severity="secondary"
            text
            :label="t('quotations.lineItems.descriptionEditor.cancel')"
            @click="cancelEditor"
          />
          <Button
            type="button"
            icon="pi pi-check"
            :label="t('quotations.lineItems.descriptionEditor.apply')"
            @click="applyEditor"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.description-field-shell {
  min-width: 0;
}

.description-field {
  position: relative;
  min-width: 0;
}

.description-field-textarea {
  display: block;
  width: 100%;
  padding-right: 2rem !important;
}

.description-expand-button {
  position: absolute;
  z-index: 1;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--accent) 16%, var(--surface-border));
  background: color-mix(in srgb, var(--surface-card) 88%, transparent);
  color: var(--text-muted);
  opacity: 0.62;
  box-shadow: 0 1px 3px rgb(15 23 42 / 8%);
  backdrop-filter: blur(4px);
  transition:
    opacity 160ms ease,
    color 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}

.description-expand-button :deep(.p-button-icon) {
  font-size: 10px;
}

.description-field:hover .description-expand-button,
.description-expand-button:focus-visible {
  border-color: color-mix(in srgb, var(--accent) 48%, var(--surface-border));
  background: var(--surface-card);
  color: var(--accent);
  opacity: 1;
}

.description-editor-body {
  display: grid;
  gap: 10px;
}

.description-editor-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.description-editor-textarea {
  width: 100%;
  min-height: clamp(260px, 42vh, 440px);
  padding: 0.9rem 1rem;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.55;
  resize: vertical;
}

.description-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}

@media (max-width: 640px) {
  .description-editor-textarea {
    min-height: 50vh;
  }

  .description-editor-actions :deep(.p-button) {
    flex: 1;
  }
}
</style>
