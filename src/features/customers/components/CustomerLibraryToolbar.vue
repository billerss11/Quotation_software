<script setup lang="ts">
import Button from 'primevue/button'

defineProps<{
  recordCount: number
}>()

const emit = defineEmits<{
  createRecord: []
  importJson: []
  exportJson: []
}>()
</script>

<template>
  <section class="toolbar-card" aria-label="Customer library actions">
    <div class="toolbar-copy">
      <h2>Customer Library</h2>
      <p>Manage reusable customer records here. Quotations copy these values and can then be edited independently.</p>
    </div>

    <div class="toolbar-actions">
      <span class="record-count">{{ recordCount }} records</span>
      <Button icon="pi pi-plus" label="New customer" @click="emit('createRecord')" />
      <Button icon="pi pi-upload" label="Import JSON" severity="secondary" outlined @click="emit('importJson')" />
      <Button
        icon="pi pi-download"
        label="Export JSON"
        severity="secondary"
        outlined
        :disabled="recordCount === 0"
        @click="emit('exportJson')"
      />
    </div>
  </section>
</template>

<style scoped>
.toolbar-card {
  display: grid;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  background: #ffffff;
}

.toolbar-copy {
  display: grid;
  gap: 6px;
}

.toolbar-copy h2,
.toolbar-copy p {
  margin: 0;
}

.toolbar-copy p {
  color: #64748b;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.record-count {
  margin-right: auto;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}
</style>
