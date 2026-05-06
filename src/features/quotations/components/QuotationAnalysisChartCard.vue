<script setup lang="ts">
const props = defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <section class="analysis-card">
    <header class="analysis-card-header">
      <div>
        <h3 class="analysis-card-title">{{ props.title }}</h3>
        <p class="analysis-card-description">{{ props.description }}</p>
      </div>
      <slot name="actions" />
    </header>
    <div class="analysis-card-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.analysis-card {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.analysis-card:hover {
  border-color: var(--surface-border-strong);
  box-shadow: var(--shadow-soft);
}

.analysis-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.analysis-card-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 700;
}

.analysis-card-description {
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
  text-wrap: pretty;
}

.analysis-card-body {
  min-width: 0;
}
</style>
