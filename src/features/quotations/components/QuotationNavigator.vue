<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationItem } from '../types'

interface NavRow {
  item: QuotationItem
  depth: number
  number: string
  isGroup: boolean
}

const props = defineProps<{
  items: QuotationItem[]
}>()

const { t } = useI18n()
const expandedIds = shallowRef(new Set<string>())

function toggle(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

function scrollTo(id: string) {
  document.querySelector(`[data-item-id="${id}"]`)?.scrollIntoView({ block: 'start' })
}

const visibleRows = computed<NavRow[]>(() => {
  const rows: NavRow[] = []

  props.items.forEach((item, i) => {
    const number = String(i + 1)
    rows.push({ item, depth: 1, number, isGroup: item.children.length > 0 })

    if (item.children.length > 0 && expandedIds.value.has(item.id)) {
      item.children.forEach((child, j) => {
        const childNumber = `${number}.${j + 1}`
        rows.push({ item: child, depth: 2, number: childNumber, isGroup: child.children.length > 0 })

        if (child.children.length > 0 && expandedIds.value.has(child.id)) {
          child.children.forEach((grandchild, k) => {
            rows.push({ item: grandchild, depth: 3, number: `${childNumber}.${k + 1}`, isGroup: false })
          })
        }
      })
    }
  })

  return rows
})
</script>

<template>
  <nav class="navigator" :aria-label="t('quotations.lineItems.navigator.aria')">
    <p v-if="items.length === 0" class="nav-empty">{{ t('quotations.lineItems.navigator.empty') }}</p>

    <div
      v-for="row in visibleRows"
      :key="row.item.id"
      class="nav-row"
      :class="`nav-depth-${row.depth}`"
    >
      <button
        v-if="row.isGroup"
        type="button"
        class="nav-toggle"
        :aria-label="expandedIds.has(row.item.id) ? t('quotations.lineItems.navigator.collapse') : t('quotations.lineItems.navigator.expand')"
        @click="toggle(row.item.id)"
      >
        <i :class="expandedIds.has(row.item.id) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
      </button>
      <span v-else class="nav-toggle-spacer" />

      <button type="button" class="nav-entry" @click="scrollTo(row.item.id)">
        <span class="nav-num" :class="`nav-num-d${row.depth}`">{{ row.number }}</span>
        <span class="nav-name">{{ row.item.name || t('quotations.lineItems.navigator.unnamed') }}</span>
        <span v-if="row.isGroup && !expandedIds.has(row.item.id)" class="nav-count">
          {{ row.item.children.length }}
        </span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.navigator {
  display: grid;
  gap: 1px;
}

.nav-empty {
  margin: 0;
  padding: 14px 4px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

.nav-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.nav-depth-2 {
  padding-left: 14px;
}

.nav-depth-3 {
  padding-left: 28px;
}

.nav-toggle {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 24px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-subtle);
  cursor: pointer;
  font-size: 10px;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.nav-toggle:hover {
  background: var(--surface-hover);
  color: var(--text-body);
}

.nav-toggle-spacer {
  display: inline-flex;
  flex-shrink: 0;
  width: 20px;
}

.nav-entry {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 5px 7px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.12s ease;
}

.nav-entry:hover {
  background: var(--surface-hover);
}

.nav-entry:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.nav-num {
  display: inline-grid;
  flex-shrink: 0;
  height: 18px;
  min-width: 22px;
  place-items: center;
  padding: 0 5px;
  border-radius: var(--radius-xs);
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.nav-num-d1 {
  background: var(--accent);
  color: #ffffff;
}

.nav-num-d2 {
  background: var(--info-soft);
  color: var(--info);
}

.nav-num-d3 {
  background: var(--surface-muted);
  color: var(--text-muted);
}

.nav-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-count {
  flex-shrink: 0;
  display: inline-grid;
  min-width: 18px;
  height: 16px;
  place-items: center;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
