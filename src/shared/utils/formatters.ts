import type { CurrencyCode } from '@/features/quotations/types'
import { DEFAULT_LOCALE, type SupportedLocale } from '@/shared/i18n/locale'

export function formatCurrency(amount: number, currency: CurrencyCode, locale: SupportedLocale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(value: number, locale: SupportedLocale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100)
}

export function formatIsoDate(value: string, locale: SupportedLocale = DEFAULT_LOCALE) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return value
  }

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month, day))

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: locale === 'zh-CN' ? 'long' : 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}
