import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import type { QuotationItem } from '../types'
import { createInitialQuotation } from './quotationDraft'
import { createQuotationItem } from './quotationItems'
import {
  applyQuotationHistoryMutations,
  createCollectionSpliceMutation,
  createReplaceQuotationMutation,
  createSetValueMutation,
} from './quotationHistoryCommands'

describe('quotationHistoryCommands', () => {
  it('applies and reverses a scalar field change in place', () => {
    const quotation = ref(createQuotation())
    const quotationBefore = quotation.value
    const headerBefore = quotation.value.header
    const mutation = createSetValueMutation(
      { scope: 'header' },
      'projectName',
      quotation.value.header.projectName,
      'Hydrogen plant',
    )

    applyQuotationHistoryMutations(quotation, [mutation], 'forward')

    expect(quotation.value.header.projectName).toBe('Hydrogen plant')
    expect(quotation.value).toBe(quotationBefore)
    expect(quotation.value.header).toBe(headerBefore)

    applyQuotationHistoryMutations(quotation, [mutation], 'inverse')

    expect(quotation.value.header.projectName).toBe('')
    expect(quotation.value).toBe(quotationBefore)
    expect(quotation.value.header).toBe(headerBefore)
  })

  it('adds and removes an optional property', () => {
    const quotation = ref(createQuotation())
    const mutation = createSetValueMutation(
      { scope: 'exchangeRates' },
      'EUR',
      undefined,
      0.92,
      { beforeExists: false },
    )

    applyQuotationHistoryMutations(quotation, [mutation], 'forward')
    expect(quotation.value.exchangeRates.EUR).toBe(0.92)

    applyQuotationHistoryMutations(quotation, [mutation], 'inverse')
    expect('EUR' in quotation.value.exchangeRates).toBe(false)
  })

  it('resolves item targets by stable item id', () => {
    const quotation = ref(createQuotation())
    const root = quotation.value.majorItems[0] as QuotationItem
    root.children = [createQuotationItem('USD', { id: 'child-1', name: 'Compressor' })]
    const mutation = createSetValueMutation(
      { scope: 'item', itemId: 'child-1' },
      'quantity',
      1,
      4,
    )

    applyQuotationHistoryMutations(quotation, [mutation], 'forward')
    expect(root.children[0]?.quantity).toBe(4)

    applyQuotationHistoryMutations(quotation, [mutation], 'inverse')
    expect(root.children[0]?.quantity).toBe(1)
  })

  it('inserts and removes only the affected subtree', () => {
    const quotation = ref(createQuotation())
    const root = quotation.value.majorItems[0] as QuotationItem
    const child = createQuotationItem('USD', { id: 'child-1', name: 'Compressor' })
    const mutation = createCollectionSpliceMutation(
      { scope: 'itemChildren', itemId: root.id },
      0,
      [],
      [child],
    )

    applyQuotationHistoryMutations(quotation, [mutation], 'forward')
    expect(root.children).toHaveLength(1)
    expect(root.children[0]).toMatchObject({ id: 'child-1', name: 'Compressor' })

    root.children[0]!.name = 'Changed after insertion'
    applyQuotationHistoryMutations(quotation, [mutation], 'inverse')
    expect(root.children).toHaveLength(0)

    applyQuotationHistoryMutations(quotation, [mutation], 'forward')
    expect(root.children[0]?.name).toBe('Compressor')
  })

  it('reverses a multi-mutation move in reverse order', () => {
    const quotation = ref(createQuotation())
    const first = quotation.value.majorItems[0] as QuotationItem
    const second = createQuotationItem('USD', { id: 'item-2', name: 'Second' })
    quotation.value.majorItems.push(second)
    const remove = createCollectionSpliceMutation(
      { scope: 'rootItems' },
      0,
      [first],
      [],
    )
    const insert = createCollectionSpliceMutation(
      { scope: 'rootItems' },
      1,
      [],
      [first],
    )

    applyQuotationHistoryMutations(quotation, [remove, insert], 'forward')
    expect(quotation.value.majorItems.map((item) => item.id)).toEqual(['item-2', 'item-1'])

    applyQuotationHistoryMutations(quotation, [remove, insert], 'inverse')
    expect(quotation.value.majorItems.map((item) => item.id)).toEqual(['item-1', 'item-2'])
  })

  it('replaces a whole quotation without retaining a live payload', () => {
    const quotation = ref(createQuotation())
    const before = quotation.value
    const after = createQuotation()
    after.header.projectName = 'Replacement'
    const mutation = createReplaceQuotationMutation(before, after)

    after.header.projectName = 'Mutated source'
    applyQuotationHistoryMutations(quotation, [mutation], 'forward')
    expect(quotation.value.header.projectName).toBe('Replacement')
    expect(quotation.value).not.toBe(after)

    applyQuotationHistoryMutations(quotation, [mutation], 'inverse')
    expect(quotation.value.header.projectName).toBe('')
    expect(quotation.value).not.toBe(before)
  })
})

function createQuotation() {
  const quotation = createInitialQuotation([], 'en-US', {
    quotationNumber: 'Q-2026-001',
  })
  quotation.majorItems = [
    createQuotationItem('USD', { id: 'item-1', name: 'First' }),
  ]
  return quotation
}
