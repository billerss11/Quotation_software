import { describe, expect, it } from 'vitest'

import { roundMoney } from './moneyMath'
import { calculateQuotationTotals } from './quotationCalculations'
import { createQuotationItem } from './quotationItems'

describe('money rounding boundaries', () => {
  it.each([6_000_000_000_000, -6_000_000_000_000, 6_000_000_000_000.01])(
    'leaves an already rounded amount unchanged: %s', (amount) => {
      expect(roundMoney(amount)).toBe(amount)
      expect(roundMoney(roundMoney(amount))).toBe(amount)
    },
  )

  it.each([
    [1.005, 1.01], [-1.005, -1.01], [0.29 * 0.5, 0.15],
    [(231.42 + 139.87 + 532.56) * 0.1, 90.39],
  ])('rounds %s to %s', (amount, expected) => {
    expect(roundMoney(amount)).toBe(expected)
  })

  it.each([6_000_000_000_000, 1e307])('keeps a finite one-unit quotation amount: %s', (amount) => {
    const item = createQuotationItem('USD', { pricingMethod: 'manual_price', manualUnitPrice: amount })
    const totals = calculateQuotationTotals([item], { globalMarkupRate: 0, taxRate: 0 }, { USD: 1 })
    expect(roundMoney(amount)).toBe(amount)
    expect(totals.subtotalAfterMarkup).toBe(amount)
    expect(totals.taxableSubtotal).toBe(amount)
    expect(totals.grandTotal).toBe(amount)
  })
})
