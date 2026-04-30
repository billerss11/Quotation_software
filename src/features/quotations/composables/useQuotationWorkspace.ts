import { shallowRef } from 'vue'

export type QuotationWorkspaceMode = 'editor' | 'analysis'

export function useQuotationWorkspace() {
  const workspaceMode = shallowRef<QuotationWorkspaceMode>('editor')
  const focusedItemId = shallowRef('')

  function openEditor() {
    workspaceMode.value = 'editor'
  }

  function openAnalysis() {
    workspaceMode.value = 'analysis'
  }

  function focusItemInEditor(itemId: string) {
    focusedItemId.value = itemId
    workspaceMode.value = 'editor'
  }

  function clearFocusedItem() {
    focusedItemId.value = ''
  }

  return {
    workspaceMode,
    focusedItemId,
    openEditor,
    openAnalysis,
    focusItemInEditor,
    clearFocusedItem,
  }
}
