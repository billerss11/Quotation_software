<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { useConfirm } from 'primevue/useconfirm'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import CompanyProfilesPanel from '@/features/company-profiles/components/CompanyProfilesPanel.vue'
import CustomersPanel from '@/features/customers/components/CustomersPanel.vue'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/shared/i18n/locale'
import { getQuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { APP_THEME_DEFINITIONS, type AppThemeId } from '@/shared/theme/appTheme'
import { useQuotationLibraryFileActions } from '../composables/useQuotationLibraryFileActions'
import type { SettingsSection } from '../types'
import AppThemePicker from './AppThemePicker.vue'

const props = defineProps<{
  uiLocale: SupportedLocale
  uiTheme: AppThemeId
}>()
const emit = defineEmits<{
  'update:uiLocale': [locale: SupportedLocale]
  'update:uiTheme': [themeId: AppThemeId]
}>()
const activeSection = defineModel<SettingsSection>('activeSection', { default: 'general' })
const { t } = useI18n()
const confirm = useConfirm()

const {
  currentLibraryFilePath,
  statusMessage,
  selectLibraryFile,
  applyLibraryReplacement,
  saveLibrary,
  saveLibraryAs,
  createEmptyLibrary,
} = useQuotationLibraryFileActions({
  runtime: getQuotationRuntime(),
  t: (key, params) => (params ? t(key, params) : t(key)),
})

const localeOptions = computed(() =>
  SUPPORTED_LOCALES.map((value) => ({ label: t(`common.locales.${value}`), value })),
)
const themeOptions = computed(() =>
  APP_THEME_DEFINITIONS.map((theme) => ({
    id: theme.id,
    label: t(`settings.themes.${theme.messageKey}.name`),
    description: t(`settings.themes.${theme.messageKey}.description`),
  })),
)
const managementTabs = computed(() => [
  { value: 'general' as const, label: t('settings.tabs.general') },
  { value: 'companyProfiles' as const, label: t('settings.tabs.companyProfiles') },
  { value: 'customers' as const, label: t('settings.tabs.customers') },
])

function confirmCreateEmptyLibrary() {
  confirm.require({
    header: t('settings.library.confirm.newTitle'),
    message: t('settings.library.confirm.newMessage'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: t('settings.library.confirm.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('settings.library.confirm.create'), severity: 'danger' },
    accept: createEmptyLibrary,
  })
}

async function chooseLibraryReplacement() {
  const candidate = await selectLibraryFile()
  if (!candidate) return

  confirm.require({
    header: t('settings.library.confirm.replaceTitle'),
    message: t('settings.library.confirm.replaceMessage', {
      companies: candidate.data.companyProfiles.length,
      customers: candidate.data.customers.length,
    }),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: t('settings.library.confirm.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('settings.library.confirm.replace'), severity: 'danger' },
    accept: () => applyLibraryReplacement(candidate),
  })
}
</script>

<template>
  <section class="settings-panel">
    <header class="panel-heading">
      <span class="scope-pill"><i class="pi pi-globe" aria-hidden="true" />{{ t('settings.scopeLabel') }}</span>
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
          :class="{ 'settings-tab-active': activeSection === tab.value }"
          role="tab"
          :aria-selected="activeSection === tab.value"
          @click="activeSection = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-show="activeSection === 'general'" class="settings-body-card">
        <div class="form-section">
          <h3 class="section-title">{{ t('settings.appearanceSection') }}</h3>
          <div class="field field-wide">
            <span>{{ t('settings.uiTheme') }}</span>
            <AppThemePicker
              :model-value="props.uiTheme"
              :options="themeOptions"
              :picker-label="t('settings.themeSelectorAria')"
              @update:model-value="emit('update:uiTheme', $event)"
            />
          </div>
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

        <section class="library-card" :aria-label="t('settings.library.aria')">
          <div class="library-copy">
            <div class="library-title-row">
              <h3 class="library-title">{{ t('settings.library.title') }}</h3>
              <span class="library-path">{{ currentLibraryFilePath || t('settings.library.unselected') }}</span>
            </div>
            <p>{{ t('settings.library.description') }}</p>
            <p class="autosave-note"><i class="pi pi-check-circle" aria-hidden="true" />{{ t('settings.library.localAutosave') }}</p>
          </div>

          <div class="library-actions">
            <Button icon="pi pi-file" :label="t('settings.library.new')" severity="secondary" outlined @click="confirmCreateEmptyLibrary" />
            <Button icon="pi pi-folder-open" :label="t('settings.library.open')" severity="secondary" outlined @click="chooseLibraryReplacement" />
            <Button icon="pi pi-save" :label="t('settings.library.save')" @click="saveLibrary" />
            <Button icon="pi pi-download" :label="t('settings.library.saveAs')" severity="secondary" outlined @click="saveLibraryAs" />
          </div>

          <div v-if="statusMessage" class="library-status" role="status" aria-live="polite">
            <i class="pi pi-info-circle" aria-hidden="true" />
            <span>{{ statusMessage }}</span>
          </div>
        </section>
      </div>

      <CompanyProfilesPanel v-show="activeSection === 'companyProfiles'" />
      <CustomersPanel v-show="activeSection === 'customers'" />
    </section>
  </section>
</template>

<style scoped>
.settings-panel { display: grid; gap: 14px; }
.panel-heading, .settings-body-card { border: 1px solid var(--surface-border); border-radius: var(--radius-lg); background: var(--surface-card); box-shadow: var(--shadow-card); }
.panel-heading { display: grid; gap: 6px; border-left: 4px solid var(--accent); padding: 18px 22px 20px; }
.scope-pill { display: inline-flex; align-items: center; gap: 6px; width: max-content; padding: 3px 10px; border: 1px solid var(--accent-soft); border-radius: var(--radius-md); color: var(--accent-hover); font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.panel-title { margin: 0; color: var(--text-strong); font-size: 18px; }
.panel-description { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.5; }
.settings-shell { display: grid; gap: 14px; }
.settings-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
.settings-tab { min-height: 38px; padding: 8px 14px; border: 1px solid var(--surface-border); border-radius: var(--radius-md); background: var(--surface-card); color: var(--text-muted); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.settings-tab:hover { border-color: var(--surface-border-strong); color: var(--text-body); background: var(--surface-raised); }
.settings-tab-active { border-color: var(--accent); background: var(--surface-card); color: var(--accent-hover); box-shadow: inset 3px 0 0 var(--accent); }
.settings-body-card { display: grid; gap: 24px; padding: 20px 22px; border-left: 4px solid color-mix(in srgb, var(--accent) 36%, var(--surface-border)); }
.form-section { display: grid; gap: 12px; max-width: 720px; }
.section-title { margin: 0; color: var(--text-muted); font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.field { display: grid; gap: 5px; color: var(--text-body); font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.field :deep(.p-select) { width: 100%; text-transform: none; letter-spacing: 0; font-weight: 400; }
.library-card { display: grid; gap: 14px; padding-top: 22px; border-top: 1px solid var(--surface-border); }
.library-copy { display: grid; gap: 5px; }
.library-title-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.library-title { margin: 0; color: var(--text-strong); font-size: 16px; }
.library-copy p { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.5; }
.library-path { max-width: 100%; overflow: hidden; padding: 3px 10px; border-radius: var(--radius-md); background: var(--surface-muted); color: var(--text-muted); font-size: 12px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.autosave-note { display: flex; align-items: center; gap: 7px; color: var(--accent) !important; font-weight: 600; }
.library-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.library-status { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid var(--accent-soft); border-radius: var(--radius-md); background: var(--accent-surface); color: var(--accent); font-size: 13px; font-weight: 600; }
</style>
