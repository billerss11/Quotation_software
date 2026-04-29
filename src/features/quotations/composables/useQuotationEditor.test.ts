import { nextTick, shallowRef } from 'vue'
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
    const { quotation } = useQuotationEditor(shallowRef('en-US'))

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

  it('rebases fixed discount amounts when the quotation currency changes', async () => {
    const { quotation } = useQuotationEditor(shallowRef('en-US'))

    quotation.value.totalsConfig.discountMode = 'fixed'
    quotation.value.totalsConfig.discountValue = 100

    quotation.value.header.currency = 'CNY'
    await nextTick()

    expect(quotation.value.totalsConfig.discountValue).toBe(714.29)
  })

  it('rebases stored expected totals when the quotation currency changes', async () => {
    const { quotation } = useQuotationEditor(shallowRef('en-US'))

    quotation.value.majorItems = [
      createItem({
        id: 'major-1',
        quantity: 1,
        costCurrency: 'USD',
        expectedTotal: 120,
        children: [
          createItem({
            id: 'child-1',
            quantity: 1,
            costCurrency: 'USD',
            expectedTotal: 35,
            children: [
              createItem({
                id: 'leaf-1',
                quantity: 2,
                unitCost: 10,
                costCurrency: 'USD',
              }),
            ],
          }),
        ],
      }),
    ]

    quotation.value.header.currency = 'CNY'
    await nextTick()

    expect(quotation.value.majorItems[0]?.expectedTotal).toBe(857.14)
    expect(quotation.value.majorItems[0]?.children[0]?.expectedTotal).toBe(250)
  })

  it('replaces line items without changing header, totals, or exchange rates', () => {
    const { quotation, replaceLineItems } = useQuotationEditor(shallowRef('en-US'))
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

  it('creates a new revision while keeping the quotation number', () => {
    const { quotation, createRevision } = useQuotationEditor(shallowRef('en-US'))
    quotation.value.header.quotationNumber = 'Q-2026-001'
    quotation.value.header.revisionNumber = 1
    const originalId = quotation.value.id

    createRevision()

    expect(quotation.value.id).not.toBe(originalId)
    expect(quotation.value.header.quotationNumber).toBe('Q-2026-001')
    expect(quotation.value.header.revisionNumber).toBe(2)
  })

  it('updates the saved draft list after saving the current quotation', () => {
    const { quotation, savedDrafts, saveCurrentQuotation } = useQuotationEditor(shallowRef('en-US'))
    quotation.value.header.quotationNumber = 'Q-2026-010'

    saveCurrentQuotation()

    expect(savedDrafts.value).toHaveLength(1)
    expect(savedDrafts.value[0]?.header.quotationNumber).toBe('Q-2026-010')
  })

  it('uses the active UI locale for new quotation defaults', () => {
    const { quotation } = useQuotationEditor(shallowRef('zh-CN'))

    expect(quotation.value.header.documentLocale).toBe('zh-CN')
    expect(quotation.value.header.validityPeriod).toBe('30天')
    expect(quotation.value.majorItems[0]?.name).toBe('新项目')
  })

  it('uses the latest UI locale when creating a fresh quotation later', () => {
    const uiLocale = shallowRef<'en-US' | 'zh-CN'>('en-US')
    const { quotation, createNewQuotation } = useQuotationEditor(uiLocale)

    uiLocale.value = 'zh-CN'
    createNewQuotation()

    expect(quotation.value.header.documentLocale).toBe('zh-CN')
    expect(quotation.value.header.validityPeriod).toBe('30天')
  })
  it('adds a supported currency to the exchange-rate table', () => {
    const { quotation, addExchangeRate } = useQuotationEditor(shallowRef('en-US'))

    expect(addExchangeRate('jpy')).toBe('added')
    expect(quotation.value.exchangeRates.JPY).toBeCloseTo(0.0067)
  })

  it('rejects invalid exchange-rate currency input', () => {
    const { quotation, addExchangeRate } = useQuotationEditor(shallowRef('en-US'))

    expect(addExchangeRate('zzz')).toBe('invalid')
    expect(quotation.value.exchangeRates.ZZZ).toBeUndefined()
  })

  it('removes an unused non-base exchange-rate currency', () => {
    const { quotation, addExchangeRate, removeExchangeRate } = useQuotationEditor(shallowRef('en-US'))

    addExchangeRate('JPY')

    expect(removeExchangeRate('JPY')).toBe('removed')
    expect(quotation.value.exchangeRates.JPY).toBeUndefined()
  })

  it('does not remove the base quotation currency', () => {
    const { quotation, removeExchangeRate } = useQuotationEditor(shallowRef('en-US'))

    expect(removeExchangeRate('USD')).toBe('base_currency')
    expect(quotation.value.exchangeRates.USD).toBe(1)
  })

  it('does not remove a currency that is used by a nested line item', () => {
    const { quotation, addExchangeRate, removeExchangeRate } = useQuotationEditor(shallowRef('en-US'))

    addExchangeRate('JPY')
    quotation.value.majorItems = [
      createItem({
        id: 'major-1',
        costCurrency: 'USD',
        children: [
          createItem({
            id: 'section-1',
            costCurrency: 'USD',
            children: [
              createItem({
                id: 'detail-1',
                costCurrency: 'JPY',
              }),
            ],
          }),
        ],
      }),
    ]

    expect(removeExchangeRate('JPY')).toBe('in_use')
    expect(quotation.value.exchangeRates.JPY).toBeCloseTo(0.0067)
  })

  it('rebases successfully when switching the quotation currency to a dynamically added code', async () => {
    const { quotation, addExchangeRate } = useQuotationEditor(shallowRef('en-US'))

    addExchangeRate('JPY')
    quotation.value.header.currency = 'JPY'
    await nextTick()

    expect(quotation.value.exchangeRates.JPY).toBe(1)
    expect(quotation.value.exchangeRates.USD).toBeCloseTo(1 / 0.0067, 5)
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
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
}
