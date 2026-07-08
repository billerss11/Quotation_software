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
const UNIT_STEP_IDS = new Set([
  'convertedUnitCost',
  'unitMarkup',
  'unitSellingPrice',
  'unitTaxAmount',
  'leafUnitPriceWithTax',
  'groupUnitPriceWithTax',
  'manualUnitPrice',
])
const SUMMARY_STEP_IDS = new Set(['totalWithTax', 'costSalesPercentage'])
const QUANTITY_ONE_FORMULA_STEP_IDS = new Set([
  'subtotal',
  'manualSubtotal',
  'convertedTotalCost',
  'groupUnitPriceWithTax',
  'groupBaseRollup',
  'groupSubtotalRollup',
  'groupMarkupRollup',
  'groupTaxRollup',
])

type FlowLaneKind = 'unit' | 'total'

interface StepFlowLane {
  kind: FlowLaneKind
  steps: CalculationExplanationStep[]
}

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
  return t(getFormulaKey(step), formatStepValues(step))
}

function formatStepResult(step: CalculationExplanationStep) {
  return formatStepValue(step, 'result', step.values.result ?? null)
}

function getStepToneClass(step: CalculationExplanationStep) {
  if (SUMMARY_STEP_IDS.has(step.id)) {
    return 'formula-step-summary'
  }

  return UNIT_STEP_IDS.has(step.id) ? 'formula-step-unit' : 'formula-step-total'
}

function getStepIconClass(step: CalculationExplanationStep) {
  if (step.id.toLowerCase().includes('tax') || step.id === 'costSalesPercentage') {
    return 'pi pi-percentage'
  }

  if (step.id.toLowerCase().includes('markup')) {
    return 'pi pi-chart-line'
  }

  if (step.id.toLowerCase().includes('rollup')) {
    return 'pi pi-sitemap'
  }

  return 'pi pi-calculator'
}

function getFormulaKey(step: CalculationExplanationStep) {
  if (shouldUseQuantityOneFormula(step)) {
    return step.formulaKey.replace(/\.formula$/, '.quantityOneFormula')
  }

  return step.formulaKey
}

function shouldUseQuantityOneFormula(step: CalculationExplanationStep) {
  return QUANTITY_ONE_FORMULA_STEP_IDS.has(step.id) && step.values.quantity === 1
}

function getStepFlowLanes(node: CalculationExplanationNode): StepFlowLane[] {
  const unitSteps = node.steps.filter((step) => UNIT_STEP_IDS.has(step.id))
  const totalSteps = node.steps.filter((step) => !UNIT_STEP_IDS.has(step.id))
  const lanes: StepFlowLane[] = [
    { kind: 'unit', steps: unitSteps },
    { kind: 'total', steps: totalSteps },
  ]

  return lanes.filter((lane) => lane.steps.length > 0)
}

function getLaneClass(kind: FlowLaneKind) {
  return kind === 'unit' ? 'flow-lane-unit' : 'flow-lane-total'
}

function getLaneLabel(kind: FlowLaneKind) {
  return t(`quotations.lineItems.calculationExplanation.lanes.${kind}`)
}

function getLaneIconClass(kind: FlowLaneKind) {
  return kind === 'unit' ? 'pi pi-calculator' : 'pi pi-sitemap'
}

function formatStepNumber(stepIndex: number) {
  return String(stepIndex + 1).padStart(2, '0')
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
            <div class="flow-lanes">
              <section
                v-for="lane in getStepFlowLanes(node)"
                :key="lane.kind"
                class="flow-lane"
                :class="getLaneClass(lane.kind)"
                :data-flow-lane="lane.kind"
              >
                <header class="flow-lane-header">
                  <i :class="getLaneIconClass(lane.kind)" aria-hidden="true" />
                  <span>{{ getLaneLabel(lane.kind) }}</span>
                </header>
                <ol class="flow-step-list">
                  <li
                    v-for="(step, stepIndex) in lane.steps"
                    :key="step.id"
                    class="flow-step formula-step"
                    :class="getStepToneClass(step)"
                  >
                    <span class="step-index">{{ formatStepNumber(stepIndex) }}</span>
                    <span class="step-icon" aria-hidden="true">
                      <i :class="getStepIconClass(step)" />
                    </span>
                    <span class="step-copy">
                      <span class="step-label">{{ t(step.labelKey) }}</span>
                      <span class="step-formula">{{ formatFormula(step) }}</span>
                    </span>
                    <strong class="step-result">{{ formatStepResult(step) }}</strong>
                  </li>
                </ol>
              </section>
            </div>
          </section>
        </div>
      </section>
    </div>
  </Dialog>
</template>

<style scoped>
:global(.calculation-explanation-dialog.p-dialog) {
  width: min(1180px, calc(100vw - 32px));
  height: min(780px, calc(100vh - 32px));
  resize: both;
  overflow: hidden;
  min-width: min(640px, calc(100vw - 20px));
  min-height: min(440px, calc(100vh - 20px));
  max-width: calc(100vw - 20px);
  max-height: calc(100vh - 20px);
}

:global(.calculation-explanation-dialog .p-dialog-header) {
  padding: 12px 16px;
  border-bottom: 1px solid #243244;
  background: #111827;
  color: #f8fafc;
}

:global(.calculation-explanation-dialog .p-dialog-title) {
  font-size: 14px;
  font-weight: 760;
  letter-spacing: 0;
}

:global(.calculation-explanation-dialog .p-dialog-header-icon) {
  color: #cbd5e1;
}

:global(.calculation-explanation-dialog.p-dialog-maximized) {
  resize: none;
}

:global(.calculation-explanation-dialog-content) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 0 !important;
  background: #f4f7fb;
}

.calculation-explanation {
  display: grid;
  grid-template-columns: auto 10px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  background: #f4f7fb;
}

.explanation-tree {
  min-width: 190px;
  max-width: min(520px, 52vw);
  overflow: auto;
  padding: 14px 10px;
  border-right: 1px solid #243244;
  background:
    linear-gradient(180deg, #182232 0%, #111827 100%);
  color: #e5edf6;
}

.tree-resize-handle {
  position: relative;
  width: 10px;
  min-width: 10px;
  height: 100%;
  padding: 0;
  border: 0;
  background: #f4f7fb;
  cursor: col-resize;
}

.tree-resize-handle::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 4px;
  border-left: 1px solid #cbd5e1;
}

.tree-resize-handle:hover::before,
.tree-resize-handle:focus-visible::before,
.is-resizing-tree .tree-resize-handle::before {
  border-left-color: #0f766e;
}

.tree-resize-handle:focus-visible {
  outline: 2px solid rgb(15 118 110 / 36%);
  outline-offset: 2px;
}

.explanation-tree h3,
.explanation-header h3 {
  margin: 0;
  color: inherit;
  font-size: 14px;
  font-weight: 760;
}

.explanation-tree h3 {
  color: #f8fafc;
}

.tree-list {
  display: grid;
  gap: 5px;
  margin-top: 12px;
}

.tree-node {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  width: 100%;
  min-height: 30px;
  padding: 4px 6px;
  border: 1px solid rgb(148 163 184 / 16%);
  border-radius: var(--radius-sm);
  background: rgb(255 255 255 / 4%);
  color: #dbe6f3;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.tree-node:hover {
  border-color: rgb(153 246 228 / 38%);
  background: rgb(255 255 255 / 8%);
}

.tree-node-selected {
  border-color: #5eead4;
  background: rgb(20 184 166 / 18%);
  color: #ffffff;
}

.tree-node-number {
  display: inline-grid;
  min-width: 32px;
  height: 22px;
  place-items: center;
  border-radius: var(--radius-sm);
  background: rgb(15 23 42 / 54%);
  color: #a7f3d0;
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
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
  overflow: hidden;
  padding: 14px;
}

.explanation-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 14px;
  align-items: start;
  padding: 12px;
  border: 1px solid #d7e0ea;
  border-radius: var(--radius-lg);
  background: #ffffff;
  box-shadow: 0 1px 2px rgb(15 23 42 / 5%);
}

.explanation-header h3 {
  overflow: hidden;
  color: #111827;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.method-label {
  justify-self: end;
  padding: 4px 8px;
  border: 1px solid #99f6e4;
  border-radius: var(--radius-sm);
  background: #e6fffb;
  color: #0f766e;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
}

.source-list {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  color: #475569;
  font-size: 11px;
}

.source-list span {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  min-height: 24px;
  padding: 3px 7px;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-sm);
  background: #f8fafc;
}

.source-list strong {
  color: #0f172a;
}

.totals-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(96px, 1fr));
  gap: 6px;
  margin: 0;
}

.total-metric {
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid #d7e0ea;
  border-left: 3px solid #0f766e;
  border-radius: var(--radius-sm);
  background: #ffffff;
  box-shadow: 0 1px 1px rgb(15 23 42 / 4%);
}

.total-metric dt {
  margin: 0 0 3px;
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.25;
}

.total-metric dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: #0f172a;
  font-size: 13px;
  font-weight: 760;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.formula-list {
  display: grid;
  align-content: start;
  gap: 9px;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

.formula-node {
  display: grid;
  min-width: 0;
  border: 1px solid #d7e0ea;
  border-radius: var(--radius-lg);
  background: #ffffff;
  box-shadow: 0 1px 2px rgb(15 23 42 / 5%);
}

.formula-node-header {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  padding: 8px 10px;
  border-bottom: 1px solid #e2e8f0;
  background:
    linear-gradient(90deg, #f8fafc 0%, #ffffff 100%);
  color: #0f172a;
  font-size: 13px;
}

.formula-node-header span {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: #e2e8f0;
  color: #334155;
  font-weight: 760;
}

.formula-node-header strong {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-lanes {
  display: grid;
  gap: 8px;
  padding: 8px;
  background: #f8fafc;
}

.flow-lane {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  min-width: 0;
  overflow: hidden;
  border: 1px solid #d7e0ea;
  border-radius: var(--radius-md);
  background: #ffffff;
}

.flow-lane-header {
  display: grid;
  align-content: center;
  gap: 6px;
  padding: 9px 8px;
  border-right: 1px solid #d7e0ea;
  color: #334155;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.2;
  text-transform: uppercase;
}

.flow-lane-header i {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: var(--radius-sm);
  background: rgb(255 255 255 / 70%);
  font-size: 12px;
}

.flow-lane-unit .flow-lane-header {
  background: #e6fffb;
  color: #0f766e;
}

.flow-lane-total .flow-lane-header {
  background: #eef2f7;
  color: #334155;
}

.flow-step-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  margin: 0;
  padding: 7px;
  list-style: none;
}

.formula-step {
  position: relative;
  display: grid;
  flex: 1 1 172px;
  grid-template-areas:
    "icon copy"
    "result result";
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 6px 7px;
  align-items: start;
  min-width: 160px;
  max-width: 238px;
  min-height: 0;
  padding: 7px;
  border: 1px solid #dbe4ee;
  border-left: 4px solid #94a3b8;
  border-radius: var(--radius-sm);
  background: #ffffff;
  box-shadow: 0 1px 1px rgb(15 23 42 / 4%);
}

.formula-step::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -7px;
  width: 7px;
  border-top: 1px solid #cbd5e1;
}

.formula-step:last-child::after {
  display: none;
}

.formula-step-unit {
  border-left-color: #0f766e;
  background: linear-gradient(180deg, #f0fdfa 0%, #ffffff 72%);
}

.formula-step-total {
  border-left-color: #64748b;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 72%);
}

.formula-step-summary {
  border-left-color: #b45309;
  background: linear-gradient(180deg, #fff7ed 0%, #ffffff 72%);
}

.step-index {
  position: absolute;
  top: 5px;
  right: 6px;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}

.step-icon {
  display: inline-grid;
  grid-area: icon;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: var(--radius-sm);
  background: #f1f5f9;
  color: #475569;
  font-size: 12px;
}

.formula-step-unit .step-icon {
  background: #ccfbf1;
  color: #0f766e;
}

.formula-step-summary .step-icon {
  background: #ffedd5;
  color: #b45309;
}

.step-copy {
  display: grid;
  grid-area: copy;
  gap: 3px;
  min-width: 0;
  padding-right: 22px;
}

.step-label {
  color: #111827;
  font-size: 12px;
  font-weight: 760;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.step-formula {
  color: #64748b;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.step-result {
  grid-area: result;
  justify-self: stretch;
  min-width: 0;
  padding: 4px 7px;
  border: 1px solid #d7e0ea;
  border-radius: var(--radius-sm);
  background: #f8fafc;
  color: #0f172a;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  overflow-wrap: anywhere;
  text-align: right;
}

.formula-step-unit .step-result {
  border-color: #99f6e4;
  background: #ecfeff;
  color: #0f766e;
}

.formula-step-summary .step-result {
  border-color: #fed7aa;
  background: #fff7ed;
  color: #9a3412;
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
    max-height: 210px;
    border-right: 0;
    border-bottom: 1px solid #243244;
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

  .explanation-panel {
    padding: 10px;
  }

  .explanation-header {
    grid-template-columns: 1fr;
  }

  .method-label {
    justify-self: start;
  }

  .flow-lane {
    grid-template-columns: 1fr;
  }

  .flow-lane-header {
    display: flex;
    align-items: center;
    border-right: 0;
    border-bottom: 1px solid #d7e0ea;
  }

  .flow-step-list {
    display: grid;
    grid-template-columns: 1fr;
  }

  .formula-step {
    max-width: none;
  }

  .formula-step::after {
    display: none;
  }

  .step-result {
    justify-self: stretch;
  }
}
</style>
