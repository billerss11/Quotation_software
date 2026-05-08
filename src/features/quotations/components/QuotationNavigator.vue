<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LineItemEntryMode, QuotationItem, QuotationRootItem } from '../types'
import { countIncompleteQuotationItems } from '../utils/quotationItemCompleteness'
import { getQuotationRootItems, isQuotationItem, isQuotationSectionHeader } from '../utils/quotationItems'

type DropMode = 'before' | 'inside' | 'after'
type DropState =
  | { kind: 'zone'; targetIndex: number }
  | { kind: 'row'; rowId: string; mode: DropMode }
type DraggedRowState = {
  itemId: string
  depth: 1 | 2 | 3
  kind: 'item' | 'section_header'
}

interface ChildNavRow {
  item: QuotationItem
  depth: 2 | 3
  number: string
  isGroup: boolean
  incomplete: boolean
  parentId: string
  siblingIndex: number
}

interface RootNavBlock {
  id: string
  root: QuotationRootItem
  rootItem: QuotationItem | null
  rootIndex: number
  displayNumber: string | null
  label: string
  isGroup: boolean
  incomplete: boolean
  descendants: ChildNavRow[]
}

const props = defineProps<{
  items: QuotationRootItem[]
  lineItemEntryMode?: LineItemEntryMode
}>()

const emit = defineEmits<{
  moveRootRowToIndex: [itemId: string, targetIndex: number]
  moveQuotationTreeRow: [itemId: string, targetParentId: string | null, targetIndex: number, dropMode: DropMode]
}>()

const { t } = useI18n()
const navigatorRef = useTemplateRef<HTMLElement>('navigator')
const expandedIds = shallowRef(new Set<string>())
const draggedRow = shallowRef<DraggedRowState | null>(null)
const activeDropState = shallowRef<DropState | null>(null)
const pendingDropState = shallowRef<DropState | null>(null)
const pointerClientY = shallowRef<number | null>(null)
const hoverFrameId = shallowRef<number | null>(null)
const autoScrollFrameId = shallowRef<number | null>(null)

const rootItems = computed(() => getQuotationRootItems(props.items))

const groupIds = computed(() => collectGroupIds(rootItems.value))
const allExpanded = computed(
  () => groupIds.value.length > 0 && groupIds.value.every((id) => expandedIds.value.has(id)),
)

const rootBlocks = computed<RootNavBlock[]>(() => {
  let pricedRootIndex = 0

  return props.items.map((root, rootIndex) => {
    if (isQuotationItem(root)) {
      pricedRootIndex += 1
      const displayNumber = String(pricedRootIndex)

      return {
        id: root.id,
        root,
        rootItem: root,
        rootIndex,
        displayNumber,
        label: root.name || t('quotations.lineItems.navigator.unnamed'),
        isGroup: root.children.length > 0,
        incomplete: isIncomplete(root),
        descendants: expandedIds.value.has(root.id)
          ? buildVisibleDescendants(root.children, displayNumber, root.id)
          : [],
      }
    }

    return {
      id: root.id,
      root,
      rootItem: null,
      rootIndex,
      displayNumber: null,
      label: root.title || t('quotations.lineItems.sectionHeaderLabel'),
      isGroup: false,
      incomplete: false,
      descendants: [],
    }
  })
})

function toggle(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

function collapseAll() {
  expandedIds.value = new Set()
}

function expandAll() {
  expandedIds.value = new Set(groupIds.value)
}

function scrollTo(id: string) {
  document.querySelector(`[data-item-id="${id}"]`)?.scrollIntoView({ block: 'start' })
}

function isIncomplete(item: QuotationItem) {
  return countIncompleteQuotationItems([item], props.lineItemEntryMode === 'quick') > 0
}

function buildVisibleDescendants(
  children: QuotationItem[],
  parentNumber: string,
  parentId: string,
): ChildNavRow[] {
  return children.flatMap((child, childIndex) => {
    const childNumber = `${parentNumber}.${childIndex + 1}`
    const row: ChildNavRow = {
      item: child,
      depth: childNumber.split('.').length as 2 | 3,
      number: childNumber,
      isGroup: child.children.length > 0,
      incomplete: isIncomplete(child),
      parentId,
      siblingIndex: childIndex,
    }

    if (child.children.length === 0 || !expandedIds.value.has(child.id)) {
      return [row]
    }

    return [row, ...buildVisibleDescendants(child.children, childNumber, child.id)]
  })
}

function collectGroupIds(items: QuotationItem[]): string[] {
  const ids: string[] = []

  for (const item of items) {
    if (item.children.length === 0) {
      continue
    }

    ids.push(item.id)
    ids.push(...collectGroupIds(item.children))
  }

  return ids
}

function handleDragStart(state: DraggedRowState, event: DragEvent) {
  draggedRow.value = state

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', state.itemId)
  }
}

function handleDropZoneHover(targetIndex: number, event: DragEvent) {
  if (!draggedRow.value) {
    return
  }

  event.preventDefault()

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }

  queueActiveDropState({ kind: 'zone', targetIndex })
  pointerClientY.value = event.clientY
  startAutoScrollLoop()
}

function handleRootRowHover(rowId: string, rootIndex: number, event: DragEvent) {
  if (!draggedRow.value) {
    return
  }

  if (draggedRow.value.kind === 'section_header') {
    const targetIndex = resolveRootRowTargetIndex(rootIndex, event)
    handleDropZoneHover(targetIndex, event)
    return
  }

  handleRowHover(rowId, rootIndex, 1, null, null, event)
}

function handleDrop(targetIndex: number, event: DragEvent) {
  if (!draggedRow.value) {
    return
  }

  event.preventDefault()
  if (draggedRow.value.depth === 1) {
    emit('moveRootRowToIndex', draggedRow.value.itemId, targetIndex)
  } else {
    emit('moveQuotationTreeRow', draggedRow.value.itemId, null, targetIndex, 'before')
  }
  resetDragState()
}

function handleRootRowDrop(rowId: string, rootIndex: number, event: DragEvent) {
  if (!draggedRow.value) {
    return
  }

  if (draggedRow.value.kind === 'section_header') {
    const targetIndex = resolveRootRowTargetIndex(rootIndex, event)
    handleDrop(targetIndex, event)
    return
  }

  const candidate = resolveRowDropCandidate(rowId, rootIndex, 1, null, null, event)

  if (!candidate) {
    return
  }

  event.preventDefault()

  if (draggedRow.value.depth === 1 && candidate.targetParentId === null && candidate.dropMode !== 'inside') {
    emit('moveRootRowToIndex', draggedRow.value.itemId, candidate.targetIndex)
  } else {
    emit(
      'moveQuotationTreeRow',
      draggedRow.value.itemId,
      candidate.targetParentId,
      candidate.targetIndex,
      candidate.dropMode,
    )
  }

  resetDragState()
}

function handleChildRowHover(row: ChildNavRow, event: DragEvent) {
  if (!draggedRow.value || draggedRow.value.kind === 'section_header') {
    return
  }

  handleRowHover(row.item.id, row.siblingIndex, row.depth, row, row.parentId, event)
}

function handleChildRowDrop(row: ChildNavRow, event: DragEvent) {
  if (!draggedRow.value || draggedRow.value.kind === 'section_header') {
    return
  }

  const candidate = resolveRowDropCandidate(row.item.id, row.siblingIndex, row.depth, row, row.parentId, event)

  if (!candidate) {
    return
  }

  event.preventDefault()
  emit(
    'moveQuotationTreeRow',
    draggedRow.value.itemId,
    candidate.targetParentId,
    candidate.targetIndex,
    candidate.dropMode,
  )
  resetDragState()
}

function handleRowHover(
  rowId: string,
  index: number,
  depth: 1 | 2 | 3,
  row: ChildNavRow | null,
  parentId: string | null,
  event: DragEvent,
) {
  const candidate = resolveRowDropCandidate(rowId, index, depth, row, parentId, event)

  if (!candidate) {
    return
  }

  event.preventDefault()

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }

  queueActiveDropState({ kind: 'row', rowId: candidate.rowId, mode: candidate.dropMode })
  pointerClientY.value = event.clientY
  startAutoScrollLoop()
}

function queueActiveDropState(nextState: DropState) {
  pendingDropState.value = nextState

  if (hoverFrameId.value !== null) {
    return
  }

  hoverFrameId.value = requestAnimationFrame(() => {
    activeDropState.value = pendingDropState.value
    hoverFrameId.value = null
  })
}

function startAutoScrollLoop() {
  if (autoScrollFrameId.value !== null) {
    return
  }

  const tick = () => {
    if (!draggedRow.value || pointerClientY.value === null) {
      autoScrollFrameId.value = null
      return
    }

    const scrollContainer = getScrollContainer()

    if (scrollContainer) {
      const rect = scrollContainer.getBoundingClientRect()
      const threshold = 36
      let scrollDelta = 0

      if (pointerClientY.value < rect.top + threshold) {
        scrollDelta = -Math.ceil((rect.top + threshold - pointerClientY.value) / 6) * 6
      } else if (pointerClientY.value > rect.bottom - threshold) {
        scrollDelta = Math.ceil((pointerClientY.value - (rect.bottom - threshold)) / 6) * 6
      }

      if (scrollDelta !== 0) {
        const maxScrollTop = Math.max(scrollContainer.scrollHeight - scrollContainer.clientHeight, 0)
        scrollContainer.scrollTop = Math.max(0, Math.min(scrollContainer.scrollTop + scrollDelta, maxScrollTop))
      }
    }

    autoScrollFrameId.value = requestAnimationFrame(tick)
  }

  autoScrollFrameId.value = requestAnimationFrame(tick)
}

function getScrollContainer() {
  const navigatorElement = navigatorRef.value
  return (navigatorElement?.closest('.panel-body') as HTMLElement | null) ?? navigatorElement
}

function resetDragState() {
  draggedRow.value = null
  activeDropState.value = null
  pendingDropState.value = null
  pointerClientY.value = null

  if (hoverFrameId.value !== null) {
    cancelAnimationFrame(hoverFrameId.value)
    hoverFrameId.value = null
  }

  if (autoScrollFrameId.value !== null) {
    cancelAnimationFrame(autoScrollFrameId.value)
    autoScrollFrameId.value = null
  }
}

function isDropzoneActive(targetIndex: number) {
  return activeDropState.value?.kind === 'zone' && activeDropState.value.targetIndex === targetIndex
}

function resolveRootRowTargetIndex(rootIndex: number, event: DragEvent) {
  const currentTarget = event.currentTarget as HTMLElement | null

  if (!currentTarget) {
    return rootIndex
  }

  const rect = currentTarget.getBoundingClientRect()
  const midpoint = rect.top + rect.height / 2
  return event.clientY < midpoint ? rootIndex : rootIndex + 1
}

function isRowDropActive(rowId: string, mode: DropMode) {
  return activeDropState.value?.kind === 'row'
    && activeDropState.value.rowId === rowId
    && activeDropState.value.mode === mode
}

function resolveRowDropCandidate(
  rowId: string,
  index: number,
  depth: 1 | 2 | 3,
  row: ChildNavRow | null,
  parentId: string | null,
  event: DragEvent,
) {
  if (!draggedRow.value) {
    return null
  }

  const currentTarget = (event.currentTarget as HTMLElement | null) ?? (event.target as HTMLElement | null)

  if (!currentTarget) {
    return null
  }

  const rect = currentTarget.getBoundingClientRect()
  const relativeY = Math.max(0, Math.min(event.clientY - rect.top, rect.height))
  const ratio = rect.height > 0 ? relativeY / rect.height : 0
  const canDropInside = draggedRow.value.kind === 'item' && depth < 3 && (!row || row.item.id !== draggedRow.value.itemId)

  let dropMode: DropMode
  if (ratio <= 0.33) {
    dropMode = 'before'
  } else if (ratio >= 0.66) {
    dropMode = 'after'
  } else {
    dropMode = canDropInside ? 'inside' : ratio < 0.5 ? 'before' : 'after'
  }

  if (draggedRow.value.kind === 'section_header' && parentId !== null) {
    return null
  }

  if (dropMode === 'inside') {
    if (depth === 1 && !row) {
      return null
    }

    return {
      rowId,
      dropMode,
      targetParentId: row?.item.id ?? null,
      targetIndex: row?.item.children.length ?? 0,
    }
  }

  if (depth === 1 && !row) {
    return null
  }

  return {
    rowId,
    dropMode,
    targetParentId: depth === 1 ? null : parentId,
    targetIndex: dropMode === 'before' ? index : index + 1,
  }
}

onBeforeUnmount(() => {
  resetDragState()
})
</script>

<template>
  <nav ref="navigator" class="navigator" :aria-label="t('quotations.lineItems.navigator.aria')">
    <div v-if="groupIds.length > 0" class="navigator-toolbar">
      <button
        type="button"
        class="navigator-toolbar-action"
        @click="allExpanded ? collapseAll() : expandAll()"
      >
        {{ allExpanded ? t('quotations.lineItems.collapseAll') : t('quotations.lineItems.expandAll') }}
      </button>
    </div>

    <p v-if="rootBlocks.length === 0" class="nav-empty">{{ t('quotations.lineItems.navigator.empty') }}</p>

    <template v-for="block in rootBlocks" :key="block.id">
      <div
        class="nav-dropzone"
        :class="{ 'nav-dropzone-active': isDropzoneActive(block.rootIndex) }"
        @dragenter.prevent="handleDropZoneHover(block.rootIndex, $event)"
        @dragover.prevent="handleDropZoneHover(block.rootIndex, $event)"
        @drop.prevent="handleDrop(block.rootIndex, $event)"
      />

      <div
        class="nav-row nav-depth-1"
        :class="{
          'nav-row-section': !block.rootItem,
          'nav-row-incomplete': block.incomplete,
          'nav-row-drop-before': isRowDropActive(block.id, 'before'),
          'nav-row-drop-inside': isRowDropActive(block.id, 'inside'),
          'nav-row-drop-after': isRowDropActive(block.id, 'after'),
        }"
        @dragenter.prevent="handleRootRowHover(block.id, block.rootIndex, $event)"
        @dragover.prevent="handleRootRowHover(block.id, block.rootIndex, $event)"
        @drop.prevent="handleRootRowDrop(block.id, block.rootIndex, $event)"
      >
        <button
          type="button"
          class="nav-drag-handle"
          draggable="true"
          :aria-label="t('quotations.lineItems.navigator.dragHandleAria', { label: block.label })"
          @click.stop
          @dragstart="handleDragStart({
            itemId: block.id,
            depth: 1,
            kind: block.rootItem ? 'item' : 'section_header',
          }, $event)"
          @dragend="resetDragState"
        >
          <i class="pi pi-bars" aria-hidden="true" />
        </button>

        <button
          v-if="block.rootItem && block.isGroup"
          type="button"
          class="nav-toggle"
          :aria-label="expandedIds.has(block.rootItem.id) ? t('quotations.lineItems.navigator.collapse') : t('quotations.lineItems.navigator.expand')"
          @click="toggle(block.rootItem.id)"
        >
          <i :class="expandedIds.has(block.rootItem.id) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
        </button>
        <span v-else class="nav-toggle-spacer" />

        <button
          type="button"
          :class="[
            'nav-entry',
            {
              'nav-entry-incomplete': block.incomplete,
              'nav-entry-section': !block.rootItem,
            },
          ]"
          @click="scrollTo(block.id)"
        >
          <span v-if="block.displayNumber" class="nav-num nav-num-d1">{{ block.displayNumber }}</span>
          <span v-else class="nav-section-tag">{{ t('quotations.lineItems.sectionHeaderLabel') }}</span>
          <span class="nav-name">{{ block.label }}</span>
          <span v-if="block.rootItem && block.isGroup && !expandedIds.has(block.rootItem.id)" class="nav-count">
            {{ block.rootItem.children.length }}
          </span>
        </button>
      </div>

      <div
        v-for="row in block.descendants"
        :key="row.item.id"
        class="nav-row"
        :class="[
          `nav-depth-${row.depth}`,
          {
            'nav-row-incomplete': row.incomplete,
            'nav-row-drop-before': isRowDropActive(row.item.id, 'before'),
            'nav-row-drop-inside': isRowDropActive(row.item.id, 'inside'),
            'nav-row-drop-after': isRowDropActive(row.item.id, 'after'),
          },
        ]"
        @dragenter.prevent="handleChildRowHover(row, $event)"
        @dragover.prevent="handleChildRowHover(row, $event)"
        @drop.prevent="handleChildRowDrop(row, $event)"
      >
        <button
          type="button"
          class="nav-drag-handle"
          draggable="true"
          :aria-label="t('quotations.lineItems.navigator.dragHandleAria', { label: row.item.name || t('quotations.lineItems.navigator.unnamed') })"
          @click.stop
          @dragstart="handleDragStart({
            itemId: row.item.id,
            depth: row.depth,
            kind: 'item',
          }, $event)"
          @dragend="resetDragState"
        >
          <i class="pi pi-bars" aria-hidden="true" />
        </button>

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

        <button
          type="button"
          :class="['nav-entry', { 'nav-entry-incomplete': row.incomplete }]"
          @click="scrollTo(row.item.id)"
        >
          <span class="nav-num" :class="`nav-num-d${row.depth}`">{{ row.number }}</span>
          <span class="nav-name">{{ row.item.name || t('quotations.lineItems.navigator.unnamed') }}</span>
          <span v-if="row.isGroup && !expandedIds.has(row.item.id)" class="nav-count">
            {{ row.item.children.length }}
          </span>
        </button>
      </div>
    </template>

    <div
      v-if="rootBlocks.length > 0"
      class="nav-dropzone nav-dropzone-tail"
      :class="{ 'nav-dropzone-active': isDropzoneActive(rootBlocks.length) }"
      @dragenter.prevent="handleDropZoneHover(rootBlocks.length, $event)"
      @dragover.prevent="handleDropZoneHover(rootBlocks.length, $event)"
      @drop.prevent="handleDrop(rootBlocks.length, $event)"
    />
  </nav>
</template>

<style scoped>
.navigator {
  display: grid;
  gap: 1px;
}

.navigator-toolbar {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 6px;
}

.navigator-toolbar-action {
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 6px;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.navigator-toolbar-action:hover {
  background: var(--surface-hover);
}

.navigator-toolbar-action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.nav-empty {
  margin: 0;
  padding: 14px 4px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

.nav-dropzone {
  height: 8px;
  margin: 1px 0;
  border-radius: 999px;
  background: transparent;
  transition: background-color 0.12s ease;
}

.nav-dropzone-active {
  background: color-mix(in srgb, var(--accent) 55%, white);
}

.nav-dropzone-tail {
  margin-top: 1px;
}

.nav-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
}

.nav-row-drop-before::before,
.nav-row-drop-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 70%, white);
}

.nav-row-drop-before::before {
  top: -2px;
}

.nav-row-drop-after::after {
  bottom: -2px;
}

.nav-row-drop-inside .nav-entry {
  background: color-mix(in srgb, var(--accent-surface) 70%, white);
  box-shadow: inset 0 0 0 1px var(--accent-soft);
}

.nav-row-incomplete .nav-num {
  background: var(--warning-soft);
  color: var(--warning);
}

.nav-row-section .nav-entry {
  background: linear-gradient(90deg, var(--accent-surface), transparent);
}

.nav-depth-2 {
  padding-left: 14px;
}

.nav-depth-3 {
  padding-left: 28px;
}

.nav-drag-handle,
.nav-drag-handle-spacer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 24px;
  flex-shrink: 0;
}

.nav-drag-handle {
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-subtle);
  cursor: grab;
  font-size: 10px;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.nav-drag-handle:hover {
  background: var(--surface-hover);
  color: var(--text-body);
}

.nav-drag-handle:active {
  cursor: grabbing;
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

.nav-entry-incomplete {
  background: #fffbf3;
}

.nav-entry-section {
  border-left: 3px solid var(--accent);
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

.nav-section-tag {
  display: inline-grid;
  flex-shrink: 0;
  min-width: 46px;
  height: 18px;
  place-items: center;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--accent-surface);
  color: var(--accent);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
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
