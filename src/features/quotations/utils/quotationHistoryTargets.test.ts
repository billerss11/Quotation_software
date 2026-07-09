// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import {
  findQuotationHistoryTargetElement,
  getQuotationHistoryTargetItemId,
  getQuotationHistoryTargetPanel,
} from './quotationHistoryTargets'

describe('quotationHistoryTargets', () => {
  it('finds an exact history target', () => {
    document.body.innerHTML = '<label data-history-target="item:item-1:quantity"></label>'

    expect(findQuotationHistoryTargetElement(document, 'item:item-1:quantity')).toBe(
      document.querySelector('[data-history-target="item:item-1:quantity"]'),
    )
  })

  it('falls back from a missing item field target to the item target', () => {
    document.body.innerHTML = '<article data-history-target="item:item-1"></article>'

    expect(findQuotationHistoryTargetElement(document, 'item:item-1:quantity')).toBe(
      document.querySelector('[data-history-target="item:item-1"]'),
    )
  })

  it('maps support-panel targets to the matching panel', () => {
    expect(getQuotationHistoryTargetPanel('header:projectName')).toBe('quoteInfo')
    expect(getQuotationHistoryTargetPanel('header:customerCompany')).toBe('customer')
    expect(getQuotationHistoryTargetPanel('totals:globalMarkupRate')).toBe('pricing')
    expect(getQuotationHistoryTargetPanel('exchangeRate:EUR')).toBe('rates')
    expect(getQuotationHistoryTargetPanel('item:item-1:quantity')).toBeNull()
  })

  it('reads item ids from item targets', () => {
    expect(getQuotationHistoryTargetItemId('item:item-1:quantity')).toBe('item-1')
    expect(getQuotationHistoryTargetItemId('header:projectName')).toBeNull()
  })
})
