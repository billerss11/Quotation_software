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
import ActivityHistorySettingsCard from '@/features/activity-history/components/ActivityHistorySettingsCard.vue'
import { useActivityHistory } from '@/features/activity-history/composables/useActivityHistory'

const props = defineProps<{
  uiLocale: SupportedLocale
  uiTheme: AppThemeId
  hideNavigation?: boolean
}>()
const emit = defineEmits<{
  'update:uiLocale': [locale: SupportedLocale]
  'update:uiTheme': [themeId: AppThemeId]
}>()
const activeSection = defineModel<SettingsSection>('activeSection', { default: 'general' })
const { t } = useI18n()
const confirm = useConfirm()
const runtime = getQuotationRuntime()
const activityHistory = useActivityHistory({ runtime })

const {
  currentLibraryFilePath,
  statusMessage,
  selectLibraryFile,
  applyLibraryReplacement,
  saveLibrary,
  saveLibraryAs,
  createEmptyLibrary,
} = useQuotationLibraryFileActions({
  runtime,
  t: (key, params) => (params ? t(key, params) : t(key)),
  recordActivity: (messageKey, params) => activityHistory.recordMessage(
    'library',
    'Reusable library',
    messageKey,
    params,
  ),
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
  <section class="settings-panel" :class="{ 'settings-panel-embedded': hideNavigation }">
    <header v-if="!hideNavigation || activeSection === 'general'" class="panel-heading">
      <h1 class="panel-title">{{ t('shell.settings.title') }}</h1>
      <p class="panel-description">{{ t('shell.settings.description') }}</p>
    </header>

    <section class="settings-shell">
      <div v-if="!hideNavigation" class="settings-tabs" role="tablist" :aria-label="t('settings.tabs.aria')">
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
          <div class="section-heading">
            <h2 class="section-title">{{ t('shell.settings.preferences') }}</h2>
            <p>{{ t('shell.settings.preferencesDescription') }}</p>
          </div>
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
            <h2 class="library-title">{{ t('shell.settings.libraryTitle') }}</h2>
            <p>{{ t('shell.settings.libraryDescription') }}</p>
            <div class="library-file">
              <span class="library-file-label">{{ t('shell.settings.fileLabel') }}</span>
              <span class="library-path" :title="currentLibraryFilePath">{{ currentLibraryFilePath || t('settings.library.unselected') }}</span>
            </div>
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

        <ActivityHistorySettingsCard v-if="runtime.capabilities.isDesktop" class="history-settings-card" />
      </div>

      <CompanyProfilesPanel v-show="activeSection === 'companyProfiles'" />
      <CustomersPanel v-show="activeSection === 'customers'" />
    </section>
  </section>
</template>

<style scoped>
.settings-panel { display: grid; gap: 28px; max-width: 1180px; min-width: 0; margin-inline: auto; }
.panel-heading { display: grid; gap: 8px; padding: 0; }
.panel-title { margin: 0; color: var(--text-strong); font-size: 28px; font-weight: 700; letter-spacing: -0.035em; }
.panel-description { margin: 0; color: var(--text-muted); font-size: 14px; line-height: 1.6; }
.settings-shell { display: grid; gap: 20px; min-width: 0; }
.settings-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
.settings-tab { min-height: 38px; padding: 8px 14px; border: 1px solid var(--surface-border); border-radius: var(--radius-md); background: var(--surface-card); color: var(--text-muted); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.settings-tab:hover { border-color: var(--surface-border-strong); color: var(--text-body); background: var(--surface-raised); }
.settings-tab-active { border-color: var(--accent); background: var(--accent-surface); color: var(--accent); }
.settings-tab:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.settings-body-card { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; min-width: 0; }
.form-section, .library-card, .history-settings-card { display: grid; align-content: start; gap: 22px; min-width: 0; padding: 26px; border: 1px solid var(--surface-border); border-radius: var(--radius-lg); background: var(--surface-card); }
.section-heading { display: grid; gap: 6px; }
.section-heading p { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.6; }
.section-title { margin: 0; color: var(--text-strong); font-size: 17px; font-weight: 650; }
.field { display: grid; gap: 9px; color: var(--text-body); font-size: 13px; font-weight: 600; }
.field :deep(.p-select) { width: 100%; text-transform: none; letter-spacing: 0; font-weight: 400; }
.library-copy { display: grid; gap: 9px; min-width: 0; }
.library-title { margin: 0; color: var(--text-strong); font-size: 17px; font-weight: 650; }
.library-copy p { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.6; }
.library-file { display: grid; gap: 7px; margin-top: 10px; padding: 14px; border: 1px solid var(--surface-border); border-radius: var(--radius-sm); background: var(--surface-panel); }
.library-file-label { color: var(--text-body); font-size: 12px; font-weight: 600; }
.library-path { min-width: 0; max-width: 100%; overflow: hidden; color: var(--text-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.autosave-note { display: flex; align-items: flex-start; gap: 7px; margin-top: 6px !important; }
.autosave-note i { margin-top: 4px; color: var(--accent); }
.library-actions { display: flex; flex-wrap: wrap; align-self: end; gap: 8px; }
.library-status { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid var(--accent-soft); border-radius: var(--radius-md); background: var(--accent-surface); color: var(--accent); font-size: 13px; font-weight: 600; }

.settings-panel :deep(.toolbar-card) { padding: 0 0 24px; border: 0; border-bottom: 1px solid var(--surface-border); border-radius: 0; background: transparent; box-shadow: none; }
.settings-panel :deep(.toolbar-card h2) { font-size: 28px; font-weight: 700; letter-spacing: -0.035em; }
.settings-panel :deep(.toolbar-card p) { font-size: 14px; line-height: 1.6; }
.settings-panel :deep(.management-layout) { grid-template-columns: minmax(250px, 0.85fr) minmax(0, 1.15fr); gap: 22px; align-items: start; }
.settings-panel :deep(.record-list), .settings-panel :deep(.editor-card), .settings-panel :deep(.editor-empty) { border-radius: var(--radius-lg); box-shadow: none; }
.settings-panel :deep(.editor-card) { position: sticky; top: 0; padding: 24px; }
.settings-panel :deep(.record-list) { padding: 20px; }
.settings-panel :deep(.record-grid) { max-height: none; gap: 4px; }
.settings-panel :deep(.record-card) { border-color: transparent; border-radius: var(--radius-sm); }
.settings-panel :deep(.record-card-active) { border-color: var(--accent-soft); }
.settings-panel :deep(.list-heading p) { display: none; }
.settings-panel :deep(.editor-heading h2) { font-size: 17px; }
.settings-panel :deep(.editor-heading p) { line-height: 1.6; }

@media (min-width: 1380px) {
  .settings-body-card { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .history-settings-card { grid-column: 1 / -1; }
}

@media (max-width: 760px) {
  .settings-panel { gap: 22px; }
  .panel-title, .settings-panel :deep(.toolbar-card h2) { font-size: 24px; }
  .form-section, .library-card, .history-settings-card { padding: 20px; }
  .settings-panel :deep(.management-layout) { grid-template-columns: minmax(0, 1fr); }
  .settings-panel :deep(.toolbar-card) { flex-wrap: wrap; }
  .settings-panel :deep(.editor-card) { position: static; }
}
</style>
