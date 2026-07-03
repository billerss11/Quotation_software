import { describe, expect, it } from 'vitest'

import type { QuotationRootItem } from '../types'
import {
  createQuotationNavigatorSearchState,
  createSearchHighlightParts,
  createSearchMatchSnippet,
} from './quotationNavigatorSearch'

describe('createQuotationNavigatorSearchState', () => {
  it('treats queries shorter than two characters as inactive', () => {
    const state = createQuotationNavigatorSearchState(createRows(), 'p')

    expect(state.isActive).toBe(false)
    expect(state.matchCount).toBe(0)
    expect([...state.visibleIds]).toEqual([])
  })

  it('matches item names and keeps parent context expanded', () => {
    const state = createQuotationNavigatorSearchState(createRows(), 'MOTOR')

    expect(state.isActive).toBe(true)
    expect(state.matchCount).toBe(1)
    expect(state.firstMatchId).toBe('item-1-1-1')
    expect([...state.visibleIds]).toEqual(['item-1-1-1', 'item-1-1', 'item-1'])
    expect([...state.expandedIds]).toEqual(['item-1-1', 'item-1'])
    expect(state.nameMatchIds.has('item-1-1-1')).toBe(true)
  })

  it('expands a matching group with descendants as visible context', () => {
    const state = createQuotationNavigatorSearchState(createRows(), 'package')

    expect(state.matchCount).toBe(1)
    expect(state.firstMatchId).toBe('item-1')
    expect(state.nameMatchIds.has('item-1')).toBe(true)
    expect(state.visibleIds.has('item-1')).toBe(true)
    expect(state.visibleIds.has('item-1-1')).toBe(true)
    expect(state.visibleIds.has('item-1-1-1')).toBe(true)
    expect(state.expandedIds.has('item-1')).toBe(true)
    expect(state.expandedIds.has('item-1-1')).toBe(true)
  })

  it('matches item descriptions and section header titles', () => {
    const steelState = createQuotationNavigatorSearchState(createRows(), 'steel')
    const valveState = createQuotationNavigatorSearchState(createRows(), 'valve')

    expect(steelState.matchCount).toBe(2)
    expect(steelState.firstMatchId).toBe('item-2-1')
    expect(steelState.descriptionMatchIds.has('item-2-1')).toBe(true)
    expect(steelState.nameMatchIds.has('item-2-2')).toBe(true)
    expect([...steelState.visibleIds]).toEqual(['item-2-1', 'item-2-2', 'item-2'])

    expect(valveState.matchCount).toBe(1)
    expect(valveState.firstMatchId).toBe('section-1')
    expect(valveState.sectionTitleMatchIds.has('section-1')).toBe(true)
    expect([...valveState.visibleIds]).toEqual(['section-1'])
  })
})

describe('createSearchHighlightParts', () => {
  it('preserves original text casing while marking all matches', () => {
    expect(createSearchHighlightParts('Steel frame steel bolts', 'steel')).toEqual([
      { text: 'Steel', matched: true },
      { text: ' frame ', matched: false },
      { text: 'steel', matched: true },
      { text: ' bolts', matched: false },
    ])
  })
})

describe('createSearchMatchSnippet', () => {
  it('keeps a long description snippet centered around the match', () => {
    const snippet = createSearchMatchSnippet(
      'Includes mounting kit, wiring allowance, painted cover, and galvanized steel anchor hardware.',
      'steel',
      36,
    )

    expect(snippet).toContain('steel')
    expect(snippet.startsWith('...')).toBe(true)
  })
})

function createRows(): QuotationRootItem[] {
  return [
    {
      id: 'item-1',
      name: 'Pump package',
      description: '',
      quantity: 1,
      quantityUnit: 'set',
      unitCost: 0,
      costCurrency: 'USD',
      children: [
        {
          id: 'item-1-1',
          name: 'Pump skid',
          description: '',
          quantity: 1,
          quantityUnit: 'set',
          unitCost: 0,
          costCurrency: 'USD',
          children: [
            {
              id: 'item-1-1-1',
              name: 'Motor',
              description: '',
              quantity: 1,
              quantityUnit: 'pc',
              unitCost: 120,
              costCurrency: 'USD',
              children: [],
            },
          ],
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
      name: 'Base frame',
      description: '',
      quantity: 1,
      quantityUnit: 'pc',
      unitCost: 40,
      costCurrency: 'USD',
      children: [
        {
          id: 'item-2-1',
          name: 'Anchor bolts',
          description: 'Galvanized steel hardware',
          quantity: 4,
          quantityUnit: 'pc',
          unitCost: 5,
          costCurrency: 'USD',
          children: [],
        },
        {
          id: 'item-2-2',
          name: 'Steel washers',
          description: '',
          quantity: 4,
          quantityUnit: 'pc',
          unitCost: 1,
          costCurrency: 'USD',
          children: [],
        },
      ],
    },
  ]
}
