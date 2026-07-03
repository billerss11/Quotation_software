<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface QuotationAnalysisScopeBrowserItem {
  itemId: string
  itemName: string
  detail: string
}

const props = withDefaults(defineProps<{
  rows: unknown[]
  resolveItem: (row: unknown) => QuotationAnalysisScopeBrowserItem
  pageSize?: number
  label: string
}>(), {
  pageSize: 80,
})

const emit = defineEmits<{
  selectItem: [payload: { itemId: string }]
}>()

const { t } = useI18n()
const pageStart = shallowRef(0)
const visibleItems = computed(() =>
  props.rows
    .slice(pageStart.value, pageStart.value + props.pageSize)
    .map((row) => props.resolveItem(row)),
)
const rangeStart = computed(() => props.rows.length > 0 ? pageStart.value + 1 : 0)
const rangeEnd = computed(() =>
  Math.min(pageStart.value + props.pageSize, props.rows.length),
)
const canGoPrevious = computed(() => pageStart.value > 0)
const canGoNext = computed(() => pageStart.value + props.pageSize < props.rows.length)

watch(
  () => props.rows.length,
  () => {
    pageStart.value = 0
  },
)

function selectItem(itemId: string) {
  emit('selectItem', { itemId })
}

function goPrevious() {
  pageStart.value = Math.max(0, pageStart.value - props.pageSize)
}

function goNext() {
  if (!canGoNext.value) {
    return
  }

  pageStart.value += props.pageSize
}
</script>

<template>
  <section class="scope-browser" :aria-label="props.label">
    <header class="scope-browser-header">
      <span>
        {{
          t('quotations.analysis.scope.range', {
            start: rangeStart,
            end: rangeEnd,
            count: props.rows.length,
          })
        }}
      </span>
      <div v-if="props.rows.length > props.pageSize" class="scope-browser-pager">
        <button
          type="button"
          class="scope-browser-page-button"
          :disabled="!canGoPrevious"
          @click="goPrevious"
        >
          {{ t('quotations.analysis.scope.previous') }}
        </button>
        <button
          type="button"
          class="scope-browser-page-button"
          :disabled="!canGoNext"
          @click="goNext"
        >
          {{ t('quotations.analysis.scope.next') }}
        </button>
      </div>
    </header>

    <div class="scope-browser-list">
      <button
        v-for="item in visibleItems"
        :key="item.itemId"
        type="button"
        class="scope-browser-row"
        :data-item-id="item.itemId"
        @click="selectItem(item.itemId)"
      >
        <span class="scope-browser-name">{{ item.itemName }}</span>
        <span class="scope-browser-detail">{{ item.detail }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.scope-browser {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--surface-border);
}

.scope-browser-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 800;
}

.scope-browser-pager {
  display: flex;
  gap: 6px;
}

.scope-browser-page-button {
  padding: 5px 8px;
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-strong);
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.scope-browser-page-button:disabled {
  color: var(--text-muted);
  cursor: not-allowed;
  opacity: 0.55;
}

.scope-browser-list {
  display: grid;
  gap: 6px;
  max-height: 360px;
  overflow: auto;
}

.scope-browser-row {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 10px;
  align-items: center;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--surface-border);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text-strong);
  cursor: pointer;
  text-align: left;
  content-visibility: auto;
  contain-intrinsic-size: 38px;
}

.scope-browser-row:hover {
  border-color: var(--accent);
  background: var(--accent-surface);
}

.scope-browser-name,
.scope-browser-detail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scope-browser-name {
  font-size: 12px;
  font-weight: 800;
}

.scope-browser-detail {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

@media (max-width: 720px) {
  .scope-browser-header,
  .scope-browser-row {
    display: grid;
  }

  .scope-browser-row {
    grid-template-columns: 1fr;
  }
}
</style>
