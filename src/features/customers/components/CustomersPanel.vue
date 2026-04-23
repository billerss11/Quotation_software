<script setup lang="ts">
const customerRows = [
  {
    company: 'Acme Industrial',
    contact: 'Maria Chen',
    email: 'maria@example.com',
    lastQuotation: 'Q-2026-001',
  },
  {
    company: 'Northstar Projects',
    contact: 'David Lee',
    email: 'david@example.com',
    lastQuotation: 'Draft',
  },
]
</script>

<template>
  <section class="customers-panel">
    <div class="panel-heading">
      <h2>Customer Management</h2>
      <p>Reusable customer history will live here as quotation drafts accumulate.</p>
    </div>

    <div class="customer-grid">
      <article v-for="customer in customerRows" :key="customer.company" class="customer-card">
        <h3>{{ customer.company }}</h3>
        <p>{{ customer.contact }}</p>
        <span>{{ customer.email }}</span>
        <strong>{{ customer.lastQuotation }}</strong>
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
