import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createInitialQuotation } from '../utils/quotationDraft'

describe('useQuotationUndoHistory performance', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('defers expensive pending snapshot work until after the render tick', async () => {
    vi.useFakeTimers()
    const stringifySpy = vi.spyOn(JSON, 'stringify')
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

    stringifySpy.mockClear()
    quotation.value.header.projectName = 'Pump station'
    await nextTick()

    expect(history.canUndo.value).toBe(true)
    expect(stringifySpy).not.toHaveBeenCalled()

    vi.runOnlyPendingTimers()

    expect(stringifySpy).toHaveBeenCalled()
  })

  it('uses one serialization pass when creating a changed pending snapshot', async () => {
    vi.useFakeTimers()
    const stringifySpy = vi.spyOn(JSON, 'stringify')
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

    stringifySpy.mockClear()
    quotation.value.header.projectName = 'Pump station'
    await nextTick()
    vi.runOnlyPendingTimers()

    expect(history.canUndo.value).toBe(true)
    expect(stringifySpy).toHaveBeenCalledTimes(1)
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
    expect(cloneSerializable).toHaveBeenCalledTimes(1)
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
