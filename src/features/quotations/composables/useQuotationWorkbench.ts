import { computed, nextTick, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import {
  loadAppSettings,
  saveAppSettings,
  RAIL_WIDTH_MAX,
  RAIL_WIDTH_MIN,
} from '@/shared/services/localAppSettingsStorage'

import type { QuotationWorkspaceMode } from './useQuotationWorkspace'

interface UseQuotationWorkbenchOptions {
  workspaceMode?: Ref<QuotationWorkspaceMode>
  focusedItemId: Ref<string | undefined>
  clearFocusedItem: () => void
  onSaveShortcut: () => void | Promise<void>
}

const FOCUS_RESET_DELAY_MS = 2200

export function useQuotationWorkbench(options: UseQuotationWorkbenchOptions) {
  const supportPanelsCollapsed = shallowRef(false)
  const railWidth = shallowRef(380)
  const isResizing = shallowRef(false)
  const isPreviewWindowOpen = shallowRef(false)
  const activeWorkspaceMode = options.workspaceMode ?? shallowRef<QuotationWorkspaceMode>('editor')

  let resizeStartX = 0
  let resizeStartWidth = 0
  let focusResetTimeout: ReturnType<typeof window.setTimeout> | null = null

  const isEditorWorkspace = computed(() => activeWorkspaceMode.value === 'editor')

  function onResizeHandleMouseDown(event: MouseEvent) {
    resizeStartX = event.clientX
    resizeStartWidth = railWidth.value
    isResizing.value = true
    window.addEventListener('mousemove', onResizeMouseMove)
    window.addEventListener('mouseup', onResizeMouseUp, { once: true })
  }

  function onResizeMouseMove(event: MouseEvent) {
    const delta = resizeStartX - event.clientX
    railWidth.value = Math.min(RAIL_WIDTH_MAX, Math.max(RAIL_WIDTH_MIN, resizeStartWidth + delta))
  }

  function onResizeMouseUp() {
    isResizing.value = false
    window.removeEventListener('mousemove', onResizeMouseMove)
    saveAppSettings({ quotationRailWidth: railWidth.value })
  }

  function toggleSupportPanels() {
    supportPanelsCollapsed.value = !supportPanelsCollapsed.value
    saveAppSettings({
      quotationSupportPanelsCollapsed: supportPanelsCollapsed.value,
    })
  }

  function openPreviewWindow() {
    isPreviewWindowOpen.value = true
  }

  function closePreviewWindow() {
    isPreviewWindowOpen.value = false
  }

  function handleKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void options.onSaveShortcut()
    }
  }

  onMounted(() => {
    const settings = loadAppSettings()
    supportPanelsCollapsed.value = settings.quotationSupportPanelsCollapsed
    railWidth.value = settings.quotationRailWidth
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('mousemove', onResizeMouseMove)
    window.removeEventListener('mouseup', onResizeMouseUp)

    if (focusResetTimeout) {
      window.clearTimeout(focusResetTimeout)
    }
  })

  watch(
    () => [activeWorkspaceMode.value, options.focusedItemId.value] as const,
    async ([workspaceMode, focusedItemId]) => {
      if (workspaceMode !== 'editor' || !focusedItemId) {
        return
      }

      await nextTick()
      document.querySelector(`[data-item-id="${focusedItemId}"]`)?.scrollIntoView({
        block: 'start',
      })

      if (focusResetTimeout) {
        window.clearTimeout(focusResetTimeout)
      }

      focusResetTimeout = window.setTimeout(() => {
        options.clearFocusedItem()
        focusResetTimeout = null
      }, FOCUS_RESET_DELAY_MS)
    },
  )

  return {
    supportPanelsCollapsed,
    railWidth,
    isResizing,
    isPreviewWindowOpen,
    isEditorWorkspace,
    onResizeHandleMouseDown,
    toggleSupportPanels,
    openPreviewWindow,
    closePreviewWindow,
  }
}
