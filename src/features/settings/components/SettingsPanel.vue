<script setup lang="ts">
import Select from 'primevue/select'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import CompanyProfilesPanel from '@/features/company-profiles/components/CompanyProfilesPanel.vue'
import CustomersPanel from '@/features/customers/components/CustomersPanel.vue'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/shared/i18n/locale'

const props = defineProps<{
  uiLocale: SupportedLocale
}>()

const emit = defineEmits<{
  'update:uiLocale': [locale: SupportedLocale]
}>()

const { t } = useI18n()
const activeTab = shallowRef<'general' | 'companyProfiles' | 'customers'>('general')

const localeOptions = computed(() =>
  SUPPORTED_LOCALES.map((value) => ({
    label: t(`common.locales.${value}`),
    value,
  })),
)

const managementTabs = computed(() => [
  { value: 'general' as const, label: t('settings.tabs.general') },
  { value: 'companyProfiles' as const, label: t('settings.tabs.companyProfiles') },
  { value: 'customers' as const, label: t('settings.tabs.customers') },
])
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

    <section class="settings-shell">
      <div class="settings-tabs" role="tablist" :aria-label="t('settings.tabs.aria')">
        <button
          v-for="tab in managementTabs"
          :key="tab.value"
          type="button"
          class="settings-tab"
          :class="{ 'settings-tab-active': activeTab === tab.value }"
          role="tab"
          :aria-selected="activeTab === tab.value"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="activeTab === 'general'" class="settings-body-card">
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
      </div>

      <CompanyProfilesPanel v-else-if="activeTab === 'companyProfiles'" />
      <CustomersPanel v-else />
    </section>
  </section>
</template>

<style scoped>
.settings-panel {
  display: grid;
  gap: 18px;
}

.panel-heading,
.settings-body-card {
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

.settings-shell {
  display: grid;
  gap: 14px;
}

.settings-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.settings-tab {
  min-height: 38px;
  padding: 8px 14px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  color: var(--text-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.settings-tab:hover {
  border-color: var(--surface-border-strong);
  color: var(--text-body);
  background: var(--surface-raised);
}

.settings-tab-active {
  border-color: var(--accent);
  background: var(--accent-surface);
  color: var(--accent);
}

.settings-body-card {
  display: grid;
  gap: 20px;
  padding: 20px 22px;
  max-width: 760px;
}

.form-section {
  display: grid;
  gap: 12px;
}

.section-title {
  margin: 0;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
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

.field :deep(.p-select) {
  width: 100%;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}
</style>
