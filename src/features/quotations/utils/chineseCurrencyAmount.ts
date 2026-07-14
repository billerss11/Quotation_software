import type { CurrencyCode } from '../types'
import { roundMoney } from './moneyMath'

const FINANCIAL_DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'] as const
const SMALL_UNITS = ['仟', '佰', '拾', ''] as const
const LARGE_UNITS = ['', '万', '亿', '万亿'] as const

const COMMON_CURRENCY_NAMES: Record<string, string> = {
  CNY: '人民币',
  USD: '美元',
  EUR: '欧元',
  HKD: '港币',
  GBP: '英镑',
  JPY: '日元',
}

const chineseCurrencyNames = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['zh-CN'], { type: 'currency' })
  : null

export function formatChineseCurrencyAmount(amount: number, currency: CurrencyCode) {
  const roundedAmount = roundMoney(amount)
  const isNegative = roundedAmount < 0
  const totalCents = BigInt(Math.round(Math.abs(roundedAmount) * 100))
  const wholeAmount = totalCents / 100n
  const jiao = Number((totalCents / 10n) % 10n)
  const fen = Number(totalCents % 10n)
  const currencyName = getChineseCurrencyName(currency)
  const sign = isNegative ? '负' : ''

  return `${currencyName}${sign}${formatWholeAmount(wholeAmount)}元${formatFraction(jiao, fen)}`
}

function formatWholeAmount(amount: bigint) {
  if (amount === 0n) {
    return FINANCIAL_DIGITS[0]
  }

  const groups: number[] = []
  let remaining = amount

  while (remaining > 0n) {
    groups.push(Number(remaining % 10000n))
    remaining /= 10000n
  }

  if (groups.length > LARGE_UNITS.length) {
    return amount.toString()
  }

  let result = ''
  let pendingZero = false
  let previousGroup: number | null = null

  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index]

    if (group === 0) {
      if (result) {
        pendingZero = true
      }
      continue
    }

    const needsZero = Boolean(result) && (
      pendingZero
      || group < 1000
      || (previousGroup !== null && previousGroup % 10 === 0)
    )

    if (needsZero && !result.endsWith(FINANCIAL_DIGITS[0])) {
      result += FINANCIAL_DIGITS[0]
    }

    result += `${formatFourDigitGroup(group)}${LARGE_UNITS[index]}`
    pendingZero = false
    previousGroup = group
  }

  return result
}

function formatFourDigitGroup(value: number) {
  const divisors = [1000, 100, 10, 1] as const
  let result = ''
  let pendingZero = false

  divisors.forEach((divisor, index) => {
    const digit = Math.floor(value / divisor) % 10

    if (digit === 0) {
      if (result) {
        pendingZero = true
      }
      return
    }

    if (pendingZero) {
      result += FINANCIAL_DIGITS[0]
    }

    result += `${FINANCIAL_DIGITS[digit]}${SMALL_UNITS[index]}`
    pendingZero = false
  })

  return result
}

function formatFraction(jiao: number, fen: number) {
  if (jiao === 0 && fen === 0) {
    return '整'
  }

  if (jiao === 0) {
    return `零${FINANCIAL_DIGITS[fen]}分`
  }

  if (fen === 0) {
    return `${FINANCIAL_DIGITS[jiao]}角整`
  }

  return `${FINANCIAL_DIGITS[jiao]}角${FINANCIAL_DIGITS[fen]}分`
}

function getChineseCurrencyName(currency: CurrencyCode) {
  const normalizedCurrency = currency.trim().toUpperCase()

  return COMMON_CURRENCY_NAMES[normalizedCurrency]
    ?? chineseCurrencyNames?.of(normalizedCurrency)
    ?? normalizedCurrency
}
