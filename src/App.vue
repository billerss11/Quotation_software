<script setup lang="ts">
import Toast from 'primevue/toast'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CustomersPanel from './features/customers/components/CustomersPanel.vue'
import QuotationEditor from './features/quotations/components/QuotationEditor.vue'
import SettingsPanel from './features/settings/components/SettingsPanel.vue'
import { loadCompanyProfile, saveCompanyProfile } from './shared/services/localCompanyProfileStorage'
import type { SupportedLocale } from './shared/i18n/locale'
import { saveAppSettings } from './shared/services/localAppSettingsStorage'

type AppModule = 'quotation' | 'customers' | 'settings'

const props = defineProps<{
  initialUiLocale: SupportedLocale
}>()

const { t, locale } = useI18n()
const activeModule = shallowRef<AppModule>('quotation')
const uiLocale = shallowRef<SupportedLocale>(props.initialUiLocale)
const companyProfile = ref(loadCompanyProfile(props.initialUiLocale))

const moduleNav = computed(() => [
  { id: 'quotation' as const, icon: 'pi pi-file-edit', label: t('app.modules.quotation') },
  { id: 'customers' as const, icon: 'pi pi-address-book', label: t('app.modules.customers') },
  { id: 'settings' as const, icon: 'pi pi-cog', label: t('app.modules.settings') },
])

watch(
  companyProfile,
  (profile) => {
    saveCompanyProfile(profile)
  },
  { deep: true },
)

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
</script>

<template>
  <main class="app-shell">
    <Toast position="top-right" />
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
          :company-profile="companyProfile"
          :ui-locale="uiLocale"
        />
        <div v-show="activeModule === 'customers'" class="padded-module">
          <CustomersPanel />
        </div>
        <div v-show="activeModule === 'settings'" class="padded-module">
          <SettingsPanel
            v-model="companyProfile"
            :ui-locale="uiLocale"
            @update:ui-locale="uiLocale = $event"
          />
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
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
  background: var(--sidebar-bg);
  color: #f8fafc;
  position: relative;
  z-index: 10;
  border-right: 1px solid rgb(255 255 255 / 6%);
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
  left: 16px;
  right: 16px;
  height: 1px;
  background: rgb(255 255 255 / 8%);
}

.brand-mark {
  display: inline-grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 8px;
  background: linear-gradient(145deg, #34d399, #059669);
  color: #ffffff;
  font-weight: 800;
  font-size: 14px;
  letter-spacing: -0.5px;
  user-select: none;
}

.module-nav {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  padding: 10px 8px;
  width: 100%;
}

.module-button {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 56px;
  padding: 6px 4px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: rgb(226 232 240 / 70%);
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
  background: rgb(255 255 255 / 6%);
  color: #f1f5f9;
}

.module-button-active {
  background: var(--sidebar-active);
  color: #ffffff;
}

.module-button-active::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 12px;
  bottom: 12px;
  width: 3px;
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
  background: var(--app-bg);
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
