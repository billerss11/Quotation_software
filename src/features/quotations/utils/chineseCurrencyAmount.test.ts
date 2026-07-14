import { describe, expect, it } from 'vitest'

import { formatChineseCurrencyAmount } from './chineseCurrencyAmount'

describe('formatChineseCurrencyAmount', () => {
  it('formats the example amount with formal Chinese financial numerals', () => {
    expect(formatChineseCurrencyAmount(1_001_000, 'CNY')).toBe('人民币壹佰万零壹仟元整')
  })

  it('handles internal zeroes and consecutive zeroes', () => {
    expect(formatChineseCurrencyAmount(1_409.5, 'CNY')).toBe('人民币壹仟肆佰零玖元伍角整')
    expect(formatChineseCurrencyAmount(6_007.14, 'CNY')).toBe('人民币陆仟零柒元壹角肆分')
    expect(formatChineseCurrencyAmount(100_000_001, 'CNY')).toBe('人民币壹亿零壹元整')
  })

  it('writes zero jiao before a non-zero fen', () => {
    expect(formatChineseCurrencyAmount(16_409.02, 'CNY')).toBe('人民币壹万陆仟肆佰零玖元零贰分')
  })

  it('uses the selected currency name and existing money rounding', () => {
    expect(formatChineseCurrencyAmount(12.34, 'USD')).toBe('美元壹拾贰元叁角肆分')
    expect(formatChineseCurrencyAmount(1.005, 'EUR')).toBe('欧元壹元零壹分')
  })

  it('formats zero and negative amounts safely', () => {
    expect(formatChineseCurrencyAmount(0, 'CNY')).toBe('人民币零元整')
    expect(formatChineseCurrencyAmount(-8.5, 'GBP')).toBe('英镑负捌元伍角整')
  })
})
