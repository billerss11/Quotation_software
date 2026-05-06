<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatIsoDate } from '@/shared/utils/formatters'
import type { CustomerLibraryRecord } from '../utils/customerRecords'

defineProps<{
  canDelete: boolean
}>()

const model = defineModel<CustomerLibraryRecord>({ required: true })

const emit = defineEmits<{
  save: []
  delete: []
}>()

const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
</script>

<template>
  <section class="editor-card" :aria-label="t('customers.editor.aria')">
    <header class="editor-heading">
      <div class="editor-heading-copy">
        <h2 class="editor-title">{{ t('customers.editor.title') }}</h2>
        <p class="editor-description">{{ t('customers.editor.description') }}</p>
      </div>
      <span class="updated-at" :title="model.updatedAt">
        <i class="pi pi-clock" aria-hidden="true" />
        {{ t('customers.editor.updated', { date: formatIsoDate(model.updatedAt.slice(0, 10), currentLocale) }) }}
      </span>
    </header>

    <div class="editor-grid">
      <label class="field">
        <span>{{ t('customers.editor.company') }}</span>
        <InputText v-model="model.customerCompany" autocomplete="organization" />
      </label>
      <label class="field">
        <span>{{ t('customers.editor.contactPerson') }}</span>
        <InputText v-model="model.contactPerson" autocomplete="name" />
      </label>
      <label class="field field-wide">
        <span>{{ t('customers.editor.contactDetails') }}</span>
        <Textarea v-model="model.contactDetails" rows="3" auto-resize />
      </label>
    </div>

    <div class="editor-actions">
      <Button icon="pi pi-save" :label="t('customers.editor.save')" @click="emit('save')" />
      <Button
        icon="pi pi-trash"
        :label="t('customers.editor.delete')"
        severity="danger"
        outlined
        :disabled="!canDelete"
        @click="emit('delete')"
      />
    </div>
  </section>
</template>

<style scoped>
.editor-card {
  display: grid;
  gap: 16px;
  padding: 20px 22px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.editor-heading {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.editor-heading-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.editor-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 15px;
  font-weight: 700;
}

.editor-description {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.45;
  text-wrap: pretty;
}

.updated-at {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.updated-at i {
  font-size: 11px;
  color: var(--text-subtle);
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.field {
  display: grid;
  gap: 5px;
  color: var(--text-body);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.field-wide {
  grid-column: 1 / -1;
}

.field :deep(.p-inputtext),
.field :deep(.p-textarea) {
  width: 100%;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}

.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 4px;
  border-top: 1px solid var(--surface-border);
}

.editor-actions :deep(.p-button) {
  border-radius: var(--radius-md);
}

@media (max-width: 640px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }
}
</style>
