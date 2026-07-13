<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuotationDraft } from '@/features/quotations/types'

import GoodsReceiptDetailsForm from './GoodsReceiptDetailsForm.vue'
import GoodsReceiptItemsEditor from './GoodsReceiptItemsEditor.vue'
import GoodsReceiptPreview from './GoodsReceiptPreview.vue'
import type { GoodsReceiptDraft, GoodsReceiptTemplateId } from '../utils/goodsReceipt'
import {
  createGoodsReceiptDraft,
  createGoodsReceiptNumber,
  normalizeGoodsReceiptTemplateId,
  validateGoodsReceiptDraft,
} from '../utils/goodsReceipt'

const GOODS_RECEIPT_TEMPLATE_STORAGE_KEY = 'quotation-software:goods-receipt-template'

const visible = defineModel<boolean>('visible', { default: false })
const props = defineProps<{
  quotation: QuotationDraft
  supportsDirectPdfExport: boolean
}>()
const emit = defineEmits<{
  exportPdf: [draft: GoodsReceiptDraft]
}>()
const { t } = useI18n()
const draft = ref<GoodsReceiptDraft | null>(null)
const grNumberUserEdited = shallowRef(false)

const templateOptions = computed<{ label: string; value: GoodsReceiptTemplateId }[]>(() => [
  { label: t('goodsReceipts.templates.standard'), value: 'standard' },
  { label: t('goodsReceipts.templates.compact'), value: 'compact' },
])
const validation = computed(() =>
  draft.value
    ? validateGoodsReceiptDraft(draft.value)
    : { errors: [], warnings: [] },
)
const canExport = computed(() => Boolean(draft.value) && validation.value.errors.length === 0)
const exportActionLabel = computed(() =>
  props.supportsDirectPdfExport ? t('goodsReceipts.actions.exportPdf') : t('goodsReceipts.actions.print'),
)

watch(
  visible,
  (nextVisible) => {
    if (nextVisible) {
      resetDraft()
    }
  },
)

watch(
  () => draft.value?.documentDate,
  (documentDate) => {
    if (!draft.value || !documentDate || grNumberUserEdited.value) {
      return
    }

    draft.value.grNumber = createGoodsReceiptNumber(documentDate)
  },
)

watch(
  () => draft.value?.templateId,
  (templateId) => {
    if (templateId) {
      saveTemplatePreference(templateId)
    }
  },
)

function resetDraft() {
  grNumberUserEdited.value = false
  draft.value = createGoodsReceiptDraft(props.quotation, {
    documentDate: getTodayIsoDate(),
    templateId: loadTemplatePreference(),
  })
}

function markGrNumberEdited() {
  grNumberUserEdited.value = true
}

function exportPdf() {
  if (!draft.value || !canExport.value) {
    return
  }

  emit('exportPdf', draft.value)
}

function getErrorMessage(code: string) {
  return t(`goodsReceipts.errors.${code}`)
}

function loadTemplatePreference(): GoodsReceiptTemplateId {
  if (typeof window === 'undefined') {
    return 'standard'
  }

  return normalizeGoodsReceiptTemplateId(window.localStorage.getItem(GOODS_RECEIPT_TEMPLATE_STORAGE_KEY))
}

function saveTemplatePreference(templateId: GoodsReceiptTemplateId) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(GOODS_RECEIPT_TEMPLATE_STORAGE_KEY, templateId)
}

function getTodayIsoDate() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${today.getFullYear()}-${month}-${day}`
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('goodsReceipts.dialog.title')"
    :style="{ width: 'min(1420px, 96vw)' }"
    :content-style="{ padding: 0 }"
  >
    <div v-if="draft" class="goods-receipt-dialog">
      <section class="goods-receipt-editor-panel">
        <header class="goods-receipt-toolbar">
          <label class="goods-receipt-template-field">
            <span>{{ t('goodsReceipts.fields.template') }}</span>
            <Select
              v-model="draft.templateId"
              :options="templateOptions"
              option-label="label"
              option-value="value"
            />
          </label>
        </header>

        <div class="goods-receipt-editor-scroll">
          <GoodsReceiptDetailsForm
            v-model="draft"
            @gr-number-edited="markGrNumberEdited"
          />
          <GoodsReceiptItemsEditor
            v-model="draft.lines"
            :warnings="validation.warnings"
          />
        </div>
      </section>

      <section class="goods-receipt-preview-panel" :aria-label="t('goodsReceipts.preview.aria')">
        <div class="goods-receipt-preview-scroll">
          <GoodsReceiptPreview
            :draft="draft"
            :branding="props.quotation.branding"
          />
        </div>
      </section>
    </div>

    <template #footer>
      <div class="goods-receipt-footer">
        <div class="goods-receipt-errors" aria-live="polite">
          <span
            v-for="error in validation.errors"
            :key="`${error.lineId ?? 'draft'}-${error.code}`"
          >
            {{ getErrorMessage(error.code) }}
          </span>
        </div>
        <Button severity="secondary" :label="t('goodsReceipts.actions.cancel')" @click="visible = false" />
        <Button
          icon="pi pi-file-pdf"
          :label="exportActionLabel"
          :disabled="!canExport"
          @click="exportPdf"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.goods-receipt-dialog {
  display: grid;
  grid-template-columns: minmax(420px, 0.92fr) minmax(520px, 1fr);
  grid-template-rows: minmax(0, 1fr);
  height: min(78vh, 760px);
  background: var(--surface-panel);
}

.goods-receipt-editor-panel,
.goods-receipt-preview-panel {
  min-width: 0;
  min-height: 0;
}

.goods-receipt-editor-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-right: 1px solid var(--surface-border);
  background: #ffffff;
}

.goods-receipt-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-card);
}

.goods-receipt-template-field {
  display: grid;
  gap: 5px;
  min-width: 220px;
}

.goods-receipt-template-field > span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.goods-receipt-editor-scroll,
.goods-receipt-preview-scroll {
  min-height: 0;
  overflow: auto;
}

.goods-receipt-editor-scroll {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 14px;
}

.goods-receipt-preview-panel {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-raised) 76%, white), var(--surface-panel)),
    var(--surface-panel);
}

.goods-receipt-preview-scroll {
  padding: 18px;
}

.goods-receipt-preview-scroll :deep(.goods-receipt-document) {
  border: 1px solid color-mix(in srgb, var(--surface-border) 72%, white);
  box-shadow: 0 10px 28px rgb(15 23 42 / 12%);
}

.goods-receipt-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}

.goods-receipt-errors {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--danger);
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 1180px) {
  .goods-receipt-dialog {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    height: auto;
    max-height: none;
  }

  .goods-receipt-editor-panel {
    border-right: 0;
    border-bottom: 1px solid var(--surface-border);
  }

  .goods-receipt-editor-scroll,
  .goods-receipt-preview-scroll {
    max-height: 58vh;
  }
}
</style>
