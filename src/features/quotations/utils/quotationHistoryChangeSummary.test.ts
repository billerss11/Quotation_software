import { describe, expect, it } from 'vitest'

import {
  createQuotationFieldChangeSummary,
  createQuotationItemAddedRemovedSummary,
  createQuotationItemFieldChangeSummary,
} from './quotationHistoryChangeSummary'

describe('quotationHistoryChangeSummary', () => {
  it('builds an item field summary without scanning the quotation', () => {
    expect(createQuotationItemFieldChangeSummary('item-1', 'Pump', 'quantity', 1, 3)).toEqual({
      kind: 'itemFieldChanged',
      target: 'item:item-1:quantity',
      itemName: 'Pump',
      fieldLabelKey: 'quotations.history.fields.quantity',
      previousValue: '1',
      nextValue: '3',
    })
  })

  it('builds a field summary without complete quotation drafts', () => {
    expect(createQuotationFieldChangeSummary(
      'header:projectName',
      'quotations.history.fields.projectName',
      '',
      'Hydrogen plant',
    )).toEqual({
      kind: 'fieldChanged',
      target: 'header:projectName',
      fieldLabelKey: 'quotations.history.fields.projectName',
      previousValue: '',
      nextValue: 'Hydrogen plant',
    })
  })

  it('builds an item add/remove summary without scanning the tree', () => {
    expect(createQuotationItemAddedRemovedSummary('itemAdded', 'item-1', 'Compressor')).toEqual({
      kind: 'itemAdded',
      target: 'item:item-1',
      itemName: 'Compressor',
    })
  })
})
