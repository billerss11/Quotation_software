<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'

import CustomersPanel from './features/customers/components/CustomersPanel.vue'
import QuotationEditor from './features/quotations/components/QuotationEditor.vue'
import SettingsPanel from './features/settings/components/SettingsPanel.vue'
import { loadCompanyProfile, saveCompanyProfile } from './shared/services/localCompanyProfileStorage'

type AppModule = 'quotation' | 'customers' | 'settings'

const activeModule = shallowRef<AppModule>('quotation')
const companyProfile = ref(loadCompanyProfile())

watch(
  companyProfile,
  (profile) => {
    saveCompanyProfile(profile)
  },
  { deep: true },
)

const appTitle = computed(() => {
  if (activeModule.value === 'customers') {
    return 'Customers'
  }

  if (activeModule.value === 'settings') {
    return 'Settings'
  }

  return 'Quotation Editor'
})
</script>

<template>
  <main class="app-shell">
    <aside class="app-sidebar" aria-label="Primary">
      <div class="brand-block">
        <span class="brand-mark">Q</span>
        <span class="brand-name">Quotation</span>
      </div>

      <nav class="module-nav">
        <button
          class="module-button"
          :class="{ 'module-button-active': activeModule === 'quotation' }"
          type="button"
          @click="activeModule = 'quotation'"
        >
          <i class="pi pi-file-edit" aria-hidden="true" />
          <span>Editor</span>
        </button>
        <button
          class="module-button"
          :class="{ 'module-button-active': activeModule === 'customers' }"
          type="button"
          @click="activeModule = 'customers'"
        >
          <i class="pi pi-address-book" aria-hidden="true" />
          <span>Customers</span>
        </button>
        <button
          class="module-button"
          :class="{ 'module-button-active': activeModule === 'settings' }"
          type="button"
          @click="activeModule = 'settings'"
        >
          <i class="pi pi-cog" aria-hidden="true" />
          <span>Settings</span>
        </button>
      </nav>
    </aside>

    <section class="app-main">
      <header class="app-header">
        <div>
          <p class="eyebrow">Quotation Software</p>
          <h1 class="page-title">{{ appTitle }}</h1>
        </div>
      </header>

      <div class="module-surface">
        <QuotationEditor
          v-show="activeModule === 'quotation'"
          :company-profile="companyProfile"
        />
        <CustomersPanel v-show="activeModule === 'customers'" />
        <SettingsPanel v-show="activeModule === 'settings'" v-model="companyProfile" />
      </div>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
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
  min-height: 70px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--surface-border);
  background: #fbfcfe;
  position: sticky;
  top: 0;
  z-index: 20;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.page-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 24px;
  line-height: 1.2;
}

.module-surface {
  flex: 1;
  padding: 12px 16px 16px;
}

@media (max-width: 900px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .app-sidebar {
    position: sticky;
    top: 0;
    z-index: 10;
    flex-direction: row;
    align-items: center;
    gap: 16px;
    padding: 10px 12px;
  }

  .module-nav {
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    overflow-x: auto;
  }

  .app-header {
    min-height: auto;
    padding: 12px;
  }

  .module-surface {
    padding: 10px;
  }
}
</style>
