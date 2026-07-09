import { describe, expect, it } from 'vitest'

import { createInitialQuotation } from './quotationDraft'
import { createQuotationItem } from './quotationItems'
import { describeQuotationHistoryChange } from './quotationHistoryChangeSummary'

describe('describeQuotationHistoryChange', () => {
  it('describes a line item quantity change', () => {
    const before = createInitialQuotation([], 'en-US', { quotationNumber: 'Q-001' })
    before.majorItems = [
      createQuotationItem('USD', {
        id: 'item-1',
        name: 'Pump',
        quantity: 1,
      }),
    ]
    const after = structuredClone(before)
    const item = after.majorItems[0]
    if (!item || 'kind' in item) throw new Error('Expected quotation item')
    item.quantity = 3

    expect(describeQuotationHistoryChange(before, after)).toEqual({
      kind: 'itemFieldChanged',
      target: 'item:item-1:quantity',
      itemName: 'Pump',
      fieldLabelKey: 'quotations.history.fields.quantity',
      previousValue: '1',
      nextValue: '3',
    })
  })

  it('describes an added line item', () => {
    const before = createInitialQuotation([], 'en-US', { quotationNumber: 'Q-001' })
    before.majorItems = []
    const after = structuredClone(before)
    after.majorItems = [
      createQuotationItem('USD', {
        id: 'item-1',
        name: 'Control panel',
      }),
    ]

    expect(describeQuotationHistoryChange(before, after)).toEqual({
      kind: 'itemAdded',
      target: 'item:item-1',
      itemName: 'Control panel',
    })
  })

  it('describes a removed line item', () => {
    const before = createInitialQuotation([], 'en-US', { quotationNumber: 'Q-001' })
    before.majorItems = [
      createQuotationItem('USD', {
        id: 'item-1',
        name: 'Control panel',
      }),
    ]
    const after = structuredClone(before)
    after.majorItems = []

    expect(describeQuotationHistoryChange(before, after)).toEqual({
      kind: 'itemRemoved',
      target: 'item:item-1',
      itemName: 'Control panel',
    })
  })

  it('describes an exchange rate change', () => {
    const before = createInitialQuotation([], 'en-US', { quotationNumber: 'Q-001' })
    before.exchangeRates.EUR = 1.1
    const after = structuredClone(before)
    after.exchangeRates.EUR = 1.2

    expect(describeQuotationHistoryChange(before, after)).toEqual({
      kind: 'fieldChanged',
      target: 'exchangeRate:EUR',
      fieldLabelKey: 'quotations.history.fields.exchangeRate',
      previousValue: 'EUR 1.1',
      nextValue: 'EUR 1.2',
    })
  })

  it('falls back for unknown quotation changes', () => {
    const before = createInitialQuotation([], 'en-US', { quotationNumber: 'Q-001' })
    const after = structuredClone(before)
    after.branding.logoDataUrl = 'data:image/png;base64,test'

    expect(describeQuotationHistoryChange(before, after)).toEqual({
      kind: 'fallback',
    })
  })

  it('describes a quote info field target', () => {
    const before = createInitialQuotation([], 'en-US', { quotationNumber: 'Q-001' })
    const after = structuredClone(before)
    after.header.projectName = 'Pump station'

    expect(describeQuotationHistoryChange(before, after)).toMatchObject({
      kind: 'fieldChanged',
      target: 'header:projectName',
    })
  })

  it('describes a pricing field target', () => {
    const before = createInitialQuotation([], 'en-US', { quotationNumber: 'Q-001' })
    const after = structuredClone(before)
    after.totalsConfig.globalMarkupRate = before.totalsConfig.globalMarkupRate + 5

    expect(describeQuotationHistoryChange(before, after)).toMatchObject({
      kind: 'fieldChanged',
      target: 'totals:globalMarkupRate',
    })
  })
})
