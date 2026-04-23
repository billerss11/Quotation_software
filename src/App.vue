<script setup lang="ts">
import { computed, shallowRef } from 'vue'

import CustomersPanel from './features/customers/components/CustomersPanel.vue'
import QuotationEditor from './features/quotations/components/QuotationEditor.vue'
import SettingsPanel from './features/settings/components/SettingsPanel.vue'

type AppModule = 'quotation' | 'customers' | 'settings'

const activeModule = shallowRef<AppModule>('quotation')

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
        <QuotationEditor v-if="activeModule === 'quotation'" />
        <CustomersPanel v-else-if="activeModule === 'customers'" />
        <SettingsPanel v-else />
      </div>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  min-height: 100vh;
  color: #1f2937;
}

.app-sidebar {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 24px 18px;
  background: #152033;
  color: #f8fafc;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  display: inline-grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 8px;
  background: #2dd4bf;
  color: #0f172a;
  font-weight: 800;
}

.brand-name {
  font-size: 18px;
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
  min-height: 44px;
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
  background: #223149;
  color: #ffffff;
}

.app-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  background: #f4f7fb;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 104px;
  padding: 24px 32px 18px;
  border-bottom: 1px solid #d9e2ef;
  background: #ffffff;
}

.eyebrow {
  margin: 0 0 6px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.page-title {
  margin: 0;
  color: #0f172a;
  font-size: 30px;
  line-height: 1.2;
}

.module-surface {
  flex: 1;
  padding: 24px 32px 32px;
}

</style>
