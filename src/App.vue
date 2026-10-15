<script setup lang="ts">
import ConfirmDialog from 'primevue/confirmdialog'
import Toast from 'primevue/toast'
import { computed, defineAsyncComponent, provide, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import QuotationEditor from './features/quotations/components/QuotationEditor.vue'
import SettingsPanel from './features/settings/components/SettingsPanel.vue'
import type { SettingsSection } from './features/settings/types'
import type { SupportedLocale } from './shared/i18n/locale'
import { saveAppSettings } from './shared/services/localAppSettingsStorage'
import { APP_THEME_ID_KEY, applyAppTheme, type AppThemeId } from './shared/theme/appTheme'

const UserManual = defineAsyncComponent(
  () => import('./features/user-manual/components/UserManual.vue'),
)

type AppModule = 'quotation' | 'settings' | 'userManual'
type NavigationDestination = Exclude<AppModule, 'settings'> | SettingsSection

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

const workspaceNav = computed(() => [
  { id: 'quotation' as const, icon: 'pi pi-file-edit', label: t('shell.navigation.quotation') },
  { id: 'customers' as const, icon: 'pi pi-users', label: t('shell.navigation.customers') },
  { id: 'companyProfiles' as const, icon: 'pi pi-building', label: t('shell.navigation.companyProfiles') },
])
const utilityNav = computed(() => [
  { id: 'general' as const, icon: 'pi pi-cog', label: t('shell.navigation.settings') },
  { id: 'userManual' as const, icon: 'pi pi-book', label: t('shell.navigation.userManual') },
])
const activeDestination = computed<NavigationDestination>(() =>
  activeModule.value === 'settings' ? settingsSection.value : activeModule.value,
)

function openSettingsSection(section: SettingsSection) {
  settingsSection.value = section
  activeModule.value = 'settings'
}

function navigateTo(destination: NavigationDestination) {
  if (destination === 'quotation' || destination === 'userManual') {
    activeModule.value = destination
    return
  }
  openSettingsSection(destination)
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
  <div class="app-shell">
    <Toast position="top-right" />
    <ConfirmDialog />
    <a class="skip-link" href="#app-main">{{ t('shell.skipToContent') }}</a>
    <aside class="app-sidebar" :aria-label="t('app.aria.primaryNavigation')">
      <div class="brand-block">
        <span class="brand-mark" aria-hidden="true">Q</span>
        <div class="brand-copy">
          <strong>{{ t('app.brandName') }}</strong>
          <span>{{ t('shell.workspaceLabel') }}</span>
        </div>
      </div>

      <nav class="module-nav" :aria-label="t('shell.navigation.workspaceAria')">
        <button
          v-for="item in workspaceNav"
          :key="item.id"
          class="module-button"
          :class="{ 'module-button-active': activeDestination === item.id }"
          type="button"
          :aria-current="activeDestination === item.id ? 'page' : undefined"
          :aria-label="item.label"
          :title="item.label"
          :data-nav="item.id"
          @click="navigateTo(item.id)"
        >
          <i :class="item.icon" aria-hidden="true" />
          <span class="module-label">{{ item.label }}</span>
        </button>
      </nav>

      <nav class="utility-nav" :aria-label="t('shell.navigation.utilityAria')">
        <button
          v-for="item in utilityNav"
          :key="item.id"
          class="module-button"
          :class="{ 'module-button-active': activeDestination === item.id }"
          type="button"
          :aria-current="activeDestination === item.id ? 'page' : undefined"
          :aria-label="item.label"
          :title="item.label"
          :data-nav="item.id"
          @click="navigateTo(item.id)"
        >
          <i :class="item.icon" aria-hidden="true" />
          <span class="module-label">{{ item.label }}</span>
        </button>
      </nav>
    </aside>

    <main id="app-main" class="app-main" tabindex="-1">
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
            hide-navigation
            @update:ui-locale="uiLocale = $event"
            @update:ui-theme="uiTheme = $event"
          />
        </div>
        <div v-if="activeModule === 'userManual'" class="manual-module">
          <UserManual @back-to-editor="activeModule = 'quotation'" />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  min-width: 0;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  color: var(--text-body);
}

.app-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0 12px;
  background: var(--surface-card);
  color: var(--text-body);
  position: relative;
  z-index: 10;
  border-right: 1px solid var(--surface-border);
}

.brand-block {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  height: 92px;
  padding: 0 8px;
  flex-shrink: 0;
}

.brand-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.brand-copy strong {
  color: var(--text-strong);
  font-size: 17px;
  font-weight: 750;
  letter-spacing: -0.03em;
}

.brand-copy span {
  color: var(--text-muted);
  font-size: 12px;
}

.brand-mark {
  display: inline-grid;
  width: 32px;
  height: 36px;
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--text-on-accent);
  font-weight: 800;
  font-size: 19px;
  letter-spacing: 0;
  user-select: none;
}

.module-nav,
.utility-nav {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  padding: 0;
  width: 100%;
}

.utility-nav {
  margin-top: auto;
  padding: 16px 0 20px;
  border-top: 1px solid var(--surface-border);
}

.module-button {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 11px 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.module-button i {
  width: 18px;
  flex-shrink: 0;
  font-size: 15px;
  text-align: center;
  line-height: 1;
}

.module-label {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
}

.module-button:hover {
  background: var(--surface-hover);
  color: var(--text-strong);
}

.module-button-active {
  background: var(--accent-surface);
  color: var(--accent);
}

.module-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

.app-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--app-bg);
  outline: none;
}

.module-surface {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.padded-module {
  height: 100%;
  padding: 32px 36px;
  overflow: auto;
}

.manual-module {
  height: 100%;
  min-height: 0;
}

.skip-link {
  position: fixed;
  top: 12px;
  left: 220px;
  z-index: 2000;
  padding: 10px 16px;
  border: 2px solid var(--focus-ring);
  border-radius: var(--radius-sm);
  background: var(--surface-card);
  color: var(--text-strong);
  transform: translateY(-180%);
}

.skip-link:focus {
  transform: translateY(0);
}

@media (max-width: 1100px) {
  .app-shell { grid-template-columns: 68px minmax(0, 1fr); }
  .app-sidebar { padding-inline: 8px; }
  .brand-block { height: 80px; padding: 0; justify-content: center; }
  .brand-copy, .module-label { display: none; }
  .module-button { justify-content: center; padding: 12px; }
  .padded-module { padding: 24px; }
  .skip-link { left: 84px; }
}

@media (max-width: 640px) {
  .padded-module { padding: 20px 14px; }
}
</style>
