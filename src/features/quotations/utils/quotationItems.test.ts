import { describe, expect, it } from 'vitest'

import { getQuotationTreeMoveError, isQuotationItem, moveQuotationTreeRow, normalizeQuotationItems, removeQuotationItem } from './quotationItems'

describe('normalizeQuotationItems', () => {
  it('preserves root-level section headers alongside priced items', () => {
    const items = normalizeQuotationItems([
      {
        id: 'section-1',
        kind: 'section_header',
        title: 'Valve',
      },
      {
        id: 'item-1',
        name: 'Valve body',
        quantity: 2,
        quantityUnit: 'ea',
        unitCost: 60,
        costCurrency: 'JPY',
        children: [],
      },
    ], 'USD', 'en-US')

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      id: 'section-1',
      kind: 'section_header',
      title: 'Valve',
    })
    expect(items[1]).toMatchObject({
      id: 'item-1',
      name: 'Valve body',
      costCurrency: 'JPY',
    })
  })

  it('preserves supported dynamic cost currencies', () => {
    const items = normalizeQuotationItems([
      {
        id: 'item-1',
        name: 'Valve body',
        quantity: 2,
        quantityUnit: 'ea',
        unitCost: 60,
        costCurrency: 'JPY',
        children: [],
      },
    ], 'USD', 'en-US')

    expect(isQuotationItem(items[0]) ? items[0].costCurrency : undefined).toBe('JPY')
  })

  it('falls back invalid cost currencies to the provided fallback currency', () => {
    const items = normalizeQuotationItems([
      {
        id: 'item-1',
        name: 'Valve body',
        quantity: 2,
        quantityUnit: 'ea',
        unitCost: 60,
        costCurrency: 'ZZZ',
        children: [],
      },
    ], 'USD', 'en-US')

    expect(isQuotationItem(items[0]) ? items[0].costCurrency : undefined).toBe('USD')
  })
})

describe('getQuotationTreeMoveError', () => {
  it.each([
    { itemId: 'missing', parentId: null, index: 0, error: 'not_found' },
    { itemId: 'item-1-1', parentId: 'missing', index: 0, error: 'not_found' },
    { itemId: 'section-1', parentId: 'item-1', index: 0, error: 'section_parent' },
    { itemId: 'item-1-1', parentId: 'section-1', index: 0, error: 'section_parent' },
    { itemId: 'item-1', parentId: 'item-1', index: 0, error: 'cycle' },
    { itemId: 'item-1', parentId: 'item-1-1', index: 0, error: 'cycle' },
    { itemId: 'item-1', parentId: 'item-2-1', index: 0, error: 'depth' },
    { itemId: 'item-1-1', parentId: 'item-2-1-1', index: 0, error: 'depth' },
    { itemId: 'item-1', parentId: null, index: 0, error: 'noop' },
    { itemId: 'item-1', parentId: null, index: 1, error: 'noop' },
    { itemId: 'item-1-1', parentId: 'item-1', index: 1, error: 'noop' },
    { itemId: 'section-1', parentId: null, index: 2, error: 'noop' },
    { itemId: 'item-1', parentId: null, index: NaN, error: 'invalid_index' },
    { itemId: 'item-1', parentId: null, index: Infinity, error: 'invalid_index' },
    { itemId: 'item-1', parentId: null, index: 1.5, error: 'invalid_index' },
  ])('rejects $error for $itemId -> $parentId at $index without changing rows', ({ itemId, parentId, index, error }) => {
    const items = createRootRows()
    const before = JSON.stringify(items)

    expect(getQuotationTreeMoveError(items, itemId, parentId, index)).toBe(error)
    moveQuotationTreeRow(items, itemId, parentId, index, 'inside')

    expect(JSON.stringify(items)).toBe(before)
  })

  it('accepts clamped indexes and adjusts same-parent insertion positions', () => {
    const items = createRootRows()
    expect(getQuotationTreeMoveError(items, 'item-2', null, -20)).toBeNull()
    moveQuotationTreeRow(items, 'item-2', null, -20, 'before')
    expect(items.map((item) => item.id)).toEqual(['item-2', 'item-1', 'section-1'])

    expect(getQuotationTreeMoveError(items, 'item-2', null, 99)).toBeNull()
    moveQuotationTreeRow(items, 'item-2', null, 99, 'after')
    expect(items.map((item) => item.id)).toEqual(['item-1', 'section-1', 'item-2'])
    expect(getQuotationTreeMoveError(items, 'item-2', null, 99)).toBe('noop')
  })
})

describe('moveQuotationTreeRow', () => {
  it('reparents a nested row into a different parent', () => {
    const items = createRootRows()

    moveQuotationTreeRow(items, 'item-1-1', 'item-2', 0, 'inside')

    expect((items[0] as TestItem).children).toHaveLength(0)
    expect((items[2] as TestItem).children.map((child) => child.id)).toEqual([
      'item-1-1',
      'item-2-1',
    ])
  })

  it('moves a nested row to the root before a section header', () => {
    const items = createRootRows()

    moveQuotationTreeRow(items, 'item-1-1', null, 1, 'before')

    expect(items.map((item) => item.id)).toEqual([
      'item-1',
      'item-1-1',
      'section-1',
      'item-2',
    ])
  })

  it('rejects moving a row into its own descendant', () => {
    const items = createRootRows()
    const snapshot = JSON.stringify(items)

    moveQuotationTreeRow(items, 'item-1', 'item-1-1', 0, 'inside')

    expect(JSON.stringify(items)).toBe(snapshot)
  })

  it('rejects moves that would exceed depth three', () => {
    const items = createRootRows()
    const snapshot = JSON.stringify(items)

    moveQuotationTreeRow(items, 'item-1', 'item-2-1', 0, 'inside')

    expect(JSON.stringify(items)).toBe(snapshot)
  })

  it('keeps section headers root-only', () => {
    const items = createRootRows()
    const snapshot = JSON.stringify(items)

    moveQuotationTreeRow(items, 'section-1', 'item-2', 0, 'inside')

    expect(JSON.stringify(items)).toBe(snapshot)
  })
})

describe('removeQuotationItem', () => {
  it('preserves object identity for unrelated branches', () => {
    const items = createRootRows()
    const rootOne = items[0]
    const section = items[1]
    const rootTwo = items[2] as TestItem
    const rootTwoGroup = rootTwo.children[0]

    const nextItems = removeQuotationItem(items, 'item-1-1')

    expect(nextItems[0]).not.toBe(rootOne)
    expect(nextItems[1]).toBe(section)
    expect(nextItems[2]).toBe(rootTwo)
    expect((nextItems[2] as TestItem).children[0]).toBe(rootTwoGroup)
  })
})

type TestItem = {
  id: string
  name: string
  description: string
  quantity: number
  quantityUnit: string
  unitCost: number
  costCurrency: string
  children: TestItem[]
}

function createRootRows() {
  return normalizeQuotationItems([
    {
      id: 'item-1',
      name: 'Root one',
      quantity: 1,
      quantityUnit: 'EA',
      unitCost: 100,
      costCurrency: 'USD',
      children: [
        {
          id: 'item-1-1',
          name: 'Child one',
          quantity: 1,
          quantityUnit: 'EA',
          unitCost: 10,
          costCurrency: 'USD',
          children: [],
        },
      ],
    },
    {
      id: 'section-1',
      kind: 'section_header',
      title: 'Valve section',
    },
    {
      id: 'item-2',
      name: 'Root two',
      quantity: 1,
      quantityUnit: 'EA',
      unitCost: 200,
      costCurrency: 'USD',
      children: [
        {
          id: 'item-2-1',
          name: 'Group two',
          quantity: 1,
          quantityUnit: 'EA',
          unitCost: 0,
          costCurrency: 'USD',
          children: [
            {
              id: 'item-2-1-1',
              name: 'Leaf two',
              quantity: 1,
              quantityUnit: 'EA',
              unitCost: 20,
              costCurrency: 'USD',
              children: [],
            },
          ],
        },
      ],
    },
  ], 'USD', 'en-US')
}
