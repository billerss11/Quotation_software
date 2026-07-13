import { nextTick, shallowRef } from 'vue'
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

  it('keeps numeric summaries and totals cached when only mixed tax document columns change', async () => {
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
    quotation.value.totalsConfig.mixedTaxColumns = ['taxRate', 'unitPrice', 'netAmount']
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

    quotation.value.totalsConfig.mixedTaxColumns = ['taxRate', 'grossAmount']

    expect(itemSummaries.value[0]?.subtotal).toBe(110)
    expect(totals.value.taxBuckets[0]?.label).toBe('Goods 13%')
    expect(majorSummarySpy).not.toHaveBeenCalled()
    expect(quotationTotalsSpy).not.toHaveBeenCalled()
  })

  it('updates extra charges without recalculating item summaries or line totals', async () => {
    vi.resetModules()

    const calculationsModule = await import('../utils/quotationCalculations')
    const majorSummarySpy = vi.spyOn(calculationsModule, 'calculateMajorItemSummary')
    const quotationTotalsSpy = vi.spyOn(calculationsModule, 'calculateQuotationTotals')
    const { useQuotationEditor } = await import('./useQuotationEditor')

    const { quotation, itemSummaries, totals } = useQuotationEditor(shallowRef('en-US'))

    quotation.value.majorItems = [
      createItem({
        id: 'item-1',
        quantity: 1,
        unitCost: 100,
        costCurrency: 'USD',
      }),
    ]
    quotation.value.totalsConfig.extraCharges = []

    expect(itemSummaries.value[0]?.subtotal).toBe(110)
    expect(totals.value.grandTotal).toBe(110)

    majorSummarySpy.mockClear()
    quotationTotalsSpy.mockClear()

    quotation.value.totalsConfig.extraCharges = [
      { id: 'shipping', label: 'Shipping', amount: 25 },
    ]

    expect(itemSummaries.value[0]?.subtotal).toBe(110)
    expect(totals.value.grandTotal).toBe(135)
    expect(majorSummarySpy).not.toHaveBeenCalled()
    expect(quotationTotalsSpy).not.toHaveBeenCalled()
  })

  it('keeps item summaries cached when only tax class rates change', async () => {
    vi.resetModules()

    const calculationsModule = await import('../utils/quotationCalculations')
    const majorSummarySpy = vi.spyOn(calculationsModule, 'calculateMajorItemSummary')
    const { useQuotationEditor } = await import('./useQuotationEditor')

    const { quotation, itemSummaries, totals } = useQuotationEditor(shallowRef('en-US'))

    quotation.value.majorItems = [
      createItem({
        id: 'item-1',
        quantity: 1,
        unitCost: 100,
        costCurrency: 'USD',
      }),
    ]

    expect(itemSummaries.value[0]?.subtotal).toBe(110)
    expect(totals.value.taxAmount).toBe(0)

    majorSummarySpy.mockClear()

    quotation.value.totalsConfig.taxClasses![0].rate = 13

    expect(itemSummaries.value[0]?.subtotal).toBe(110)
    expect(totals.value.taxAmount).toBe(14.3)
    expect(majorSummarySpy).not.toHaveBeenCalled()
  })

  it('reuses computed item summaries when totals are read', async () => {
    vi.resetModules()

    const calculationsModule = await import('../utils/quotationCalculations')
    const majorSummarySpy = vi.spyOn(calculationsModule, 'calculateMajorItemSummary')
    const { useQuotationEditor } = await import('./useQuotationEditor')

    const { quotation, itemSummaries, totals } = useQuotationEditor(shallowRef('en-US'))

    quotation.value.majorItems = [
      createItem({
        id: 'item-1',
        quantity: 1,
        unitCost: 100,
        costCurrency: 'USD',
      }),
      createItem({
        id: 'item-2',
        quantity: 2,
        unitCost: 50,
        costCurrency: 'USD',
      }),
    ]

    expect(itemSummaries.value.map((summary) => summary.subtotal)).toEqual([110, 110])

    majorSummarySpy.mockClear()

    expect(totals.value.subtotalAfterMarkup).toBe(220)
    expect(majorSummarySpy).not.toHaveBeenCalled()
  })

  it('updates nested item fields through a cached item lookup', async () => {
    vi.resetModules()

    const quotationItemsModule = await import('../utils/quotationItems')
    const findQuotationItemSpy = vi.spyOn(quotationItemsModule, 'findQuotationItem')
    const { useQuotationEditor } = await import('./useQuotationEditor')

    const editor = useQuotationEditor(shallowRef('en-US'))
    const childItem = createItem({ id: 'child-1', quantity: 1 })
    editor.quotation.value.majorItems = [
      createItem({
        id: 'root-1',
        children: [childItem],
      }),
    ]

    findQuotationItemSpy.mockClear()
    editor.updateItemField('child-1', 'quantity', 7)

    expect(childItem.quantity).toBe(7)
    expect(findQuotationItemSpy).not.toHaveBeenCalled()
  })

  it('undoes a nested item field edit without replacing the quotation tree', async () => {
    vi.resetModules()

    const { useQuotationEditor } = await import('./useQuotationEditor')
    const editor = useQuotationEditor(shallowRef('en-US'))
    const childItem = createItem({ id: 'child-1', quantity: 1 })
    const rootItem = createItem({
      id: 'root-1',
      children: [childItem],
    })
    editor.quotation.value.majorItems = [rootItem]
    editor.resetQuotationChangeHistory()

    editor.updateItemField('child-1', 'quantity', 7)
    await nextTick()

    const quotationBeforeUndo = editor.quotation.value
    const rootBeforeUndo = editor.quotation.value.majorItems[0]
    const childBeforeUndo = childItem

    const undoResult = editor.undoLastQuotationChange()

    expect(undoResult.ok).toBe(true)
    expect(editor.quotation.value).toBe(quotationBeforeUndo)
    expect(editor.quotation.value.majorItems[0]).toBe(rootBeforeUndo)
    expect(childItem).toBe(childBeforeUndo)
    expect(childItem.quantity).toBe(1)
  })

  it('keeps a concrete undo summary for large single item field changes', async () => {
    vi.resetModules()

    const { useQuotationEditor } = await import('./useQuotationEditor')
    const editor = useQuotationEditor(shallowRef('en-US'))
    const childItem = createItem({ id: 'child-1', name: 'Drive motor', quantity: 1 })
    const rootItem = createItem({
      id: 'root-1',
      notes: 'x'.repeat(260_000),
      children: [childItem],
    })
    editor.quotation.value.majorItems = [rootItem]
    editor.resetQuotationChangeHistory()

    editor.updateItemField('child-1', 'quantity', 7)
    await nextTick()

    const undoResult = editor.undoLastQuotationChange()

    expect(undoResult.ok).toBe(true)
    if (!undoResult.ok) throw new Error('Expected undo to succeed')
    expect(undoResult.change.summary).toEqual({
      kind: 'itemFieldChanged',
      target: 'item:child-1:quantity',
      itemName: 'Drive motor',
      fieldLabelKey: 'quotations.history.fields.quantity',
      previousValue: '7',
      nextValue: '1',
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
