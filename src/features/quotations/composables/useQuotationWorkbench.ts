import { computed, nextTick, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import {
  loadAppSettings,
  saveAppSettings,
  RAIL_WIDTH_MAX,
  RAIL_WIDTH_MIN,
} from '@/shared/services/localAppSettingsStorage'

import type { QuotationWorkspaceMode } from './useQuotationWorkspace'
import { findQuotationItemFocusElement } from '../utils/quotationItemFocusTarget'

interface UseQuotationWorkbenchOptions {
  workspaceMode?: Ref<QuotationWorkspaceMode>
  focusedItemId: Ref<string | undefined>
  railElement?: Ref<HTMLElement | null | undefined>
  clearFocusedItem: () => void
  onSaveShortcut: () => void | Promise<void>
  onUndoShortcut?: () => void | Promise<void>
  onRedoShortcut?: () => void | Promise<void>
  onTogglePreview?: () => void | Promise<void>
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
  let pendingResizeClientX = 0
  let resizeAnimationFrame: number | null = null
  let focusResetTimeout: ReturnType<typeof window.setTimeout> | null = null

  const isEditorWorkspace = computed(() => activeWorkspaceMode.value === 'editor')

  function onResizeHandleMouseDown(event: MouseEvent) {
    resizeStartX = event.clientX
    resizeStartWidth = railWidth.value
    pendingResizeClientX = event.clientX
    isResizing.value = true
    window.addEventListener('mousemove', onResizeMouseMove)
    window.addEventListener('mouseup', onResizeMouseUp, { once: true })
  }

  function onResizeMouseMove(event: MouseEvent) {
    pendingResizeClientX = event.clientX

    if (resizeAnimationFrame !== null) {
      return
    }

    resizeAnimationFrame = window.requestAnimationFrame(() => {
      resizeAnimationFrame = null
      applyLiveResizeWidth(pendingResizeClientX)
    })
  }

  function resolveResizeWidth(clientX: number) {
    const delta = resizeStartX - clientX
    return Math.min(RAIL_WIDTH_MAX, Math.max(RAIL_WIDTH_MIN, resizeStartWidth + delta))
  }

  function applyLiveResizeWidth(clientX: number) {
    setRailElementWidth(resolveResizeWidth(clientX))
  }

  function commitResizeWidth(clientX: number) {
    const nextWidth = resolveResizeWidth(clientX)
    railWidth.value = nextWidth
    setRailElementWidth(nextWidth)
  }

  function setRailElementWidth(width: number) {
    const element = options.railElement?.value
    if (element) {
      element.style.width = `${width}px`
    }
  }

  function onResizeMouseUp() {
    if (resizeAnimationFrame !== null) {
      window.cancelAnimationFrame(resizeAnimationFrame)
      resizeAnimationFrame = null
    }

    commitResizeWidth(pendingResizeClientX)
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

  function isModifier(event: KeyboardEvent) {
    return event.ctrlKey || event.metaKey
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isModifier(event)) return

    const key = event.key.toLowerCase()
    const isUndoShortcut = key === 'z' && !event.shiftKey
    const isRedoShortcut = key === 'y' || (key === 'z' && event.shiftKey)

    if ((isUndoShortcut || isRedoShortcut) && isEditableShortcutTarget(event.target)) {
      return
    }

    if (key === 's' && !event.shiftKey) {
      event.preventDefault()
      void options.onSaveShortcut()
      return
    }

    if (isUndoShortcut && options.onUndoShortcut) {
      event.preventDefault()
      void options.onUndoShortcut()
      return
    }

    if (isRedoShortcut && options.onRedoShortcut) {
      event.preventDefault()
      void options.onRedoShortcut()
      return
    }

    if (key === 'b' && !event.shiftKey) {
      event.preventDefault()
      toggleSupportPanels()
      return
    }

    if (key === 'p' && !event.shiftKey && options.onTogglePreview) {
      event.preventDefault()
      void options.onTogglePreview()
      return
    }
  }

  onMounted(() => {
    const settings = loadAppSettings()
    supportPanelsCollapsed.value = settings.quotationSupportPanelsCollapsed
    railWidth.value = settings.quotationRailWidth
    setRailElementWidth(settings.quotationRailWidth)
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('mousemove', onResizeMouseMove)
    window.removeEventListener('mouseup', onResizeMouseUp)

    if (resizeAnimationFrame !== null) {
      window.cancelAnimationFrame(resizeAnimationFrame)
      resizeAnimationFrame = null
    }

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
      findQuotationItemFocusElement(document, focusedItemId)?.scrollIntoView({
        block: 'center',
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

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable
    || target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
  )
}
