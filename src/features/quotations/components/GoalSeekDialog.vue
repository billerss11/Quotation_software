<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency, formatPercent } from '@/shared/utils/formatters'

import type { CurrencyCode, ExchangeRateTable, QuotationRootItem } from '../types'
import {
  collectItemGoalSeekCandidates,
  solveItemGoalSeekMarkup,
  solveQuotationGoalSeekGlobalMarkup,
  type ItemGoalSeekResult,
  type QuotationGoalSeekResult,
} from '../utils/quotationGoalSeek'

export interface GoalSeekItemUpdate {
  itemId: string
  markupRate: number
}

const visible = defineModel<boolean>('visible', { default: false })
const props = defineProps<{
  mode: 'items' | 'quotation'
  items: QuotationRootItem[]
  currency: CurrencyCode
  exchangeRates: ExchangeRateTable
  globalMarkupRate: number
  currentSubtotalBeforeTax: number
  initialItemId?: string | null
}>()
const emit = defineEmits<{
  applyItems: [updates: GoalSeekItemUpdate[]]
  applyQuotation: [markupRate: number]
}>()

const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
const selectedItemIds = shallowRef(new Set<string>())
const itemTargets = shallowRef<Record<string, number | null>>({})
const quotationTarget = shallowRef<number | null>(null)

const itemCandidates = computed(() =>
  collectItemGoalSeekCandidates(props.items, props.exchangeRates, props.globalMarkupRate),
)
const itemRows = computed(() =>
  itemCandidates.value.map((candidate) => {
    const selected = selectedItemIds.value.has(candidate.item.id)
    const target = itemTargets.value[candidate.item.id] ?? null
    const result = selected && typeof target === 'number'
      ? solveItemGoalSeekMarkup(candidate.item, target, props.exchangeRates)
      : null

    return {
      ...candidate,
      selected,
      target,
      result,
    }
  }),
)
const selectedItemRows = computed(() => itemRows.value.filter((row) => row.selected))
const quotationResult = computed<QuotationGoalSeekResult | null>(() =>
  typeof quotationTarget.value === 'number'
    ? solveQuotationGoalSeekGlobalMarkup(props.items, quotationTarget.value, props.exchangeRates)
    : null,
)
const dialogHeader = computed(() =>
  props.mode === 'quotation'
    ? t('quotations.goalSeek.quotationTitle')
    : t('quotations.goalSeek.itemTitle'),
)
const canApplyItems = computed(() =>
  selectedItemRows.value.length > 0
  && selectedItemRows.value.every((row) => row.result?.ok === true),
)
const canApplyQuotation = computed(() => quotationResult.value?.ok === true)
const allItemsSelected = computed(() =>
  itemRows.value.length > 0
  && itemRows.value.every((row) => row.selected),
)
const hasSelectedItems = computed(() => selectedItemRows.value.length > 0)

watch(
  visible,
  (nextVisible) => {
    if (nextVisible) {
      resetState()
    }
  },
)

function resetState() {
  quotationTarget.value = null
  itemTargets.value = Object.fromEntries(itemCandidates.value.map((candidate) => [candidate.item.id, null]))

  const initialItemId = props.initialItemId
  selectedItemIds.value = initialItemId && itemCandidates.value.some((candidate) => candidate.item.id === initialItemId)
    ? new Set([initialItemId])
    : new Set()
}

function isItemSelected(itemId: string) {
  return selectedItemIds.value.has(itemId)
}

function setItemSelected(itemId: string, selected: unknown) {
  const next = new Set(selectedItemIds.value)

  if (selected === true) {
    next.add(itemId)
  } else {
    next.delete(itemId)
  }

  selectedItemIds.value = next
}

function selectAllItems() {
  selectedItemIds.value = new Set(itemCandidates.value.map((candidate) => candidate.item.id))
}

function unselectAllItems() {
  selectedItemIds.value = new Set()
}

function setItemTarget(itemId: string, value: unknown) {
  itemTargets.value = {
    ...itemTargets.value,
    [itemId]: typeof value === 'number' && Number.isFinite(value) ? value : null,
  }
}

function applyItems() {
  if (!canApplyItems.value) {
    return
  }

  emit('applyItems', selectedItemRows.value.flatMap((row) =>
    row.result?.ok
      ? [{ itemId: row.item.id, markupRate: row.result.markupRate }]
      : [],
  ))
  visible.value = false
}

function applyQuotation() {
  const result = quotationResult.value

  if (!result?.ok) {
    return
  }

  emit('applyQuotation', result.markupRate)
  visible.value = false
}

function formatMoney(amount: number) {
  return formatCurrency(amount, props.currency, currentLocale.value)
}

function formatMarkupRate(rate: number) {
  return formatPercent(rate, currentLocale.value)
}

function getItemRowMessage(row: (typeof itemRows.value)[number]) {
  if (!row.selected) {
    return t('quotations.goalSeek.rowNotSelected')
  }

  if (typeof row.target !== 'number') {
    return t('quotations.goalSeek.enterTarget')
  }

  return formatItemResultMessage(row.result)
}

function formatItemResultMessage(result: ItemGoalSeekResult | null) {
  if (!result) {
    return t('quotations.goalSeek.enterTarget')
  }

  if (result.ok) {
    return t('quotations.goalSeek.previewMarkup', {
      rate: formatMarkupRate(result.markupRate),
      amount: formatMoney(result.projectedUnitPrice),
    })
  }

  if (result.reason === 'invalid_unit_cost') {
    return t('quotations.goalSeek.errors.invalidUnitCost')
  }

  if (result.reason === 'target_below_minimum') {
    return t('quotations.goalSeek.errors.itemBelowCost', {
      amount: formatMoney(result.minimumTarget ?? 0),
    })
  }

  if (result.reason === 'target_above_maximum') {
    return t('quotations.goalSeek.errors.itemAboveMax', {
      amount: formatMoney(result.maximumTarget ?? 0),
    })
  }

  return t('quotations.goalSeek.errors.ineligibleItem')
}

function formatQuotationResultMessage(result: QuotationGoalSeekResult | null) {
  if (!result) {
    return t('quotations.goalSeek.enterTarget')
  }

  if (result.ok) {
    return t('quotations.goalSeek.previewGlobalMarkup', {
      rate: formatMarkupRate(result.markupRate),
      amount: formatMoney(result.projectedSubtotal),
    })
  }

  if (result.reason === 'no_adjustable_items') {
    return t('quotations.goalSeek.errors.noGlobalItems')
  }

  if (result.reason === 'target_below_minimum') {
    return t('quotations.goalSeek.errors.quotationBelowMinimum', {
      amount: formatMoney(result.minimumSubtotal ?? 0),
    })
  }

  return t('quotations.goalSeek.errors.quotationAboveMax', {
    amount: formatMoney(result.maximumSubtotal ?? 0),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="dialogHeader"
    :style="{ width: props.mode === 'quotation' ? '440px' : '760px' }"
  >
    <section v-if="props.mode === 'quotation'" class="goal-seek-section">
      <div class="goal-seek-current">
        <span>{{ t('quotations.goalSeek.currentSubtotal') }}</span>
        <strong>{{ formatMoney(props.currentSubtotalBeforeTax) }}</strong>
      </div>

      <label class="goal-seek-field">
        <span>{{ t('quotations.goalSeek.targetSubtotal') }}</span>
        <InputNumber
          v-model="quotationTarget"
          mode="currency"
          :currency="props.currency"
          :locale="currentLocale"
          :min="0"
          :max-fraction-digits="2"
        />
      </label>

      <p class="goal-seek-message" :class="{ 'goal-seek-message-error': quotationResult && !quotationResult.ok }">
        {{ formatQuotationResultMessage(quotationResult) }}
      </p>

      <div class="goal-seek-actions">
        <Button severity="secondary" :label="t('quotations.goalSeek.cancel')" @click="visible = false" />
        <Button :label="t('quotations.goalSeek.apply')" :disabled="!canApplyQuotation" @click="applyQuotation" />
      </div>
    </section>

    <section v-else class="goal-seek-section">
      <p class="goal-seek-note">
        {{ t('quotations.goalSeek.itemOverrideNote') }}
      </p>

      <div v-if="itemRows.length > 0" class="goal-seek-table-wrap">
        <div class="goal-seek-selection-actions">
          <Button
            size="small"
            severity="secondary"
            outlined
            :label="t('quotations.goalSeek.selectAll')"
            :disabled="allItemsSelected"
            @click="selectAllItems"
          />
          <Button
            size="small"
            severity="secondary"
            outlined
            :label="t('quotations.goalSeek.unselectAll')"
            :disabled="!hasSelectedItems"
            @click="unselectAllItems"
          />
        </div>
        <table class="goal-seek-table">
          <thead>
            <tr>
              <th scope="col">{{ t('quotations.goalSeek.select') }}</th>
              <th scope="col">{{ t('quotations.goalSeek.item') }}</th>
              <th scope="col">{{ t('quotations.goalSeek.currentUnitPrice') }}</th>
              <th scope="col">{{ t('quotations.goalSeek.targetUnitPrice') }}</th>
              <th scope="col">{{ t('quotations.goalSeek.preview') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in itemRows" :key="row.item.id">
              <td>
                <Checkbox
                  binary
                  :model-value="isItemSelected(row.item.id)"
                  :aria-label="t('quotations.goalSeek.selectItemAria', { itemNumber: row.itemNumber })"
                  @update:model-value="setItemSelected(row.item.id, $event)"
                />
              </td>
              <td>
                <strong>{{ row.itemNumber }}</strong>
                <span>{{ row.item.name.trim() || t('quotations.lineItems.navigator.unnamed') }}</span>
              </td>
              <td>{{ formatMoney(row.currentUnitPrice) }}</td>
              <td>
                <InputNumber
                  :model-value="row.target"
                  mode="currency"
                  :currency="props.currency"
                  :locale="currentLocale"
                  :min="0"
                  :max-fraction-digits="2"
                  :disabled="!row.selected"
                  @update:model-value="setItemTarget(row.item.id, $event)"
                />
              </td>
              <td>
                <span :class="{ 'goal-seek-message-error': row.result && !row.result.ok }">
                  {{ getItemRowMessage(row) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="goal-seek-message goal-seek-message-error">
        {{ t('quotations.goalSeek.errors.noEligibleItems') }}
      </p>

      <div class="goal-seek-actions">
        <Button severity="secondary" :label="t('quotations.goalSeek.cancel')" @click="visible = false" />
        <Button :label="t('quotations.goalSeek.apply')" :disabled="!canApplyItems" @click="applyItems" />
      </div>
    </section>
  </Dialog>
</template>

<style scoped>
.goal-seek-section {
  display: grid;
  gap: 12px;
}

.goal-seek-current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.goal-seek-current span,
.goal-seek-field > span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 750;
  text-transform: uppercase;
}

.goal-seek-field {
  display: grid;
  gap: 5px;
}

.goal-seek-field :deep(.p-inputnumber),
.goal-seek-field :deep(.p-inputnumber-input) {
  width: 100%;
}

.goal-seek-note,
.goal-seek-message {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.goal-seek-message-error {
  color: var(--danger);
}

.goal-seek-table-wrap {
  overflow: auto;
  max-height: min(52vh, 440px);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
}

.goal-seek-selection-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-card);
}

.goal-seek-table {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
  font-size: 12px;
}

.goal-seek-table th,
.goal-seek-table td {
  padding: 8px;
  border-bottom: 1px solid var(--surface-border);
  text-align: left;
  vertical-align: top;
}

.goal-seek-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface-card);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}

.goal-seek-table td:first-child {
  width: 46px;
}

.goal-seek-table td:nth-child(2) {
  display: grid;
  gap: 2px;
  min-width: 160px;
}

.goal-seek-table td:nth-child(4) {
  width: 168px;
}

.goal-seek-table :deep(.p-inputnumber),
.goal-seek-table :deep(.p-inputnumber-input) {
  width: 100%;
}

.goal-seek-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
