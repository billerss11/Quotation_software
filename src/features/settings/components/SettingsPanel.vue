<script setup lang="ts">
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { SUPPORTED_LOCALES, type SupportedLocale } from '@/shared/i18n/locale'
import type { CompanyProfile } from '@/shared/services/localCompanyProfileStorage'

const props = defineProps<{
  uiLocale: SupportedLocale
}>()

const companyProfile = defineModel<CompanyProfile>({ required: true })
const emit = defineEmits<{
  'update:uiLocale': [locale: SupportedLocale]
}>()
const { t } = useI18n()

const localeOptions = computed(() =>
  SUPPORTED_LOCALES.map((value) => ({
    label: t(`common.locales.${value}`),
    value,
  })),
)
</script>

<template>
  <section class="settings-panel">
    <div class="panel-heading">
      <h2>{{ t('settings.title') }}</h2>
      <p>{{ t('settings.description') }}</p>
    </div>

    <form class="settings-form">
      <label class="field field-wide">
        <span>{{ t('settings.uiLanguage') }}</span>
        <Select
          :model-value="props.uiLocale"
          :options="localeOptions"
          option-label="label"
          option-value="value"
          @update:model-value="emit('update:uiLocale', $event as SupportedLocale)"
        />
      </label>
      <label class="field">
        <span>{{ t('settings.companyName') }}</span>
        <InputText v-model="companyProfile.companyName" />
      </label>
      <label class="field">
        <span>{{ t('settings.contactNumber') }}</span>
        <InputText v-model="companyProfile.phone" />
      </label>
      <label class="field">
        <span>{{ t('settings.email') }}</span>
        <InputText v-model="companyProfile.email" />
      </label>
    </form>
  </section>
</template>

<style scoped>
.settings-panel {
  display: grid;
  gap: 20px;
}

.panel-heading,
.settings-form {
  padding: 20px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: #ffffff;
}

.panel-heading h2,
.panel-heading p {
  margin: 0;
}

.panel-heading p {
  margin-top: 6px;
  color: #64748b;
}

.settings-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.field {
  display: grid;
  gap: 7px;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.field-wide {
  grid-column: 1 / -1;
}

.field :deep(.p-inputtext),
.field :deep(.p-select) {
  width: 100%;
}
</style>
