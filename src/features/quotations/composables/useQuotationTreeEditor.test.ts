import { computed, ref, shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { QuotationItem } from '../types'
import { createInitialQuotation } from '../utils/quotationDraft'
import { applyQuotationHistoryMutations, type QuotationHistoryMutation } from '../utils/quotationHistoryCommands'
import { createQuotationItem, createQuotationSectionHeader, findQuotationItem } from '../utils/quotationItems'
import { useQuotationTreeEditor } from './useQuotationTreeEditor'

describe('useQuotationTreeEditor move validation', () => {
  it('does not create history for invalid moves or normalized no-ops', () => {
    const { editor, executeHistory, quotation } = setup()
    const before = JSON.stringify(quotation.value)

    expect(editor.moveQuotationTreeRow('missing', null, 0)).toBe(false)
    expect(editor.moveQuotationTreeRow('root', 'child', 0)).toBe(false)
    expect(editor.moveQuotationTreeRow('other', 'leaf', 0)).toBe(false)
    expect(editor.moveQuotationTreeRow('section', 'other', 0)).toBe(false)
    expect(editor.moveQuotationTreeRow('child', 'section', 0)).toBe(false)
    expect(editor.moveQuotationTreeRow('root', null, -10)).toBe(false)
    expect(editor.moveQuotationTreeRow('root', null, 1)).toBe(false)
    expect(editor.moveQuotationTreeRow('child', 'root', 1)).toBe(false)
    expect(editor.moveQuotationTreeRow('other', null, NaN)).toBe(false)
    expect(editor.moveQuotationTreeRow('other', null, 1.5)).toBe(false)

    expect(executeHistory).not.toHaveBeenCalled()
    expect(JSON.stringify(quotation.value)).toBe(before)
  })

  it('reparents with one reversible history transaction and a clamped index', () => {
    const { editor, executeHistory, quotation } = setup()
    const before = JSON.stringify(quotation.value)

    expect(editor.moveQuotationTreeRow('child', 'other', 99)).toBe(true)
    expect(executeHistory).toHaveBeenCalledTimes(1)
    const mutations = executeHistory.mock.calls[0]![0]
    expect(mutations).toHaveLength(2)
    expect(findQuotationItem(quotation.value.majorItems, 'root')!.children).toEqual([])
    expect(findQuotationItem(quotation.value.majorItems, 'other')!.children[0]!.id).toBe('child')
    const after = JSON.stringify(quotation.value)

    applyQuotationHistoryMutations(quotation, mutations, 'inverse')
    expect(JSON.stringify(quotation.value)).toBe(before)
    applyQuotationHistoryMutations(quotation, mutations, 'forward')
    expect(JSON.stringify(quotation.value)).toBe(after)
  })

  it('adjusts indexes for downward moves within the same collection', () => {
    const { editor, executeHistory, quotation } = setup()

    expect(editor.moveQuotationTreeRow('root', null, 99)).toBe(true)
    expect(quotation.value.majorItems.map((row) => row.id)).toEqual(['other', 'section', 'root'])
    expect(executeHistory).toHaveBeenCalledTimes(1)
  })
})

function setup() {
  const quotation = ref(createInitialQuotation([], 'en-US'))
  const leaf = createQuotationItem('USD', { id: 'leaf' })
  const child = createQuotationItem('USD', { id: 'child', children: [leaf] })
  const root = createQuotationItem('USD', { id: 'root', children: [child] })
  const other = createQuotationItem('USD', { id: 'other' })
  quotation.value.majorItems = [root, other, createQuotationSectionHeader('en-US', { id: 'section' })]
  const quotationItemById = computed(() => new Map(
    ['root', 'child', 'leaf', 'other'].map((id) => [id, findQuotationItem(quotation.value.majorItems, id)!] as [string, QuotationItem]),
  ))
  const executeHistory = vi.fn((mutations: readonly QuotationHistoryMutation[]) => {
    applyQuotationHistoryMutations(quotation, mutations, 'forward')
    return true
  })
  const editor = useQuotationTreeEditor({ quotation, uiLocale: shallowRef('en-US'), quotationItemById, executeHistory })
  return { editor, executeHistory, quotation }
}
