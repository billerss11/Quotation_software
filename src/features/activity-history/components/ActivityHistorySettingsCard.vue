<script setup lang="ts">
import Button from 'primevue/button'
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { getQuotationRuntime } from '@/shared/runtime/quotationRuntime'

const { t } = useI18n()
const runtime = getQuotationRuntime()
const statusMessage = shallowRef('')

async function openActivityHistoryFolder() {
  try {
    const result = await runtime.openActivityHistoryFolder()
    statusMessage.value = result.ok
      ? t('settings.activityHistory.opened', { path: result.folderPath })
      : t('settings.activityHistory.openFailed', { error: result.error })
  } catch (error) {
    statusMessage.value = t('settings.activityHistory.openFailed', {
      error: error instanceof Error ? error.message : t('settings.activityHistory.unknownError'),
    })
  }
}
</script>

<template>
  <section class="activity-history-card" :aria-label="t('settings.activityHistory.aria')">
    <div class="activity-history-copy">
      <h3>{{ t('settings.activityHistory.title') }}</h3>
      <p>{{ t('settings.activityHistory.description') }}</p>
      <dl>
        <div>
          <dt>{{ t('settings.activityHistory.folderLabel') }}</dt>
          <dd>Quotation Activity History - Safe to Delete</dd>
        </div>
        <div>
          <dt>{{ t('settings.activityHistory.maximumSizeLabel') }}</dt>
          <dd>100 MB</dd>
        </div>
      </dl>
      <p>{{ t('settings.activityHistory.safeDelete') }}</p>
      <p>{{ t('settings.activityHistory.recreated') }}</p>
    </div>

    <Button
      icon="pi pi-folder-open"
      :label="t('settings.activityHistory.openFolder')"
      severity="secondary"
      outlined
      @click="openActivityHistoryFolder"
    />

    <div v-if="statusMessage" class="activity-history-status" role="status" aria-live="polite">
      {{ statusMessage }}
    </div>
  </section>
</template>

<style scoped>
.activity-history-card { display: grid; gap: 14px; padding-top: 22px; border-top: 1px solid var(--surface-border); }
.activity-history-copy { display: grid; gap: 7px; }
.activity-history-copy h3 { margin: 0; color: var(--text-strong); font-size: 16px; }
.activity-history-copy p { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.5; }
.activity-history-copy dl { display: grid; gap: 6px; margin: 4px 0; }
.activity-history-copy dl div { display: flex; flex-wrap: wrap; gap: 6px; font-size: 13px; }
.activity-history-copy dt { color: var(--text-body); font-weight: 700; }
.activity-history-copy dd { margin: 0; color: var(--text-muted); }
.activity-history-card :deep(.p-button) { width: max-content; }
.activity-history-status { overflow-wrap: anywhere; color: var(--text-muted); font-size: 12px; }
</style>
