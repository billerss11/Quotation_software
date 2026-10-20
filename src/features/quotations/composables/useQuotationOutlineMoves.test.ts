import { shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuotationItem, QuotationRootItem } from '../types'
import { createInitialQuotation } from '../utils/quotationDraft'
import { createQuotationItem, findQuotationItem } from '../utils/quotationItems'
import { previewQuotationTreeMove } from '../utils/quotationMoveImpact'
import { useQuotationEditor } from './useQuotationEditor'
import { useQuotationOutlineMoves } from './useQuotationOutlineMoves'

describe('useQuotationOutlineMoves', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('previews a risky move and cancels without changing the quotation or adding undo entries', () => {
    const { editor, workflow, move, onMoved } = createHarness()
    const before = snapshot(editor.quotation.value)
    const totalsBefore = snapshot(editor.totals.value)
    const impact = previewQuotationTreeMove(editor.quotation.value, 'moving', 'destination', 0)

    expect(workflow.requestMove('moving', 'destination', 0, 'inside')).toBe(false)
    expect(workflow.pendingMove.value).toMatchObject({
      itemId: 'moving',
      targetParentId: 'destination',
      targetIndex: 0,
      dropMode: 'inside',
      impact,
    })
    expect(editor.quotation.value).toEqual(before)
    expect(editor.totals.value).toEqual(totalsBefore)
    expect(editor.canUndoQuotationChange.value).toBe(false)
    expect(move).not.toHaveBeenCalled()

    workflow.cancelMove()

    expect(workflow.pendingMove.value).toBeNull()
    expect(workflow.confirmMove()).toBe(false)
    expect(editor.quotation.value).toEqual(before)
    expect(editor.canUndoQuotationChange.value).toBe(false)
    expect(move).not.toHaveBeenCalled()
    expect(onMoved).not.toHaveBeenCalled()
  })

  it('confirms once and restores the exact tree and totals with one undo', () => {
    const { editor, workflow, move, onMoved, onStale } = createHarness()
    const before = snapshot(editor.quotation.value)
    const totalsBefore = snapshot(editor.totals.value)

    workflow.requestMove('moving', 'destination', 0, 'inside')
    expect(workflow.pendingMove.value?.impact).toMatchObject({ beforeTotal: 30, afterTotal: 110 })
    expect(workflow.confirmMove()).toBe(true)
    expect(workflow.confirmMove()).toBe(false)

    expect(workflow.pendingMove.value).toBeNull()
    expect(move).toHaveBeenCalledExactlyOnceWith('moving', 'destination', 0, 'inside')
    expect(onMoved).toHaveBeenCalledExactlyOnceWith('moving')
    expect(onStale).not.toHaveBeenCalled()
    expect(findQuotationItem(editor.quotation.value.majorItems, 'source')).toMatchObject({
      unitCost: 100,
      children: [],
    })
    expect(findQuotationItem(editor.quotation.value.majorItems, 'destination')).toMatchObject({
      unitCost: 20,
      children: [{ id: 'moving', unitCost: 10 }],
    })
    expect(editor.totals.value.grandTotal).toBe(110)
    const after = snapshot(editor.quotation.value)
    const totalsAfter = snapshot(editor.totals.value)

    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(editor.quotation.value).toEqual(before)
    expect(editor.totals.value).toEqual(totalsBefore)
    expect(editor.canUndoQuotationChange.value).toBe(false)
    expect(editor.redoLastQuotationChange().ok).toBe(true)
    expect(editor.quotation.value).toEqual(after)
    expect(editor.totals.value).toEqual(totalsAfter)
  })

  it('commits same-parent reorders immediately even when the parent retains a price', () => {
    const { editor, workflow, onMoved } = createHarness([
      item('parent', { unitCost: 100, children: [item('first', { unitCost: 10 }), item('second', { unitCost: 20 })] }),
    ])
    const totalsBefore = snapshot(editor.totals.value)

    expect(workflow.requestMove('first', 'parent', 2, 'after')).toBe(true)
    expect(workflow.pendingMove.value).toBeNull()
    expect(findQuotationItem(editor.quotation.value.majorItems, 'parent')?.children.map((child) => child.id))
      .toEqual(['second', 'first'])
    expect(editor.totals.value).toEqual(totalsBefore)
    expect(onMoved).toHaveBeenCalledExactlyOnceWith('first')
  })

  it('commits a pricing-neutral reparent immediately', () => {
    const { editor, workflow, move } = createHarness([
      item('source', { children: [item('moving', { unitCost: 10 }), item('remaining')] }),
      item('destination', { children: [item('existing', { unitCost: 20 })] }),
    ])
    const totalsBefore = snapshot(editor.totals.value)

    expect(workflow.requestMove('moving', 'destination', 1, 'inside')).toBe(true)
    expect(workflow.pendingMove.value).toBeNull()
    expect(move).toHaveBeenCalledExactlyOnceWith('moving', 'destination', 1, 'inside')
    expect(findQuotationItem(editor.quotation.value.majorItems, 'source')?.children.map((child) => child.id))
      .toEqual(['remaining'])
    expect(findQuotationItem(editor.quotation.value.majorItems, 'destination')?.children.map((child) => child.id))
      .toEqual(['existing', 'moving'])
    expect(editor.totals.value).toEqual(totalsBefore)
  })

  it('rejects a stale confirmation without adding a move to history', () => {
    const { editor, workflow, move, onMoved, onStale } = createHarness()
    const before = snapshot(editor.quotation.value)
    workflow.requestMove('moving', 'destination', 0)
    editor.updateItemField('destination', 'unitCost', 25)
    const edited = snapshot(editor.quotation.value)

    expect(workflow.confirmMove()).toBe(false)
    expect(workflow.pendingMove.value).toBeNull()
    expect(editor.quotation.value).toEqual(edited)
    expect(move).not.toHaveBeenCalled()
    expect(onMoved).not.toHaveBeenCalled()
    expect(onStale).toHaveBeenCalledOnce()
    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(editor.quotation.value).toEqual(before)
    expect(editor.canUndoQuotationChange.value).toBe(false)
  })

  it.each(['readOnly', 'busy'] as const)('blocks a request while %s', (guard) => {
    const { editor, workflow, move, flushPendingEdits, guards } = createHarness()
    const before = snapshot(editor.quotation.value)
    guards[guard].value = true

    expect(workflow.requestMove('moving', 'destination', 0)).toBe(false)
    expect(workflow.pendingMove.value).toBeNull()
    expect(flushPendingEdits).not.toHaveBeenCalled()
    expect(move).not.toHaveBeenCalled()
    expect(editor.quotation.value).toEqual(before)
    expect(editor.canUndoQuotationChange.value).toBe(false)
  })

  it.each(['readOnly', 'busy'] as const)('rechecks %s before confirming', (guard) => {
    const { editor, workflow, move, flushPendingEdits, guards, onStale } = createHarness()
    const before = snapshot(editor.quotation.value)
    workflow.requestMove('moving', 'destination', 0)
    guards[guard].value = true

    expect(workflow.confirmMove()).toBe(false)
    expect(workflow.pendingMove.value).toBeNull()
    expect(flushPendingEdits).toHaveBeenCalledOnce()
    expect(move).not.toHaveBeenCalled()
    expect(onStale).not.toHaveBeenCalled()
    expect(editor.quotation.value).toEqual(before)
    expect(editor.canUndoQuotationChange.value).toBe(false)
  })

  it('flushes pending edits before deciding whether the move needs confirmation', () => {
    const { editor, workflow, move, flushPendingEdits } = createHarness([
      item('source', { children: [item('moving', { unitCost: 10 }), item('remaining')] }),
      item('destination'),
    ])
    const before = snapshot(editor.quotation.value)
    expect(previewQuotationTreeMove(editor.quotation.value, 'moving', 'destination', 0)?.requiresConfirmation)
      .toBe(false)
    flushPendingEdits.mockImplementationOnce(() => {
      editor.updateItemField('destination', 'unitCost', 20)
    })

    expect(workflow.requestMove('moving', 'destination', 0)).toBe(false)
    expect(workflow.pendingMove.value?.impact).toEqual(
      previewQuotationTreeMove(editor.quotation.value, 'moving', 'destination', 0),
    )
    expect(workflow.pendingMove.value?.impact).toMatchObject({
      beforeTotal: 30,
      afterTotal: 10,
      hiddenPriceItemName: 'destination',
      requiresConfirmation: true,
    })
    expect(move).not.toHaveBeenCalled()

    workflow.cancelMove()
    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(editor.quotation.value).toEqual(before)
    expect(editor.canUndoQuotationChange.value).toBe(false)
  })

  it('flushes and rechecks pending edits again before confirmation', () => {
    const { editor, workflow, move, flushPendingEdits, onStale } = createHarness()
    const before = snapshot(editor.quotation.value)
    workflow.requestMove('moving', 'destination', 0)
    flushPendingEdits.mockImplementationOnce(() => {
      editor.updateItemField('destination', 'unitCost', 25)
    })

    expect(workflow.confirmMove()).toBe(false)
    expect(flushPendingEdits).toHaveBeenCalledTimes(2)
    expect(workflow.pendingMove.value).toBeNull()
    expect(move).not.toHaveBeenCalled()
    expect(onStale).toHaveBeenCalledOnce()
    expect(findQuotationItem(editor.quotation.value.majorItems, 'destination')?.unitCost).toBe(25)
    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(editor.quotation.value).toEqual(before)
    expect(editor.canUndoQuotationChange.value).toBe(false)
  })
})

function createHarness(majorItems: QuotationRootItem[] = [
  item('source', { unitCost: 100, children: [item('moving', { unitCost: 10 })] }),
  item('destination', { unitCost: 20 }),
]) {
  const editor = useQuotationEditor(shallowRef('en-US'))
  const quotation = createInitialQuotation([], 'en-US')
  quotation.majorItems = majorItems
  quotation.totalsConfig.globalMarkupRate = 0
  editor.quotation.value = quotation
  editor.resetQuotationChangeHistory()
  const guards = { readOnly: shallowRef(false), busy: shallowRef(false) }
  const flushPendingEdits = vi.fn<() => void>()
  const move = vi.fn(editor.moveQuotationTreeRow)
  const onMoved = vi.fn()
  const onStale = vi.fn()
  const workflow = useQuotationOutlineMoves({
    quotation: editor.quotation,
    canMove: () => !guards.readOnly.value && !guards.busy.value,
    flushPendingEdits,
    move,
    onMoved,
    onStale,
  })

  return { editor, workflow, guards, flushPendingEdits, move, onMoved, onStale }
}

function item(id: string, overrides: Partial<QuotationItem> = {}) {
  return createQuotationItem('USD', { id, name: id, ...overrides })
}

function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
