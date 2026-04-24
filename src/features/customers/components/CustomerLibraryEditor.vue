<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'

import type { CustomerLibraryRecord } from '../utils/customerRecords'

defineProps<{
  canDelete: boolean
}>()

const model = defineModel<CustomerLibraryRecord>({ required: true })

const emit = defineEmits<{
  save: []
  delete: []
}>()
</script>

<template>
  <section class="editor-card" aria-label="Customer record editor">
    <div class="editor-heading">
      <div>
        <h2>Customer Details</h2>
        <p>Update the reusable customer record here.</p>
      </div>
      <span class="updated-at">Updated {{ model.updatedAt.slice(0, 10) }}</span>
    </div>

    <div class="editor-grid">
      <label class="field">
        <span>Company</span>
        <InputText v-model="model.customerCompany" />
      </label>
      <label class="field">
        <span>Customer Name</span>
        <InputText v-model="model.customerName" />
      </label>
      <label class="field">
        <span>Contact Person</span>
        <InputText v-model="model.contactPerson" />
      </label>
      <label class="field field-wide">
        <span>Contact Details</span>
        <Textarea v-model="model.contactDetails" rows="3" auto-resize />
      </label>
    </div>

    <div class="editor-actions">
      <Button icon="pi pi-save" label="Save record" @click="emit('save')" />
      <Button
        icon="pi pi-trash"
        label="Delete"
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
