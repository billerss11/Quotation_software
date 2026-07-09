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
    await nextTick()

    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(false)

    expect(history.undo()).toBe(true)
    expect(quotation.value.header.projectName).toBe('')
    expect(getFirstItemName(quotation.value)).toBe('New item')
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(true)

    expect(history.redo()).toBe(true)
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
      await nextTick()
    }

    for (let index = 0; index < 50; index += 1) {
      expect(history.undo()).toBe(true)
    }

    expect(quotation.value.header.projectName).toBe('Project 5')
    expect(history.undo()).toBe(false)
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
    await nextTick()
    quotation.value.header.projectName = 'Second'
    await nextTick()

    expect(history.undo()).toBe(true)
    expect(quotation.value.header.projectName).toBe('First')

    quotation.value.header.projectName = 'Replacement'
    await nextTick()

    expect(history.canRedo.value).toBe(false)
    expect(history.redo()).toBe(false)
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

    expect(history.undo()).toBe(true)
    expect(quotation.value.header.projectName).toBe('')
    expect(history.redo()).toBe(true)
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
