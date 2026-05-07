<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useI18n } from 'vue-i18n'

import type { QuotationSectionHeader } from '../types'

const props = defineProps<{
  header: QuotationSectionHeader
  rowIndex: number
  totalRows: number
}>()

const emit = defineEmits<{
  moveRow: [rowId: string, direction: -1 | 1]
  removeRow: [rowId: string]
  updateTitle: [rowId: string, title: string]
}>()

const { t } = useI18n()
</script>

<template>
  <article class="section-header-row" :data-item-id="props.header.id">
    <div class="section-band">
      <span class="section-label">{{ t('quotations.lineItems.sectionHeaderLabel') }}</span>
      <InputText
        class="section-title-input"
        :model-value="props.header.title"
        :placeholder="t('quotations.lineItems.sectionHeaderPlaceholder')"
        :aria-label="t('quotations.lineItems.sectionHeaderTitleAria', { index: props.rowIndex + 1 })"
        @update:model-value="emit('updateTitle', props.header.id, String($event ?? ''))"
      />
      <div class="section-actions">
        <Button
          v-tooltip.top="t('quotations.lineItems.moveUp')"
          icon="pi pi-arrow-up"
          severity="secondary"
          text
          rounded
          :disabled="props.rowIndex === 0"
          :aria-label="t('quotations.lineItems.moveSectionHeaderUpAria', { index: props.rowIndex + 1 })"
          @click="emit('moveRow', props.header.id, -1)"
        />
        <Button
          v-tooltip.top="t('quotations.lineItems.moveDown')"
          icon="pi pi-arrow-down"
          severity="secondary"
          text
          rounded
          :disabled="props.rowIndex === props.totalRows - 1"
          :aria-label="t('quotations.lineItems.moveSectionHeaderDownAria', { index: props.rowIndex + 1 })"
          @click="emit('moveRow', props.header.id, 1)"
        />
        <Button
          v-tooltip.top="t('quotations.lineItems.delete')"
          icon="pi pi-trash"
          severity="danger"
          text
          rounded
          :aria-label="t('quotations.lineItems.deleteSectionHeaderAria', { index: props.rowIndex + 1 })"
          @click="emit('removeRow', props.header.id)"
        />
      </div>
    </div>
  </article>
</template>

<style scoped>
.section-header-row {
  scroll-margin-top: 160px;
}

.section-band {
  display: grid;
  grid-template-columns: auto minmax(220px, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--accent-soft);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius-lg);
  background: linear-gradient(90deg, var(--accent-surface), var(--surface-card));
  box-shadow: var(--shadow-control);
}

.section-label {
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
}

.section-title-input {
  min-width: 0;
}

.section-title-input :deep(.p-inputtext) {
  width: 100%;
  min-height: 34px;
  border-color: rgb(4 120 87 / 18%);
  background: #ffffff;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-strong);
}

.section-actions {
  display: flex;
  gap: 2px;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .section-band {
    grid-template-columns: 1fr;
    justify-items: stretch;
  }

  .section-actions {
    justify-content: flex-start;
  }
}
</style>
