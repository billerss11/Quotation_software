<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

defineProps<{
  recordCount: number
}>()

const emit = defineEmits<{
  createRecord: []
  importJson: []
  exportJson: []
}>()

const { t } = useI18n()
</script>

<template>
  <section class="toolbar-card" :aria-label="t('customers.toolbar.aria')">
    <div class="toolbar-copy">
      <h2>{{ t('customers.toolbar.title') }}</h2>
      <p>{{ t('customers.toolbar.description') }}</p>
    </div>

    <div class="toolbar-actions">
      <span class="record-count">{{ t('customers.toolbar.recordCount', { count: recordCount }) }}</span>
      <Button icon="pi pi-plus" :label="t('customers.toolbar.newCustomer')" @click="emit('createRecord')" />
      <Button icon="pi pi-upload" :label="t('customers.toolbar.importJson')" severity="secondary" outlined @click="emit('importJson')" />
      <Button
        icon="pi pi-download"
        :label="t('customers.toolbar.exportJson')"
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
