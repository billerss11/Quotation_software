<script setup lang="ts">
import Button from 'primevue/button'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { UserManualLocale } from '@/shared/contracts/quotationApp'

const emit = defineEmits<{
  backToEditor: []
}>()

const MANUAL_FILE_NAMES: Record<UserManualLocale, string> = {
  'en-US': 'Quotation-Software-User-Guide-en-US.docx',
  'zh-CN': 'Quotation-Software-User-Guide-zh-CN.docx',
}

const { t, locale } = useI18n()
const openingLocale = shallowRef<UserManualLocale | null>(null)
const statusMessage = shallowRef('')
const isDesktop = Boolean(window.quotationApp?.openUserManual)

const currentLocale = computed<UserManualLocale>(() =>
  locale.value === 'zh-CN' ? 'zh-CN' : 'en-US',
)
const guides = computed(() => (Object.keys(MANUAL_FILE_NAMES) as UserManualLocale[]).map(guideLocale => ({
  locale: guideLocale,
  name: t(`userManualEntry.languages.${guideLocale}`),
  fileName: MANUAL_FILE_NAMES[guideLocale],
  downloadUrl: `${import.meta.env.BASE_URL}${MANUAL_FILE_NAMES[guideLocale]}`,
})))

async function openGuide(guideLocale: UserManualLocale) {
  const bridge = window.quotationApp
  if (!bridge) {
    return
  }

  openingLocale.value = guideLocale
  statusMessage.value = ''

  try {
    const result = await bridge.openUserManual(guideLocale)
    statusMessage.value = result.ok
      ? t('userManualEntry.statuses.opened', { name: t(`userManualEntry.languages.${guideLocale}`) })
      : t('userManualEntry.statuses.openFailed', { error: result.error })
  } catch (error) {
    statusMessage.value = t('userManualEntry.statuses.openFailed', {
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    openingLocale.value = null
  }
}
</script>

<template>
  <section class="user-manual">
    <header class="manual-header">
      <div class="header-copy">
        <h1 class="manual-title">{{ t('userManualEntry.title') }}</h1>
        <p class="manual-description">{{ t('userManualEntry.description') }}</p>
      </div>
      <Button
        :label="t('userManualEntry.backToEditor')"
        icon="pi pi-arrow-left"
        severity="secondary"
        outlined
        @click="emit('backToEditor')"
      />
    </header>

    <div class="manual-content">
      <div class="guide-list">
        <article
          v-for="guide in guides"
          :key="guide.locale"
          class="guide-card"
          :class="{ 'guide-card-current': guide.locale === currentLocale }"
        >
          <div class="document-icon" aria-hidden="true">
            <i class="pi pi-file-word" />
          </div>

          <div class="guide-copy">
            <div class="guide-title-row">
              <h2 class="guide-title">{{ guide.name }}</h2>
              <span v-if="guide.locale === currentLocale" class="current-language">
                {{ t('userManualEntry.currentLanguage') }}
              </span>
            </div>
            <p class="guide-format">{{ t('userManualEntry.format') }}</p>
            <p class="guide-filename">{{ guide.fileName }}</p>
          </div>

          <Button
            v-if="isDesktop"
            :label="t('userManualEntry.actions.open')"
            icon="pi pi-external-link"
            :loading="openingLocale === guide.locale"
            :disabled="openingLocale !== null"
            @click="openGuide(guide.locale)"
          />
          <a
            v-else
            class="download-button"
            :href="guide.downloadUrl"
            :download="guide.fileName"
          >
            <i class="pi pi-download" aria-hidden="true" />
            <span>{{ t('userManualEntry.actions.download') }}</span>
          </a>
        </article>
      </div>

      <p v-if="statusMessage" class="status-message" aria-live="polite">
        {{ statusMessage }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.user-manual {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  color: var(--text-body);
}

.manual-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 24px;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-card);
  box-shadow: var(--shadow-control);
}

.header-copy {
  display: grid;
  gap: 4px;
}

.manual-title,
.manual-description,
.guide-title,
.guide-format,
.guide-filename,
.status-message {
  margin: 0;
}

.manual-title {
  color: var(--text-strong);
  font-size: 20px;
}

.manual-description {
  max-width: 74ch;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.55;
}

.manual-content {
  min-height: 0;
  padding: clamp(28px, 6vw, 72px);
  overflow: auto;
}

.guide-list {
  display: grid;
  gap: 16px;
  width: min(100%, 820px);
  margin-inline: auto;
}

.guide-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  padding: 22px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.guide-card-current {
  border-color: var(--accent-soft);
  background: color-mix(in srgb, var(--accent-surface) 35%, var(--surface-card));
}

.document-icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--accent-surface);
  color: var(--accent-hover);
  font-size: 23px;
}

.guide-copy {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.guide-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.guide-title {
  color: var(--text-strong);
  font-size: 16px;
}

.current-language {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--accent-surface);
  color: var(--accent-hover);
  font-size: 11px;
  font-weight: 700;
}

.guide-format,
.guide-filename {
  color: var(--text-muted);
  font-size: 12px;
}

.guide-filename {
  overflow: hidden;
  font-family: var(--font-mono, monospace);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.download-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 9px 14px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-md);
  background: var(--accent);
  color: var(--text-on-accent);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.download-button:hover {
  background: var(--accent-hover);
}

.download-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.status-message {
  width: min(100%, 820px);
  margin: 16px auto 0;
  color: var(--text-muted);
  font-size: 13px;
}

@media (max-width: 760px) {
  .manual-header,
  .guide-card {
    align-items: stretch;
  }

  .manual-header {
    flex-direction: column;
  }

  .guide-card {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .guide-card :deep(.p-button),
  .download-button {
    grid-column: 1 / -1;
  }
}
</style>
