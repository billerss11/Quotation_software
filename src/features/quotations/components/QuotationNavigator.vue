<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LineItemEntryMode, QuotationItem, QuotationRootItem } from '../types'
import { countIncompleteQuotationItems } from '../utils/quotationItemCompleteness'
import {
  createQuotationNavigatorSearchState,
  createSearchHighlightParts,
  createSearchMatchSnippet,
} from '../utils/quotationNavigatorSearch'
import { getQuotationRootItems, isQuotationItem } from '../utils/quotationItems'

type DropMode = 'before' | 'inside' | 'after'
type DropState =
  | { kind: 'zone'; targetIndex: number }
  | { kind: 'row'; rowId: string; mode: DropMode }
type DraggedRowState = {
  itemId: string
  depth: 1 | 2 | 3
  kind: 'item' | 'section_header'
}
type HighlightPart = ReturnType<typeof createSearchHighlightParts>[number]
type NavigatorContextTarget = {
  id: string
  label: string
  depth: 1 | 2 | 3
  isItem: boolean
  isRootItem: boolean
  isGroup: boolean
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
  selectedItemId?: string | null
}>()

const emit = defineEmits<{
  selectItem: [itemId: string]
  addChildItem: [parentItemId: string]
  removeItem: [itemId: string]
  duplicateRootItem: [itemId: string]
  moveRootRowToIndex: [itemId: string, targetIndex: number]
  moveQuotationTreeRow: [itemId: string, targetParentId: string | null, targetIndex: number, dropMode: DropMode]
}>()

const { t } = useI18n()
const navigatorRef = useTemplateRef<HTMLElement>('navigator')
const expandedIds = shallowRef(new Set<string>())
const searchInput = shallowRef('')
const debouncedSearchQuery = shallowRef('')
const contextMenu = shallowRef<{
  target: NavigatorContextTarget
  x: number
  y: number
} | null>(null)
let searchDebounceTimeout: ReturnType<typeof window.setTimeout> | null = null
let draggedRow: DraggedRowState | null = null
let activeDropState: DropState | null = null
let pendingDropState: DropState | null = null
let pointerClientY: number | null = null
let hoverFrameId: number | null = null
let autoScrollFrameId: number | null = null
const SEARCH_DEBOUNCE_MS = 120

const rootItems = computed(() => getQuotationRootItems(props.items))

const groupIds = computed(() => collectGroupIds(rootItems.value))
const searchState = computed(() => createQuotationNavigatorSearchState(props.items, debouncedSearchQuery.value))
const isSearchActive = computed(() => searchState.value.isActive)
const visibleExpandedIds = computed(() => {
  if (!isSearchActive.value) {
    return expandedIds.value
  }

  return new Set([...expandedIds.value, ...searchState.value.expandedIds])
})
const allExpanded = computed(
  () => groupIds.value.length > 0 && groupIds.value.every((id) => expandedIds.value.has(id)),
)
const bulkToggleLabel = computed(() =>
  allExpanded.value ? t('quotations.lineItems.collapseAll') : t('quotations.lineItems.expandAll'),
)
const bulkToggleIcon = computed(() => allExpanded.value ? 'pi pi-minus' : 'pi pi-plus')
const searchResultCountLabel = computed(() => {
  const count = searchState.value.matchCount
  return t(
    count === 1
      ? 'quotations.lineItems.navigator.searchResultCountOne'
      : 'quotations.lineItems.navigator.searchResultCount',
    { count },
  )
})
const activeContextTarget = computed(() => contextMenu.value?.target ?? null)

watch(
  () => props.selectedItemId,
  async (selectedItemId) => {
    if (!selectedItemId) {
      return
    }

    await nextTick()
    findNavigatorDataElement('data-nav-row-id', selectedItemId)?.scrollIntoView?.({ block: 'center' })
  },
  { immediate: true },
)

const rootBlocks = computed<RootNavBlock[]>(() => {
  let pricedRootIndex = 0
  const blocks: RootNavBlock[] = []

  props.items.forEach((root, rootIndex) => {
    if (isQuotationItem(root)) {
      pricedRootIndex += 1
      const displayNumber = String(pricedRootIndex)

      if (isSearchActive.value && !searchState.value.visibleIds.has(root.id)) {
        return
      }

      blocks.push({
        id: root.id,
        root,
        rootItem: root,
        rootIndex,
        displayNumber,
        label: root.name || t('quotations.lineItems.navigator.unnamed'),
        isGroup: root.children.length > 0,
        incomplete: isIncomplete(root),
        descendants: visibleExpandedIds.value.has(root.id)
          ? buildVisibleDescendants(root.children, displayNumber, root.id)
          : [],
      })
      return
    }

    if (isSearchActive.value && !searchState.value.visibleIds.has(root.id)) {
      return
    }

    blocks.push({
      id: root.id,
      root,
      rootItem: null,
      rootIndex,
      displayNumber: null,
      label: root.title || t('quotations.lineItems.sectionHeaderLabel'),
      isGroup: false,
      incomplete: false,
      descendants: [],
    })
  })

  return blocks
})

watch(searchInput, (nextQuery) => {
  if (searchDebounceTimeout !== null) {
    window.clearTimeout(searchDebounceTimeout)
  }

  searchDebounceTimeout = window.setTimeout(() => {
    debouncedSearchQuery.value = nextQuery
    searchDebounceTimeout = null
  }, SEARCH_DEBOUNCE_MS)
})

watch(isSearchActive, (active) => {
  if (active) {
    resetDragState()
  }
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

function selectItem(id: string) {
  closeContextMenu()
  emit('selectItem', id)
}

function clearSearch() {
  searchInput.value = ''
  debouncedSearchQuery.value = ''

  if (searchDebounceTimeout !== null) {
    window.clearTimeout(searchDebounceTimeout)
    searchDebounceTimeout = null
  }
}

async function jumpToFirstSearchMatch() {
  debouncedSearchQuery.value = searchInput.value
  await nextTick()

  if (searchState.value.firstMatchId) {
    selectItem(searchState.value.firstMatchId)
  }
}

function isSearchMatch(itemId: string) {
  return isSearchActive.value && searchState.value.matchIds.has(itemId)
}

function shouldShowDescriptionMatch(item: QuotationItem) {
  return isSearchActive.value
    && searchState.value.descriptionMatchIds.has(item.id)
    && !searchState.value.nameMatchIds.has(item.id)
}

function getDescriptionSnippet(item: QuotationItem) {
  return createSearchMatchSnippet(item.description, searchState.value.query)
}

function getHighlightedParts(text: string): HighlightPart[] {
  return createSearchHighlightParts(text, searchState.value.query)
}

function openContextMenu(target: NavigatorContextTarget, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  resetDragState()
  emit('selectItem', target.id)
  contextMenu.value = {
    target,
    x: clampContextMenuCoordinate(event.clientX, window.innerWidth, 220),
    y: clampContextMenuCoordinate(event.clientY, window.innerHeight, 220),
  }
}

function closeContextMenu() {
  contextMenu.value = null
}

function handleNavigatorKeydown(event: KeyboardEvent) {
  if (event.key !== 'Delete' && event.key !== 'Backspace') {
    if (event.key === 'Escape') {
      closeContextMenu()
    }
    return
  }

  if (isTextInputEventTarget(event.target)) {
    return
  }

  const targetId = activeContextTarget.value?.id ?? props.selectedItemId

  if (!targetId) {
    return
  }

  event.preventDefault()
  closeContextMenu()
  emit('removeItem', targetId)
}

function isTextInputEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.matches('input, textarea, select, [contenteditable="true"]')
}

function addChildFromContextMenu() {
  const target = activeContextTarget.value

  if (!target?.isItem || target.depth >= 3) {
    return
  }

  closeContextMenu()
  emit('addChildItem', target.id)
}

function duplicateRootFromContextMenu() {
  const target = activeContextTarget.value

  if (!target?.isRootItem) {
    return
  }

  closeContextMenu()
  emit('duplicateRootItem', target.id)
}

function deleteFromContextMenu() {
  const target = activeContextTarget.value

  if (!target) {
    return
  }

  closeContextMenu()
  emit('removeItem', target.id)
}

function toggleFromContextMenu() {
  const target = activeContextTarget.value

  if (!target?.isGroup) {
    return
  }

  toggle(target.id)
  closeContextMenu()
}

function createRootContextTarget(block: RootNavBlock): NavigatorContextTarget {
  return {
    id: block.id,
    label: block.label,
    depth: 1,
    isItem: Boolean(block.rootItem),
    isRootItem: Boolean(block.rootItem),
    isGroup: block.isGroup,
  }
}

function createChildContextTarget(row: ChildNavRow): NavigatorContextTarget {
  return {
    id: row.item.id,
    label: row.item.name || t('quotations.lineItems.navigator.unnamed'),
    depth: row.depth,
    isItem: true,
    isRootItem: false,
    isGroup: row.isGroup,
  }
}

function clampContextMenuCoordinate(value: number, viewportSize: number, menuSize: number) {
  return Math.max(8, Math.min(value, viewportSize - menuSize - 8))
}

function isIncomplete(item: QuotationItem) {
  return countIncompleteQuotationItems([item]) > 0
}

function buildVisibleDescendants(
  children: QuotationItem[],
  parentNumber: string,
  parentId: string,
): ChildNavRow[] {
  return children.flatMap((child, childIndex) => {
    if (isSearchActive.value && !searchState.value.visibleIds.has(child.id)) {
      return []
    }

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

    if (child.children.length === 0 || !visibleExpandedIds.value.has(child.id)) {
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
  if (isSearchActive.value) {
    event.preventDefault()
    return
  }

  draggedRow = state

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', state.itemId)
  }
}

function handleDropZoneHover(targetIndex: number, event: DragEvent) {
  if (!draggedRow || isSearchActive.value) {
    return
  }

  event.preventDefault()

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }

  queueActiveDropState({ kind: 'zone', targetIndex })
  pointerClientY = event.clientY
  startAutoScrollLoop()
}

function handleRootRowHover(rowId: string, rootIndex: number, event: DragEvent) {
  if (!draggedRow || isSearchActive.value) {
    return
  }

  if (draggedRow.kind === 'section_header') {
    const targetIndex = resolveRootRowTargetIndex(rootIndex, event)
    handleDropZoneHover(targetIndex, event)
    return
  }

  handleRowHover(rowId, rootIndex, 1, null, null, event)
}

function handleDrop(targetIndex: number, event: DragEvent) {
  if (!draggedRow || isSearchActive.value) {
    return
  }

  event.preventDefault()
  if (draggedRow.depth === 1) {
    emit('moveRootRowToIndex', draggedRow.itemId, targetIndex)
  } else {
    emit('moveQuotationTreeRow', draggedRow.itemId, null, targetIndex, 'before')
  }
  resetDragState()
}

function handleRootRowDrop(rowId: string, rootIndex: number, event: DragEvent) {
  if (!draggedRow || isSearchActive.value) {
    return
  }

  if (draggedRow.kind === 'section_header') {
    const targetIndex = resolveRootRowTargetIndex(rootIndex, event)
    handleDrop(targetIndex, event)
    return
  }

  const candidate = resolveRowDropCandidate(rowId, rootIndex, 1, null, null, event)

  if (!candidate) {
    return
  }

  event.preventDefault()

  if (draggedRow.depth === 1 && candidate.targetParentId === null && candidate.dropMode !== 'inside') {
    emit('moveRootRowToIndex', draggedRow.itemId, candidate.targetIndex)
  } else {
    emit(
      'moveQuotationTreeRow',
      draggedRow.itemId,
      candidate.targetParentId,
      candidate.targetIndex,
      candidate.dropMode,
    )
  }

  resetDragState()
}

function handleChildRowHover(row: ChildNavRow, event: DragEvent) {
  if (!draggedRow || draggedRow.kind === 'section_header' || isSearchActive.value) {
    return
  }

  handleRowHover(row.item.id, row.siblingIndex, row.depth, row, row.parentId, event)
}

function handleChildRowDrop(row: ChildNavRow, event: DragEvent) {
  if (!draggedRow || draggedRow.kind === 'section_header' || isSearchActive.value) {
    return
  }

  const candidate = resolveRowDropCandidate(row.item.id, row.siblingIndex, row.depth, row, row.parentId, event)

  if (!candidate) {
    return
  }

  event.preventDefault()
  emit(
    'moveQuotationTreeRow',
    draggedRow.itemId,
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
  if (isSearchActive.value) {
    return
  }

  const candidate = resolveRowDropCandidate(rowId, index, depth, row, parentId, event)

  if (!candidate) {
    return
  }

  event.preventDefault()

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }

  queueActiveDropState({ kind: 'row', rowId: candidate.rowId, mode: candidate.dropMode })
  pointerClientY = event.clientY
  startAutoScrollLoop()
}

function queueActiveDropState(nextState: DropState) {
  if (isSameDropState(activeDropState, nextState) || isSameDropState(pendingDropState, nextState)) {
    return
  }

  pendingDropState = nextState

  if (hoverFrameId !== null) {
    return
  }

  hoverFrameId = requestAnimationFrame(() => {
    hoverFrameId = null
    const nextState = pendingDropState
    pendingDropState = null
    applyActiveDropState(nextState)
  })
}

function startAutoScrollLoop() {
  if (autoScrollFrameId !== null) {
    return
  }

  const tick = () => {
    if (!draggedRow || pointerClientY === null) {
      autoScrollFrameId = null
      return
    }

    const scrollContainer = getScrollContainer()

    if (scrollContainer) {
      const rect = scrollContainer.getBoundingClientRect()
      const threshold = 36
      let scrollDelta = 0

      if (pointerClientY < rect.top + threshold) {
        scrollDelta = -Math.ceil((rect.top + threshold - pointerClientY) / 6) * 6
      } else if (pointerClientY > rect.bottom - threshold) {
        scrollDelta = Math.ceil((pointerClientY - (rect.bottom - threshold)) / 6) * 6
      }

      if (scrollDelta !== 0) {
        const maxScrollTop = Math.max(scrollContainer.scrollHeight - scrollContainer.clientHeight, 0)
        scrollContainer.scrollTop = Math.max(0, Math.min(scrollContainer.scrollTop + scrollDelta, maxScrollTop))
      }
    }

    autoScrollFrameId = requestAnimationFrame(tick)
  }

  autoScrollFrameId = requestAnimationFrame(tick)
}

function getScrollContainer() {
  const navigatorElement = navigatorRef.value
  return (navigatorElement?.closest('.panel-body') as HTMLElement | null) ?? navigatorElement
}

function resetDragState() {
  draggedRow = null
  pendingDropState = null
  pointerClientY = null
  applyActiveDropState(null)

  if (hoverFrameId !== null) {
    cancelAnimationFrame(hoverFrameId)
    hoverFrameId = null
  }

  if (autoScrollFrameId !== null) {
    cancelAnimationFrame(autoScrollFrameId)
    autoScrollFrameId = null
  }
}

function applyActiveDropState(nextState: DropState | null) {
  if (isSameDropState(activeDropState, nextState)) {
    return
  }

  removeDropStateClasses(activeDropState)
  activeDropState = nextState
  addDropStateClasses(activeDropState)
}

function addDropStateClasses(state: DropState | null) {
  const element = getDropStateElement(state)

  if (!element || !state) {
    return
  }

  element.classList.add(getDropStateClass(state))
}

function removeDropStateClasses(state: DropState | null) {
  const element = getDropStateElement(state)

  if (!element || !state) {
    return
  }

  element.classList.remove(getDropStateClass(state))
}

function getDropStateElement(state: DropState | null) {
  if (!state) {
    return null
  }

  if (state.kind === 'zone') {
    return findNavigatorDataElement('data-dropzone-index', String(state.targetIndex))
  }

  return findNavigatorDataElement('data-nav-row-id', state.rowId)
}

function getDropStateClass(state: DropState) {
  return state.kind === 'zone' ? 'nav-dropzone-active' : `nav-row-drop-${state.mode}`
}

function findNavigatorDataElement(attribute: string, value: string) {
  return navigatorRef.value?.querySelector<HTMLElement>(
    `[${attribute}="${escapeAttributeSelectorValue(value)}"]`,
  ) ?? null
}

function escapeAttributeSelectorValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function isSameDropState(left: DropState | null, right: DropState | null) {
  if (left === right) {
    return true
  }

  if (!left || !right || left.kind !== right.kind) {
    return false
  }

  if (left.kind === 'zone') {
    return left.targetIndex === (right as Extract<DropState, { kind: 'zone' }>).targetIndex
  }

  const rightRow = right as Extract<DropState, { kind: 'row' }>
  return left.rowId === rightRow.rowId && left.mode === rightRow.mode
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

function resolveRowDropCandidate(
  rowId: string,
  index: number,
  depth: 1 | 2 | 3,
  row: ChildNavRow | null,
  parentId: string | null,
  event: DragEvent,
) {
  if (!draggedRow) {
    return null
  }

  const currentTarget = (event.currentTarget as HTMLElement | null) ?? (event.target as HTMLElement | null)

  if (!currentTarget) {
    return null
  }

  const rect = currentTarget.getBoundingClientRect()
  const relativeY = Math.max(0, Math.min(event.clientY - rect.top, rect.height))
  const ratio = rect.height > 0 ? relativeY / rect.height : 0
  const canDropInside = draggedRow.kind === 'item' && depth < 3 && (!row || row.item.id !== draggedRow.itemId)

  let dropMode: DropMode
  if (ratio <= 0.33) {
    dropMode = 'before'
  } else if (ratio >= 0.66) {
    dropMode = 'after'
  } else {
    dropMode = canDropInside ? 'inside' : ratio < 0.5 ? 'before' : 'after'
  }

  if (draggedRow.kind === 'section_header' && parentId !== null) {
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
  if (searchDebounceTimeout !== null) {
    window.clearTimeout(searchDebounceTimeout)
  }

  resetDragState()
})
</script>

<template>
  <nav
    ref="navigator"
    class="navigator"
    tabindex="0"
    :aria-label="t('quotations.lineItems.navigator.aria')"
    @click="closeContextMenu"
    @keydown="handleNavigatorKeydown"
  >
    <div class="navigator-search">
      <div class="navigator-search-field">
        <i class="pi pi-search navigator-search-icon" aria-hidden="true" />
        <input
          v-model="searchInput"
          type="search"
          class="navigator-search-input"
          :aria-label="t('quotations.lineItems.navigator.searchAria')"
          :placeholder="t('quotations.lineItems.navigator.searchPlaceholder')"
          @keydown.enter.prevent="jumpToFirstSearchMatch"
        >
        <button
          v-if="searchInput.length > 0"
          type="button"
          class="navigator-search-clear"
          :aria-label="t('quotations.lineItems.navigator.clearSearch')"
          :title="t('quotations.lineItems.navigator.clearSearch')"
          @click="clearSearch"
        >
          <i class="pi pi-times" aria-hidden="true" />
        </button>
      </div>
      <span v-if="isSearchActive" class="navigator-search-count">{{ searchResultCountLabel }}</span>
    </div>

    <div v-if="!isSearchActive && groupIds.length > 0" class="navigator-toolbar">
      <button
        type="button"
        class="navigator-toolbar-action"
        :aria-label="bulkToggleLabel"
        :title="bulkToggleLabel"
        @click="allExpanded ? collapseAll() : expandAll()"
      >
        <i :class="bulkToggleIcon" aria-hidden="true" />
        <span class="navigator-toolbar-label">{{ bulkToggleLabel }}</span>
      </button>
    </div>

    <p v-if="isSearchActive && rootBlocks.length === 0" class="nav-empty">
      {{ t('quotations.lineItems.navigator.noSearchResults') }}
    </p>
    <p v-else-if="rootBlocks.length === 0" class="nav-empty">{{ t('quotations.lineItems.navigator.empty') }}</p>

    <template v-for="block in rootBlocks" :key="block.id">
      <div
        v-if="!isSearchActive"
        class="nav-dropzone"
        :data-dropzone-index="block.rootIndex"
        @dragenter.prevent="handleDropZoneHover(block.rootIndex, $event)"
        @dragover.prevent="handleDropZoneHover(block.rootIndex, $event)"
        @drop.prevent="handleDrop(block.rootIndex, $event)"
      />

      <div
        class="nav-row nav-depth-1"
        :class="{
          'nav-row-section': !block.rootItem,
          'nav-row-incomplete': block.incomplete,
        }"
        :data-nav-row-id="block.id"
        @dragenter.prevent="handleRootRowHover(block.id, block.rootIndex, $event)"
        @dragover.prevent="handleRootRowHover(block.id, block.rootIndex, $event)"
        @drop.prevent="handleRootRowDrop(block.id, block.rootIndex, $event)"
        @contextmenu="openContextMenu(createRootContextTarget(block), $event)"
      >
        <button
          type="button"
          class="nav-drag-handle"
          :draggable="!isSearchActive"
          :disabled="isSearchActive"
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
          :aria-label="visibleExpandedIds.has(block.rootItem.id) ? t('quotations.lineItems.navigator.collapse') : t('quotations.lineItems.navigator.expand')"
          @click="toggle(block.rootItem.id)"
        >
          <i :class="visibleExpandedIds.has(block.rootItem.id) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
        </button>
        <span v-else class="nav-toggle-spacer" />

        <button
          type="button"
          :class="[
            'nav-entry',
            {
              'nav-entry-incomplete': block.incomplete,
              'nav-entry-section': !block.rootItem,
              'nav-entry-search-match': isSearchMatch(block.id),
              'nav-entry-active': props.selectedItemId === block.id,
            },
          ]"
          @click="selectItem(block.id)"
        >
          <span v-if="block.displayNumber" class="nav-num nav-num-d1">{{ block.displayNumber }}</span>
          <span v-else class="nav-section-tag">{{ t('quotations.lineItems.sectionHeaderLabel') }}</span>
          <span class="nav-entry-text">
            <span class="nav-name">
              <span
                v-for="(part, index) in getHighlightedParts(block.label)"
                :key="`${block.id}-name-${index}`"
                :class="{ 'nav-match-text': part.matched }"
              >{{ part.text }}</span>
            </span>
            <span v-if="block.rootItem && shouldShowDescriptionMatch(block.rootItem)" class="nav-match-detail">
              <span
                v-for="(part, index) in getHighlightedParts(getDescriptionSnippet(block.rootItem))"
                :key="`${block.id}-description-${index}`"
                :class="{ 'nav-match-text': part.matched }"
              >{{ part.text }}</span>
            </span>
          </span>
          <span v-if="block.rootItem && block.isGroup && !visibleExpandedIds.has(block.rootItem.id)" class="nav-count">
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
          },
        ]"
        :data-nav-row-id="row.item.id"
        @dragenter.prevent="handleChildRowHover(row, $event)"
        @dragover.prevent="handleChildRowHover(row, $event)"
        @drop.prevent="handleChildRowDrop(row, $event)"
        @contextmenu="openContextMenu(createChildContextTarget(row), $event)"
      >
        <button
          type="button"
          class="nav-drag-handle"
          :draggable="!isSearchActive"
          :disabled="isSearchActive"
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
          :aria-label="visibleExpandedIds.has(row.item.id) ? t('quotations.lineItems.navigator.collapse') : t('quotations.lineItems.navigator.expand')"
          @click="toggle(row.item.id)"
        >
          <i :class="visibleExpandedIds.has(row.item.id) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
        </button>
        <span v-else class="nav-toggle-spacer" />

        <button
          type="button"
          :class="[
            'nav-entry',
            {
              'nav-entry-incomplete': row.incomplete,
              'nav-entry-search-match': isSearchMatch(row.item.id),
              'nav-entry-active': props.selectedItemId === row.item.id,
            },
          ]"
          @click="selectItem(row.item.id)"
        >
          <span class="nav-num" :class="`nav-num-d${row.depth}`">{{ row.number }}</span>
          <span class="nav-entry-text">
            <span class="nav-name">
              <span
                v-for="(part, index) in getHighlightedParts(row.item.name || t('quotations.lineItems.navigator.unnamed'))"
                :key="`${row.item.id}-name-${index}`"
                :class="{ 'nav-match-text': part.matched }"
              >{{ part.text }}</span>
            </span>
            <span v-if="shouldShowDescriptionMatch(row.item)" class="nav-match-detail">
              <span
                v-for="(part, index) in getHighlightedParts(getDescriptionSnippet(row.item))"
                :key="`${row.item.id}-description-${index}`"
                :class="{ 'nav-match-text': part.matched }"
              >{{ part.text }}</span>
            </span>
          </span>
          <span v-if="row.isGroup && !visibleExpandedIds.has(row.item.id)" class="nav-count">
            {{ row.item.children.length }}
          </span>
        </button>
      </div>
    </template>

    <div
      v-if="!isSearchActive && rootBlocks.length > 0"
      class="nav-dropzone nav-dropzone-tail"
      :data-dropzone-index="rootBlocks.length"
      @dragenter.prevent="handleDropZoneHover(rootBlocks.length, $event)"
      @dragover.prevent="handleDropZoneHover(rootBlocks.length, $event)"
      @drop.prevent="handleDrop(rootBlocks.length, $event)"
    />

    <div
      v-if="contextMenu && activeContextTarget"
      class="navigator-context-menu"
      role="menu"
      :aria-label="t('quotations.lineItems.navigator.contextMenuAria', { label: activeContextTarget.label })"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
      @contextmenu.prevent
    >
      <button
        v-if="activeContextTarget.isGroup"
        type="button"
        class="navigator-context-action"
        role="menuitem"
        @click="toggleFromContextMenu"
      >
        <i
          :class="visibleExpandedIds.has(activeContextTarget.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          aria-hidden="true"
        />
        <span>
          {{ visibleExpandedIds.has(activeContextTarget.id)
            ? t('quotations.lineItems.collapseItem')
            : t('quotations.lineItems.expandItem') }}
        </span>
      </button>
      <button
        v-if="activeContextTarget.isItem && activeContextTarget.depth < 3"
        type="button"
        class="navigator-context-action"
        role="menuitem"
        @click="addChildFromContextMenu"
      >
        <i class="pi pi-plus" aria-hidden="true" />
        <span>{{ t('quotations.lineItems.addChildItem') }}</span>
      </button>
      <button
        v-if="activeContextTarget.isRootItem"
        type="button"
        class="navigator-context-action"
        role="menuitem"
        @click="duplicateRootFromContextMenu"
      >
        <i class="pi pi-copy" aria-hidden="true" />
        <span>{{ t('quotations.lineItems.duplicate') }}</span>
      </button>
      <span class="navigator-context-separator" aria-hidden="true" />
      <button
        type="button"
        class="navigator-context-action navigator-context-danger"
        role="menuitem"
        @click="deleteFromContextMenu"
      >
        <i class="pi pi-trash" aria-hidden="true" />
        <span>{{ t('quotations.lineItems.delete') }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.navigator {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1px;
  min-width: 0;
}

.navigator-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 5px;
  min-width: 0;
  padding-bottom: 7px;
}

.navigator-search-field {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 30px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  background: var(--surface-card);
  color: var(--text-muted);
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

.navigator-search-field:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.navigator-search-icon {
  flex-shrink: 0;
  width: 28px;
  text-align: center;
  font-size: 11px;
}

.navigator-search-input {
  min-width: 0;
  flex: 1;
  height: 28px;
  border: 0;
  background: transparent;
  color: var(--text-strong);
  font: inherit;
  font-size: 12px;
  outline: none;
}

.navigator-search-input::placeholder {
  color: var(--text-subtle);
}

.navigator-search-clear {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-subtle);
  cursor: pointer;
  font-size: 10px;
}

.navigator-search-clear:hover {
  background: var(--surface-hover);
  color: var(--text-body);
}

.navigator-search-count {
  min-width: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navigator-toolbar {
  display: flex;
  justify-content: flex-end;
  min-width: 0;
  padding-bottom: 6px;
}

.navigator-toolbar-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 28px;
  max-width: 100%;
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

.navigator-toolbar-action i {
  flex-shrink: 0;
  font-size: 10px;
}

.navigator-toolbar-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  background: color-mix(in srgb, var(--accent) 55%, var(--surface-card));
}

.nav-dropzone-tail {
  margin-top: 1px;
}

.nav-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.nav-row-drop-before::before,
.nav-row-drop-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 70%, var(--surface-card));
}

.nav-row-drop-before::before {
  top: -2px;
}

.nav-row-drop-after::after {
  bottom: -2px;
}

.nav-row-drop-inside .nav-entry {
  background: color-mix(in srgb, var(--accent-surface) 70%, var(--surface-card));
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

.nav-drag-handle:disabled {
  color: var(--text-subtle);
  cursor: not-allowed;
  opacity: 0.45;
}

.nav-drag-handle:disabled:hover {
  background: transparent;
  color: var(--text-subtle);
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
  background: var(--warning-soft);
}

.nav-entry-section {
  border-left: 3px solid var(--accent);
}

.nav-entry-search-match {
  background: var(--accent-surface);
}

.nav-entry-active {
  background: color-mix(in srgb, var(--accent-surface) 82%, var(--surface-card));
  box-shadow: inset 0 0 0 1px var(--accent-soft);
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
  color: var(--text-on-accent);
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

.nav-entry-text {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1px;
}

.nav-name {
  min-width: 0;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-match-detail {
  min-width: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-match-text {
  border-radius: 3px;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
  font-weight: 700;
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

.navigator-context-menu {
  position: fixed;
  z-index: 80;
  display: grid;
  min-width: 188px;
  border: 1px solid var(--surface-border-strong);
  border-radius: var(--radius-md);
  padding: 4px;
  background: var(--surface-card);
  box-shadow: 0 16px 38px rgb(15 23 42 / 22%);
}

.navigator-context-action {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 30px;
  border: 0;
  border-radius: var(--radius-sm);
  padding: 5px 8px;
  background: transparent;
  color: var(--text-body);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  text-align: left;
}

.navigator-context-action:hover {
  background: var(--surface-hover);
  color: var(--text-strong);
}

.navigator-context-action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.navigator-context-action i {
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

.navigator-context-action span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navigator-context-danger {
  color: var(--danger);
}

.navigator-context-danger i {
  color: var(--danger);
}

.navigator-context-danger:hover {
  background: color-mix(in srgb, var(--danger-soft) 72%, var(--surface-card));
  color: var(--danger);
}

.navigator-context-separator {
  display: block;
  height: 1px;
  margin: 4px;
  background: var(--surface-border);
}
</style>
