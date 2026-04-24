<script setup lang="ts">
import Button from 'primevue/button'

import type { CustomerLibraryRecord } from '../utils/customerRecords'

defineProps<{
  records: CustomerLibraryRecord[]
}>()

const emit = defineEmits<{
  selectCustomer: [record: CustomerLibraryRecord]
}>()
</script>

<template>
  <section class="customer-picker" aria-label="Customer library">
    <div class="picker-heading">
      <h2>Customer Library</h2>
      <span>{{ records.length }}</span>
    </div>

    <div v-if="records.length > 0" class="customer-list">
      <button
        v-for="record in records"
        :key="record.id"
        class="customer-row"
        type="button"
        @click="emit('selectCustomer', record)"
      >
        <span class="customer-main">
          <strong>{{ record.customerCompany || record.customerName }}</strong>
          <span>{{ record.contactPerson || 'No contact person' }}</span>
        </span>
        <span class="customer-side">
          <span>{{ record.contactDetails || 'No contact details' }}</span>
          <strong>{{ record.updatedAt.slice(0, 10) }}</strong>
        </span>
      </button>
    </div>

    <div v-else class="empty-customers">
      <p>No customer library records yet.</p>
      <span>Add or import customers in the customer library to reuse them here.</span>
    </div>

    <Button
      v-if="records.length > 0"
      class="hint-button"
      icon="pi pi-user-plus"
      label="Click a customer to apply"
      severity="secondary"
      text
      disabled
    />
  </section>
</template>

<style scoped>
.customer-picker {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: #ffffff;
}

.picker-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.picker-heading h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
}

.picker-heading span {
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

.customer-list {
  display: grid;
  gap: 6px;
  max-height: 220px;
  overflow: auto;
}

.customer-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(120px, 0.8fr);
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.customer-row:hover {
  border-color: #99f6e4;
  background: #ecfdf5;
}

.customer-main,
.customer-side,
.empty-customers {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.customer-main strong,
.customer-main span,
.customer-side strong,
.customer-side span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-main strong,
.customer-side strong {
  color: var(--text-strong);
}

.customer-main span,
.customer-side span,
.empty-customers {
  color: #64748b;
  font-size: 13px;
}

.customer-side {
  justify-items: end;
}

.empty-customers p {
  margin: 0;
  color: var(--text-strong);
  font-weight: 800;
}

.empty-customers span {
  font-size: 13px;
}

.hint-button {
  justify-self: start;
}
</style>
