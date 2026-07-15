<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatIsoDate } from '@/shared/utils/formatters'
import type { CustomerEditorMode, CustomerValidationError } from '../composables/useCustomerLibrary'
import type { CustomerLibraryRecord } from '../utils/customerRecords'

const props = defineProps<{
  mode: Exclude<CustomerEditorMode, 'idle'>
  canDelete: boolean
  isDirty: boolean
  validationErrors: CustomerValidationError[]
}>()
const model = defineModel<CustomerLibraryRecord>({ required: true })
const emit = defineEmits<{ save: []; cancel: []; delete: [] }>()
const { t, locale } = useI18n()
const submitted = shallowRef(false)
const currentLocale = computed(() => locale.value as SupportedLocale)
const identityInvalid = computed(() => submitted.value && props.validationErrors.includes('missing_identity'))

watch(() => [props.mode, model.value.id], () => { submitted.value = false })

function handleSave() {
  submitted.value = true
  emit('save')
}
</script>

<template>
  <section class="editor-card" :aria-label="t('customers.editor.aria')">
    <header class="editor-heading">
      <div>
        <h2>{{ mode === 'create' ? t('customers.editor.createTitle') : t('customers.editor.editTitle') }}</h2>
        <p>{{ mode === 'create' ? t('customers.editor.createDescription') : t('customers.editor.description') }}</p>
      </div>
      <span v-if="mode === 'edit' && model.updatedAt" class="updated-at" :title="model.updatedAt">
        <i class="pi pi-clock" aria-hidden="true" />
        {{ t('customers.editor.updated', { date: formatIsoDate(model.updatedAt.slice(0, 10), currentLocale) }) }}
      </span>
    </header>

    <div class="editor-grid">
      <label class="field">
        <span>{{ t('customers.editor.company') }}</span>
        <InputText v-model="model.customerCompany" autocomplete="organization" :aria-invalid="identityInvalid" :aria-describedby="identityInvalid ? 'customer-identity-error' : undefined" />
      </label>
      <label class="field">
        <span>{{ t('customers.editor.contactPerson') }}</span>
        <InputText v-model="model.contactPerson" autocomplete="name" :aria-invalid="identityInvalid" :aria-describedby="identityInvalid ? 'customer-identity-error' : undefined" />
      </label>
      <p v-if="identityInvalid" id="customer-identity-error" class="field-error field-wide">{{ t('customers.editor.errors.identityRequired') }}</p>
      <label class="field field-wide">
        <span>{{ t('customers.editor.contactDetails') }}</span>
        <Textarea v-model="model.contactDetails" rows="3" auto-resize />
      </label>
    </div>

    <div class="editor-actions">
      <Button icon="pi pi-save" :label="t('customers.editor.save')" :disabled="!isDirty" @click="handleSave" />
      <Button :label="t('customers.editor.cancel')" severity="secondary" outlined @click="emit('cancel')" />
      <Button v-if="canDelete" icon="pi pi-trash" :label="t('customers.editor.delete')" severity="danger" text @click="emit('delete')" />
    </div>
  </section>
</template>

<style scoped>
.editor-card { display: grid; align-content: start; gap: 16px; min-height: 320px; padding: 20px 22px; border: 1px solid var(--surface-border); border-radius: var(--radius-xl); background: var(--surface-card); box-shadow: var(--shadow-card); }
.editor-heading { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; }
.editor-heading div { display: grid; gap: 4px; }
.editor-heading h2 { margin: 0; color: var(--text-strong); font-size: 15px; }
.editor-heading p { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.45; }
.updated-at { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: 12px; font-weight: 600; white-space: nowrap; }
.editor-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.field { display: grid; gap: 5px; color: var(--text-body); font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.field-wide { grid-column: 1 / -1; }
.field :deep(.p-inputtext), .field :deep(.p-textarea) { width: 100%; text-transform: none; letter-spacing: 0; font-weight: 400; }
.field-error { margin: -5px 0 0; color: var(--p-red-600); font-size: 12px; line-height: 1.4; }
.editor-actions { display: flex; flex-wrap: wrap; gap: 10px; padding-top: 4px; border-top: 1px solid var(--surface-border); }
.editor-actions :deep(.p-button:last-child) { margin-left: auto; }
@media (max-width: 640px) { .editor-grid { grid-template-columns: 1fr; } }
</style>
