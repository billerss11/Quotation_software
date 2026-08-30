import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { createInitialQuotation } from '../utils/quotationDraft'
import { createQuotationItemFieldChangeSummary } from '../utils/quotationHistoryChangeSummary'
import {
  createCollectionSpliceMutation,
  createSetValueMutation,
} from '../utils/quotationHistoryCommands'
import { createQuotationItem } from '../utils/quotationItems'
import { useQuotationUndoHistory } from './useQuotationUndoHistory'

describe('useQuotationUndoHistory', () => {
  it('undoes and redoes same-tick mutations as one entry', () => {
    const quotation = ref(createTestQuotation())
    const history = useQuotationUndoHistory({ quotation })
    const item = quotation.value.majorItems[0]
    if (!item || 'kind' in item) throw new Error('Expected quotation item')

    history.execute([
      createSetValueMutation({ scope: 'header' }, 'projectName', '', 'Pump station'),
    ])
    history.execute([
      createSetValueMutation({ scope: 'item', itemId: item.id }, 'name', item.name, 'Control panel'),
    ])

    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(false)
    expect(quotation.value.header.projectName).toBe('Pump station')
    expect(item.name).toBe('Control panel')

    expect(history.undo().ok).toBe(true)
    expect(quotation.value.header.projectName).toBe('')
    expect(item.name).toBe('New item')
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(true)

    expect(history.redo().ok).toBe(true)
    expect(quotation.value.header.projectName).toBe('Pump station')
    expect(item.name).toBe('Control panel')
  })

  it('keeps only the latest 50 undo changes by default', async () => {
    const quotation = ref(createTestQuotation())
    const history = useQuotationUndoHistory({ quotation })

    for (let index = 1; index <= 55; index += 1) {
      history.execute([
        createSetValueMutation(
          { scope: 'header' },
          'projectName',
          quotation.value.header.projectName,
          `Project ${index}`,
        ),
      ])
      await flushHistoryEntry()
    }

    for (let index = 0; index < 50; index += 1) {
      expect(history.undo().ok).toBe(true)
    }

    expect(quotation.value.header.projectName).toBe('Project 5')
    expect(history.undo().ok).toBe(false)
  })

  it('clears redo history after a new edit follows undo', async () => {
    const quotation = ref(createTestQuotation())
    const history = useQuotationUndoHistory({ quotation })

    history.execute([createSetValueMutation({ scope: 'header' }, 'projectName', '', 'First')])
    await flushHistoryEntry()
    history.execute([createSetValueMutation({ scope: 'header' }, 'projectName', 'First', 'Second')])
    await flushHistoryEntry()

    expect(history.undo().ok).toBe(true)
    history.execute([createSetValueMutation({ scope: 'header' }, 'projectName', 'First', 'Replacement')])

    expect(history.canRedo.value).toBe(false)
    expect(history.redo().ok).toBe(false)
    expect(quotation.value.header.projectName).toBe('Replacement')
  })

  it('undoes an edit before the pending entry flushes', () => {
    const quotation = ref(createTestQuotation())
    const history = useQuotationUndoHistory({ quotation })
    history.execute([createSetValueMutation({ scope: 'header' }, 'projectName', '', 'Immediate edit')])

    expect(history.undo().ok).toBe(true)
    expect(quotation.value.header.projectName).toBe('')
    expect(history.redo().ok).toBe(true)
    expect(quotation.value.header.projectName).toBe('Immediate edit')
  })

  it('resets pending, undo, and redo state at the current quotation', () => {
    const quotation = ref(createTestQuotation())
    const history = useQuotationUndoHistory({ quotation })
    history.execute([createSetValueMutation({ scope: 'header' }, 'projectName', '', 'Current')])

    history.reset()

    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
    expect(history.undo().ok).toBe(false)
    expect(quotation.value.header.projectName).toBe('Current')
  })

  it('does not record no-op mutations', () => {
    const quotation = ref(createTestQuotation())
    const history = useQuotationUndoHistory({ quotation })
    const executed = history.execute([
      createSetValueMutation({ scope: 'header' }, 'projectName', '', ''),
      createCollectionSpliceMutation({ scope: 'rootItems' }, 0, [], []),
    ])

    expect(executed).toBe(false)
    expect(history.canUndo.value).toBe(false)
  })

  it('returns directional compact summaries without complete drafts', () => {
    const quotation = ref(createTestQuotation())
    const history = useQuotationUndoHistory({ quotation })
    const item = quotation.value.majorItems[0]
    if (!item || 'kind' in item) throw new Error('Expected quotation item')
    const summary = createQuotationItemFieldChangeSummary(item.id, item.name, 'quantity', 1, 3)
    history.execute([
      createSetValueMutation({ scope: 'item', itemId: item.id }, 'quantity', 1, 3),
    ], summary)

    const undoResult = history.undo()
    expect(undoResult).toMatchObject({
      ok: true,
      action: 'undo',
      change: {
        summary: {
          kind: 'itemFieldChanged',
          previousValue: '3',
          nextValue: '1',
        },
      },
    })
    expect(undoResult.ok && 'before' in undoResult.change).toBe(false)

    expect(history.redo()).toMatchObject({
      ok: true,
      action: 'redo',
      change: {
        summary: {
          kind: 'itemFieldChanged',
          previousValue: '1',
          nextValue: '3',
        },
      },
    })
  })

  it('reports one committed change plus precise undo and redo events', async () => {
    const quotation = ref(createTestQuotation())
    const onCommitted = vi.fn()
    const history = useQuotationUndoHistory({ quotation, onCommitted })
    const summary = createQuotationItemFieldChangeSummary('item-1', 'New item', 'quantity', 1, 3)

    history.execute([
      createSetValueMutation({ scope: 'item', itemId: 'item-1' }, 'quantity', 1, 3),
    ], summary)
    await flushHistoryEntry()
    history.undo()
    history.redo()

    expect(onCommitted).toHaveBeenCalledTimes(3)
    expect(onCommitted.mock.calls[0]?.[0]).toEqual({ action: 'change', summary })
    expect(onCommitted.mock.calls[1]?.[0]).toMatchObject({
      action: 'undo',
      summary: { previousValue: '3', nextValue: '1' },
    })
    expect(onCommitted.mock.calls[2]?.[0]).toEqual({ action: 'redo', summary })
  })

  it('does not notify for no-op changes or history reset', async () => {
    const quotation = ref(createTestQuotation())
    const onCommitted = vi.fn()
    const history = useQuotationUndoHistory({ quotation, onCommitted })

    history.execute([createSetValueMutation({ scope: 'header' }, 'projectName', '', '')])
    history.execute([createSetValueMutation({ scope: 'header' }, 'projectName', '', 'Startup load')])
    history.reset()
    await flushHistoryEntry()

    expect(onCommitted).not.toHaveBeenCalled()
  })
})

function createTestQuotation() {
  const quotation = createInitialQuotation([], 'en-US', {
    quotationNumber: 'Q-2026-001',
  })
  quotation.majorItems = [createQuotationItem('USD', { id: 'item-1' })]
  return quotation
}

async function flushHistoryEntry() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}
