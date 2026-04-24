import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { calculateUnitSellingPrice } from '../utils/quotationCalculations'
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
})

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
