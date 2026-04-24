import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { calculateUnitSellingPrice } from '../utils/quotationCalculations'
import type { QuotationItem } from '../types'
import { useQuotationEditor } from './useQuotationEditor'

describe('useQuotationEditor', () => {
  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rebases exchange rates when the quotation currency changes', async () => {
    const { quotation } = useQuotationEditor()

    quotation.value.header.currency = 'CNY'
    await nextTick()

    expect(quotation.value.exchangeRates.CNY).toBe(1)
    expect(quotation.value.exchangeRates.USD).toBeCloseTo(7.142857, 6)
    expect(
      calculateUnitSellingPrice(
        {
          unitCost: 100,
          costCurrency: 'USD',
        },
        quotation.value.totalsConfig.globalMarkupRate,
        quotation.value.exchangeRates,
      ),
    ).toBe(785.72)
  })

  it('replaces line items without changing header, totals, or exchange rates', () => {
    const { quotation, replaceLineItems } = useQuotationEditor()
    const originalHeader = { ...quotation.value.header }
    const originalTotalsConfig = { ...quotation.value.totalsConfig }
    const originalExchangeRates = { ...quotation.value.exchangeRates }
    const importedItems: QuotationItem[] = [
      createItem({
        id: 'major-1',
        name: 'Imported equipment',
        description: 'Imported from CSV',
        quantity: 1,
        unitCost: 100,
        costCurrency: 'USD',
        children: [
          createItem({
            id: 'sub-1',
            name: 'Valve set',
            quantity: 2,
            unitCost: 60,
            costCurrency: 'USD',
          }),
        ],
      }),
    ]

    replaceLineItems(importedItems)

    expect(quotation.value.majorItems).toEqual(importedItems)
    expect(quotation.value.header).toEqual(originalHeader)
    expect(quotation.value.totalsConfig).toEqual(originalTotalsConfig)
    expect(quotation.value.exchangeRates).toEqual(originalExchangeRates)
  })
})

function createItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'New item',
    description: overrides.description ?? '',
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? '',
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? 'USD',
    markupRate: overrides.markupRate,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}

function createLocalStorageMock() {
  const store = new Map<string, string>()

  return {
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    clear() {
      store.clear()
    },
  }
}
