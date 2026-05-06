<script setup lang="ts">
import Button from 'primevue/button'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SupportedLocale } from '@/shared/i18n/locale'
import { formatIsoDate } from '@/shared/utils/formatters'

import CompanyProfileLibraryEditor from './CompanyProfileLibraryEditor.vue'
import { useCompanyProfileLibrary } from '../composables/useCompanyProfileLibrary'

const {
  records,
  draft,
  selectedRecordId,
  hasSelectedRecord,
  selectRecord,
  startNewRecord,
  saveDraft,
  deleteSelectedRecord,
} = useCompanyProfileLibrary()

const { t, locale } = useI18n()
const currentLocale = computed(() => locale.value as SupportedLocale)
const statusMessage = shallowRef('')

function getDraftLabel() {
  return draft.value.companyName || draft.value.email || t('companyProfiles.list.untitled')
}

function handleSave() {
  saveDraft()
  statusMessage.value = t('companyProfiles.statuses.saved', { name: getDraftLabel() })
}

function handleDelete() {
  const deletedLabel = getDraftLabel()
  deleteSelectedRecord()
  statusMessage.value = t('companyProfiles.statuses.deleted', { name: deletedLabel })
}

function handleCreateRecord() {
  startNewRecord()
  statusMessage.value = t('companyProfiles.statuses.newReady')
}
</script>

<template>
  <section class="company-profiles-panel">
    <section class="toolbar-card" :aria-label="t('companyProfiles.toolbar.aria')">
      <div class="toolbar-copy">
        <div class="toolbar-title-row">
          <h2 class="toolbar-title">{{ t('companyProfiles.toolbar.title') }}</h2>
          <span class="record-count">{{ t('companyProfiles.toolbar.recordCount', { count: records.length }) }}</span>
        </div>
        <p class="toolbar-description">{{ t('companyProfiles.toolbar.description') }}</p>
      </div>

      <div class="toolbar-actions">
        <Button icon="pi pi-plus" :label="t('companyProfiles.toolbar.newProfile')" @click="handleCreateRecord" />
      </div>
    </section>

    <div v-if="statusMessage" class="status-banner" aria-live="polite">
      <i class="pi pi-info-circle" aria-hidden="true" />
      <span>{{ statusMessage }}</span>
    </div>

    <div class="company-layout">
      <section class="company-list-card" :aria-label="t('companyProfiles.list.aria')">
        <header class="list-heading">
          <div class="list-heading-copy">
            <h2>{{ t('companyProfiles.list.title') }}</h2>
            <p>{{ t('companyProfiles.list.description') }}</p>
          </div>
          <Button icon="pi pi-plus" :label="t('companyProfiles.list.new')" text @click="handleCreateRecord" />
        </header>

        <div v-if="records.length > 0" class="company-grid">
          <button
            v-for="record in records"
            :key="record.id"
            class="company-card"
            :class="{ 'company-card-active': record.id === selectedRecordId }"
            type="button"
            @click="selectRecord(record.id)"
          >
            <div class="company-card-main">
              <h3>{{ record.companyName || t('companyProfiles.list.untitled') }}</h3>
              <p>{{ record.phone || t('companyProfiles.list.noContactNumber') }}</p>
              <p>{{ record.email || t('companyProfiles.list.noEmail') }}</p>
            </div>
            <span class="company-card-side">{{ formatIsoDate(record.updatedAt.slice(0, 10), currentLocale) }}</span>
          </button>
        </div>

        <div v-else class="empty-library">
          <span class="empty-library-icon" aria-hidden="true">
            <i class="pi pi-building" />
          </span>
          <p>{{ t('companyProfiles.list.emptyTitle') }}</p>
          <span>{{ t('companyProfiles.list.emptyDescription') }}</span>
        </div>
      </section>

      <CompanyProfileLibraryEditor
        v-model="draft"
        :can-delete="hasSelectedRecord"
        @save="handleSave"
        @delete="handleDelete"
      />
    </div>
  </section>
</template>

<style scoped>
.company-profiles-panel {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.toolbar-card {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 22px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.toolbar-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1 1 320px;
}

.toolbar-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.1;
}

.toolbar-description {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
  text-wrap: pretty;
  max-width: 64ch;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.toolbar-actions :deep(.p-button) {
  border-radius: var(--radius-md);
}

.record-count {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--accent-surface);
  border: 1px solid var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.status-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border: 1px solid var(--accent-soft);
  border-radius: var(--radius-md);
  background: var(--accent-surface);
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
}

.company-layout {
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(0, 1.1fr);
  gap: 16px;
  min-width: 0;
}

.company-list-card {
  display: grid;
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
  min-height: 0;
}

.list-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.list-heading-copy {
  display: grid;
  gap: 3px;
}

.list-heading-copy h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 700;
}

.list-heading-copy p {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.company-grid {
  display: grid;
  gap: 8px;
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 2px;
}

.company-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.company-card:hover {
  border-color: var(--surface-border-strong);
  background: var(--surface-raised);
}

.company-card-active {
  border-color: var(--accent);
  background: var(--accent-surface);
}

.company-card-active:hover {
  background: var(--accent-surface);
}

.company-card-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.company-card h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.company-card p,
.company-card-side {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.company-card-side {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-subtle);
}

.empty-library {
  display: grid;
  gap: 8px;
  place-items: center;
  min-height: 220px;
  padding: 18px;
  text-align: center;
  color: var(--text-muted);
}

.empty-library p {
  margin: 0;
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 700;
}

.empty-library span {
  font-size: 13px;
  line-height: 1.5;
  max-width: 36ch;
}

.empty-library-icon {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--surface-muted);
  color: var(--accent);
  font-size: 20px;
}

@media (max-width: 960px) {
  .company-layout {
    grid-template-columns: 1fr;
  }
}
</style>
