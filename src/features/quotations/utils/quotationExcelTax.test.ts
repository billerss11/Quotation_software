import { describe, expect, it } from 'vitest'

import { getExcelTaxQuota, getExcelTaxRate } from './quotationExcelTax'

describe('exact Excel tax arithmetic', () => {
  it.each([0, 0.07, 5, 10, 13.37, 12.3456, 0.0000001, 100])('keeps the complete %s percent rate', rate => {
    const fraction = getExcelTaxRate(rate)
    expect(fraction.numerator / fraction.scale * 100).toBeCloseTo(rate, 12)
    expect(Number.isInteger(fraction.numerator)).toBe(true)
  })

  it('uses identical integer remainders for decimal ties', () => {
    const rate = getExcelTaxRate(10)
    expect(getExcelTaxQuota(0.03, rate)).toEqual({ cents: 0, remainder: 3000 })
    expect(getExcelTaxQuota(0.13, rate)).toEqual({ cents: 1, remainder: 3000 })
    expect(getExcelTaxRate(13.37).value).toBe(1337 / 10000)
  })

  it('decomposes large cent products without losing the remainder', () => {
    const rate = getExcelTaxRate(13.37)
    const amount = 9999000000000.41
    const product = 999900000000041n * 1337n
    expect(getExcelTaxQuota(amount, rate)).toEqual({ cents: Number(product / 10000n), remainder: Number(product % 10000n) })
  })

  it('rejects unsupported precision instead of silently rounding tax rates', () => {
    expect(() => getExcelTaxRate(1e-14)).toThrow('precision')
    expect(() => getExcelTaxQuota(1e13, getExcelTaxRate(10))).toThrow('precision')
    expect(() => getExcelTaxQuota(987654321.01, getExcelTaxRate(12.3456789))).toThrow('precision')
  })
})
