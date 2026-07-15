<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationItem, QuotationRootItem } from '@/features/quotations/types'
import { isQuotationItem } from '@/features/quotations/utils/quotationItems'

import type { GoodsReceiptLineDraft } from '../utils/goodsReceipt'

interface GoodsReceiptOutlineLine {
  kind: 'line'
  id: string
  itemNumber: string
  label: string
  depth: number
}

interface GoodsReceiptOutlineGroup {
  kind: 'group'
  id: string
  itemNumber: string
  label: string
  depth: number
  children: GoodsReceiptOutlineNode[]
  descendantLineIds: string[]
}

type GoodsReceiptOutlineNode = GoodsReceiptOutlineGroup | GoodsReceiptOutlineLine

const props = defineProps<{
  items: QuotationRootItem[]
  lines: GoodsReceiptLineDraft[]
}>()
const emit = defineEmits<{
  selectLine: [sourceItemId: string]
  setLineSelected: [sourceItemId: string, selected: boolean]
}>()
const { t } = useI18n()
const searchQuery = shallowRef('')
const expandedGroupIds = shallowRef(new Set<string>())

const lineBySourceItemId = computed(() =>
  new Map(props.lines.map((line) => [line.sourceItemId, line])),
)
const outlineNodes = computed(() => {
  const nodes: GoodsReceiptOutlineNode[] = []
  let rootItemNumber = 0

  for (const item of props.items) {
    if (!isQuotationItem(item)) {
      continue
    }

    rootItemNumber += 1
    const node = createOutlineNode(item, String(rootItemNumber), 0)

    if (node) {
      nodes.push(node)
    }
  }

  return nodes
})
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLocaleLowerCase())
const visibleRows = computed(() => {
  if (normalizedSearchQuery.value) {
    return outlineNodes.value.flatMap((node) => collectSearchRows(node, normalizedSearchQuery.value))
  }

  return outlineNodes.value.flatMap((node) => collectExpandedRows(node))
})
const searchMatchCount = computed(() =>
  normalizedSearchQuery.value
    ? countMatchingNodes(outlineNodes.value, normalizedSearchQuery.value)
    : 0,
)
const topLevelGroupCount = computed(() =>
  outlineNodes.value.filter((node) => node.kind === 'group').length,
)

function createOutlineNode(
  item: QuotationItem,
  itemNumber: string,
  depth: number,
): GoodsReceiptOutlineNode | null {
  if (item.children.length === 0) {
    if (!lineBySourceItemId.value.has(item.id)) {
      return null
    }

    return {
      kind: 'line',
      id: item.id,
      itemNumber,
      label: createLineLabel(item),
      depth,
    }
  }

  const children = item.children
    .map((child, index) => createOutlineNode(child, `${itemNumber}.${index + 1}`, depth + 1))
    .filter((child): child is GoodsReceiptOutlineNode => child !== null)

  if (children.length === 0) {
    return null
  }

  return {
    kind: 'group',
    id: item.id,
    itemNumber,
    label: item.name.trim() || item.description.trim() || t('goodsReceipts.items.unnamedLine'),
    depth,
    children,
    descendantLineIds: children.flatMap((child) =>
      child.kind === 'line' ? [child.id] : [child.id, ...child.descendantLineIds],
    ),
  }
}

function collectExpandedRows(node: GoodsReceiptOutlineNode): GoodsReceiptOutlineNode[] {
  if (node.kind === 'line' || !expandedGroupIds.value.has(node.id)) {
    return [node]
  }

  return [node, ...node.children.flatMap((child) => collectExpandedRows(child))]
}

function collectSearchRows(
  node: GoodsReceiptOutlineNode,
  query: string,
  ancestorMatches = false,
): GoodsReceiptOutlineNode[] {
  const nodeMatches = doesNodeMatch(node, query)

  if (node.kind === 'line') {
    return nodeMatches || ancestorMatches ? [node] : []
  }

  const childRows = node.children.flatMap((child) =>
    collectSearchRows(child, query, ancestorMatches || nodeMatches),
  )

  return nodeMatches || childRows.length > 0 ? [node, ...childRows] : []
}

function countMatchingNodes(nodes: GoodsReceiptOutlineNode[], query: string): number {
  return nodes.reduce((count, node) => {
    const childCount = node.kind === 'group' ? countMatchingNodes(node.children, query) : 0
    return count + (doesNodeMatch(node, query) ? 1 : 0) + childCount
  }, 0)
}

function doesNodeMatch(node: GoodsReceiptOutlineNode, query: string) {
  return `${node.itemNumber} ${node.label}`.toLocaleLowerCase().includes(query)
}

function createLineLabel(item: QuotationItem) {
  return [item.name, item.description]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(', ') || t('goodsReceipts.items.unnamedLine')
}

function toggleGroup(groupId: string) {
  if (normalizedSearchQuery.value) {
    return
  }

  const nextIds = new Set(expandedGroupIds.value)

  if (nextIds.has(groupId)) {
    nextIds.delete(groupId)
  } else {
    nextIds.add(groupId)
  }

  expandedGroupIds.value = nextIds
}

function isGroupExpanded(groupId: string) {
  return Boolean(normalizedSearchQuery.value) || expandedGroupIds.value.has(groupId)
}

function getSelectedCount(group: GoodsReceiptOutlineGroup) {
  return group.descendantLineIds.filter((id) => lineBySourceItemId.value.get(id)?.selected).length
}

function isLineSelected(lineId: string) {
  return lineBySourceItemId.value.get(lineId)?.selected ?? false
}

function getGroupStatus(group: GoodsReceiptOutlineGroup) {
  if (isLineSelected(group.id)) {
    return t('goodsReceipts.outline.selectedAsLine')
  }

  return t('goodsReceipts.outline.selectedDescendantCount', getSelectedCount(group))
}
</script>

<template>
  <nav class="goods-receipt-outline" :aria-label="t('goodsReceipts.outline.aria')">
    <div class="goods-receipt-outline-heading">
      <div>
        <h4>{{ t('goodsReceipts.outline.title') }}</h4>
        <p>{{ t('goodsReceipts.outline.help') }}</p>
      </div>
      <span>{{ topLevelGroupCount }}</span>
    </div>

    <IconField class="goods-receipt-outline-search">
      <InputIcon class="pi pi-search" />
      <InputText
        v-model="searchQuery"
        :placeholder="t('goodsReceipts.outline.searchPlaceholder')"
        :aria-label="t('goodsReceipts.outline.searchAria')"
      />
    </IconField>

    <p v-if="normalizedSearchQuery" class="goods-receipt-outline-result-count">
      {{ t('goodsReceipts.outline.resultCount', searchMatchCount) }}
    </p>

    <div class="goods-receipt-outline-results" role="tree">
      <div
        v-for="row in visibleRows"
        :key="`${row.kind}:${row.id}`"
        class="goods-receipt-outline-row"
        :class="`is-${row.kind}`"
        :style="{ paddingInlineStart: `${6 + row.depth * 16}px` }"
        role="treeitem"
        :aria-level="row.depth + 1"
        :aria-expanded="row.kind === 'group' ? isGroupExpanded(row.id) : undefined"
      >
        <template v-if="row.kind === 'group'">
          <button
            type="button"
            class="goods-receipt-outline-toggle"
            :disabled="Boolean(normalizedSearchQuery)"
            :aria-label="t(isGroupExpanded(row.id)
              ? 'goodsReceipts.outline.collapseGroupAria'
              : 'goodsReceipts.outline.expandGroupAria', { description: row.label })"
            @click="toggleGroup(row.id)"
          >
            <i :class="isGroupExpanded(row.id) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" aria-hidden="true" />
          </button>
          <Checkbox
            binary
            :model-value="isLineSelected(row.id)"
            :input-id="`goods-receipt-outline-group-${row.id}`"
            :aria-label="t(isLineSelected(row.id)
              ? 'goodsReceipts.outline.clearGroupAria'
              : 'goodsReceipts.outline.selectGroupAria', { description: row.label })"
            @update:model-value="emit('setLineSelected', row.id, Boolean($event))"
          />
          <button
            type="button"
            class="goods-receipt-outline-entry"
            @click="toggleGroup(row.id)"
          >
            <span class="goods-receipt-outline-number">{{ row.itemNumber }}</span>
            <span class="goods-receipt-outline-label">{{ row.label }}</span>
          </button>
          <small>{{ getGroupStatus(row) }}</small>
        </template>

        <template v-else>
          <span class="goods-receipt-outline-toggle-spacer" aria-hidden="true" />
          <Checkbox
            binary
            :model-value="isLineSelected(row.id)"
            :input-id="`goods-receipt-outline-line-${row.id}`"
            :aria-label="t(isLineSelected(row.id)
              ? 'goodsReceipts.items.clearLineAria'
              : 'goodsReceipts.items.selectLineAria', { description: row.label })"
            @update:model-value="emit('setLineSelected', row.id, Boolean($event))"
          />
          <button
            type="button"
            class="goods-receipt-outline-entry"
            :aria-label="t('goodsReceipts.outline.jumpLineAria', {
              itemNumber: row.itemNumber,
              description: row.label,
            })"
            @click="emit('selectLine', row.id)"
          >
            <span class="goods-receipt-outline-number">{{ row.itemNumber }}</span>
            <span class="goods-receipt-outline-label">{{ row.label }}</span>
          </button>
        </template>
      </div>

      <p v-if="visibleRows.length === 0" class="goods-receipt-outline-empty">
        {{ t('goodsReceipts.outline.noMatches') }}
      </p>
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
  background: color-mix(in srgb, var(--surface-muted) 72%, var(--surface-card));
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
  background: color-mix(in srgb, var(--accent) 12%, var(--surface-card));
  color: var(--accent-strong);
  font-size: 10px;
  font-weight: 800;
  text-align: center;
}

.goods-receipt-outline-search,
.goods-receipt-outline-search :deep(.p-inputtext) {
  width: 100%;
}

.goods-receipt-outline-result-count {
  padding-inline: 2px;
}

.goods-receipt-outline-results {
  display: grid;
  max-height: 230px;
  overflow: auto;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  background: var(--surface-card);
}

.goods-receipt-outline-row {
  display: grid;
  grid-template-columns: 24px 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
  min-height: 34px;
  padding: 4px 7px 4px 6px;
  border-bottom: 1px solid var(--surface-border);
}

.goods-receipt-outline-row:last-child {
  border-bottom: 0;
}

.goods-receipt-outline-row.is-group {
  background: color-mix(in srgb, var(--accent) 4%, var(--surface-card));
}

.goods-receipt-outline-toggle,
.goods-receipt-outline-entry {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.goods-receipt-outline-toggle {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
}

.goods-receipt-outline-toggle:disabled {
  cursor: default;
}

.goods-receipt-outline-toggle-spacer {
  width: 24px;
}

.goods-receipt-outline-entry {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 5px;
  min-width: 0;
  padding: 4px 2px;
  text-align: left;
}

.goods-receipt-outline-toggle:hover:not(:disabled),
.goods-receipt-outline-entry:hover {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface-card));
}

.goods-receipt-outline-toggle:focus-visible,
.goods-receipt-outline-entry:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

.goods-receipt-outline-number,
.goods-receipt-outline-row small {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
}

.goods-receipt-outline-label {
  overflow: hidden;
  color: var(--text-body);
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goods-receipt-outline-empty {
  padding: 8px;
}
</style>
