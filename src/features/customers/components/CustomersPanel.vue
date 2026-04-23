<script setup lang="ts">
import { computed } from 'vue'

import { loadSavedQuotations } from '@/shared/services/localQuotationStorage'

import { extractCustomerRecords } from '../utils/customerRecords'

const customerRows = computed(() => extractCustomerRecords(loadSavedQuotations()))
</script>

<template>
  <section class="customers-panel">
    <div class="panel-heading">
      <h2>Customer Management</h2>
      <p>Customer history is built from saved quotations and can be reused in the editor header tab.</p>
    </div>

    <div class="customer-grid">
      <article v-for="customer in customerRows" :key="customer.key" class="customer-card">
        <h3>{{ customer.customerCompany || customer.customerName }}</h3>
        <p>{{ customer.contactPerson }}</p>
        <span>{{ customer.contactDetails }}</span>
        <strong>{{ customer.lastQuotationNumber }}</strong>
      </article>
    </div>
  </section>
</template>

<style scoped>
.customers-panel {
  display: grid;
  gap: 20px;
}

.panel-heading {
  padding: 20px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: #ffffff;
}

.panel-heading h2,
.panel-heading p {
  margin: 0;
}

.panel-heading p {
  margin-top: 6px;
  color: #64748b;
}

.customer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.customer-card {
  display: grid;
  gap: 6px;
  padding: 18px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: #ffffff;
}

.customer-card h3,
.customer-card p {
  margin: 0;
}

.customer-card span {
  color: #64748b;
}

.customer-card strong {
  color: var(--accent);
}
</style>
