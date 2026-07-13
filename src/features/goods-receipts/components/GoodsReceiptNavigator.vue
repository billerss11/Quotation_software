<script setup lang="ts">
import IconField from 'primevue/iconfield'
import InputText from 'primevue/inputtext'
import InputIcon from 'primevue/inputicon'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationItem, QuotationRootItem } from '@/features/quotations/types'
import { isQuotationItem } from '@/features/quotations/utils/quotationItems'

import type { GoodsReceiptLineDraft } from '../utils/goodsReceipt'

interface GoodsReceiptOutlineLine {
  id: string
  itemNumber: string
  label: string
  selected: boolean
}

interface GoodsReceiptOutlineGroup {
  id: string
  itemNumber: string
  label: string
  lines: GoodsReceiptOutlineLine[]
}

const MAX_SEARCH_RESULTS = 50

const props = defineProps<{
  items: QuotationRootItem[]
  lines: GoodsReceiptLineDraft[]
}>()
const emit = defineEmits<{
  selectLine: [sourceItemId: string]
}>()
const { t } = useI18n()
const searchQuery = shallowRef('')

const selectedBySourceItemId = computed(() =>
  new Map(props.lines.map((line) => [line.sourceItemId, line.selected])),
)
const outlineGroups = computed(() => {
  const groups: GoodsReceiptOutlineGroup[] = []
  let rootItemNumber = 0

  for (const item of props.items) {
    if (!isQuotationItem(item)) {
      continue
    }

    rootItemNumber += 1
    const itemNumber = String(rootItemNumber)
    groups.push({
      id: item.id,
      itemNumber,
      label: item.name.trim() || t('goodsReceipts.items.unnamedLine'),
      lines: collectOutlineLines(item, itemNumber),
    })
  }

  return groups.filter((group) => group.lines.length > 0)
})
const allOutlineLines = computed(() => outlineGroups.value.flatMap((group) => group.lines))
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLocaleLowerCase())
const searchMatches = computed(() => {
  if (!normalizedSearchQuery.value) {
    return []
  }

  return allOutlineLines.value.filter((line) =>
    `${line.itemNumber} ${line.label}`.toLocaleLowerCase().includes(normalizedSearchQuery.value),
  )
})
const visibleSearchMatches = computed(() => searchMatches.value.slice(0, MAX_SEARCH_RESULTS))

function collectOutlineLines(item: QuotationItem, itemNumber: string): GoodsReceiptOutlineLine[] {
  if (item.children.length === 0) {
    return [{
      id: item.id,
      itemNumber,
      label: [item.name, item.description].map((value) => value.trim()).filter(Boolean).join(', ')
        || t('goodsReceipts.items.unnamedLine'),
      selected: selectedBySourceItemId.value.get(item.id) ?? false,
    }]
  }

  return item.children.flatMap((child, index) =>
    collectOutlineLines(child, `${itemNumber}.${index + 1}`),
  )
}

function getIncludedCount(group: GoodsReceiptOutlineGroup) {
  return group.lines.filter((line) => line.selected).length
}

function selectFirstGroupLine(group: GoodsReceiptOutlineGroup) {
  const firstLine = group.lines[0]

  if (firstLine) {
    emit('selectLine', firstLine.id)
  }
}
</script>

<template>
  <nav class="goods-receipt-outline" :aria-label="t('goodsReceipts.outline.aria')">
    <div class="goods-receipt-outline-heading">
      <div>
        <h4>{{ t('goodsReceipts.outline.title') }}</h4>
        <p>{{ t('goodsReceipts.outline.help') }}</p>
      </div>
      <span>{{ outlineGroups.length }}</span>
    </div>

    <IconField class="goods-receipt-outline-search">
      <InputIcon class="pi pi-search" />
      <InputText
        v-model="searchQuery"
        :placeholder="t('goodsReceipts.outline.searchPlaceholder')"
        :aria-label="t('goodsReceipts.outline.searchAria')"
      />
    </IconField>

    <div v-if="normalizedSearchQuery" class="goods-receipt-outline-results">
      <p class="goods-receipt-outline-result-count">
        {{ t('goodsReceipts.outline.resultCount', {
          shown: visibleSearchMatches.length,
          total: searchMatches.length,
        }) }}
      </p>
      <button
        v-for="line in visibleSearchMatches"
        :key="line.id"
        type="button"
        class="goods-receipt-outline-row"
        :aria-label="t('goodsReceipts.outline.jumpLineAria', {
          itemNumber: line.itemNumber,
          description: line.label,
        })"
        @click="emit('selectLine', line.id)"
      >
        <i :class="line.selected ? 'pi pi-check-circle' : 'pi pi-circle'" aria-hidden="true" />
        <span class="goods-receipt-outline-number">{{ line.itemNumber }}</span>
        <span class="goods-receipt-outline-label">{{ line.label }}</span>
      </button>
      <p v-if="searchMatches.length === 0" class="goods-receipt-outline-empty">
        {{ t('goodsReceipts.outline.noMatches') }}
      </p>
    </div>

    <div v-else class="goods-receipt-outline-results">
      <button
        v-for="group in outlineGroups"
        :key="group.id"
        type="button"
        class="goods-receipt-outline-row"
        :aria-label="t('goodsReceipts.outline.jumpGroupAria', {
          itemNumber: group.itemNumber,
          description: group.label,
        })"
        @click="selectFirstGroupLine(group)"
      >
        <i class="pi pi-folder" aria-hidden="true" />
        <span class="goods-receipt-outline-number">{{ group.itemNumber }}</span>
        <span class="goods-receipt-outline-label">{{ group.label }}</span>
        <small>{{ getIncludedCount(group) }}/{{ group.lines.length }}</small>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.goods-receipt-outline {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--surface-ground) 72%, #ffffff);
}

.goods-receipt-outline-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.goods-receipt-outline-heading h4,
.goods-receipt-outline-heading p,
.goods-receipt-outline-result-count,
.goods-receipt-outline-empty {
  margin: 0;
}

.goods-receipt-outline-heading h4 {
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 800;
}

.goods-receipt-outline-heading p,
.goods-receipt-outline-result-count,
.goods-receipt-outline-empty {
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.35;
}

.goods-receipt-outline-heading > span {
  min-width: 24px;
  padding: 2px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, #ffffff);
  color: var(--accent-strong);
  font-size: 10px;
  font-weight: 800;
  text-align: center;
}

.goods-receipt-outline-search,
.goods-receipt-outline-search :deep(.p-inputtext) {
  width: 100%;
}

.goods-receipt-outline-results {
  display: grid;
  max-height: 172px;
  overflow: auto;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  background: #ffffff;
}

.goods-receipt-outline-result-count,
.goods-receipt-outline-empty {
  padding: 7px 9px;
}

.goods-receipt-outline-row {
  display: grid;
  grid-template-columns: 16px 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 5px 8px;
  border: 0;
  border-bottom: 1px solid var(--surface-border);
  background: transparent;
  color: var(--text-body);
  text-align: left;
  cursor: pointer;
}

.goods-receipt-outline-row:last-child {
  border-bottom: 0;
}

.goods-receipt-outline-row:hover {
  background: color-mix(in srgb, var(--accent) 7%, #ffffff);
}

.goods-receipt-outline-row:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

.goods-receipt-outline-row > i {
  color: var(--accent);
  font-size: 12px;
}

.goods-receipt-outline-number,
.goods-receipt-outline-row small {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
}

.goods-receipt-outline-label {
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
