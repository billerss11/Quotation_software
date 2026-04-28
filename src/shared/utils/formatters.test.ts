import { describe, expect, it } from 'vitest'

import { formatCurrency, formatIsoDate, formatPercent } from './formatters'

describe('formatters', () => {
  it('formats currency using the requested locale', () => {
    expect(formatCurrency(1234.5, 'CNY', 'en-US')).toBe('CN¥1,234.50')
    expect(formatCurrency(1234.5, 'CNY', 'zh-CN')).toBe('¥1,234.50')
  })

  it('formats percentages with stable precision', () => {
    expect(formatPercent(12.5, 'en-US')).toBe('12.50%')
    expect(formatPercent(12.5, 'zh-CN')).toBe('12.50%')
  })

  it('formats ISO dates using the requested locale', () => {
    expect(formatIsoDate('2026-04-24', 'en-US')).toBe('Apr 24, 2026')
    expect(formatIsoDate('2026-04-24', 'zh-CN')).toBe('2026年4月24日')
  })
})
