import { shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuotationItem } from '../types'

describe('useQuotationEditor performance', () => {
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

  it('keeps numeric summaries and totals cached when only tax labels change', async () => {
    vi.resetModules()

    const calculationsModule = await import('../utils/quotationCalculations')
    const majorSummarySpy = vi.spyOn(calculationsModule, 'calculateMajorItemSummary')
    const quotationTotalsSpy = vi.spyOn(calculationsModule, 'calculateQuotationTotals')
    const { useQuotationEditor } = await import('./useQuotationEditor')

    const { quotation, itemSummaries, totals } = useQuotationEditor(shallowRef('en-US'))

    quotation.value.totalsConfig.taxMode = 'mixed'
    quotation.value.totalsConfig.taxClasses = [
      { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
      { id: 'tax-service', label: 'Service 6%', rate: 6 },
    ]
    quotation.value.totalsConfig.defaultTaxClassId = 'tax-goods'
    quotation.value.majorItems = [
      createItem({
        id: 'item-1',
        quantity: 1,
        unitCost: 100,
        costCurrency: 'USD',
        taxClassId: 'tax-goods',
      }),
    ]

    expect(itemSummaries.value[0]?.subtotal).toBe(110)
    expect(totals.value.taxBuckets[0]?.label).toBe('Goods 13%')

    majorSummarySpy.mockClear()
    quotationTotalsSpy.mockClear()

    quotation.value.totalsConfig.taxClasses[0].label = 'Updated Goods 13%'

    expect(itemSummaries.value[0]?.subtotal).toBe(110)
    expect(totals.value.taxBuckets[0]?.label).toBe('Updated Goods 13%')
    expect(majorSummarySpy).not.toHaveBeenCalled()
    expect(quotationTotalsSpy).not.toHaveBeenCalled()
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
    taxClassId: overrides.taxClassId,
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
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
}
