<script setup lang="ts">
import Dialog from 'primevue/dialog'
import { computed, onBeforeUnmount, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency } from '@/shared/utils/formatters'

import type { CurrencyCode, ExchangeRateTable, QuotationItem, TotalsConfig } from '../types'
import {
  createCalculationExplanationTree,
  type CalculationExplanationNode,
  type CalculationExplanationStep,
} from '../utils/quotationCalculationExplanation'

const visible = defineModel<boolean>('visible', { default: false })

const props = defineProps<{
  item: QuotationItem
  itemNumber: string
  selectedItemId: string | null
  currency: CurrencyCode
  globalMarkupRate: number
  totalsConfig: TotalsConfig
  exchangeRates: ExchangeRateTable
}>()

const emit = defineEmits<{
  selectItem: [itemId: string]
}>()

const DEFAULT_TREE_WIDTH = 250
const MIN_TREE_WIDTH = 190
const MAX_TREE_WIDTH = 520
const MIN_FORMULA_PANEL_WIDTH = 360
const TREE_RESIZE_KEYBOARD_STEP = 24

const { t, locale } = useI18n()
const layoutRef = useTemplateRef<HTMLElement>('layout')
const treeWidth = shallowRef(DEFAULT_TREE_WIDTH)
const isResizingTree = shallowRef(false)
const currentLocale = computed(() => locale.value as SupportedLocale)
const explanationTree = computed(() =>
  createCalculationExplanationTree({
    item: props.item,
    itemNumber: props.itemNumber,
    globalMarkupRate: props.globalMarkupRate,
    exchangeRates: props.exchangeRates,
    totalsConfig: props.totalsConfig,
  }),
)
const treeNodes = computed(() => flattenExplanationNodes(explanationTree.value))
const selectedNode = computed(() =>
  findExplanationNode(explanationTree.value, props.selectedItemId ?? props.item.id)
  ?? explanationTree.value,
)
const selectedSubtreeNodes = computed(() => flattenExplanationNodes(selectedNode.value))
const treeColumnStyle = computed(() => ({
  width: `${treeWidth.value}px`,
}))
const dialogTitle = computed(() =>
  t('quotations.lineItems.calculationExplanation.title', {
    itemNumber: selectedNode.value.itemNumber,
    itemName: getNodeName(selectedNode.value),
  }),
)
const summaryMetrics = computed(() => [
  {
    key: 'baseAmount',
    label: t('quotations.lineItems.calculationExplanation.totals.baseAmount'),
    value: formatMoney(selectedNode.value.totals.baseAmount),
  },
  {
    key: 'markupAmount',
    label: t('quotations.lineItems.calculationExplanation.totals.markupAmount'),
    value: formatMoney(selectedNode.value.totals.markupAmount),
  },
  {
    key: 'subtotal',
    label: t('quotations.lineItems.calculationExplanation.totals.subtotal'),
    value: formatMoney(selectedNode.value.totals.subtotal),
  },
  {
    key: 'taxAmount',
    label: t('quotations.lineItems.calculationExplanation.totals.taxAmount'),
    value: formatMoney(selectedNode.value.totals.taxAmount),
  },
  {
    key: 'totalWithTax',
    label: t('quotations.lineItems.calculationExplanation.totals.totalWithTax'),
    value: formatMoney(selectedNode.value.totals.totalWithTax),
  },
  {
    key: 'effectiveMarkupRate',
    label: t('quotations.lineItems.calculationExplanation.totals.effectiveMarkupRate'),
    value: formatRate(selectedNode.value.totals.effectiveMarkupRate),
  },
])

function selectNode(itemId: string) {
  emit('selectItem', itemId)
}

function startTreeResize(event: PointerEvent) {
  event.preventDefault()
  isResizingTree.value = true
  updateTreeWidth(event.clientX)
  window.addEventListener('pointermove', handleTreeResize)
  window.addEventListener('pointerup', stopTreeResize)
}

function handleTreeResize(event: PointerEvent) {
  updateTreeWidth(event.clientX)
}

function stopTreeResize() {
  isResizingTree.value = false
  window.removeEventListener('pointermove', handleTreeResize)
  window.removeEventListener('pointerup', stopTreeResize)
}

function resizeTreeWithKeyboard(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return
  }

  event.preventDefault()
  const direction = event.key === 'ArrowRight' ? 1 : -1
  setTreeWidth(treeWidth.value + direction * TREE_RESIZE_KEYBOARD_STEP)
}

function updateTreeWidth(clientX: number) {
  const layoutBounds = layoutRef.value?.getBoundingClientRect()

  if (!layoutBounds) {
    return
  }

  setTreeWidth(clientX - layoutBounds.left)
}

function setTreeWidth(nextWidth: number) {
  const layoutWidth = layoutRef.value?.getBoundingClientRect().width ?? 0
  const maxWidth = layoutWidth > 0
    ? Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, layoutWidth - MIN_FORMULA_PANEL_WIDTH))
    : MAX_TREE_WIDTH

  treeWidth.value = Math.min(Math.max(nextWidth, MIN_TREE_WIDTH), maxWidth)
}

function getNodeName(node: CalculationExplanationNode) {
  return node.name.trim() || t('quotations.lineItems.navigator.unnamed')
}

function getTreeNodeStyle(node: CalculationExplanationNode) {
  return {
    paddingLeft: `${8 + Math.max(node.depth - 1, 0) * 14}px`,
  }
}

function getFormulaNodeStyle(node: CalculationExplanationNode) {
  return {
    marginLeft: `${Math.max(node.depth - selectedNode.value.depth, 0) * 12}px`,
  }
}

function getPricingMethodLabel(node: CalculationExplanationNode) {
  if (node.isGroup) {
    return t('quotations.lineItems.calculationExplanation.pricingMethods.group')
  }

  return t(`quotations.lineItems.calculationExplanation.pricingMethods.${node.pricingMethod}`)
}

function getMarkupSourceLabel(node: CalculationExplanationNode) {
  if (!node.isGroup && node.pricingMethod === 'manual_price') {
    return t('quotations.lineItems.calculationExplanation.sources.manualPrice')
  }

  const rate = formatRate(node.totals.effectiveMarkupRate)

  if (node.totals.markupSource === 'self') {
    return t('quotations.lineItems.calculationExplanation.sources.markupSelf', { rate })
  }

  if (node.totals.markupSource === 'inherited') {
    return t('quotations.lineItems.calculationExplanation.sources.markupInherited', {
      rate,
      source: node.totals.markupSourceLabel ?? emptyValue(),
    })
  }

  return t('quotations.lineItems.calculationExplanation.sources.markupGlobal', { rate })
}

function getTaxSourceLabel(node: CalculationExplanationNode) {
  if (node.totals.taxSource.kind === 'mixed') {
    return t('quotations.lineItems.calculationExplanation.sources.taxMixed')
  }

  const taxClass = node.totals.taxClassLabel ?? emptyValue()
  const rate = formatRate(node.totals.taxRate ?? node.totals.effectiveTaxRate)

  if (node.totals.taxSource.kind === 'self') {
    return t('quotations.lineItems.calculationExplanation.sources.taxSelf', { taxClass, rate })
  }

  if (node.totals.taxSource.kind === 'inherited') {
    return t('quotations.lineItems.calculationExplanation.sources.taxInherited', {
      taxClass,
      rate,
      source: node.totals.taxSource.sourceLabel ?? emptyValue(),
    })
  }

  return t('quotations.lineItems.calculationExplanation.sources.taxDefault', { taxClass, rate })
}

function formatFormula(step: CalculationExplanationStep) {
  return t(step.formulaKey, formatStepValues(step))
}

function formatStepValues(step: CalculationExplanationStep) {
  return Object.fromEntries(
    Object.entries(step.values).map(([key, value]) => [key, formatStepValue(step, key, value)]),
  )
}

function formatStepValue(
  step: CalculationExplanationStep,
  key: string,
  value: number | string | null,
) {
  if (value === null) {
    return emptyValue()
  }

  if (typeof value === 'string') {
    return value
  }

  if (key === 'quantity') {
    return formatQuantity(value)
  }

  if (key === 'exchangeRate') {
    return formatDecimal(value)
  }

  if (isPercentageStepValue(step, key)) {
    return formatRate(value)
  }

  return formatMoney(value)
}

function isPercentageStepValue(step: CalculationExplanationStep, key: string) {
  return key.toLowerCase().includes('rate')
    || (key === 'result' && ['costSalesPercentage', 'groupEffectiveMarkupRate'].includes(step.id))
}

function formatMoney(amount: number) {
  return formatCurrency(amount, props.currency, currentLocale.value)
}

function formatQuantity(value: number) {
  const normalizedValue = Number.isFinite(value) ? value : 0

  return new Intl.NumberFormat(currentLocale.value, {
    minimumFractionDigits: Number.isInteger(normalizedValue) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(normalizedValue)
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat(currentLocale.value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(Number.isFinite(value) ? value : 0)
}

function formatRate(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return emptyValue()
  }

  return `${formatDecimal(value)}%`
}

function emptyValue() {
  return t('quotations.lineItems.calculationExplanation.emptyValue')
}

function flattenExplanationNodes(node: CalculationExplanationNode): CalculationExplanationNode[] {
  return [
    node,
    ...node.children.flatMap((child) => flattenExplanationNodes(child)),
  ]
}

function findExplanationNode(
  node: CalculationExplanationNode,
  itemId: string,
): CalculationExplanationNode | null {
  if (node.itemId === itemId) {
    return node
  }

  for (const child of node.children) {
    const match = findExplanationNode(child, itemId)
    if (match) {
      return match
    }
  }

  return null
}

onBeforeUnmount(() => stopTreeResize())
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    maximizable
    class="calculation-explanation-dialog"
    content-class="calculation-explanation-dialog-content"
    :header="dialogTitle"
  >
    <div
      ref="layout"
      class="calculation-explanation"
      :class="{ 'is-resizing-tree': isResizingTree }"
      data-calculation-explanation-dialog="root"
    >
      <aside
        class="explanation-tree"
        :style="treeColumnStyle"
        :aria-label="t('quotations.lineItems.calculationExplanation.treeLabel')"
      >
        <h3>{{ t('quotations.lineItems.calculationExplanation.treeLabel') }}</h3>
        <div class="tree-list">
          <button
            v-for="node in treeNodes"
            :key="node.itemId"
            type="button"
            class="tree-node"
            data-calculation-explanation-tree-node
            :data-calculation-explanation-tree-item-id="node.itemId"
            :class="{ 'tree-node-selected': node.itemId === selectedNode.itemId }"
            :style="getTreeNodeStyle(node)"
            :title="getNodeName(node)"
            :aria-current="node.itemId === selectedNode.itemId ? 'true' : undefined"
            @click="selectNode(node.itemId)"
          >
            <span class="tree-node-number">{{ node.itemNumber }}</span>
            <span class="tree-node-name">{{ getNodeName(node) }}</span>
          </button>
        </div>
      </aside>

      <button
        type="button"
        class="tree-resize-handle"
        data-calculation-explanation-tree-resize-handle
        role="separator"
        aria-orientation="vertical"
        :aria-label="t('quotations.lineItems.calculationExplanation.treeResizeHandle')"
        :aria-valuemin="MIN_TREE_WIDTH"
        :aria-valuemax="MAX_TREE_WIDTH"
        :aria-valuenow="treeWidth"
        @pointerdown="startTreeResize"
        @keydown="resizeTreeWithKeyboard"
      />

      <section class="explanation-panel">
        <header class="explanation-header">
          <span class="method-label">{{ getPricingMethodLabel(selectedNode) }}</span>
          <h3>{{ selectedNode.itemNumber }} {{ getNodeName(selectedNode) }}</h3>
          <div class="source-list">
            <span>
              <strong>{{ t('quotations.lineItems.calculationExplanation.sources.markup') }}</strong>
              {{ getMarkupSourceLabel(selectedNode) }}
            </span>
            <span>
              <strong>{{ t('quotations.lineItems.calculationExplanation.sources.tax') }}</strong>
              {{ getTaxSourceLabel(selectedNode) }}
            </span>
          </div>
        </header>

        <dl class="totals-grid" :aria-label="t('quotations.lineItems.calculationExplanation.totalsLabel')">
          <div v-for="metric in summaryMetrics" :key="metric.key" class="total-metric">
            <dt>{{ metric.label }}</dt>
            <dd>{{ metric.value }}</dd>
          </div>
        </dl>

        <div class="formula-list">
          <section
            v-for="node in selectedSubtreeNodes"
            :key="node.itemId"
            class="formula-node"
            :style="getFormulaNodeStyle(node)"
          >
            <header class="formula-node-header">
              <span>{{ node.itemNumber }}</span>
              <strong>{{ getNodeName(node) }}</strong>
            </header>
            <ol class="step-list">
              <li v-for="step in node.steps" :key="step.id" class="formula-step">
                <span class="step-label">{{ t(step.labelKey) }}</span>
                <span class="step-formula">{{ formatFormula(step) }}</span>
              </li>
            </ol>
          </section>
        </div>
      </section>
    </div>
  </Dialog>
</template>

<style scoped>
:global(.calculation-explanation-dialog.p-dialog) {
  width: min(1040px, calc(100vw - 32px));
  height: min(760px, calc(100vh - 32px));
  resize: both;
  overflow: hidden;
  min-width: min(640px, calc(100vw - 20px));
  min-height: min(440px, calc(100vh - 20px));
  max-width: calc(100vw - 20px);
  max-height: calc(100vh - 20px);
}

:global(.calculation-explanation-dialog.p-dialog-maximized) {
  resize: none;
}

:global(.calculation-explanation-dialog-content) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.calculation-explanation {
  display: grid;
  grid-template-columns: auto 10px minmax(0, 1fr);
  column-gap: 10px;
  height: 100%;
  min-height: 0;
}

.explanation-tree {
  min-width: 190px;
  max-width: min(520px, 52vw);
  overflow: auto;
  padding-right: 0;
}

.tree-resize-handle {
  position: relative;
  width: 10px;
  min-width: 10px;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
}

.tree-resize-handle::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 4px;
  border-left: 1px solid var(--surface-border);
}

.tree-resize-handle:hover::before,
.tree-resize-handle:focus-visible::before,
.is-resizing-tree .tree-resize-handle::before {
  border-left-color: color-mix(in srgb, var(--accent) 44%, var(--surface-border));
}

.tree-resize-handle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 42%, transparent);
  outline-offset: 2px;
}

.explanation-tree h3,
.explanation-header h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 15px;
  font-weight: 760;
}

.tree-list {
  display: grid;
  gap: 4px;
  margin-top: 10px;
  padding-right: 6px;
}

.tree-node {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  width: 100%;
  min-height: 30px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.tree-node:hover,
.tree-node-selected {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--surface-border));
  background: var(--accent-surface);
}

.tree-node-number {
  display: inline-grid;
  min-width: 32px;
  height: 22px;
  place-items: center;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--surface-muted) 70%, white);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 760;
}

.tree-node-name {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.explanation-panel {
  min-width: 0;
  overflow: auto;
  padding-right: 4px;
}

.explanation-header {
  display: grid;
  gap: 6px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--surface-border);
}

.method-label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.source-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
}

.source-list span {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}

.source-list strong {
  color: var(--text);
}

.totals-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  gap: 8px;
  margin: 12px 0;
}

.total-metric {
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--surface-muted) 54%, white);
}

.total-metric dt {
  margin: 0 0 3px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.total-metric dd {
  margin: 0;
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 760;
}

.formula-list {
  display: grid;
  gap: 10px;
}

.formula-node {
  display: grid;
  gap: 7px;
  min-width: 0;
  padding-left: 10px;
  border-left: 3px solid color-mix(in srgb, var(--accent) 28%, var(--surface-border));
}

.formula-node-header {
  display: flex;
  gap: 7px;
  align-items: center;
  color: var(--text-strong);
  font-size: 13px;
}

.formula-node-header span {
  color: var(--text-muted);
  font-weight: 760;
}

.step-list {
  display: grid;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.formula-step {
  display: grid;
  gap: 2px;
  padding: 7px 8px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 82%, transparent);
  border-radius: var(--radius-sm);
  background: #ffffff;
}

.step-label {
  color: var(--text);
  font-size: 12px;
  font-weight: 760;
}

.step-formula {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

@media (max-width: 560px) {
  .calculation-explanation {
    grid-template-columns: 1fr;
    row-gap: 12px;
    min-height: 0;
  }

  .explanation-tree {
    width: auto !important;
    min-width: 0;
    max-width: none;
    border-bottom: 1px solid var(--surface-border);
    padding-bottom: 12px;
  }

  .tree-resize-handle {
    display: none;
  }

  .tree-list {
    max-height: 180px;
    overflow: auto;
  }

  .totals-grid {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }
}
</style>
