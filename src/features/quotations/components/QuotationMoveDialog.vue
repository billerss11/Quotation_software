<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import { computed, shallowRef, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationRootItem } from '../types'
import { getQuotationTreeMoveError, isQuotationItem } from '../utils/quotationItems'

type DropMode = 'before' | 'inside' | 'after'
interface Destination {
  id: string
  label: string
  item: QuotationRootItem | null
  parentId: string | null
  index: number
}

const props = defineProps<{ items: QuotationRootItem[]; itemId: string }>()
const emit = defineEmits<{
  close: []
  move: [itemId: string, parentId: string | null, index: number, mode: DropMode]
}>()
const { t } = useI18n()
const id = useId()
const destinationId = shallowRef('root-start')
const position = shallowRef<DropMode>('before')
const destinations = computed<Destination[]>(() => {
  const rows: Destination[] = []
  function collect(items: QuotationRootItem[], parentId: string | null, prefix = '') {
    let itemNumber = 0
    items.forEach((item, index) => {
      const isItem = isQuotationItem(item)
      if (isItem) itemNumber += 1
      const number = isItem ? `${prefix}${itemNumber}` : ''
      const label = isItem ? item.name || t('quotations.lineItems.navigator.unnamed') : item.title || t('quotations.lineItems.sectionHeaderLabel')
      rows.push({ id: `item:${item.id}`, label: `${number ? `${number} ` : ''}${label}`, item, parentId, index })
      if (isItem) collect(item.children, item.id, `${number}.`)
    })
  }
  collect(props.items, null)
  return [
    { id: 'root-start', label: t('quotations.lineItems.navigator.moveRootStart'), item: null, parentId: null, index: 0 },
    ...rows,
    { id: 'root-end', label: t('quotations.lineItems.navigator.moveRootEnd'), item: null, parentId: null, index: props.items.length },
  ]
})
const sourceLabel = computed(() => {
  const source = destinations.value.find((entry) => entry.item?.id === props.itemId)?.item
  return source && isQuotationItem(source) ? source.name || t('quotations.lineItems.navigator.unnamed') : source?.title || t('quotations.lineItems.sectionHeaderLabel')
})
const destination = computed(() => destinations.value.find((entry) => entry.id === destinationId.value))
const positionOptions = computed(() => [
  { value: 'before', label: t('quotations.lineItems.navigator.moveBefore') },
  { value: 'inside', label: t('quotations.lineItems.navigator.moveInside'), disabled: !isQuotationItem(destination.value?.item) },
  { value: 'after', label: t('quotations.lineItems.navigator.moveAfter') },
])
const candidate = computed(() => {
  const target = destination.value
  if (!target) return null
  if (!target.item) return { parentId: null, index: target.index, mode: 'before' as const }
  if (position.value === 'inside' && isQuotationItem(target.item)) {
    return { parentId: target.item.id, index: target.item.children.length, mode: position.value }
  }
  if (position.value === 'inside') return null
  return { parentId: target.parentId, index: target.index + (position.value === 'after' ? 1 : 0), mode: position.value }
})
const moveError = computed(() => {
  const target = candidate.value
  return target ? getQuotationTreeMoveError(props.items, props.itemId, target.parentId, target.index) : 'invalid_index'
})

function submitMove() {
  const target = candidate.value
  if (!target || moveError.value) return
  emit('move', props.itemId, target.parentId, target.index, target.mode)
}
</script>

<template>
  <Dialog
    :visible="true"
    modal
    :header="t('quotations.lineItems.navigator.moveDialogTitle', { label: sourceLabel })"
    :style="{ width: 'min(440px, calc(100vw - 32px))' }"
    :close-button-props="{ 'aria-label': t('quotations.lineItems.navigator.moveCancel') }"
    @update:visible="!$event && emit('close')"
  >
    <form class="quotation-move-form" @submit.prevent="submitMove">
      <label :for="`${id}-destination`">{{ t('quotations.lineItems.navigator.moveDestination') }}</label>
      <Select
        v-model="destinationId"
        :input-id="`${id}-destination`"
        :options="destinations"
        option-label="label"
        option-value="id"
        :aria-label="t('quotations.lineItems.navigator.moveDestination')"
        data-move-destination
      />
      <template v-if="destination?.item">
        <label :for="`${id}-position`">{{ t('quotations.lineItems.navigator.movePosition') }}</label>
        <Select
          v-model="position"
          :input-id="`${id}-position`"
          :options="positionOptions"
          option-label="label"
          option-value="value"
          option-disabled="disabled"
          :aria-label="t('quotations.lineItems.navigator.movePosition')"
          data-move-position
        />
      </template>
      <p v-if="moveError" class="quotation-move-error" role="status">{{ t(`quotations.lineItems.navigator.moveErrors.${moveError}`) }}</p>
      <div class="quotation-move-actions">
        <Button type="button" severity="secondary" text :label="t('quotations.lineItems.navigator.moveCancel')" @click="emit('close')" />
        <Button type="submit" :label="t('quotations.lineItems.navigator.moveConfirm')" :disabled="Boolean(moveError)" data-move-confirm />
      </div>
    </form>
  </Dialog>
</template>

<style scoped>
.quotation-move-form {
  display: grid;
  gap: 8px;
}

.quotation-move-form label {
  font-size: 13px;
  font-weight: 600;
}

.quotation-move-error {
  margin: 4px 0;
  color: var(--text-muted);
  font-size: 12px;
}

.quotation-move-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
</style>
