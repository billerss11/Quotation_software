<script setup lang="ts">
import Toast from 'primevue/toast'
import { ref, shallowRef, watch } from 'vue'
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
</script>

<template>
  <main class="app-shell">
    <Toast position="top-right" />
    <aside class="app-sidebar" :aria-label="t('app.aria.primaryNavigation')">
      <div class="brand-block">
        <span
          class="brand-mark"
          v-tooltip.right="t('app.softwareName')"
        >Q</span>
      </div>

      <nav class="module-nav">
        <button
          class="module-button"
          :class="{ 'module-button-active': activeModule === 'quotation' }"
          type="button"
          v-tooltip.right="t('app.modules.quotation')"
          :aria-label="t('app.modules.quotation')"
          @click="activeModule = 'quotation'"
        >
          <i class="pi pi-file-edit" />
        </button>
        <button
          class="module-button"
          :class="{ 'module-button-active': activeModule === 'customers' }"
          type="button"
          v-tooltip.right="t('app.modules.customers')"
          :aria-label="t('app.modules.customers')"
          @click="activeModule = 'customers'"
        >
          <i class="pi pi-address-book" />
        </button>
        <button
          class="module-button"
          :class="{ 'module-button-active': activeModule === 'settings' }"
          type="button"
          v-tooltip.right="t('app.modules.settings')"
          :aria-label="t('app.modules.settings')"
          @click="activeModule = 'settings'"
        >
          <i class="pi pi-cog" />
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
  grid-template-columns: 56px minmax(0, 1fr);
  min-width: 960px;
  height: 100vh;
  overflow: hidden;
  color: var(--text-body);
}

.app-sidebar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 14px 0;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 4%), transparent 160px),
    var(--sidebar-bg);
  color: #f8fafc;
}

.brand-block {
  display: flex;
  justify-content: center;
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
  cursor: default;
  user-select: none;
}

.module-nav {
  display: grid;
  gap: 6px;
}

.module-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  font: inherit;
  font-size: 17px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
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
  padding: 12px 16px;
  overflow: auto;
}
</style>
