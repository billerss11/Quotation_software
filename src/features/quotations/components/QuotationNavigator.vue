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
  gap: 3px;
}

.nav-empty {
  margin: 0;
  padding: 12px 4px;
  color: var(--text-muted);
  font-size: 13px;
}

.nav-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-depth-2 {
  padding-left: 12px;
}

.nav-depth-3 {
  padding-left: 24px;
}

.nav-toggle {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  transition: background 0.12s, color 0.12s;
}

.nav-toggle:hover {
  background: var(--surface-raised);
  color: var(--text-body);
}

.nav-toggle-spacer {
  display: inline-flex;
  flex-shrink: 0;
  width: 22px;
}

.nav-entry {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background: var(--surface-card);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.13s, background 0.13s;
}

.nav-entry:hover {
  border-color: var(--accent-soft);
  background: var(--accent-surface);
}

/* Number badges */

.nav-num {
  display: inline-grid;
  flex-shrink: 0;
  height: 22px;
  min-width: 22px;
  place-items: center;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.nav-num-d1 {
  background: var(--accent);
  color: #ffffff;
}

.nav-num-d2 {
  background: var(--info-soft);
  border: 1px solid rgb(37 99 235 / 18%);
  color: var(--info);
}

.nav-num-d3 {
  background: var(--surface-raised);
  border: 1px solid var(--surface-border);
  color: var(--text-subtle);
}

.nav-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-count {
  flex-shrink: 0;
  display: inline-grid;
  min-width: 18px;
  height: 18px;
  place-items: center;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--surface-raised);
  border: 1px solid var(--surface-border);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
}
</style>
