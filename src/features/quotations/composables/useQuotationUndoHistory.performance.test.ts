import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createInitialQuotation } from '../utils/quotationDraft'

describe('useQuotationUndoHistory performance', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('avoids duplicate full quotation clones when undoing a synced change', async () => {
    const cloneSerializable = vi.fn((value: unknown) => JSON.parse(JSON.stringify(value)))
    vi.doMock('@/shared/utils/clone', () => ({ cloneSerializable }))

    const { useQuotationUndoHistory } = await import('./useQuotationUndoHistory')
    const quotation = ref(createInitialQuotation([], 'en-US', {
      quotationNumber: 'Q-2026-001',
    }))
    const history = useQuotationUndoHistory({
      quotation,
      restoreQuotation: (nextQuotation) => {
        quotation.value = nextQuotation
      },
    })

    quotation.value.header.projectName = 'Pump station'
    await nextTick()

    cloneSerializable.mockClear()
    const undoResult = history.undo()

    expect(undoResult.ok).toBe(true)
    expect(quotation.value.header.projectName).toBe('')
    expect(cloneSerializable).toHaveBeenCalledTimes(2)
  })

  it('can skip pending-change scanning when undoing a known synced change', async () => {
    const cloneSerializable = vi.fn((value: unknown) => JSON.parse(JSON.stringify(value)))
    vi.doMock('@/shared/utils/clone', () => ({ cloneSerializable }))

    const { useQuotationUndoHistory } = await import('./useQuotationUndoHistory')
    const quotation = ref(createInitialQuotation([], 'en-US', {
      quotationNumber: 'Q-2026-001',
    }))
    const history = useQuotationUndoHistory({
      quotation,
      restoreQuotation: (nextQuotation) => {
        quotation.value = nextQuotation
      },
    })

    quotation.value.header.projectName = 'Pump station'
    await nextTick()

    cloneSerializable.mockClear()
    const undoResult = history.undo({ skipPendingCheck: true })

    expect(undoResult.ok).toBe(true)
    expect(quotation.value.header.projectName).toBe('')
    expect(cloneSerializable).toHaveBeenCalledTimes(1)
  })
})
