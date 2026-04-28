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
    <div class="editor-heading">
      <div>
        <h2>{{ t('customers.editor.title') }}</h2>
        <p>{{ t('customers.editor.description') }}</p>
      </div>
      <span class="updated-at">{{ t('customers.editor.updated', { date: formatIsoDate(model.updatedAt.slice(0, 10), currentLocale) }) }}</span>
    </div>

    <div class="editor-grid">
      <label class="field">
        <span>{{ t('customers.editor.company') }}</span>
        <InputText v-model="model.customerCompany" />
      </label>
      <label class="field">
        <span>{{ t('customers.editor.contactPerson') }}</span>
        <InputText v-model="model.contactPerson" />
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
  padding: 20px;
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  background: #ffffff;
}

.editor-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.editor-heading h2,
.editor-heading p {
  margin: 0;
}

.editor-heading p,
.updated-at {
  color: #64748b;
}

.updated-at {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.field {
  display: grid;
  gap: 6px;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.field-wide {
  grid-column: 1 / -1;
}

.field :deep(.p-inputtext),
.field :deep(.p-textarea) {
  width: 100%;
}

.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
