<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatCurrency } from '@/shared/utils/formatters'
import type { QuotationInformationalTotal, QuotationOutputSettings } from '../types'
import { useBufferedFieldValues } from '../composables/useBufferedFieldValues'
import { getQuotationSubtotalLabel, resolveQuotationInformationalTotals, type QuotationSummaryItem, type QuotationSummarySection } from '../utils/quotationSummaryDisplay'

const props = defineProps<{
  settings?: QuotationOutputSettings
  sections: QuotationSummarySection[]
  items: QuotationSummaryItem[]
  currency: string
  documentLocale: SupportedLocale
}>()
const emit = defineEmits<{
  updateSettings: [patch: Partial<QuotationOutputSettings>]
  updateRow: [id: string, patch: Partial<QuotationInformationalTotal>]
  addRow: [row: QuotationInformationalTotal]
  removeRow: [id: string]
}>()
const { t, locale } = useI18n()
const defaultSubtotalLabel = computed(() => t('quotations.document.subtotal', {}, { locale: props.documentLocale }))
const defaultInformationalNote = computed(() => t('quotations.summaryDisplay.documentNote', {
  subtotalLabel: getQuotationSubtotalLabel(props.settings, defaultSubtotalLabel.value),
}, { locale: props.documentLocale }))
const rows = computed(() => resolveQuotationInformationalTotals(props.settings, props.sections, props.items))
const sourceOptions = computed(() => [
  { value: 'sections', label: t('quotations.summaryDisplay.selectedSections') },
  { value: 'items', label: t('quotations.summaryDisplay.selectedItems') },
])
const sectionOptions = computed(() => {
  const options = props.sections.map(section => ({
    id: section.id,
    label: t('quotations.summaryDisplay.sectionOption', {
      title: section.title || t('quotations.summaryDisplay.untitledSection'),
      count: section.itemCount,
    }),
  }))
  const missingIds = new Set(rows.value.flatMap(row => row.missingSectionIds))
  for (const id of missingIds) {
    options.push({ id, label: t('quotations.summaryDisplay.removedSection', { id }) })
  }
  return options
})
const itemOptions = computed(() => {
  const options = props.items.map(item => ({
    id: item.id,
    label: `${item.itemNumber} ${item.name || t('quotations.summaryDisplay.untitledItem')}`,
    description: item.description,
    depth: item.depth,
  }))
  const missingIds = new Set(rows.value.flatMap(row => row.missingItemIds))
  for (const id of missingIds) {
    options.push({ id, label: t('quotations.summaryDisplay.removedItem', { id }), description: '', depth: 0 })
  }
  return options
})
const { getBufferedValue, queueBufferedValue, flushBufferedValue } = useBufferedFieldValues((key, value) => {
  if (key === 'subtotalLabel') emit('updateSettings', { subtotalLabel: String(value ?? '') })
  else if (key === 'informationalTotalsNote') emit('updateSettings', { informationalTotalsNote: String(value ?? '') })
  else emit('updateRow', key.slice('row:'.length), { label: String(value ?? '') })
})

function addRow() {
  const usedSectionIds = new Set(rows.value.flatMap(row => row.sectionIds))
  const section = props.sections.find(entry => !usedSectionIds.has(entry.id)) ?? props.sections[0]
  emit('addRow', {
    id: crypto.randomUUID(),
    label: '',
    source: section ? 'sections' : 'items',
    sectionIds: section ? [section.id] : [],
    itemIds: [],
    visible: true,
  })
}
</script>

<template>
  <section class="summary-settings" data-history-target="quotation:summaryDisplay" :aria-label="t('quotations.summaryDisplay.title')">
    <h2 class="section-title">{{ t('quotations.summaryDisplay.title') }}</h2>
    <label class="field">
      <span>{{ t('quotations.summaryDisplay.subtotalLabel') }}</span>
      <InputText
        :model-value="getBufferedValue('subtotalLabel', settings?.subtotalLabel ?? '')"
        :placeholder="defaultSubtotalLabel"
        @update:model-value="queueBufferedValue('subtotalLabel', $event)"
        @blur="flushBufferedValue('subtotalLabel')"
      />
    </label>
    <p class="help">{{ t('quotations.summaryDisplay.labelHelp') }}</p>
    <label class="toggle">
      <Checkbox
        binary
        :model-value="settings?.showInformationalTotals === true"
        @update:model-value="emit('updateSettings', { showInformationalTotals: $event === true })"
      />
      <span>{{ t('quotations.summaryDisplay.showBreakdown') }}</span>
    </label>
    <div v-if="settings?.showInformationalTotals" class="breakdown-settings">
      <label class="field">
        <span>{{ t('quotations.summaryDisplay.noteLabel') }}</span>
        <Textarea
          :model-value="getBufferedValue('informationalTotalsNote', settings?.informationalTotalsNote ?? defaultInformationalNote)"
          :aria-label="t('quotations.summaryDisplay.noteLabel')"
          rows="2"
          auto-resize
          @update:model-value="queueBufferedValue('informationalTotalsNote', $event)"
          @blur="flushBufferedValue('informationalTotalsNote')"
        />
      </label>
      <p class="help">{{ t('quotations.summaryDisplay.noteHelp') }}</p>
      <p class="help">{{ t('quotations.summaryDisplay.basisHelp') }}</p>
      <p v-if="!sections.length && !items.length" class="help">{{ t('quotations.summaryDisplay.noSources') }}</p>
      <div v-for="row in rows" :key="row.id" class="breakdown-row" :data-summary-row="row.id">
        <div class="row-actions">
          <label class="toggle">
            <Checkbox binary :model-value="row.visible" @update:model-value="emit('updateRow', row.id, { visible: $event === true })" />
            <span>{{ t('quotations.summaryDisplay.showRow') }}</span>
          </label>
          <Button
            icon="pi pi-trash"
            text
            size="small"
            severity="secondary"
            :aria-label="t('quotations.summaryDisplay.removeRow', { label: row.label || t('quotations.summaryDisplay.untitled') })"
            @click="emit('removeRow', row.id)"
          />
        </div>
        <label class="field">
          <span>{{ t('quotations.summaryDisplay.rowLabel') }}</span>
          <InputText
            :model-value="getBufferedValue(`row:${row.id}`, settings?.informationalTotals?.find(entry => entry.id === row.id)?.label ?? '')"
            :placeholder="row.label || t('quotations.summaryDisplay.untitled')"
            @update:model-value="queueBufferedValue(`row:${row.id}`, $event)"
            @blur="flushBufferedValue(`row:${row.id}`)"
          />
        </label>
        <label class="field">
          <span>{{ t('quotations.summaryDisplay.source') }}</span>
          <Select
            :model-value="row.source ?? 'sections'"
            :options="sourceOptions"
            option-label="label"
            option-value="value"
            :aria-label="t('quotations.summaryDisplay.source')"
            @update:model-value="emit('updateRow', row.id, { source: $event })"
          />
        </label>
        <template v-if="row.source === 'items'">
          <label class="field">
            <span>{{ t('quotations.summaryDisplay.items') }}</span>
            <MultiSelect
              :model-value="row.itemIds ?? []"
              :options="itemOptions"
              option-label="label"
              option-value="id"
              display="chip"
              filter
              :filter-fields="['label', 'description']"
              :placeholder="t('quotations.summaryDisplay.selectItems')"
              :aria-label="t('quotations.summaryDisplay.items')"
              @update:model-value="emit('updateRow', row.id, { itemIds: $event })"
            >
              <template #option="{ option }">
                <div class="item-option" :style="{ paddingInlineStart: `${Math.max(0, option.depth - 1) * 8}px` }">
                  <span>{{ option.label }}</span>
                  <small v-if="option.description">{{ option.description }}</small>
                </div>
              </template>
            </MultiSelect>
          </label>
          <p class="help">{{ t('quotations.summaryDisplay.itemsHelp') }}</p>
          <p v-if="row.missingItemIds.length" class="selection-warning" role="status">{{ t('quotations.summaryDisplay.missingItem') }}</p>
          <p v-else-if="!row.itemIds?.length" class="selection-warning" role="status">{{ t('quotations.summaryDisplay.selectItems') }}</p>
        </template>
        <template v-else>
          <label class="field">
            <span>{{ t('quotations.summaryDisplay.sections') }}</span>
            <MultiSelect
              :model-value="row.sectionIds"
              :options="sectionOptions"
              option-label="label"
              option-value="id"
              display="chip"
              filter
              :placeholder="t('quotations.summaryDisplay.selectSections')"
              :aria-label="t('quotations.summaryDisplay.sections')"
              @update:model-value="emit('updateRow', row.id, { sectionIds: $event })"
            />
          </label>
          <p v-if="!sections.length" class="help">{{ t('quotations.summaryDisplay.noSections') }}</p>
          <p v-if="row.missingSectionIds.length" class="selection-warning" role="status">{{ t('quotations.summaryDisplay.missingSection') }}</p>
          <p v-else-if="!row.sectionIds.length" class="selection-warning" role="status">{{ t('quotations.summaryDisplay.selectSections') }}</p>
        </template>
        <div class="calculated-amount">
          <span>{{ t('quotations.summaryDisplay.amount') }}</span>
          <strong>{{ row.amount === null ? t('common.emptyValue') : formatCurrency(row.amount, currency, locale as SupportedLocale) }}</strong>
        </div>
      </div>
      <Button
        :label="t('quotations.summaryDisplay.addRow')"
        icon="pi pi-plus"
        outlined
        size="small"
        :disabled="!sections.length && !items.length"
        @click="addRow"
      />
    </div>
  </section>
</template>

<style scoped>
.summary-settings, .breakdown-settings, .breakdown-row { display: grid; gap: 8px; min-width: 0; }
.summary-settings { padding-top: 12px; border-top: 1px solid var(--surface-border); }
.section-title { margin: 0; color: var(--text-muted); font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.field { display: grid; gap: 4px; min-width: 0; color: var(--text-body); font-size: 11px; font-weight: 700; }
.field :deep(.p-inputtext), .field :deep(.p-multiselect), .field :deep(.p-select), .field :deep(.p-textarea) { width: 100%; min-width: 0; font-weight: 400; }
.field :deep(.p-textarea) { resize: vertical; }
.field :deep(.p-multiselect-label) { flex-wrap: wrap; }
.item-option { display: grid; gap: 3px; min-width: 0; max-width: 30rem; white-space: normal; overflow-wrap: anywhere; }
.item-option small { color: var(--text-muted); }
.help { margin: 0; color: var(--text-muted); font-size: 11px; line-height: 1.5; }
.toggle { display: flex; align-items: center; gap: 8px; color: var(--text-body); font-size: 12px; }
.breakdown-row { padding: 10px; border: 1px solid var(--surface-border); border-radius: 6px; }
.row-actions, .calculated-amount { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.calculated-amount { flex-wrap: wrap; color: var(--text-body); font-size: 12px; }
.calculated-amount strong { overflow-wrap: anywhere; }
.selection-warning { margin: 0; color: var(--p-orange-700, #9a3412); font-size: 11px; }
</style>
