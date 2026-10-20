import { describe, expect, it } from 'vitest'

import { allocateTaxCents, calculateExactTaxAmount, getTaxRateFraction } from './taxAllocation'

describe('exact tax allocation', () => {
  it.each([
    [31372950, 13.37, 4194563.42],
    [9999000000000.41, 13.37, 1336866300000.05],
    [9999000000000.42, 13.37, 1336866300000.06],
    [0.05, 10, 0.01],
    [0.15, 10, 0.02],
    [0.29, 50, 0.15],
    [0.005, 100, 0.01],
    [100, 1e-7, 0],
    [Number.NaN, 10, 0],
    [-1, 10, 0],
  ])('rounds exact tax from cent-rounded amount %s at %s percent to %s', (taxableAmount, rate, expected) => {
    expect(calculateExactTaxAmount(taxableAmount, rate)).toBe(expected)
  })

  it('preserves fractional and scientific-notation rates without reducing their precision', () => {
    expect(getTaxRateFraction(0)).toEqual({ numerator: 0n, denominator: 1n })
    expect(getTaxRateFraction(10)).toEqual({ numerator: 1n, denominator: 10n })
    expect(getTaxRateFraction(100)).toEqual({ numerator: 1n, denominator: 1n })
    expect(getTaxRateFraction(12.3456789)).toEqual({ numerator: 123456789n, denominator: 1000000000n })
    expect(getTaxRateFraction(1e-7)).toEqual({ numerator: 1n, denominator: 1000000000n })
    expect(getTaxRateFraction(Number.MIN_VALUE)).toEqual({
      numerator: 1n,
      denominator: 2n * 10n ** 325n,
    })
  })

  it('uses the same normalization bounds as quotation tax calculations', () => {
    expect(getTaxRateFraction(-1)).toEqual(getTaxRateFraction(0))
    expect(getTaxRateFraction(Number.NaN)).toEqual(getTaxRateFraction(0))
    expect(getTaxRateFraction(Number.POSITIVE_INFINITY)).toEqual(getTaxRateFraction(0))
    expect(getTaxRateFraction(101)).toEqual(getTaxRateFraction(100))
  })

  it('breaks exact ties by quotation order even when floating multiplication differs', () => {
    const rows = [
      { subtotalAfterMarkup: 0.03, rootIndex: 0 },
      { subtotalAfterMarkup: 0.13, rootIndex: 1 },
    ]

    expect(allocateTaxCents(rows, 10, 0.02)).toEqual([1n, 1n])
    expect(allocateTaxCents(rows.slice().reverse(), 10, 0.02)).toEqual([1n, 1n])
    expect(allocateTaxCents([
      { subtotalAfterMarkup: 0.13, rootIndex: 0 },
      { subtotalAfterMarkup: 0.03, rootIndex: 1 },
    ], 10, 0.02)).toEqual([2n, 0n])
  })

  it('compares exact fractional-rate remainders before quotation order', () => {
    expect(allocateTaxCents([
      { subtotalAfterMarkup: 100, rootIndex: 0 },
      { subtotalAfterMarkup: 0.01, rootIndex: 1 },
      { subtotalAfterMarkup: 100, rootIndex: 2 },
    ], 12.3456789, 24.69)).toEqual([1235n, 0n, 1234n])
  })

  it('keeps zero subtotals and zero tax nonnegative', () => {
    expect(allocateTaxCents([
      { subtotalAfterMarkup: 0, rootIndex: 0 },
      { subtotalAfterMarkup: 100, rootIndex: 1 },
    ], 0, 0)).toEqual([0n, 0n])
    expect(allocateTaxCents([], 10, 0)).toEqual([])
  })

  it('reconciles positive and negative canonical residuals in bounded reverse quotation order', () => {
    const rows = [
      { subtotalAfterMarkup: 1, rootIndex: 0 },
      { subtotalAfterMarkup: 1, rootIndex: 1 },
    ]

    expect(allocateTaxCents(rows, 10, 0.25)).toEqual([11n, 14n])
    expect(allocateTaxCents(rows, 10, 0.05)).toEqual([5n, 0n])
    expect(allocateTaxCents(rows, 10, 0)).toEqual([0n, 0n])
  })
})
