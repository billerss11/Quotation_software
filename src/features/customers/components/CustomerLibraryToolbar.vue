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
      <div class="toolbar-title-row">
        <h2 class="toolbar-title">{{ t('customers.toolbar.title') }}</h2>
        <span class="record-count">{{ t('customers.toolbar.recordCount', { count: recordCount }) }}</span>
      </div>
      <p class="toolbar-description">{{ t('customers.toolbar.description') }}</p>
    </div>

    <div class="toolbar-actions">
      <Button
        icon="pi pi-upload"
        :label="t('customers.toolbar.importJson')"
        severity="secondary"
        outlined
        @click="emit('importJson')"
      />
      <Button
        icon="pi pi-download"
        :label="t('customers.toolbar.exportJson')"
        severity="secondary"
        outlined
        :disabled="recordCount === 0"
        @click="emit('exportJson')"
      />
      <Button icon="pi pi-plus" :label="t('customers.toolbar.newCustomer')" @click="emit('createRecord')" />
    </div>
  </section>
</template>

<style scoped>
.toolbar-card {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 22px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.toolbar-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1 1 320px;
}

.toolbar-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.1;
}

.toolbar-description {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
  text-wrap: pretty;
  max-width: 64ch;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.toolbar-actions :deep(.p-button) {
  border-radius: var(--radius-md);
}

.record-count {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--accent-surface);
  border: 1px solid var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
