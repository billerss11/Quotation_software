<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency } from '@/shared/utils/formatters'

import LineItemCard from './LineItemCard.vue'

import type {
  CurrencyCode,
  ExchangeRateTable,
  QuotationItem,
  QuotationItemField,
  TotalsConfig,
} from '../types'

const props = defineProps<{
  items: QuotationItem[]
  currency: CurrencyCode
  grandTotal: number
  globalMarkupRate: number
  totalsConfig: TotalsConfig
  exchangeRates: ExchangeRateTable
  costCurrencyOptions: string[]
  quotationCurrencyOptions: string[]
  focusedItemId?: string
}>()

const emit = defineEmits<{
  addRootItem: []
  addChildItem: [parentItemId: string]
  removeItem: [itemId: string]
  duplicateRootItem: [itemId: string]
  moveRootItem: [itemId: string, direction: -1 | 1]
  updateQuotationCurrency: [currency: CurrencyCode]
  updateItemField: [itemId: string, field: QuotationItemField, value: QuotationItem[QuotationItemField]]
}>()

const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
const collapsedRootIds = shallowRef(new Set<string>())

watch(
  () => props.focusedItemId,
  (focusedItemId) => {
    if (!focusedItemId || !collapsedRootIds.value.has(focusedItemId)) {
      return
    }

    const next = new Set(collapsedRootIds.value)
    next.delete(focusedItemId)
    collapsedRootIds.value = next
  },
)

const allCollapsed = computed(
  () => props.items.length > 0 && props.items.every((item) => collapsedRootIds.value.has(item.id)),
)

function setQuotationCurrency(value: unknown) {
  emit('updateQuotationCurrency', value as CurrencyCode)
}

function isRootCardExpanded(itemId: string) {
  return !collapsedRootIds.value.has(itemId)
}

function toggleRootCard(itemId: string) {
  const next = new Set(collapsedRootIds.value)
  if (next.has(itemId)) next.delete(itemId)
  else next.add(itemId)
  collapsedRootIds.value = next
}

function collapseAll() {
  collapsedRootIds.value = new Set(props.items.map((item) => item.id))
}

function expandAll() {
  collapsedRootIds.value = new Set()
}
</script>

<template>
  <section class="workbench" :aria-label="t('quotations.lineItems.aria')">
    <div class="workbench-heading">
      <div class="heading-copy">
        <h2 class="heading-title">{{ t('quotations.lineItems.title') }}</h2>
        <p class="heading-sub">{{ t('quotations.lineItems.subtitle') }}</p>
      </div>
      <div class="heading-tools">
        <div class="heading-summary">
          <label class="heading-currency">
            <span>{{ t('quotations.commandBar.customerCurrency') }}</span>
            <Select
              :model-value="currency"
              :options="props.quotationCurrencyOptions"
              :aria-label="t('quotations.commandBar.customerCurrencyAria')"
              @update:model-value="setQuotationCurrency"
            />
          </label>
          <div class="heading-total">
            <span>{{ t('quotations.commandBar.total') }}</span>
            <strong>{{ formatCurrency(props.grandTotal, props.currency, currentLocale) }}</strong>
          </div>
        </div>

        <div class="heading-buttons">
          <Button
            v-if="props.items.length > 0"
            :icon="allCollapsed ? 'pi pi-expand' : 'pi pi-compress'"
            :label="allCollapsed ? t('quotations.lineItems.expandAll') : t('quotations.lineItems.collapseAll')"
            severity="secondary"
            rounded
            @click="allCollapsed ? expandAll() : collapseAll()"
          />
          <Button
            icon="pi pi-plus"
            :label="t('quotations.lineItems.addItem')"
            rounded
            :aria-label="t('quotations.lineItems.addRootAria')"
            @click="emit('addRootItem')"
          />
        </div>
      </div>
    </div>

    <div class="items-list">
      <LineItemCard
        v-for="(item, itemIndex) in props.items"
        :key="item.id"
        :item="item"
        :item-index="itemIndex"
        :total-items="props.items.length"
        :currency="props.currency"
        :global-markup-rate="props.globalMarkupRate"
        :totals-config="props.totalsConfig"
        :exchange-rates="props.exchangeRates"
        :cost-currency-options="props.costCurrencyOptions"
        :focused="props.focusedItemId === item.id"
        :expanded="isRootCardExpanded(item.id)"
        @toggle-expanded="toggleRootCard"
        @add-child-item="emit('addChildItem', $event)"
        @remove-item="emit('removeItem', $event)"
        @duplicate-root-item="emit('duplicateRootItem', $event)"
        @move-root-item="(itemId, direction) => emit('moveRootItem', itemId, direction)"
        @update-item-field="(itemId, field, value) => emit('updateItemField', itemId, field, value)"
      />
    </div>
  </section>
</template>

<style scoped>
.workbench {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.workbench-heading {
  position: sticky;
  top: 0;
  z-index: 8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 0 0 6px;
  background: var(--app-bg);
  border-bottom: 1px solid var(--surface-border);
}

.workbench-heading :deep(.p-button) {
  flex: 0 0 auto;
}

.heading-copy {
  min-width: 0;
}

.heading-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.heading-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
}

.heading-currency,
.heading-total {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: rgb(255 255 255 / 72%);
}

.heading-currency span,
.heading-total span {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.heading-currency :deep(.p-select) {
  min-width: 108px;
  min-height: 28px;
}

.heading-currency :deep(.p-select-label) {
  padding: 0.3rem 0.55rem;
  font-size: 12px;
}

.heading-total {
  min-width: 102px;
  align-content: center;
}

.heading-total strong {
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
}

.heading-buttons {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

.heading-buttons :deep(.p-button) {
  min-height: 32px;
  font-size: 0.9rem;
  padding-inline: 0.72rem;
  padding-block: 0.3rem;
}

.heading-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
  line-height: 1.1;
}

.heading-sub {
  margin: 1px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.2;
}

.items-list {
  display: grid;
  gap: 12px;
}

@media (max-width: 1320px) {
  .heading-tools {
    width: 100%;
    justify-content: space-between;
  }

  .heading-summary {
    justify-content: flex-start;
  }
}

@media (max-width: 900px) {
  .heading-tools,
  .heading-summary,
  .heading-buttons {
    width: 100%;
    justify-content: flex-start;
  }

  .heading-currency,
  .heading-total {
    flex: 1 1 180px;
  }
}
</style>
