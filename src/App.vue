<script setup lang="ts">
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

const appTitle = computed(() => {
  if (activeModule.value === 'customers') {
    return t('app.titles.customers')
  }

  if (activeModule.value === 'settings') {
    return t('app.titles.settings')
  }

  return t('app.titles.quotation')
})
</script>

<template>
  <main class="app-shell">
    <aside class="app-sidebar" :aria-label="t('app.aria.primaryNavigation')">
      <div class="brand-block">
        <span class="brand-mark">Q</span>
        <span class="brand-name">{{ t('app.brandName') }}</span>
      </div>

      <nav class="module-nav">
        <button
          class="module-button"
          :class="{ 'module-button-active': activeModule === 'quotation' }"
          type="button"
          @click="activeModule = 'quotation'"
        >
          <i class="pi pi-file-edit" aria-hidden="true" />
          <span>{{ t('app.modules.quotation') }}</span>
        </button>
        <button
          class="module-button"
          :class="{ 'module-button-active': activeModule === 'customers' }"
          type="button"
          @click="activeModule = 'customers'"
        >
          <i class="pi pi-address-book" aria-hidden="true" />
          <span>{{ t('app.modules.customers') }}</span>
        </button>
        <button
          class="module-button"
          :class="{ 'module-button-active': activeModule === 'settings' }"
          type="button"
          @click="activeModule = 'settings'"
        >
          <i class="pi pi-cog" aria-hidden="true" />
          <span>{{ t('app.modules.settings') }}</span>
        </button>
      </nav>
    </aside>

    <section class="app-main">
      <header class="app-header">
        <div class="header-title">
          <p class="eyebrow">{{ t('app.softwareName') }}</p>
          <h1 class="page-title">{{ appTitle }}</h1>
        </div>
      </header>

      <div class="module-surface">
        <QuotationEditor
          v-show="activeModule === 'quotation'"
          :company-profile="companyProfile"
          :ui-locale="uiLocale"
        />
        <CustomersPanel v-show="activeModule === 'customers'" />
        <SettingsPanel
          v-show="activeModule === 'settings'"
          v-model="companyProfile"
          :ui-locale="uiLocale"
          @update:ui-locale="uiLocale = $event"
        />
      </div>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-width: 1120px;
  min-height: 100vh;
  color: var(--text-body);
}

.app-sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 18px 14px;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 4%), transparent 160px),
    var(--sidebar-bg);
  color: #f8fafc;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 8px;
  background: linear-gradient(135deg, #34d399, #10b981);
  color: #052e2b;
  font-weight: 800;
  box-shadow: 0 10px 24px rgb(16 185 129 / 24%);
}

.brand-name {
  font-size: 17px;
  font-weight: 750;
}

.module-nav {
  display: grid;
  gap: 8px;
}

.module-button {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #cbd5e1;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.module-button:hover,
.module-button-active {
  background: var(--sidebar-active);
  color: #ffffff;
}

.app-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  background: var(--app-bg);
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 5px 16px;
  border-bottom: 1px solid var(--surface-border);
  background: #fbfcfe;
  position: sticky;
  top: 0;
  z-index: 20;
}

.header-title {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 10px;
}

.eyebrow {
  margin: 0;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.page-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 19px;
  line-height: 1.2;
}

.module-surface {
  flex: 1;
  min-height: 0;
  padding: 8px 14px 12px;
}

</style>
