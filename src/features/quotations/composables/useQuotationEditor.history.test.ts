import { shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuotationDraft, QuotationItem } from '../types'
import { createInitialQuotation } from '../utils/quotationDraft'
import { createQuotationItem } from '../utils/quotationItems'
import { useQuotationEditor } from './useQuotationEditor'

describe('useQuotationEditor patch history', () => {
  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: localStorageMock })
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips scalar, settings, customer, company, and exchange-rate actions as one transaction', () => {
    const editor = useQuotationEditor(shallowRef('en-US'))
    editor.resetQuotationChangeHistory()
    const before = snapshot(editor.quotation.value)

    editor.updateHeaderField('projectName', 'Hydrogen plant')
    editor.setTemplateId('technical-bid')
    editor.setOutputItemDetailLevel(3)
    editor.setLineItemEntryMode('quick')
    editor.setLogoDataUrl('data:image/png;base64,test')
    editor.updateTotalsField('globalMarkupRate', 25)
    editor.applyCustomerRecord({
      customerCompany: 'Northwind',
      contactPerson: 'Ada',
      contactDetails: 'ada@example.com',
    })
    editor.applyCompanyProfile({
      id: 'company-1',
      companyName: 'Hydrogen Systems',
      email: 'sales@example.com',
      phone: '+86 123',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(editor.addExchangeRate('JPY')).toBe('added')
    editor.updateExchangeRate('JPY', 0.007)
    const after = snapshot(editor.quotation.value)

    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(before)
    expect(editor.redoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(after)
  })

  it('round-trips tax classes and extra charges', () => {
    const editor = useQuotationEditor(shallowRef('en-US'))
    editor.quotation.value.totalsConfig.taxClasses = [
      { id: 'tax-default', label: 'Default', rate: 13 },
    ]
    editor.quotation.value.totalsConfig.defaultTaxClassId = 'tax-default'
    editor.resetQuotationChangeHistory()
    const before = snapshot(editor.quotation.value)

    editor.addTaxClass({ id: 'tax-service', label: 'Service', rate: 6 })
    editor.updateTaxClassField('tax-service', 'rate', 5)
    editor.updateTotalsField('defaultTaxClassId', 'tax-service')
    editor.setMixedTaxDocumentColumns(['taxRate', 'grossAmount'])
    editor.addExtraCharge({ id: 'shipping', label: 'Shipping', amount: 100 })
    editor.updateExtraChargeField('shipping', 'amount', 150)
    const after = snapshot(editor.quotation.value)

    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(before)
    expect(editor.redoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(after)
  })

  it('round-trips root, section, child, duplicate, and remove operations', () => {
    const editor = useQuotationEditor(shallowRef('en-US'))
    editor.resetQuotationChangeHistory()
    const before = snapshot(editor.quotation.value)

    editor.addRootItem()
    editor.addSectionHeader()
    const firstItem = editor.quotation.value.majorItems.find(isItem)
    if (!firstItem) throw new Error('Expected root item')
    editor.addChildItem(firstItem.id)
    editor.duplicateRootItem(firstItem.id)
    const addedRoot = [...editor.quotation.value.majorItems].reverse().find(isItem)
    if (!addedRoot) throw new Error('Expected added root item')
    editor.removeItem(addedRoot.id)
    const after = snapshot(editor.quotation.value)

    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(before)
    expect(editor.redoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(after)
  })

  it('round-trips root reorder and cross-parent reparenting', () => {
    const editor = useQuotationEditor(shallowRef('en-US'))
    editor.quotation.value.majorItems = [
      createItem('root-1', [createItem('child-1')]),
      createItem('root-2'),
      createItem('root-3'),
    ]
    editor.resetQuotationChangeHistory()
    const before = snapshot(editor.quotation.value)

    editor.moveRootItem('root-3', -1)
    editor.moveQuotationTreeRow('child-1', 'root-2', 0, 'inside')
    const after = snapshot(editor.quotation.value)

    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(before)
    expect(editor.redoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(after)
  })

  it('round-trips item fields, pricing mode, tax mode, and batch goal seek', () => {
    const editor = useQuotationEditor(shallowRef('en-US'))
    editor.quotation.value.majorItems = [createItem('item-1'), createItem('item-2')]
    editor.quotation.value.totalsConfig.taxMode = 'mixed'
    editor.quotation.value.totalsConfig.taxClasses = [
      { id: 'tax-goods', label: 'Goods', rate: 13 },
      { id: 'tax-service', label: 'Service', rate: 6 },
    ]
    ;(editor.quotation.value.majorItems[0] as QuotationItem).taxClassId = 'tax-goods'
    ;(editor.quotation.value.majorItems[1] as QuotationItem).taxClassId = 'tax-service'
    editor.resetQuotationChangeHistory()
    const before = snapshot(editor.quotation.value)

    editor.updateItemField('item-1', 'quantity', 4)
    editor.setItemPricingMethod('item-1', 'manual_price')
    editor.applyItemGoalSeek([
      { itemId: 'item-1', markupRate: 15 },
      { itemId: 'item-2', markupRate: 18 },
    ])
    expect(editor.setTaxMode('single', { taxClassId: 'tax-goods' })).toBe('updated')
    const after = snapshot(editor.quotation.value)

    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(before)
    expect(editor.redoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(after)
  })

  it('round-trips currency and all derived rebasing atomically', () => {
    const editor = useQuotationEditor(shallowRef('en-US'))
    editor.quotation.value.totalsConfig.extraCharges = [
      { id: 'shipping', label: 'Shipping', amount: 14 },
    ]
    editor.quotation.value.majorItems = [createQuotationItem('USD', {
      id: 'item-1',
      expectedTotal: 140,
      pricingMethod: 'manual_price',
      manualUnitPrice: 70,
    })]
    editor.resetQuotationChangeHistory()
    const before = snapshot(editor.quotation.value)

    editor.setQuotationCurrency('CNY')
    const after = snapshot(editor.quotation.value)

    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(before)
    expect(editor.redoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(after)
  })

  it('round-trips line-item and whole-draft replacement', async () => {
    const editor = useQuotationEditor(shallowRef('en-US'))
    editor.resetQuotationChangeHistory()
    const beforeItems = snapshot(editor.quotation.value)

    editor.replaceLineItems([createItem('imported-1')])
    const afterItems = snapshot(editor.quotation.value)
    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(beforeItems)
    expect(editor.redoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(afterItems)

    editor.resetQuotationChangeHistory()
    const beforeDraft = snapshot(editor.quotation.value)
    const replacement = createInitialQuotation([], 'en-US', { quotationNumber: 'Q-NEW' })
    replacement.header.projectName = 'Imported quotation'
    editor.replaceQuotationDraft(replacement)
    const afterDraft = snapshot(editor.quotation.value)
    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(beforeDraft)
    expect(editor.redoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(afterDraft)
  })

  it('undoes all quotation state changed by a confirmed CSV row replacement', () => {
    const editor = useQuotationEditor(shallowRef('en-US'))
    editor.quotation.value.totalsConfig.taxClasses = [
      { id: 'tax-goods', label: 'Goods', rate: 13 },
      { id: 'tax-service', label: 'Service', rate: 6 },
    ]
    editor.quotation.value.totalsConfig.defaultTaxClassId = 'tax-goods'
    editor.quotation.value.totalsConfig.taxMode = 'single'
    editor.quotation.value.lineItemEntryMode = 'detailed'
    editor.resetQuotationChangeHistory()
    const before = snapshot(editor.quotation.value)

    editor.replaceLineItems([
      createQuotationItem('USD', {
        id: 'imported-goods',
        name: 'Imported goods',
        pricingMethod: 'manual_price',
        manualUnitPrice: 100,
        unitCost: 50,
        costCurrency: 'EUR',
        taxClassId: 'tax-goods',
      }),
      createQuotationItem('USD', {
        id: 'imported-service',
        name: 'Imported service',
        pricingMethod: 'manual_price',
        manualUnitPrice: 80,
        taxClassId: 'tax-service',
      }),
    ])

    expect(editor.quotation.value.exchangeRates.EUR).toBeDefined()
    expect(editor.quotation.value.totalsConfig.taxMode).toBe('mixed')
    expect(editor.quotation.value.lineItemEntryMode).toBe('quick')

    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(snapshot(editor.quotation.value)).toEqual(before)
  })

  it('does not create history for invalid or no-op actions', () => {
    const editor = useQuotationEditor(shallowRef('en-US'))
    editor.resetQuotationChangeHistory()

    editor.updateHeaderField('projectName', editor.quotation.value.header.projectName)
    editor.updateItemField('missing', 'quantity', 2)
    editor.moveRootItem('missing', 1)
    editor.removeItem('missing')

    expect(editor.canUndoQuotationChange.value).toBe(false)
  })
})

function createItem(id: string, children: QuotationItem[] = []): QuotationItem {
  return createQuotationItem('USD', { id, name: id, children })
}

function isItem(row: QuotationDraft['majorItems'][number]): row is QuotationItem {
  return !('kind' in row)
}

function snapshot(quotation: QuotationDraft) {
  return JSON.parse(JSON.stringify(quotation)) as QuotationDraft
}

function createLocalStorageMock() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  }
}
