import { nextTick, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { calculateUnitSellingPrice } from '../utils/quotationCalculations'
import type { QuotationItem, TaxMode } from '../types'
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

  it('rebases stored manual unit prices when the quotation currency changes', async () => {
    const { quotation } = useQuotationEditor(shallowRef('en-US'))

    quotation.value.majorItems = [
      createItem({
        id: 'manual-1',
        quantity: 2,
        pricingMethod: 'manual_price',
        manualUnitPrice: 120,
      }),
    ]

    quotation.value.header.currency = 'CNY'
    await nextTick()

    expect(quotation.value.majorItems[0]?.manualUnitPrice).toBe(857.14)
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

  it('switches new rows to manual-price defaults in quick entry mode', () => {
    const { quotation, setLineItemEntryMode, addRootItem } = useQuotationEditor(shallowRef('en-US'))

    setLineItemEntryMode('quick')
    addRootItem()

    expect(quotation.value.lineItemEntryMode).toBe('quick')
    expect(quotation.value.majorItems.at(-1)).toMatchObject({
      pricingMethod: 'manual_price',
      manualUnitPrice: 0,
      costCurrency: 'USD',
    })
  })

  it('converts existing leaf rows to manual-price rows when switching to quick entry mode', () => {
    const { quotation, setLineItemEntryMode } = useQuotationEditor(shallowRef('en-US'))

    quotation.value.majorItems = [
      createItem({
        id: 'leaf-1',
        quantity: 2,
        unitCost: 100,
        costCurrency: 'USD',
      }),
    ]

    setLineItemEntryMode('quick')

    expect(quotation.value.lineItemEntryMode).toBe('quick')
    expect(quotation.value.majorItems[0]).toMatchObject({
      pricingMethod: 'manual_price',
      manualUnitPrice: 110,
      unitCost: 100,
      costCurrency: 'USD',
    })
  })

  it('keeps manual-price rows intact when switching back to detailed entry mode', () => {
    const { quotation, setLineItemEntryMode } = useQuotationEditor(shallowRef('en-US'))

    quotation.value.majorItems = [
      createItem({
        id: 'manual-1',
        pricingMethod: 'manual_price',
        manualUnitPrice: 180,
      }),
    ]

    setLineItemEntryMode('detailed')

    expect(quotation.value.lineItemEntryMode).toBe('detailed')
    expect(quotation.value.majorItems[0]).toMatchObject({
      pricingMethod: 'manual_price',
      manualUnitPrice: 180,
    })
  })

  it('creates new quotations in single tax mode by default', () => {
    const { quotation } = useQuotationEditor(shallowRef('en-US'))

    expect(quotation.value.totalsConfig.taxMode).toBe('single')
  })

  it('switches to mixed tax mode without rewriting item tax assignments', () => {
    const { quotation, setTaxMode } = useQuotationEditor(shallowRef('en-US'))
    quotation.value.totalsConfig.taxClasses = [
      { id: 'tax-0', label: '0%', rate: 0 },
      { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
      { id: 'tax-service', label: 'Service 6%', rate: 6 },
    ]
    quotation.value.totalsConfig.defaultTaxClassId = 'tax-0'
    quotation.value.majorItems = [
      createItem({
        id: 'major-1',
        taxClassId: 'tax-goods',
        children: [
          createItem({
            id: 'leaf-1',
            quantity: 1,
            unitCost: 100,
            costCurrency: 'USD',
            taxClassId: 'tax-service',
          }),
        ],
      }),
    ]

    setTaxMode('mixed')

    expect(quotation.value.totalsConfig.taxMode).toBe('mixed')
    expect(quotation.value.majorItems[0]?.children[0]?.taxClassId).toBe('tax-service')
  })

  it('requires an explicit surviving tax class before consolidating mixed rows to single mode', () => {
    const { quotation, setTaxMode } = useQuotationEditor(shallowRef('en-US'))
    quotation.value.totalsConfig.taxMode = 'mixed' as TaxMode
    quotation.value.totalsConfig.taxClasses = [
      { id: 'tax-0', label: '0%', rate: 0 },
      { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
      { id: 'tax-service', label: 'Service 6%', rate: 6 },
    ]
    quotation.value.totalsConfig.defaultTaxClassId = 'tax-0'
    quotation.value.majorItems = [
      createItem({
        id: 'major-1',
        taxClassId: 'tax-goods',
        children: [
          createItem({
            id: 'leaf-1',
            quantity: 1,
            unitCost: 100,
            costCurrency: 'USD',
          }),
          createItem({
            id: 'leaf-2',
            quantity: 1,
            unitCost: 100,
            costCurrency: 'USD',
            taxClassId: 'tax-service',
          }),
        ],
      }),
    ]

    expect(setTaxMode('single')).toBe('requires_tax_class')
    expect(quotation.value.totalsConfig.taxMode).toBe('mixed')
  })

  it('consolidates all row assignments when switching mixed quotations back to single mode', () => {
    const { quotation, setTaxMode } = useQuotationEditor(shallowRef('en-US'))
    quotation.value.totalsConfig.taxMode = 'mixed' as TaxMode
    quotation.value.totalsConfig.taxClasses = [
      { id: 'tax-0', label: '0%', rate: 0 },
      { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
      { id: 'tax-service', label: 'Service 6%', rate: 6 },
    ]
    quotation.value.totalsConfig.defaultTaxClassId = 'tax-0'
    quotation.value.majorItems = [
      createItem({
        id: 'major-1',
        taxClassId: 'tax-goods',
        children: [
          createItem({
            id: 'leaf-1',
            quantity: 1,
            unitCost: 100,
            costCurrency: 'USD',
          }),
          createItem({
            id: 'leaf-2',
            quantity: 1,
            unitCost: 100,
            costCurrency: 'USD',
            taxClassId: 'tax-service',
          }),
        ],
      }),
    ]

    expect(setTaxMode('single', { taxClassId: 'tax-goods' })).toBe('updated')
    expect(quotation.value.totalsConfig.taxMode).toBe('single')
    expect(quotation.value.majorItems[0]?.taxClassId).toBe('tax-goods')
    expect(quotation.value.majorItems[0]?.children[0]?.taxClassId).toBe('tax-goods')
    expect(quotation.value.majorItems[0]?.children[1]?.taxClassId).toBe('tax-goods')
  })

  it('auto-switches to mixed mode when imported line items resolve to multiple effective tax classes', () => {
    const { quotation, replaceLineItems } = useQuotationEditor(shallowRef('en-US'))
    quotation.value.totalsConfig.taxMode = 'single' as TaxMode
    quotation.value.totalsConfig.taxClasses = [
      { id: 'tax-0', label: '0%', rate: 0 },
      { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
      { id: 'tax-service', label: 'Service 6%', rate: 6 },
    ]
    quotation.value.totalsConfig.defaultTaxClassId = 'tax-0'

    replaceLineItems([
      createItem({
        id: 'major-1',
        taxClassId: 'tax-goods',
        children: [
          createItem({
            id: 'leaf-1',
            quantity: 1,
            unitCost: 100,
            costCurrency: 'USD',
          }),
          createItem({
            id: 'leaf-2',
            quantity: 1,
            unitCost: 80,
            costCurrency: 'USD',
            taxClassId: 'tax-service',
          }),
        ],
      }),
    ])

    expect(quotation.value.totalsConfig.taxMode).toBe('mixed')
  })

  it('does not expose a create revision action', () => {
    const editor = useQuotationEditor(shallowRef('en-US'))

    expect('createRevision' in editor).toBe(false)
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

  it('preserves custom rate relationships when switching to a manually edited quotation currency', async () => {
    const { quotation } = useQuotationEditor(shallowRef('en-US'))

    quotation.value.exchangeRates.CNY = 1
    quotation.value.header.currency = 'CNY'
    await nextTick()

    expect(quotation.value.exchangeRates.CNY).toBe(1)
    expect(quotation.value.exchangeRates.USD).toBe(1)
  })

  it('selects a company profile into the quotation id and snapshot fields', () => {
    const { quotation, applyCompanyProfile } = useQuotationEditor(shallowRef('en-US'))

    applyCompanyProfile({
      id: 'company-1',
      updatedAt: '2026-05-06T09:00:00.000Z',
      companyName: 'Northwind Process',
      email: 'quotes@northwind.test',
      phone: '+86 400 100 200',
    })

    expect(quotation.value.companyProfileId).toBe('company-1')
    expect(quotation.value.companyProfileSnapshot).toEqual({
      companyName: 'Northwind Process',
      email: 'quotes@northwind.test',
      phone: '+86 400 100 200',
    })
  })
})

function createItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'New item',
    description: overrides.description ?? '',
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? '',
    pricingMethod: (overrides as QuotationItem & { pricingMethod?: 'cost_plus' | 'manual_price' }).pricingMethod ?? 'cost_plus',
    manualUnitPrice: (overrides as QuotationItem & { manualUnitPrice?: number }).manualUnitPrice,
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
