import { describe, expect, it } from 'vitest'

import { useQuotationWorkspace } from './useQuotationWorkspace'

describe('useQuotationWorkspace', () => {
  it('starts in editor mode and can switch to analysis mode', () => {
    const { workspaceMode, openAnalysis } = useQuotationWorkspace()

    openAnalysis()

    expect(workspaceMode.value).toBe('analysis')
  })

  it('returns to the editor and records the requested item when drilling into analysis results', () => {
    const { workspaceMode, focusedItemId, openAnalysis, focusItemInEditor } = useQuotationWorkspace()

    openAnalysis()
    focusItemInEditor('major-2')

    expect(workspaceMode.value).toBe('editor')
    expect(focusedItemId.value).toBe('major-2')
  })

  it('clears the one-shot focus target after the editor consumes it', () => {
    const { focusedItemId, focusItemInEditor, clearFocusedItem } = useQuotationWorkspace()

    focusItemInEditor('major-1')
    clearFocusedItem()

    expect(focusedItemId.value).toBe('')
  })
})
