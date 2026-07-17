<script setup lang="ts">
import { useVirtualizer, type Rect, type VirtualItem, type Virtualizer } from '@tanstack/vue-virtual'
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, nextTick, shallowRef, useTemplateRef, watch, type ComponentPublicInstance, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'

import CalculationSheetDialog from './CalculationSheetDialog.vue'
import LineItemCard from './LineItemCard.vue'
import SectionHeaderRow from './SectionHeaderRow.vue'

import type {
  CurrencyCode,
  ExchangeRateTable,
  LineItemEntryMode,
  MajorItemSummary,
  QuotationItem,
  QuotationItemField,
  QuotationRootItem,
  TotalsConfig,
} from '../types'
import { countIncompleteQuotationItems, hasIncompleteQuotationItem } from '../utils/quotationItemCompleteness'
import { findQuotationItemFocusElement } from '../utils/quotationItemFocusTarget'
import { isQuotationItem } from '../utils/quotationItems'

type RootRowEntry = {
  row: QuotationRootItem
  rootIndex: number
  itemDisplayIndex: number | null
}

type RenderedRootRow = {
  entry: RootRowEntry
  key: string
  virtualRow: VirtualItem | null
}

const LARGE_QUOTE_COLLAPSE_ITEM_THRESHOLD = 80
const VIRTUAL_ROOT_ROW_THRESHOLD = 100
const VIRTUAL_TOTAL_ITEM_THRESHOLD = 100
const VIRTUAL_ROOT_ROW_OVERSCAN = 5
const ROOT_ROW_GAP_PX = 7
const LARGE_QUOTE_ROOT_ROW_GAP_PX = 6
const ROOT_SECTION_HEADER_ESTIMATE_PX = 56
const COLLAPSED_ROOT_CARD_ESTIMATE_PX = 96
const EXPANDED_ROOT_CARD_ESTIMATE_PX = 560
const ROOT_SCROLL_HEIGHT_FALLBACK_PX = 720

const props = defineProps<{
  items: QuotationRootItem[]
  quotationNumber?: string
  itemSummaries?: MajorItemSummary[]
  currency: CurrencyCode
  grandTotal: number
  lineItemEntryMode: LineItemEntryMode
  globalMarkupRate: number
  totalsConfig: TotalsConfig
  exchangeRates: ExchangeRateTable
  costCurrencyOptions: string[]
  quotationCurrencyOptions: string[]
  focusedItemId?: string
  focusedItemRequestKey?: number
  scrollContainer?: HTMLElement | null
}>()

const emit = defineEmits<{
  addRootItem: []
  addSectionHeader: []
  addChildItem: [parentItemId: string]
  removeItem: [itemId: string]
  duplicateRootItem: [itemId: string]
  moveRootItem: [itemId: string, direction: -1 | 1]
  updateSectionHeaderTitle: [itemId: string, title: string]
  updateQuotationCurrency: [currency: CurrencyCode]
  updateLineItemEntryMode: [mode: LineItemEntryMode]
  setItemPricingMethod: [itemId: string, pricingMethod: QuotationItem['pricingMethod']]
  updateItemField: [itemId: string, field: QuotationItemField, value: QuotationItem[QuotationItemField]]
  requestItemGoalSeek: [itemId: string]
  requestBatchGoalSeek: []
}>()

const { t } = useI18n()
const entryModeOptions = computed<{ label: string; value: LineItemEntryMode }[]>(() => [
  { label: t('quotations.lineItems.entryModes.quick'), value: 'quick' },
  { label: t('quotations.lineItems.entryModes.detailed'), value: 'detailed' },
])
const rootItems = computed(() => props.items.filter(isQuotationItem))
const rootRows = computed<RootRowEntry[]>(() => {
  let itemDisplayIndex = 0

  return props.items.map((row, rootIndex) => ({
    row,
    rootIndex,
    itemDisplayIndex: isQuotationItem(row) ? itemDisplayIndex++ : null,
  }))
})
const summaryByItemId = computed(() =>
  new Map((props.itemSummaries ?? []).map((summary) => [summary.itemId, summary])),
)
const totalQuotationItemCount = computed(() => countQuotationItems(rootItems.value))
const isLargeQuote = computed(() => totalQuotationItemCount.value > LARGE_QUOTE_COLLAPSE_ITEM_THRESHOLD)
const rootIncompleteCounts = computed(() =>
  createRootIncompleteCounts(rootItems.value),
)
const collapsedRootIds = shallowRef(new Set<string>())
const expandAllRequestKey = shallowRef(0)
const collapseAllRequestKey = shallowRef(0)
const isExpandingAll = shallowRef(false)
const isCalculationSheetVisible = shallowRef(false)
const itemsListRef = useTemplateRef<HTMLDivElement>('itemsList')
const rootListScrollMargin = shallowRef(0)
const quotationCalculationSheetTitle = computed(() =>
  t('quotations.lineItems.calculationSheet.quotationTitle', {
    quotationNumber: props.quotationNumber?.trim() || 'quotation',
  }),
)
const quotationCalculationSheetFileName = computed(() =>
  `${sanitizeFileNamePart(props.quotationNumber?.trim() || 'quotation')}-calculation-sheet.csv`,
)
const rootScrollContainer = computed(() => props.scrollContainer ?? itemsListRef.value?.parentElement ?? null)
const shouldVirtualizeRootRows = computed(() =>
  rootRows.value.length > VIRTUAL_ROOT_ROW_THRESHOLD
  || totalQuotationItemCount.value > VIRTUAL_TOTAL_ITEM_THRESHOLD,
)
const rootRowGap = computed(() => isLargeQuote.value ? LARGE_QUOTE_ROOT_ROW_GAP_PX : ROOT_ROW_GAP_PX)
const rootRowVirtualizer = useVirtualizer<HTMLElement, HTMLDivElement>(
  computed(() => ({
    count: shouldVirtualizeRootRows.value ? rootRows.value.length : 0,
    getScrollElement: () => rootScrollContainer.value,
    estimateSize: estimateRootRowSize,
    getItemKey: (index) => rootRows.value[index]?.row.id ?? index,
    gap: rootRowGap.value,
    initialRect: { width: 0, height: ROOT_SCROLL_HEIGHT_FALLBACK_PX },
    measureElement: (element) => {
      const height = element.getBoundingClientRect().height || element.offsetHeight
      return height > 0 ? height : estimateRootRowSize(Number(element.dataset.index ?? 0))
    },
    observeElementRect: observeRootScrollRect,
    overscan: VIRTUAL_ROOT_ROW_OVERSCAN,
    scrollMargin: rootListScrollMargin.value,
  })),
)
const renderedRootRows = computed<RenderedRootRow[]>(() => {
  if (!shouldVirtualizeRootRows.value) {
    return rootRows.value.map((entry) => ({
      entry,
      key: entry.row.id,
      virtualRow: null,
    }))
  }

  const entries: RenderedRootRow[] = []

  for (const virtualRow of rootRowVirtualizer.value.getVirtualItems()) {
    const entry = rootRows.value[virtualRow.index]

    if (entry) {
      entries.push({
        entry,
        key: entry.row.id,
        virtualRow,
      })
    }
  }

  return entries
})
const virtualRootSpacerStyle = computed<CSSProperties | undefined>(() =>
  shouldVirtualizeRootRows.value
    ? { height: `${rootRowVirtualizer.value.getTotalSize()}px` }
    : undefined,
)

watch(
  () => rootItems.value.map((item) => item.id),
  (nextRootIds, previousRootIds) => {
    const nextRootIdSet = new Set(nextRootIds)

    if (!previousRootIds) {
      collapsedRootIds.value = new Set(
        isLargeQuote.value ? nextRootIds : [],
      )
      return
    }

    const previousRootIdSet = new Set(previousRootIds)
    const nextCollapsedIds = Array.from(collapsedRootIds.value).filter((id) => nextRootIdSet.has(id))

    if (isLargeQuote.value) {
      for (const itemId of nextRootIds) {
        if (!previousRootIdSet.has(itemId)) {
          nextCollapsedIds.push(itemId)
        }
      }
    }

    collapsedRootIds.value = new Set(nextCollapsedIds)
  },
  { immediate: true },
)

watch(
  () => [props.focusedItemId, props.focusedItemRequestKey] as const,
  async ([focusedItemId]) => {
    if (!focusedItemId) {
      return
    }

    await revealItemInEditor(focusedItemId, 'center')
  },
  { immediate: true },
)

const allCollapsed = computed(
  () => rootItems.value.length > 0 && rootItems.value.every((item) => collapsedRootIds.value.has(item.id)),
)

function setQuotationCurrency(value: unknown) {
  emit('updateQuotationCurrency', value as CurrencyCode)
}

function setEntryMode(mode: LineItemEntryMode) {
  if (mode === props.lineItemEntryMode) return
  emit('updateLineItemEntryMode', mode)
}

function isRootCardExpanded(itemId: string) {
  return !collapsedRootIds.value.has(itemId)
}

function toggleRootCard(itemId: string) {
  const next = new Set(collapsedRootIds.value)
  if (next.has(itemId)) next.delete(itemId)
  else next.add(itemId)
  collapsedRootIds.value = next
  queueRootVirtualRowMeasure(itemId)
}

function collapseAll() {
  collapsedRootIds.value = new Set(rootItems.value.map((item) => item.id))
  collapseAllRequestKey.value += 1
  queueRootVirtualMeasure()
}

function applyExpandAll() {
  collapsedRootIds.value = new Set()
  expandAllRequestKey.value += 1
  queueRootVirtualMeasure()
}

async function expandAll() {
  if (!isLargeQuote.value) {
    applyExpandAll()
    return
  }

  if (isExpandingAll.value) {
    return
  }

  isExpandingAll.value = true

  try {
    await yieldToBrowser()
    applyExpandAll()
    await yieldToBrowser()
  }
  finally {
    isExpandingAll.value = false
  }
}

async function yieldToBrowser() {
  await nextTick()
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
}

function openCalculationSheet() {
  isCalculationSheetVisible.value = true
}

const incompleteCount = computed(() => rootIncompleteCounts.value.total)

const itemsCount = computed(() => rootItems.value.length)

function jumpToFirstIncomplete() {
  for (const item of rootItems.value) {
    const total = rootIncompleteCounts.value.byItemId.get(item.id)
      ?? (item.children.length === 0
        ? (hasIncompleteQuotationItem(item) ? 1 : 0)
        : countIncompleteQuotationItems([item]))
    if (total > 0) {
      expandRootItem(item.id)
      void revealItemInEditor(item.id, 'start', 'smooth')
      return
    }
  }
}

function estimateRootRowSize(index: number) {
  const entry = rootRows.value[index]

  if (!entry || !isQuotationItem(entry.row)) {
    return ROOT_SECTION_HEADER_ESTIMATE_PX
  }

  return isRootCardExpanded(entry.row.id)
    ? EXPANDED_ROOT_CARD_ESTIMATE_PX
    : COLLAPSED_ROOT_CARD_ESTIMATE_PX
}

function getVirtualRootRowStyle(virtualRow: VirtualItem | null): CSSProperties | undefined {
  if (!virtualRow) {
    return undefined
  }

  return {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    transform: `translateY(${virtualRow.start - rootListScrollMargin.value}px)`,
  }
}

function measureVirtualRootRow(ref: Element | ComponentPublicInstance | null) {
  if (ref instanceof HTMLDivElement) {
    rootRowVirtualizer.value.measureElement(ref)
  }
}

function observeRootScrollRect(
  instance: Virtualizer<HTMLElement, HTMLDivElement>,
  callback: (rect: Rect) => void,
) {
  const element = instance.scrollElement

  if (!element) {
    return
  }

  const updateRect = () => {
    updateRootListScrollMargin()
    callback(getRootScrollRect(element))
  }
  updateRect()

  const ResizeObserverCtor = element.ownerDocument.defaultView?.ResizeObserver

  if (!ResizeObserverCtor) {
    return
  }

  const observer = new ResizeObserverCtor(updateRect)
  observer.observe(element)

  return () => observer.disconnect()
}

function getRootScrollRect(element: HTMLElement): Rect {
  const rect = element.getBoundingClientRect()

  return {
    width: Math.round(element.clientWidth || rect.width || 1024),
    height: Math.round(element.clientHeight || rect.height || ROOT_SCROLL_HEIGHT_FALLBACK_PX),
  }
}

function updateRootListScrollMargin() {
  const listElement = itemsListRef.value
  const scrollElement = rootScrollContainer.value

  if (!listElement || !scrollElement) {
    rootListScrollMargin.value = 0
    return
  }

  const listRect = listElement.getBoundingClientRect()
  const scrollRect = scrollElement.getBoundingClientRect()
  const topOffset = listRect.top - scrollRect.top

  if (topOffset === 0 && scrollElement.scrollTop > 0) {
    return
  }

  rootListScrollMargin.value = Math.max(0, topOffset + scrollElement.scrollTop)
}

function queueRootVirtualMeasure() {
  if (!shouldVirtualizeRootRows.value) {
    return
  }

  void nextTick(() => {
    rootRowVirtualizer.value.measure()
  })
}

function queueRootVirtualRowMeasure(itemId: string) {
  if (!shouldVirtualizeRootRows.value) {
    return
  }

  void nextTick(() => {
    const itemElement = itemsListRef.value
      ? findQuotationItemFocusElement(itemsListRef.value, itemId)
      : null
    const rootRowElement = itemElement?.closest<HTMLDivElement>('.root-row-shell')

    if (rootRowElement) {
      rootRowVirtualizer.value.measureElement(rootRowElement)
    }
  })
}

function expandRootItem(itemId: string) {
  if (!collapsedRootIds.value.has(itemId)) {
    return false
  }

  const next = new Set(collapsedRootIds.value)
  next.delete(itemId)
  collapsedRootIds.value = next
  queueRootVirtualMeasure()
  return true
}

async function revealItemInEditor(
  itemId: string,
  block: ScrollLogicalPosition,
  behavior?: ScrollBehavior,
) {
  const rootRowIndex = findRootRowIndexForItemId(itemId)

  const didScrollVirtualRoot = scrollRootRowIntoVirtualView(rootRowIndex)

  const rootItem = findRootItemForItemId(itemId)
  if (rootItem) {
    expandRootItem(rootItem.id)
  }

  await nextTick()
  await nextTick()

  if (didScrollVirtualRoot) {
    scrollRootRowIntoVirtualView(rootRowIndex)
    await nextTick()
    await nextTick()
  }

  const scrollOptions: ScrollIntoViewOptions = { block }
  if (behavior) {
    scrollOptions.behavior = behavior
  }

  findQuotationItemFocusElement(document, itemId)?.scrollIntoView?.(scrollOptions)
}

function scrollRootRowIntoVirtualView(rootRowIndex: number) {
  if (rootRowIndex < 0 || !shouldVirtualizeRootRows.value) {
    return false
  }

  updateRootListScrollMargin()
  rootRowVirtualizer.value.scrollToIndex(rootRowIndex, { align: 'center' })
  return true
}

function sanitizeFileNamePart(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .trim() || 'quotation'
}

function countQuotationItems(items: QuotationItem[]): number {
  return items.reduce((count, item) => count + 1 + countQuotationItems(item.children), 0)
}

function findRootItemForItemId(itemId: string) {
  return rootItems.value.find((item) => containsItemId(item, itemId)) ?? null
}

function findRootRowIndexForItemId(itemId: string) {
  return rootRows.value.findIndex(({ row }) => {
    if (row.id === itemId) {
      return true
    }

    return isQuotationItem(row) && containsItemId(row, itemId)
  })
}

function containsItemId(item: QuotationItem, itemId: string): boolean {
  return item.id === itemId || item.children.some((child) => containsItemId(child, itemId))
}

function createRootIncompleteCounts(items: QuotationItem[]) {
  const byItemId = new Map<string, number>()
  let total = 0

  for (const item of items) {
    const itemCount = countIncompleteQuotationItems([item])
    byItemId.set(item.id, itemCount)
    total += itemCount
  }

  return { byItemId, total }
}
</script>

<template>
  <section
    class="workbench"
    :class="{ 'workbench-large-quote': isLargeQuote }"
    :aria-label="t('quotations.lineItems.aria')"
  >
    <Teleport to="body">
      <div v-if="isExpandingAll" class="expand-all-overlay">
        <div
          class="expand-all-window"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span class="expand-all-warning-icon" aria-hidden="true">
            <i class="pi pi-exclamation-triangle" />
          </span>
          <div class="expand-all-message">
            <strong class="expand-all-title">
              {{ t('quotations.lineItems.expandingAllTitle') }}
            </strong>
            <p class="expand-all-detail">
              {{ t('quotations.lineItems.expandingAllWarning') }}
            </p>
          </div>
          <i class="pi pi-spinner pi-spin expand-all-spinner" aria-hidden="true" />
        </div>
      </div>
    </Teleport>

    <div class="workbench-heading">
      <div class="heading-copy">
        <h2 class="heading-title">
          {{ t('quotations.lineItems.title') }}
          <span v-if="itemsCount > 0" class="heading-count">{{ itemsCount }}</span>
        </h2>
        <p class="heading-sub">{{ t('quotations.lineItems.subtitle') }}</p>
      </div>
      <div class="heading-tools">
        <div
          class="entry-mode-toggle"
          role="tablist"
          :aria-label="t('quotations.lineItems.entryModeAria')"
        >
          <button
            v-for="opt in entryModeOptions"
            :key="opt.value"
            class="entry-mode-button"
            :class="{ 'entry-mode-button-active': props.lineItemEntryMode === opt.value }"
            type="button"
            role="tab"
            :aria-selected="props.lineItemEntryMode === opt.value"
            @click="setEntryMode(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>

        <label class="heading-currency">
          <span>{{ t('quotations.commandBar.customerCurrency') }}</span>
          <Select
            :model-value="currency"
            :options="props.quotationCurrencyOptions"
            :aria-label="t('quotations.commandBar.customerCurrencyAria')"
            @update:model-value="setQuotationCurrency"
          />
        </label>

        <button
          v-if="incompleteCount > 0"
          type="button"
          class="incomplete-badge"
          :title="t('quotations.lineItems.jumpToIncomplete')"
          :aria-label="t('quotations.lineItems.jumpToIncomplete')"
          @click="jumpToFirstIncomplete"
        >
          <i class="pi pi-exclamation-triangle" aria-hidden="true" />
          {{ t('quotations.lineItems.incompleteLines', { count: incompleteCount }) }}
        </button>

        <div class="heading-buttons">
          <Button
            v-if="rootItems.length > 0"
            :icon="allCollapsed ? 'pi pi-angle-double-down' : 'pi pi-angle-double-up'"
            :label="allCollapsed ? t('quotations.lineItems.expandAll') : t('quotations.lineItems.collapseAll')"
            severity="secondary"
            text
            :disabled="isExpandingAll"
            @click="allCollapsed ? expandAll() : collapseAll()"
          />
          <Button
            v-if="rootItems.length > 0"
            data-calculation-sheet-action="quotation"
            icon="pi pi-calculator"
            severity="secondary"
            :label="t('quotations.lineItems.calculationSheet.openQuotation')"
            :aria-label="t('quotations.lineItems.calculationSheet.openQuotationAria')"
            @click="openCalculationSheet"
          />
          <Button
            v-if="rootItems.length > 0"
            icon="pi pi-bullseye"
            severity="secondary"
            :label="t('quotations.goalSeek.openBatch')"
            :aria-label="t('quotations.goalSeek.openBatchAria')"
            @click="emit('requestBatchGoalSeek')"
          />
          <Button
            icon="pi pi-plus"
            :label="t('quotations.lineItems.addItem')"
            :aria-label="t('quotations.lineItems.addRootAria')"
            @click="emit('addRootItem')"
          />
          <Button
            icon="pi pi-minus"
            severity="secondary"
            :label="t('quotations.lineItems.addSectionHeader')"
            :aria-label="t('quotations.lineItems.addSectionHeaderAria')"
            @click="emit('addSectionHeader')"
          />
        </div>
      </div>
    </div>

    <CalculationSheetDialog
      v-if="isCalculationSheetVisible"
      :visible="isCalculationSheetVisible"
      :items="rootItems"
      :title="quotationCalculationSheetTitle"
      :export-file-name="quotationCalculationSheetFileName"
      :currency="props.currency"
      :global-markup-rate="props.globalMarkupRate"
      :totals-config="props.totalsConfig"
      :exchange-rates="props.exchangeRates"
      @update:visible="isCalculationSheetVisible = $event"
    />

    <div
      ref="itemsList"
      class="items-list"
      :class="{ 'items-list-virtual': shouldVirtualizeRootRows }"
    >
      <div
        :class="shouldVirtualizeRootRows ? 'root-virtual-spacer' : 'root-row-list'"
        :style="virtualRootSpacerStyle"
      >
        <div
          v-for="{ entry, key, virtualRow } in renderedRootRows"
          :key="key"
          :ref="virtualRow ? measureVirtualRootRow : undefined"
          class="root-row-shell"
          :data-index="virtualRow?.index"
          :style="getVirtualRootRowStyle(virtualRow)"
        >
          <LineItemCard
            v-if="isQuotationItem(entry.row)"
            :item="entry.row"
            :item-index="entry.rootIndex"
            :display-index="entry.itemDisplayIndex ?? entry.rootIndex"
            :total-items="props.items.length"
            :currency="props.currency"
            :line-item-entry-mode="props.lineItemEntryMode"
            :summary="summaryByItemId.get(entry.row.id)"
            :global-markup-rate="props.globalMarkupRate"
            :totals-config="props.totalsConfig"
            :exchange-rates="props.exchangeRates"
            :cost-currency-options="props.costCurrencyOptions"
            :focused="props.focusedItemId === entry.row.id"
            :focused-item-id="props.focusedItemId"
            :focused-item-request-key="props.focusedItemRequestKey"
            :expanded="isRootCardExpanded(entry.row.id)"
            :incomplete-count="rootIncompleteCounts.byItemId.get(entry.row.id) ?? 0"
            :expand-all-request-key="expandAllRequestKey"
            :collapse-all-request-key="collapseAllRequestKey"
            @toggle-expanded="toggleRootCard"
            @add-child-item="emit('addChildItem', $event)"
            @remove-item="emit('removeItem', $event)"
            @duplicate-root-item="emit('duplicateRootItem', $event)"
            @move-root-item="(itemId, direction) => emit('moveRootItem', itemId, direction)"
            @set-item-pricing-method="(itemId, pricingMethod) => emit('setItemPricingMethod', itemId, pricingMethod)"
            @update-item-field="(itemId, field, value) => emit('updateItemField', itemId, field, value)"
            @request-item-goal-seek="emit('requestItemGoalSeek', $event)"
          />
          <SectionHeaderRow
            v-else
            :header="entry.row"
            :row-index="entry.rootIndex"
            :total-rows="props.items.length"
            @move-row="(itemId, direction) => emit('moveRootItem', itemId, direction)"
            @remove-row="emit('removeItem', $event)"
            @update-title="(itemId, title) => emit('updateSectionHeaderTitle', itemId, title)"
          />
        </div>
      </div>
      <div v-if="items.length === 0" class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">
          <i class="pi pi-inbox" />
        </div>
        <h3 class="empty-state-title">{{ t('quotations.lineItems.emptyTitle') }}</h3>
        <p class="empty-state-text">{{ t('quotations.lineItems.emptyDescription') }}</p>
        <Button
          icon="pi pi-plus"
          :label="t('quotations.lineItems.addItem')"
          @click="emit('addRootItem')"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.workbench {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding-bottom: 12px;
}

.workbench-heading {
  position: sticky;
  top: -14px;
  z-index: 8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
  padding: 10px 14px;
  margin: 0 -14px 2px;
  background:
    linear-gradient(180deg, var(--surface-card) 0, var(--surface-raised) 100%),
    var(--surface-card);
  border-bottom: 1px solid var(--surface-border-strong);
}

.workbench-heading::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -6px;
  height: 6px;
  background: linear-gradient(180deg, rgb(15 23 42 / 7%), transparent);
  pointer-events: none;
}

.workbench-heading :deep(.p-button) {
  flex: 0 0 auto;
}

.heading-copy {
  flex: 1 1 0;
  min-width: 0;
}

.heading-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.1;
}

.heading-count {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.heading-sub {
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.3;
}

.expand-all-overlay {
  position: fixed;
  inset: 0;
  z-index: 1400;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(15 23 42 / 28%);
  pointer-events: none;
}

.expand-all-window {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  width: min(440px, calc(100vw - 48px));
  padding: 20px 22px;
  border: 1px solid var(--warning-border);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
  box-shadow: var(--shadow-elevated);
}

.expand-all-warning-icon {
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 999px;
  background: var(--warning-soft);
  color: var(--warning);
  font-size: 19px;
}

.expand-all-message {
  min-width: 0;
}

.expand-all-title {
  display: block;
  color: var(--text-strong);
  font-size: 16px;
  line-height: 1.25;
}

.expand-all-detail {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.4;
}

.expand-all-spinner {
  color: var(--warning);
  font-size: 20px;
}

.heading-tools {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.entry-mode-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0;
  padding: 2px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.entry-mode-button {
  min-height: 26px;
  padding: 0 11px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.entry-mode-button:hover:not(.entry-mode-button-active) {
  color: var(--text-body);
  background: var(--surface-hover);
}

.entry-mode-button-active {
  background: var(--surface-card);
  color: var(--accent-hover);
  font-weight: 700;
  box-shadow: var(--shadow-control);
}

.heading-currency {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.heading-currency span {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-left: 2px;
}

.heading-currency :deep(.p-select) {
  min-width: 96px;
  min-height: 28px;
  border-radius: var(--radius-md);
}

.heading-currency :deep(.p-select-label) {
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 600;
}

.incomplete-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border: 1px solid var(--warning-border);
  border-radius: 999px;
  background: var(--warning-soft);
  color: var(--warning);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.13s ease, border-color 0.13s ease, transform 0.13s ease;
  white-space: nowrap;
}

.incomplete-badge:hover {
  background: #ffe4ca;
  border-color: #fdba74;
  transform: translateY(-1px);
}

.incomplete-badge i {
  font-size: 12px;
}

.heading-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-shrink: 0;
}

.heading-buttons :deep(.p-button) {
  min-height: 32px;
  font-size: 13px;
  padding-inline: 0.7rem;
  padding-block: 0.32rem;
  border-radius: var(--radius-md);
}

.items-list {
  min-width: 0;
}

.root-row-list {
  display: grid;
  gap: 7px;
}

.workbench-large-quote .root-row-list {
  gap: 6px;
}

.root-virtual-spacer {
  position: relative;
  width: 100%;
}

.root-row-shell {
  min-width: 0;
}

.workbench-large-quote :deep(.item-card),
.workbench-large-quote :deep(.ct-row),
.workbench-large-quote :deep(.child-table-wrap),
.workbench-large-quote :deep(.entry-mode-button),
.workbench-large-quote .incomplete-badge {
  transition: none;
}

.workbench-large-quote :deep(.item-card),
.workbench-large-quote :deep(.ct-row),
.workbench-large-quote :deep(.ct-head) {
  box-shadow: none;
}

.workbench-large-quote :deep(.item-card:hover) {
  box-shadow: none;
  transform: none;
}

.workbench-large-quote :deep(.ct-row:hover) {
  box-shadow: inset 4px 0 0 0 color-mix(in srgb, var(--accent) 24%, transparent);
}

.workbench-large-quote .incomplete-badge:hover {
  transform: none;
}

.empty-state {
  display: grid;
  gap: 10px;
  justify-items: center;
  padding: 56px 24px 64px;
  text-align: center;
}

.empty-state-icon {
  display: inline-grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-subtle);
  font-size: 22px;
}

.empty-state-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 15px;
  font-weight: 700;
}

.empty-state-text {
  max-width: 42ch;
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
  text-wrap: pretty;
}

@media (max-width: 1320px) {
  .workbench-heading {
    flex-wrap: wrap;
  }

  .heading-tools {
    flex: 1 1 100%;
    flex-wrap: wrap;
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 900px) {
  .heading-tools {
    width: 100%;
    justify-content: flex-start;
  }

  .heading-currency {
    flex: 1 1 160px;
  }
}
</style>
