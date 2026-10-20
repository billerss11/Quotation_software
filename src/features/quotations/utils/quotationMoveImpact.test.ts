import { describe, expect, it } from 'vitest'

import type { QuotationDraft, QuotationItem, QuotationRootItem } from '../types'
import { createInitialQuotation } from './quotationDraft'
import { createQuotationItem, createQuotationSectionHeader } from './quotationItems'
import { previewQuotationTreeMove } from './quotationMoveImpact'

describe('previewQuotationTreeMove', () => {
  it('reports a hidden destination price and reactivated final-child parent without mutation', () => {
    const quotation = createDraft([
      item('source', { unitCost: 100, children: [item('moving', { unitCost: 10 })] }),
      item('destination', { unitCost: 20 }),
    ])
    const before = JSON.stringify(quotation)
    const originalSource = quotation.majorItems[0]

    expect(previewQuotationTreeMove(quotation, 'moving', 'destination', 0)).toEqual({
      beforeTotal: 30,
      afterTotal: 110,
      requiresConfirmation: true,
      hiddenPriceItemName: 'destination',
      reactivatedPriceItemName: 'source',
    })
    expect(JSON.stringify(quotation)).toBe(before)
    expect(quotation.majorItems[0]).toBe(originalSource)
  })

  it('uses inherited markup and all ancestor quantities for the total change', () => {
    const quotation = createDraft([
      item('source', {
        quantity: 2,
        markupRate: 20,
        children: [item('moving', { quantity: 2, unitCost: 10 }), item('remaining', { unitCost: 1 })],
      }),
      item('destination', { quantity: 3, markupRate: 50, children: [item('existing', { unitCost: 5 })] }),
    ])

    expect(previewQuotationTreeMove(quotation, 'moving', 'destination', 1)).toEqual({
      beforeTotal: 72.9,
      afterTotal: 114.9,
      requiresConfirmation: true,
      hiddenPriceItemName: null,
      reactivatedPriceItemName: null,
    })
  })

  it.each([
    { unitCost: 80 },
    { pricingMethod: 'manual_price' as const, manualUnitPrice: 80 },
    { pricingMethod: 'manual_price' as const, manualUnitPrice: 0, unitCost: 80 },
  ])('warns for retained pricing at zero quantity: %j', (pricing) => {
    const quotation = createDraft([
      item('moving'),
      item('destination', { ...pricing, quantity: 0 }),
    ])

    expect(previewQuotationTreeMove(quotation, 'moving', 'destination', 0)).toEqual({
      beforeTotal: 0,
      afterTotal: 0,
      requiresConfirmation: true,
      hiddenPriceItemName: 'destination',
      reactivatedPriceItemName: null,
    })
  })

  it('reports a retained manual price when the final child leaves a zero-quantity parent', () => {
    const quotation = createDraft([
      item('source', {
        quantity: 0,
        pricingMethod: 'manual_price',
        manualUnitPrice: 120,
        children: [item('moving')],
      }),
    ])

    expect(previewQuotationTreeMove(quotation, 'moving', null, 1)).toEqual({
      beforeTotal: 0,
      afterTotal: 0,
      requiresConfirmation: true,
      hiddenPriceItemName: null,
      reactivatedPriceItemName: 'source',
    })
  })

  it('ignores inactive manual prices on cost-plus items', () => {
    const quotation = createDraft([
      item('moving'),
      item('destination', { manualUnitPrice: 100 }),
    ])

    expect(previewQuotationTreeMove(quotation, 'moving', 'destination', 0)).toMatchObject({
      requiresConfirmation: false,
      hiddenPriceItemName: null,
    })
  })

  it('preserves manual selling prices and uses normalized mixed tax, FX, and extra charges', () => {
    const quotation = createDraft([
      item('source', {
        taxClassId: 'goods',
        children: [
          item('moving', { costCurrency: 'EUR', unitCost: 10 }),
          item('manual', { pricingMethod: 'manual_price', manualUnitPrice: 7, markupRate: 90 }),
        ],
      }),
      item('destination', { taxClassId: 'services', children: [item('existing')] }),
    ])
    quotation.exchangeRates.EUR = 2
    quotation.totalsConfig = {
      globalMarkupRate: 0,
      taxMode: 'mixed',
      taxClasses: [
        { id: 'goods', label: 'Goods', rate: 10 },
        { id: 'services', label: 'Services', rate: 20 },
      ],
      defaultTaxClassId: 'goods',
      extraCharges: [{ id: 'shipping', label: 'Shipping', amount: 3 }],
    }

    expect(previewQuotationTreeMove(quotation, 'moving', 'destination', 1)).toEqual({
      beforeTotal: 32.7,
      afterTotal: 34.7,
      requiresConfirmation: true,
      hiddenPriceItemName: null,
      reactivatedPriceItemName: null,
    })
  })

  it('allows same-parent reorders and section reorders immediately', () => {
    const quotation = createDraft([
      item('parent', { unitCost: 100, children: [item('first', { unitCost: 10 }), item('second', { unitCost: 20 })] }),
      createQuotationSectionHeader('en-US', { id: 'section' }),
    ])

    expect(previewQuotationTreeMove(quotation, 'first', 'parent', 2)).toEqual({
      beforeTotal: 30,
      afterTotal: 30,
      requiresConfirmation: false,
      hiddenPriceItemName: null,
      reactivatedPriceItemName: null,
    })
    expect(previewQuotationTreeMove(quotation, 'section', null, 0)?.requiresConfirmation).toBe(false)
  })

  it('allows a price-neutral reparent when both groups remain groups', () => {
    const quotation = createDraft([
      item('source', { children: [item('moving', { unitCost: 10 }), item('remaining')] }),
      item('destination', { children: [item('existing')] }),
    ])

    expect(previewQuotationTreeMove(quotation, 'moving', 'destination', 1)).toMatchObject({
      beforeTotal: 10,
      afterTotal: 10,
      requiresConfirmation: false,
    })
  })

  it('returns null for no-ops and invalid moves', () => {
    const quotation = createDraft([
      item('root', { children: [item('group', { children: [item('leaf')] })] }),
      item('other'),
      createQuotationSectionHeader('en-US', { id: 'section' }),
    ])

    expect(previewQuotationTreeMove(quotation, 'root', null, 1)).toBeNull()
    expect(previewQuotationTreeMove(quotation, 'missing', null, 0)).toBeNull()
    expect(previewQuotationTreeMove(quotation, 'root', 'group', 0)).toBeNull()
    expect(previewQuotationTreeMove(quotation, 'other', 'leaf', 0)).toBeNull()
    expect(previewQuotationTreeMove(quotation, 'section', 'other', 0)).toBeNull()
    expect(previewQuotationTreeMove(quotation, 'other', null, NaN)).toBeNull()
  })
})

function item(id: string, overrides: Partial<QuotationItem> = {}) {
  return createQuotationItem('USD', { id, name: id, ...overrides })
}

function createDraft(majorItems: QuotationRootItem[]): QuotationDraft {
  const quotation = createInitialQuotation([], 'en-US')
  quotation.majorItems = majorItems
  quotation.totalsConfig.globalMarkupRate = 0
  return quotation
}
