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
      <div class="section-label">
        <i class="pi pi-bookmark-fill section-icon" />
        <span>{{ t('quotations.lineItems.sectionHeaderLabel') }}</span>
      </div>
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
  padding: 8px 14px;
  background: #047857;
  border: none;
  border-radius: var(--radius-md, 6px);
}

.section-label {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #a7f3d0;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  user-select: none;
}

.section-icon {
  font-size: 12px;
}

.section-title-input {
  min-width: 0;
}

.section-title-input :deep(.p-inputtext) {
  width: 100%;
  min-height: 32px;
  border-color: transparent;
  background: transparent;
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.01em;
}

.section-title-input :deep(.p-inputtext::placeholder) {
  color: rgb(255 255 255 / 50%);
}

.section-title-input :deep(.p-inputtext:hover),
.section-title-input :deep(.p-inputtext:focus) {
  border-color: #a7f3d0;
  background: rgb(255 255 255 / 10%);
}

.section-actions {
  display: flex;
  gap: 2px;
  justify-content: flex-end;
}

.section-actions :deep(.p-button) {
  color: #a7f3d0;
}

.section-actions :deep(.p-button:hover) {
  color: #ffffff;
  background: rgb(255 255 255 / 12%);
}

.section-actions :deep(.p-button.p-button-danger) {
  color: #fca5a5;
}

.section-actions :deep(.p-button.p-button-danger:hover) {
  color: #ffffff;
  background: rgb(239 68 68 / 30%);
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
