<script setup lang="ts">
import { computed } from 'vue'

import type { QuotationHistoryAction } from '../composables/useQuotationUndoHistory'

const props = defineProps<{
  action: QuotationHistoryAction
  title: string
  detail: string
}>()

const iconClass = computed(() => (props.action === 'undo' ? 'pi pi-undo' : 'pi pi-replay'))
</script>

<template>
  <div
    class="quotation-history-notice"
    :class="`quotation-history-notice--${props.action}`"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <span class="quotation-history-notice-icon" aria-hidden="true">
      <i :class="iconClass" />
    </span>
    <span class="quotation-history-notice-copy">
      <strong>{{ props.title }}</strong>
      <span>{{ props.detail }}</span>
    </span>
  </div>
</template>

<style scoped>
.quotation-history-notice {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 80;
  display: inline-flex;
  max-width: min(460px, calc(100vw - 40px));
  min-width: 280px;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
  box-shadow: var(--shadow-elevated);
  color: var(--text-body);
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.quotation-history-notice--undo {
  border-color: color-mix(in srgb, var(--warning) 34%, var(--surface-border));
}

.quotation-history-notice--redo {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--surface-border));
}

.quotation-history-notice-icon {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  color: var(--text-strong);
}

.quotation-history-notice--undo .quotation-history-notice-icon {
  background: var(--warning-soft);
  color: var(--warning);
}

.quotation-history-notice--redo .quotation-history-notice-icon {
  background: var(--accent-surface);
  color: var(--accent-hover);
}

.quotation-history-notice-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.quotation-history-notice-copy strong,
.quotation-history-notice-copy span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quotation-history-notice-copy strong {
  color: var(--text-strong);
  font-size: 13px;
  line-height: 1.2;
}

.quotation-history-notice-copy span {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.3;
}
</style>
