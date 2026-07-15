<script setup lang="ts">
import ConfirmDialog from 'primevue/confirmdialog'
import Toast from 'primevue/toast'
import { computed, provide, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import QuotationEditor from './features/quotations/components/QuotationEditor.vue'
import SettingsPanel from './features/settings/components/SettingsPanel.vue'
import type { SettingsSection } from './features/settings/types'
import type { SupportedLocale } from './shared/i18n/locale'
import { saveAppSettings } from './shared/services/localAppSettingsStorage'
import { APP_THEME_ID_KEY, applyAppTheme, type AppThemeId } from './shared/theme/appTheme'

type AppModule = 'quotation' | 'settings'

const props = defineProps<{
  initialUiLocale: SupportedLocale
  initialUiTheme: AppThemeId
}>()

const { t, locale } = useI18n()
const activeModule = shallowRef<AppModule>('quotation')
const settingsSection = shallowRef<SettingsSection>('general')
const uiLocale = shallowRef<SupportedLocale>(props.initialUiLocale)
const uiTheme = shallowRef<AppThemeId>(props.initialUiTheme)

provide(APP_THEME_ID_KEY, computed(() => uiTheme.value))

const moduleNav = computed(() => [
  { id: 'quotation' as const, icon: 'pi pi-file-edit', label: t('app.modules.quotation') },
  { id: 'settings' as const, icon: 'pi pi-cog', label: t('app.modules.settings') },
])

function openSettingsSection(section: SettingsSection) {
  settingsSection.value = section
  activeModule.value = 'settings'
}

watch(
  uiLocale,
  (nextLocale) => {
    locale.value = nextLocale
    saveAppSettings({
      uiLocale: nextLocale,
    })
  },
  { immediate: true },
)

watch(
  uiTheme,
  (nextTheme) => {
    applyAppTheme(nextTheme)
    saveAppSettings({
      uiTheme: nextTheme,
    })
  },
  { immediate: true },
)
</script>

<template>
  <main class="app-shell">
    <Toast position="top-right" />
    <ConfirmDialog />
    <aside class="app-sidebar" :aria-label="t('app.aria.primaryNavigation')">
      <div class="brand-block">
        <span
          class="brand-mark"
          v-tooltip.right="t('app.softwareName')"
          aria-hidden="true"
        >Q</span>
      </div>

      <nav class="module-nav" role="tablist" :aria-orientation="'vertical'">
        <button
          v-for="item in moduleNav"
          :key="item.id"
          class="module-button"
          :class="{ 'module-button-active': activeModule === item.id }"
          type="button"
          role="tab"
          :aria-selected="activeModule === item.id"
          :aria-label="item.label"
          @click="activeModule = item.id"
        >
          <i :class="item.icon" aria-hidden="true" />
          <span class="module-label">{{ item.label }}</span>
        </button>
      </nav>
    </aside>

    <section class="app-main">
      <div class="module-surface">
        <QuotationEditor
          v-show="activeModule === 'quotation'"
          :ui-locale="uiLocale"
          @manage-customers="openSettingsSection('customers')"
          @manage-company-profiles="openSettingsSection('companyProfiles')"
        />
        <div v-show="activeModule === 'settings'" class="padded-module">
          <SettingsPanel
            v-model:active-section="settingsSection"
            :ui-locale="uiLocale"
            :ui-theme="uiTheme"
            @update:ui-locale="uiLocale = $event"
            @update:ui-theme="uiTheme = $event"
          />
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  min-width: 960px;
  height: 100vh;
  overflow: hidden;
  color: var(--text-body);
}

.app-sidebar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding: 0;
  background:
    linear-gradient(180deg, var(--sidebar-highlight), transparent 120px),
    var(--sidebar-bg);
  color: var(--sidebar-text);
  position: relative;
  z-index: 10;
  border-right: 1px solid var(--sidebar-border);
}

.brand-block {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 56px;
  flex-shrink: 0;
  position: relative;
}

.brand-block::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 14px;
  right: 14px;
  height: 1px;
  background: var(--sidebar-divider);
}

.brand-mark {
  display: inline-grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--sidebar-brand-border);
  border-radius: var(--radius-md);
  background:
    linear-gradient(180deg, var(--sidebar-brand-bg-start), var(--sidebar-brand-bg-end)),
    var(--sidebar-brand-bg);
  color: var(--sidebar-brand-text);
  font-weight: 800;
  font-size: 14px;
  letter-spacing: 0;
  user-select: none;
}

.module-nav {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  padding: 12px 8px;
  width: 100%;
}

.module-button {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 58px;
  padding: 6px 4px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--sidebar-text-muted);
  font: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.module-button i {
  font-size: 17px;
  line-height: 1;
}

.module-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.module-button:hover {
  background: var(--sidebar-item-hover);
  border-color: var(--sidebar-item-hover-border);
  color: var(--sidebar-item-hover-text);
}

.module-button-active {
  background: var(--sidebar-item-active);
  border-color: var(--sidebar-item-active-border);
  color: var(--sidebar-item-active-text);
}

.module-button-active::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 12px;
  bottom: 12px;
  width: 2px;
  border-radius: 0 2px 2px 0;
  background: var(--sidebar-accent);
}

.module-button:focus-visible {
  outline: 2px solid var(--sidebar-accent);
  outline-offset: -2px;
}

.app-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  height: 100%;
  background:
    linear-gradient(135deg, var(--app-highlight) 0, transparent 34%),
    linear-gradient(180deg, var(--app-bg-elevated) 0, var(--app-bg) 230px),
    var(--app-bg);
}

.module-surface {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.padded-module {
  height: 100%;
  padding: 16px 20px;
  overflow: auto;
}
</style>
