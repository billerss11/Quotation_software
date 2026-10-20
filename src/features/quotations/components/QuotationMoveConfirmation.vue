<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useI18n } from 'vue-i18n'
import { formatCurrency } from '@/shared/utils/formatters'
import type { SupportedLocale } from '@/shared/i18n/locale'
import type { QuotationTreeMoveImpact } from '../utils/quotationMoveImpact'

defineProps<{ impact: QuotationTreeMoveImpact | null; currency: string; disabled: boolean }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const { t, locale } = useI18n()
const key = 'quotations.lineItems.navigator'
</script>

<template>
  <Dialog
    :visible="impact !== null"
    modal
    :header="t(`${key}.priceConfirmationTitle`)"
    :close-button-props="{ 'aria-label': t(`${key}.moveCancel`) }"
    :style="{ width: '30rem', maxWidth: 'calc(100vw - 2rem)' }"
    @update:visible="visible => { if (!visible) emit('cancel') }"
  >
    <div v-if="impact" class="move-price-impact">
      <p>{{ t(`${key}.priceConfirmationIntro`) }}</p>
      <p v-if="impact.hiddenPriceItemName !== null">
        {{ t(`${key}.priceHidden`, { label: impact.hiddenPriceItemName || t(`${key}.unnamed`) }) }}
      </p>
      <p v-if="impact.reactivatedPriceItemName !== null">
        {{ t(`${key}.priceReactivated`, { label: impact.reactivatedPriceItemName || t(`${key}.unnamed`) }) }}
      </p>
      <p v-if="impact.hiddenPriceItemName === null && impact.reactivatedPriceItemName === null">
        {{ t(`${key}.priceInherited`) }}
      </p>
      <dl class="move-price-totals">
        <div><dt>{{ t(`${key}.totalBefore`) }}</dt><dd>{{ formatCurrency(impact.beforeTotal, currency, locale as SupportedLocale) }}</dd></div>
        <div><dt>{{ t(`${key}.totalAfter`) }}</dt><dd>{{ formatCurrency(impact.afterTotal, currency, locale as SupportedLocale) }}</dd></div>
      </dl>
    </div>
    <template #footer>
      <Button severity="secondary" :label="t(`${key}.moveCancel`)" autofocus @click="emit('cancel')" />
      <Button :label="t(`${key}.moveConfirm`)" :disabled="disabled" @click="emit('confirm')" />
    </template>
  </Dialog>
</template>

<style scoped>
.move-price-impact p { margin: 0 0 1rem; }
.move-price-totals { margin: 1.25rem 0 0; }
.move-price-totals > div { display: flex; justify-content: space-between; gap: 1rem; padding: 0.5rem 0; }
.move-price-totals dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
