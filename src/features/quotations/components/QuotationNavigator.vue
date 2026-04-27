<script setup lang="ts">
import type { QuotationItem } from '../types'

const props = defineProps<{
  items: QuotationItem[]
}>()

function scrollToItem(itemId: string) {
  document.querySelector(`[data-item-id="${itemId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <nav class="navigator" aria-label="Jump to item">
    <p v-if="items.length === 0" class="nav-empty">No items yet. Add an item to get started.</p>
    <button
      v-for="(item, index) in items"
      :key="item.id"
      type="button"
      class="nav-entry"
      @click="scrollToItem(item.id)"
    >
      <span class="nav-num">{{ index + 1 }}</span>
      <span class="nav-name">{{ item.name || 'Unnamed item' }}</span>
      <span v-if="item.children.length > 0" class="nav-count">{{ item.children.length }}</span>
    </button>
  </nav>
</template>

<style scoped>
.navigator {
  display: grid;
  gap: 4px;
}

.nav-empty {
  margin: 0;
  padding: 12px 4px;
  color: var(--text-muted);
  font-size: 13px;
}

.nav-entry {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background: var(--surface-card);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}

.nav-entry:hover {
  border-color: var(--accent-soft);
  background: var(--accent-surface);
}

.nav-num {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 5px;
  background: var(--accent);
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.nav-name {
  overflow: hidden;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-count {
  display: inline-grid;
  min-width: 20px;
  height: 20px;
  place-items: center;
  padding: 0 5px;
  border-radius: 10px;
  background: var(--surface-raised);
  border: 1px solid var(--surface-border);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}
</style>
