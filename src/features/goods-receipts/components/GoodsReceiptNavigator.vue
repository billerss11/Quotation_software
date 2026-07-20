<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationItem, QuotationRootItem } from '@/features/quotations/types'
import { isQuotationItem } from '@/features/quotations/utils/quotationItems'

import type { GoodsReceiptLineDraft } from '../utils/goodsReceipt'
import { isGoodsReceiptLineCustomized } from '../utils/goodsReceipt'

interface GoodsReceiptOutlineLine {
  kind: 'line'
  id: string
  itemNumber: string
  label: string
  searchText: string
  depth: number
}

interface GoodsReceiptOutlineGroup {
  kind: 'group'
  id: string
  itemNumber: string
  label: string
  searchText: string
  depth: number
  children: GoodsReceiptOutlineNode[]
  descendantLineIds: string[]
}

type GoodsReceiptOutlineNode = GoodsReceiptOutlineGroup | GoodsReceiptOutlineLine

const props = defineProps<{
  items: QuotationRootItem[]
  lines: GoodsReceiptLineDraft[]
  includedOnly: boolean
}>()
const emit = defineEmits<{
  editLine: [sourceItemId: string]
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
const hasActiveFilter = computed(() => Boolean(normalizedSearchQuery.value) || props.includedOnly)
const allGroupIds = computed(() => outlineNodes.value.flatMap((node) => collectGroupIds(node)))
const allGroupsExpanded = computed(() =>
  allGroupIds.value.length > 0
    && allGroupIds.value.every((groupId) => expandedGroupIds.value.has(groupId)),
)
const visibleRows = computed(() => {
  if (hasActiveFilter.value) {
    return outlineNodes.value.flatMap((node) =>
      collectFilteredRows(node, normalizedSearchQuery.value),
    )
  }

  return outlineNodes.value.flatMap((node) => collectExpandedRows(node))
})
const searchMatchCount = computed(() =>
  normalizedSearchQuery.value
    ? visibleRows.value.filter((row) => doesNodeMatch(row, normalizedSearchQuery.value)).length
    : 0,
)

function createOutlineNode(
  item: QuotationItem,
  itemNumber: string,
  depth: number,
): GoodsReceiptOutlineNode | null {
  const line = lineBySourceItemId.value.get(item.id)

  if (!line) {
    return null
  }

  const originalLabel = createLineLabel(item)
  const searchText = `${itemNumber} ${originalLabel} ${line.description}`.toLocaleLowerCase()

  if (item.children.length === 0) {
    return {
      kind: 'line',
      id: item.id,
      itemNumber,
      label: line.description.trim() || originalLabel,
      searchText,
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
    label: createGroupLabel(item) || line.description.trim() || t('goodsReceipts.items.unnamedLine'),
    searchText,
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

function collectFilteredRows(
  node: GoodsReceiptOutlineNode,
  query: string,
  ancestorMatches = false,
): GoodsReceiptOutlineNode[] {
  const nodeMatches = !query || doesNodeMatch(node, query)
  const pathMatches = ancestorMatches || nodeMatches
  const selected = isLineSelected(node.id)

  if (node.kind === 'line') {
    return pathMatches && (!props.includedOnly || selected) ? [node] : []
  }

  const childRows = node.children.flatMap((child) =>
    collectFilteredRows(child, query, pathMatches),
  )
  const includeNode = (pathMatches && (!props.includedOnly || selected)) || childRows.length > 0

  return includeNode ? [node, ...childRows] : []
}

function collectGroupIds(node: GoodsReceiptOutlineNode): string[] {
  return node.kind === 'line'
    ? []
    : [node.id, ...node.children.flatMap((child) => collectGroupIds(child))]
}

function doesNodeMatch(node: GoodsReceiptOutlineNode, query: string) {
  return node.searchText.includes(query)
}

function createLineLabel(item: QuotationItem) {
  return [item.name, item.description]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(', ') || t('goodsReceipts.items.unnamedLine')
}

function createGroupLabel(item: QuotationItem) {
  return item.name.trim() || item.description.trim()
}

function toggleGroup(groupId: string) {
  if (hasActiveFilter.value) {
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

function toggleAllGroups() {
  if (hasActiveFilter.value) {
    return
  }

  expandedGroupIds.value = allGroupsExpanded.value
    ? new Set<string>()
    : new Set(allGroupIds.value)
}

function isGroupExpanded(groupId: string) {
  return hasActiveFilter.value || expandedGroupIds.value.has(groupId)
}

function getSelectedCount(group: GoodsReceiptOutlineGroup) {
  return group.descendantLineIds.filter((id) => isLineSelected(id)).length
}

function isLineSelected(lineId: string) {
  return lineBySourceItemId.value.get(lineId)?.selected ?? false
}

function isLineCustomized(lineId: string) {
  const line = lineBySourceItemId.value.get(lineId)
  return line ? isGoodsReceiptLineCustomized(line) : false
}

function getGroupStatus(group: GoodsReceiptOutlineGroup) {
  if (isLineSelected(group.id)) {
    return t('goodsReceipts.outline.selectedAsLine')
  }

  const selectedCount = getSelectedCount(group)
  return selectedCount > 0
    ? t('goodsReceipts.outline.selectedDescendantCount', selectedCount)
    : ''
}

function toggleGroupLine(groupId: string) {
  emit('setLineSelected', groupId, !isLineSelected(groupId))
}
</script>

<template>
  <nav class="goods-receipt-outline" :aria-label="t('goodsReceipts.outline.aria')">
    <div class="goods-receipt-outline-heading">
      <h4>{{ t('goodsReceipts.outline.title') }}</h4>
      <p>{{ t('goodsReceipts.outline.help') }}</p>
    </div>

    <div class="goods-receipt-outline-toolbar">
      <IconField class="goods-receipt-outline-search">
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="searchQuery"
          :placeholder="t('goodsReceipts.outline.searchPlaceholder')"
          :aria-label="t('goodsReceipts.outline.searchAria')"
        />
      </IconField>
      <Button
        size="small"
        severity="secondary"
        outlined
        :icon="allGroupsExpanded ? 'pi pi-angle-double-up' : 'pi pi-angle-double-down'"
        :label="t(allGroupsExpanded
          ? 'goodsReceipts.actions.collapseAll'
          : 'goodsReceipts.actions.expandAll')"
        :disabled="hasActiveFilter || allGroupIds.length === 0"
        @click="toggleAllGroups"
      />
    </div>

    <p v-if="normalizedSearchQuery" class="goods-receipt-outline-result-count">
      {{ t('goodsReceipts.outline.resultCount', searchMatchCount) }}
    </p>

    <div class="goods-receipt-outline-results" role="tree">
      <div
        v-for="row in visibleRows"
        :key="`${row.kind}:${row.id}`"
        class="goods-receipt-outline-row"
        :class="[`is-${row.kind}`, {
          'is-selected': isLineSelected(row.id),
          'is-customized': isLineCustomized(row.id),
        }]"
        :style="{ paddingInlineStart: `${6 + row.depth * 16}px` }"
        role="treeitem"
        :aria-level="row.depth + 1"
        :aria-selected="isLineSelected(row.id)"
        :aria-expanded="row.kind === 'group' ? isGroupExpanded(row.id) : undefined"
      >
        <template v-if="row.kind === 'group'">
          <button
            type="button"
            class="goods-receipt-outline-toggle"
            :disabled="hasActiveFilter"
            :aria-label="t(isGroupExpanded(row.id)
              ? 'goodsReceipts.outline.collapseGroupAria'
              : 'goodsReceipts.outline.expandGroupAria', { description: row.label })"
            @click="toggleGroup(row.id)"
          >
            <i :class="isGroupExpanded(row.id) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="goods-receipt-outline-entry"
            :title="row.label"
            @click="toggleGroup(row.id)"
          >
            <span class="goods-receipt-outline-number">{{ row.itemNumber }}</span>
            <span class="goods-receipt-outline-text">
              <span class="goods-receipt-outline-label">{{ row.label }}</span>
              <small v-if="getGroupStatus(row)">{{ getGroupStatus(row) }}</small>
              <small v-if="isLineCustomized(row.id)" class="goods-receipt-outline-customized">
                {{ t('goodsReceipts.customizer.customized') }}
              </small>
            </span>
          </button>
          <button
            type="button"
            class="goods-receipt-outline-group-action"
            :class="{ 'is-active': isLineSelected(row.id) }"
            :aria-pressed="isLineSelected(row.id)"
            :aria-label="t(isLineSelected(row.id)
              ? 'goodsReceipts.outline.excludeGroupLineAria'
              : 'goodsReceipts.outline.useGroupAsLineAria', { description: row.label })"
            @click="toggleGroupLine(row.id)"
          >
            {{ t(isLineSelected(row.id)
              ? 'goodsReceipts.outline.includedAsLine'
              : 'goodsReceipts.outline.useAsLine') }}
          </button>
          <Button
            v-if="isLineSelected(row.id)"
            size="small"
            severity="secondary"
            text
            rounded
            class="goods-receipt-outline-edit-button"
            icon="pi pi-pencil"
            :aria-label="t('goodsReceipts.customizer.editAria', {
              itemNumber: row.itemNumber,
              description: row.label,
            })"
            v-tooltip.left="t('goodsReceipts.customizer.edit')"
            @click="emit('editLine', row.id)"
          />
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
          <div class="goods-receipt-outline-entry" :title="row.label">
            <span class="goods-receipt-outline-number">{{ row.itemNumber }}</span>
            <span class="goods-receipt-outline-text">
              <span class="goods-receipt-outline-label">{{ row.label }}</span>
              <small v-if="isLineCustomized(row.id)" class="goods-receipt-outline-customized">
                {{ t('goodsReceipts.customizer.customized') }}
              </small>
            </span>
          </div>
          <Button
            v-if="isLineSelected(row.id)"
            size="small"
            severity="secondary"
            text
            rounded
            class="goods-receipt-outline-edit-button"
            icon="pi pi-pencil"
            :aria-label="t('goodsReceipts.customizer.editAria', {
              itemNumber: row.itemNumber,
              description: row.label,
            })"
            v-tooltip.left="t('goodsReceipts.customizer.edit')"
            @click="emit('editLine', row.id)"
          />
        </template>
      </div>

      <p v-if="visibleRows.length === 0" class="goods-receipt-outline-empty">
        {{ t(props.includedOnly
          ? 'goodsReceipts.outline.noIncludedItems'
          : 'goodsReceipts.outline.noMatches') }}
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
  display: grid;
  gap: 2px;
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

.goods-receipt-outline-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
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
  max-height: min(50vh, 520px);
  overflow: auto;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  background: var(--surface-card);
}

.goods-receipt-outline-row {
  display: grid;
  grid-template-columns: 24px 28px minmax(0, 1fr) auto 28px;
  grid-template-areas: 'toggle selector entry action edit';
  align-items: center;
  gap: 5px;
  min-height: 38px;
  padding: 4px 7px 4px 6px;
  border-bottom: 1px solid var(--surface-border);
}

.goods-receipt-outline-row:last-child {
  border-bottom: 0;
}

.goods-receipt-outline-row.is-group {
  background: color-mix(in srgb, var(--accent) 4%, var(--surface-card));
}

.goods-receipt-outline-row.is-selected {
  background: color-mix(in srgb, var(--accent) 7%, var(--surface-card));
  box-shadow: inset 3px 0 0 var(--accent);
}

.goods-receipt-outline-toggle,
.goods-receipt-outline-entry,
.goods-receipt-outline-group-action {
  border: 0;
  color: inherit;
}

.goods-receipt-outline-toggle,
.goods-receipt-outline-entry {
  background: transparent;
}

.goods-receipt-outline-toggle {
  grid-area: toggle;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
}

.goods-receipt-outline-toggle:disabled {
  cursor: default;
}

.goods-receipt-outline-toggle-spacer {
  grid-area: toggle;
  width: 24px;
}

.goods-receipt-outline-row :deep(.p-checkbox) {
  grid-area: selector;
}

.goods-receipt-outline-entry {
  grid-area: entry;
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  gap: 5px;
  min-width: 0;
  padding: 4px 2px;
  text-align: left;
}

button.goods-receipt-outline-entry {
  cursor: pointer;
}

.goods-receipt-outline-toggle:hover:not(:disabled),
button.goods-receipt-outline-entry:hover {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface-card));
}

.goods-receipt-outline-toggle:focus-visible,
.goods-receipt-outline-entry:focus-visible,
.goods-receipt-outline-group-action:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

.goods-receipt-outline-number {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
}

.goods-receipt-outline-text {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.goods-receipt-outline-label {
  overflow: hidden;
  color: var(--text-body);
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goods-receipt-outline-text small {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 700;
}

.goods-receipt-outline-text .goods-receipt-outline-customized {
  color: var(--accent-strong);
}

.goods-receipt-outline-group-action {
  grid-area: action;
  min-height: 28px;
  padding: 4px 7px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  background: var(--surface-card);
  color: var(--text-body);
  font-size: 9px;
  font-weight: 800;
  line-height: 1.15;
  cursor: pointer;
}

.goods-receipt-outline-group-action:hover,
.goods-receipt-outline-group-action.is-active {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--surface-border));
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-card));
  color: var(--accent-strong);
}

.goods-receipt-outline-edit-button {
  grid-area: edit;
  width: 28px;
  height: 28px;
}

.goods-receipt-outline-empty {
  padding: 12px;
  text-align: center;
}

@container (max-width: 460px) {
  .goods-receipt-outline-toolbar {
    grid-template-columns: 1fr;
  }

  .goods-receipt-outline-row {
    grid-template-columns: 22px 26px minmax(0, 1fr) auto 28px;
    gap: 3px;
  }

  .goods-receipt-outline-entry {
    grid-template-columns: 40px minmax(0, 1fr);
  }

  .goods-receipt-outline-group-action {
    max-width: 86px;
  }
}
</style>
