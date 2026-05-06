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
    <header class="panel-heading">
      <span class="scope-pill">
        <i class="pi pi-globe" aria-hidden="true" />
        {{ t('settings.scopeLabel') }}
      </span>
      <h2 class="panel-title">{{ t('settings.title') }}</h2>
      <p class="panel-description">{{ t('settings.description') }}</p>
    </header>

    <form class="settings-form" @submit.prevent>
      <div class="form-section">
        <h3 class="section-title">{{ t('settings.appearanceSection') }}</h3>
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
      </div>

      <div class="form-section">
        <h3 class="section-title">{{ t('settings.companySection') }}</h3>
        <div class="field-grid">
          <label class="field field-wide">
            <span>{{ t('settings.companyName') }}</span>
            <InputText v-model="companyProfile.companyName" autocomplete="organization" />
          </label>
          <label class="field">
            <span>{{ t('settings.contactNumber') }}</span>
            <InputText v-model="companyProfile.phone" type="tel" autocomplete="tel" />
          </label>
          <label class="field">
            <span>{{ t('settings.email') }}</span>
            <InputText
              v-model="companyProfile.email"
              type="email"
              autocomplete="email"
              :spellcheck="false"
            />
          </label>
        </div>
      </div>
    </form>
  </section>
</template>

<style scoped>
.settings-panel {
  display: grid;
  gap: 18px;
  max-width: 760px;
}

.panel-heading,
.settings-form {
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.panel-heading {
  display: grid;
  gap: 6px;
  padding: 18px 22px 20px;
}

.scope-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: max-content;
  padding: 3px 10px;
  border: 1px solid var(--accent-soft);
  border-radius: 999px;
  background: var(--accent-surface);
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.scope-pill i {
  font-size: 11px;
}

.panel-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 18px;
  font-weight: 700;
}

.panel-description {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
  text-wrap: pretty;
}

.settings-form {
  display: grid;
  gap: 20px;
  padding: 20px 22px;
}

.form-section {
  display: grid;
  gap: 12px;
}

.form-section + .form-section {
  padding-top: 18px;
  border-top: 1px solid var(--surface-border);
}

.section-title {
  margin: 0;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.field {
  display: grid;
  gap: 5px;
  color: var(--text-body);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.field-wide {
  grid-column: 1 / -1;
}

.field :deep(.p-inputtext),
.field :deep(.p-select) {
  width: 100%;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}

@media (max-width: 640px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
