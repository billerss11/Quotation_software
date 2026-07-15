<script setup lang="ts">
import type { AppThemeId } from '@/shared/theme/appTheme'

defineProps<{
  pickerLabel: string
  options: Array<{
    id: AppThemeId
    label: string
    description: string
  }>
}>()

const model = defineModel<AppThemeId>({ required: true })
</script>

<template>
  <div class="theme-picker" role="group" :aria-label="pickerLabel">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      class="theme-card"
      :class="{ 'theme-card-selected': model === option.id }"
      :aria-pressed="model === option.id"
      @click="model = option.id"
    >
      <span class="theme-preview" :data-ui-theme="option.id" aria-hidden="true">
        <span class="theme-preview-sidebar">
          <span class="theme-preview-brand" />
          <span class="theme-preview-nav theme-preview-nav-active" />
          <span class="theme-preview-nav" />
        </span>
        <span class="theme-preview-workspace">
          <span class="theme-preview-toolbar" />
          <span class="theme-preview-grid">
            <span class="theme-preview-panel theme-preview-panel-wide" />
            <span class="theme-preview-panel" />
          </span>
        </span>
      </span>

      <span class="theme-card-copy">
        <span class="theme-card-title">
          <span>{{ option.label }}</span>
          <i v-if="model === option.id" class="pi pi-check-circle" aria-hidden="true" />
        </span>
        <span class="theme-card-description">{{ option.description }}</span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.theme-picker {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.theme-card {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
  color: var(--text-body);
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: var(--shadow-control);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.theme-card:hover {
  border-color: var(--surface-border-strong);
  box-shadow: var(--shadow-soft);
  transform: translateY(-1px);
}

.theme-card-selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-ring), var(--shadow-card);
}

.theme-card:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.theme-preview {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  height: 82px;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  border-radius: calc(var(--radius-lg) - 2px);
  background: var(--app-bg);
}

.theme-preview-sidebar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 5px;
  border-right: 1px solid var(--sidebar-border);
  background: var(--sidebar-bg);
}

.theme-preview-brand {
  width: 12px;
  height: 12px;
  margin-bottom: 3px;
  border-radius: 3px;
  background: var(--sidebar-accent);
}

.theme-preview-nav {
  width: 14px;
  height: 5px;
  border-radius: 3px;
  background: var(--sidebar-text-muted);
  opacity: 0.48;
}

.theme-preview-nav-active {
  background: var(--sidebar-accent);
  opacity: 1;
}

.theme-preview-workspace {
  display: grid;
  grid-template-rows: 16px minmax(0, 1fr);
  gap: 7px;
  padding: 8px;
  background: linear-gradient(145deg, var(--app-bg-elevated), var(--app-bg));
}

.theme-preview-toolbar {
  border: 1px solid var(--surface-border);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius-sm);
  background: var(--surface-card);
}

.theme-preview-grid {
  display: grid;
  grid-template-columns: 1.45fr 0.8fr;
  gap: 6px;
}

.theme-preview-panel {
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.theme-preview-panel-wide {
  background: linear-gradient(180deg, var(--surface-card), var(--surface-raised));
}

.theme-card-copy {
  display: grid;
  gap: 4px;
  padding: 0 2px 2px;
}

.theme-card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 800;
}

.theme-card-title i {
  color: var(--accent);
  font-size: 14px;
}

.theme-card-description {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.45;
}

@media (max-width: 760px) {
  .theme-picker {
    grid-template-columns: 1fr;
  }
}
</style>
