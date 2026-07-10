import { describe, expect, it } from 'vitest'

import type { ExchangeRateTable, QuotationItem } from '../types'
import {
  collectItemGoalSeekCandidates,
  collectScopedItemGoalSeekCandidates,
  solveItemGoalSeekMarkup,
  solveQuotationGoalSeekGlobalMarkup,
} from './quotationGoalSeek'

describe('quotation goal seek', () => {
  const exchangeRates: ExchangeRateTable = {
    USD: 1,
    CNY: 0.14,
  }

  it('rejects item targets below converted unit cost', () => {
    const result = solveItemGoalSeekMarkup(createItem({ unitCost: 100 }), 99.99, exchangeRates)

    expect(result).toMatchObject({
      ok: false,
      reason: 'target_below_minimum',
      minimumTarget: 100,
    })
  })

  it('returns item markup needed to hit the target unit price', () => {
    const result = solveItemGoalSeekMarkup(createItem({ unitCost: 100 }), 125, exchangeRates)

    expect(result).toMatchObject({
      ok: true,
      markupRate: 25,
      projectedUnitPrice: 125,
      targetUnitPrice: 125,
    })
  })

  it('treats missing exchange rates as invalid unit cost', () => {
    const result = solveItemGoalSeekMarkup(createItem({ unitCost: 100, costCurrency: 'EUR' }), 125, exchangeRates)

    expect(result).toMatchObject({
      ok: false,
      reason: 'invalid_unit_cost',
      convertedUnitCost: 0,
    })
  })

  it('rejects item targets above the maximum markup limit', () => {
    const result = solveItemGoalSeekMarkup(createItem({ unitCost: 100 }), 1100.01, exchangeRates)

    expect(result).toMatchObject({
      ok: false,
      reason: 'target_above_maximum',
      maximumTarget: 1100,
    })
  })

  it('solves quotation global markup while fixed items still count toward the target', () => {
    const items = [
      createItem({ id: 'global', quantity: 2, unitCost: 100 }),
      createItem({ id: 'own', quantity: 1, unitCost: 100, markupRate: 20 }),
      createItem({
        id: 'manual',
        quantity: 3,
        unitCost: 50,
        pricingMethod: 'manual_price',
        manualUnitPrice: 80,
      }),
      createItem({
        id: 'parent',
        quantity: 1,
        markupRate: 10,
        children: [createItem({ id: 'inherited-child', quantity: 1, unitCost: 100 })],
      }),
    ]

    const result = solveQuotationGoalSeekGlobalMarkup(items, 730, exchangeRates)

    expect(result).toMatchObject({
      ok: true,
      markupRate: 30,
      fixedSubtotal: 470,
      adjustableBaseSubtotal: 200,
      projectedSubtotal: 730,
      targetSubtotal: 730,
    })
  })

  it('rejects quotation goal seek when no detail items use global markup', () => {
    const result = solveQuotationGoalSeekGlobalMarkup(
      [createItem({ unitCost: 100, markupRate: 20 })],
      150,
      exchangeRates,
    )

    expect(result).toMatchObject({
      ok: false,
      reason: 'no_adjustable_items',
    })
  })

  it('rejects quotation targets below the minimum possible subtotal', () => {
    const result = solveQuotationGoalSeekGlobalMarkup(
      [
        createItem({ id: 'fixed', quantity: 1, unitCost: 100, markupRate: 20 }),
        createItem({ id: 'global', quantity: 1, unitCost: 100 }),
      ],
      219.99,
      exchangeRates,
    )

    expect(result).toMatchObject({
      ok: false,
      reason: 'target_below_minimum',
      minimumSubtotal: 220,
    })
  })

  it('rejects quotation targets above the maximum global markup limit', () => {
    const result = solveQuotationGoalSeekGlobalMarkup(
      [createItem({ quantity: 1, unitCost: 100 })],
      1100.01,
      exchangeRates,
    )

    expect(result).toMatchObject({
      ok: false,
      reason: 'target_above_maximum',
      maximumSubtotal: 1100,
    })
  })

  it('projects quotation subtotal with normal line-level money rounding', () => {
    const result = solveQuotationGoalSeekGlobalMarkup(
      [
        createItem({ id: 'small-a', quantity: 1, unitCost: 0.01 }),
        createItem({ id: 'small-b', quantity: 1, unitCost: 0.01 }),
      ],
      0.03,
      exchangeRates,
    )

    expect(result).toMatchObject({
      ok: true,
      markupRate: 50,
      targetSubtotal: 0.03,
      projectedSubtotal: 0.04,
    })
  })

  it('collects only valid detail cost-plus item candidates', () => {
    const candidates = collectItemGoalSeekCandidates(
      [
        createItem({ id: 'valid-root', unitCost: 100 }),
        createItem({ id: 'manual', unitCost: 100, pricingMethod: 'manual_price', manualUnitPrice: 120 }),
        createItem({ id: 'empty-cost', unitCost: 0 }),
        createItem({
          id: 'group',
          unitCost: 999,
          children: [createItem({ id: 'valid-child', unitCost: 50 })],
        }),
      ],
      exchangeRates,
    )

    expect(candidates.map((candidate) => ({
      itemId: candidate.item.id,
      itemNumber: candidate.itemNumber,
      currentUnitPrice: candidate.currentUnitPrice,
      currentMarkupRate: candidate.currentMarkupRate,
    }))).toEqual([
      { itemId: 'valid-root', itemNumber: '1', currentUnitPrice: 100, currentMarkupRate: 0 },
      { itemId: 'valid-child', itemNumber: '4.1', currentUnitPrice: 50, currentMarkupRate: 0 },
    ])
  })

  it('shows candidate current unit prices using inherited and global markup', () => {
    const candidates = collectItemGoalSeekCandidates(
      [
        createItem({ id: 'global', unitCost: 100 }),
        createItem({
          id: 'parent',
          markupRate: 20,
          children: [
            createItem({
              id: 'child-group',
              children: [createItem({ id: 'inherited-grandchild', unitCost: 100 })],
            }),
          ],
        }),
      ],
      exchangeRates,
      10,
    )

    expect(candidates.map((candidate) => ({
      itemId: candidate.item.id,
      currentUnitPrice: candidate.currentUnitPrice,
      currentMarkupRate: candidate.currentMarkupRate,
    }))).toEqual([
      { itemId: 'global', currentUnitPrice: 110, currentMarkupRate: 10 },
      { itemId: 'inherited-grandchild', currentUnitPrice: 120, currentMarkupRate: 20 },
    ])
  })

  it('collects scoped candidates for selected group and detail rows', () => {
    const items = [
      createItem({ id: 'root-detail', unitCost: 100 }),
      createItem({
        id: 'group',
        markupRate: 20,
        children: [
          createItem({ id: 'manual-child', unitCost: 40, pricingMethod: 'manual_price', manualUnitPrice: 55 }),
          createItem({ id: 'child-detail', unitCost: 50 }),
          createItem({
            id: 'nested-group',
            children: [createItem({ id: 'grandchild-detail', unitCost: 30 })],
          }),
        ],
      }),
    ]

    const groupCandidates = collectScopedItemGoalSeekCandidates(items, 'group', exchangeRates, 5)
    const detailCandidates = collectScopedItemGoalSeekCandidates(items, 'grandchild-detail', exchangeRates, 5)

    expect(groupCandidates.map((candidate) => ({
      itemId: candidate.item.id,
      itemNumber: candidate.itemNumber,
      currentUnitPrice: candidate.currentUnitPrice,
      currentMarkupRate: candidate.currentMarkupRate,
    }))).toEqual([
      { itemId: 'child-detail', itemNumber: '2.2', currentUnitPrice: 60, currentMarkupRate: 20 },
      { itemId: 'grandchild-detail', itemNumber: '2.3.1', currentUnitPrice: 36, currentMarkupRate: 20 },
    ])
    expect(detailCandidates.map((candidate) => ({
      itemId: candidate.item.id,
      itemNumber: candidate.itemNumber,
    }))).toEqual([
      { itemId: 'grandchild-detail', itemNumber: '2.3.1' },
    ])
    expect(collectScopedItemGoalSeekCandidates(items, 'missing', exchangeRates)).toEqual([])
  })
})

function createItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: overrides.id ?? 'item',
    name: overrides.name ?? 'Item',
    description: overrides.description ?? '',
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? 'pc',
    pricingMethod: overrides.pricingMethod,
    manualUnitPrice: overrides.manualUnitPrice,
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? 'USD',
    markupRate: overrides.markupRate,
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes,
    children: overrides.children ?? [],
  }
}
