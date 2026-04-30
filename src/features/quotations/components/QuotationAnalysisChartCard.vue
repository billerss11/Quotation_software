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
  border-radius: 14px;
  background:
    radial-gradient(circle at top right, rgb(4 120 87 / 6%), transparent 140px),
    var(--surface-card);
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
  font-size: 16px;
}

.analysis-card-description {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.analysis-card-body {
  min-width: 0;
}
</style>
