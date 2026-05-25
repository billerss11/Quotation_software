import { describe, expect, it } from 'vitest'

import { formatCurrency, formatIsoDate, formatPercent } from './formatters'

describe('formatters', () => {
  it('formats currency using compact symbols', () => {
    expect(formatCurrency(1234.5, 'CNY', 'en-US')).toBe('\u00A51,234.50')
    expect(formatCurrency(1234.5, 'CNY', 'zh-CN')).toBe('\u00A51,234.50')
    expect(formatCurrency(1234.5, 'USD', 'en-US')).toBe('$1,234.50')
  })

  it('reuses currency formatters for the same locale and currency', () => {
    const originalNumberFormat = Intl.NumberFormat
    let formatterConstructionCount = 0

    Object.defineProperty(Intl, 'NumberFormat', {
      configurable: true,
      value: new Proxy(originalNumberFormat, {
        construct(target, args) {
          formatterConstructionCount += 1
          return Reflect.construct(target, args)
        },
        apply(target, thisArg, args) {
          formatterConstructionCount += 1
          return Reflect.apply(target, thisArg, args)
        },
      }),
    })

    try {
      expect(formatCurrency(1, 'EUR', 'en-US')).toContain('1.00')
      expect(formatCurrency(2, 'EUR', 'en-US')).toContain('2.00')
      expect(formatCurrency(3, 'JPY', 'en-US')).toContain('3.00')
      expect(formatterConstructionCount).toBe(2)
    } finally {
      Object.defineProperty(Intl, 'NumberFormat', {
        configurable: true,
        value: originalNumberFormat,
      })
    }
  })

  it('formats percentages with stable precision', () => {
    expect(formatPercent(12.5, 'en-US')).toBe('12.50%')
    expect(formatPercent(12.5, 'zh-CN')).toBe('12.50%')
  })

  it('formats ISO dates using the requested locale', () => {
    expect(formatIsoDate('2026-04-24', 'en-US')).toBe('Apr 24, 2026')
    expect(formatIsoDate('2026-04-24', 'zh-CN')).toBe('2026\u5E744\u670824\u65E5')
  })
})
