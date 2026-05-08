import { describe, expect, it } from 'vitest'

import { isQuotationItem, moveQuotationTreeRow, normalizeQuotationItems } from './quotationItems'

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
