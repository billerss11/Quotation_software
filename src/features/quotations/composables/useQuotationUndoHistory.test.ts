import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { isQuotationItem } from '../utils/quotationItems'
import { createInitialQuotation } from '../utils/quotationDraft'
import { useQuotationUndoHistory } from './useQuotationUndoHistory'

describe('useQuotationUndoHistory', () => {
  it('undoes and redoes deep quotation edits', async () => {
    const quotation = ref(createTestQuotation())
    const history = useQuotationUndoHistory({
      quotation,
      restoreQuotation: (nextQuotation) => {
        quotation.value = nextQuotation
      },
    })

    quotation.value.header.projectName = 'Pump station'
    const firstItem = quotation.value.majorItems[0]
    if (firstItem && isQuotationItem(firstItem)) {
      firstItem.name = 'Control panel'
    }
    await flushHistorySnapshot()

    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(false)

    const undoResult = history.undo()
    expect(undoResult.ok).toBe(true)
    if (!undoResult.ok) throw new Error('Expected undo to succeed')
    expect(undoResult.action).toBe('undo')
    expect(undoResult.change?.before.header.projectName).toBe('Pump station')
    expect(undoResult.change?.after.header.projectName).toBe('')
    expect(quotation.value.header.projectName).toBe('')
    expect(getFirstItemName(quotation.value)).toBe('New item')
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(true)

    const redoResult = history.redo()
    expect(redoResult.ok).toBe(true)
    if (!redoResult.ok) throw new Error('Expected redo to succeed')
    expect(redoResult.action).toBe('redo')
    expect(redoResult.change?.before.header.projectName).toBe('')
    expect(redoResult.change?.after.header.projectName).toBe('Pump station')
    expect(quotation.value.header.projectName).toBe('Pump station')
    expect(getFirstItemName(quotation.value)).toBe('Control panel')
  })

  it('keeps only the latest 50 undo changes by default', async () => {
    const quotation = ref(createTestQuotation())
    const history = useQuotationUndoHistory({
      quotation,
      restoreQuotation: (nextQuotation) => {
        quotation.value = nextQuotation
      },
    })

    for (let index = 1; index <= 55; index += 1) {
      quotation.value.header.projectName = `Project ${index}`
      await flushHistorySnapshot()
    }

    for (let index = 0; index < 50; index += 1) {
      expect(history.undo().ok).toBe(true)
    }

    expect(quotation.value.header.projectName).toBe('Project 5')
    expect(history.undo().ok).toBe(false)
    expect(quotation.value.header.projectName).toBe('Project 5')
  })

  it('clears redo history after a new edit follows undo', async () => {
    const quotation = ref(createTestQuotation())
    const history = useQuotationUndoHistory({
      quotation,
      restoreQuotation: (nextQuotation) => {
        quotation.value = nextQuotation
      },
    })

    quotation.value.header.projectName = 'First'
    await flushHistorySnapshot()
    quotation.value.header.projectName = 'Second'
    await flushHistorySnapshot()

    expect(history.undo().ok).toBe(true)
    expect(quotation.value.header.projectName).toBe('First')

    quotation.value.header.projectName = 'Replacement'
    await flushHistorySnapshot()

    expect(history.canRedo.value).toBe(false)
    expect(history.redo().ok).toBe(false)
    expect(quotation.value.header.projectName).toBe('Replacement')
  })

  it('undoes a same-tick edit before the watcher flushes', () => {
    const quotation = ref(createTestQuotation())
    const history = useQuotationUndoHistory({
      quotation,
      restoreQuotation: (nextQuotation) => {
        quotation.value = nextQuotation
      },
    })

    quotation.value.header.projectName = 'Immediate edit'

    const undoResult = history.undo()
    expect(undoResult.ok).toBe(true)
    if (!undoResult.ok) throw new Error('Expected undo to succeed')
    expect(undoResult.change?.before.header.projectName).toBe('Immediate edit')
    expect(undoResult.change?.after.header.projectName).toBe('')
    expect(quotation.value.header.projectName).toBe('')

    const redoResult = history.redo()
    expect(redoResult.ok).toBe(true)
    if (!redoResult.ok) throw new Error('Expected redo to succeed')
    expect(redoResult.change?.before.header.projectName).toBe('')
    expect(redoResult.change?.after.header.projectName).toBe('Immediate edit')
    expect(quotation.value.header.projectName).toBe('Immediate edit')
  })
})

function createTestQuotation() {
  return createInitialQuotation([], 'en-US', {
    quotationNumber: 'Q-2026-001',
  })
}

function getFirstItemName(quotation: ReturnType<typeof createTestQuotation>) {
  const firstItem = quotation.majorItems[0]
  return firstItem && isQuotationItem(firstItem) ? firstItem.name : ''
}

async function flushHistorySnapshot() {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
}
