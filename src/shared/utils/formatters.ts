import type { CurrencyCode } from '@/features/quotations/types'
import { DEFAULT_LOCALE, type SupportedLocale } from '@/shared/i18n/locale'

const currencyFormatters = new Map<string, Intl.NumberFormat>()
const percentFormatters = new Map<SupportedLocale, Intl.NumberFormat>()
const dateFormatters = new Map<SupportedLocale, Intl.DateTimeFormat>()

export function formatCurrency(amount: number, currency: CurrencyCode, locale: SupportedLocale = DEFAULT_LOCALE) {
  return getCurrencyFormatter(currency, locale).format(amount)
}

export function formatPercent(value: number, locale: SupportedLocale = DEFAULT_LOCALE) {
  return getPercentFormatter(locale).format(value / 100)
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

  return getDateFormatter(locale).format(date)
}

function getCurrencyFormatter(currency: CurrencyCode, locale: SupportedLocale) {
  const cacheKey = `${locale}:${currency}`
  const cachedFormatter = currencyFormatters.get(cacheKey)

  if (cachedFormatter) {
    return cachedFormatter
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  currencyFormatters.set(cacheKey, formatter)
  return formatter
}

function getPercentFormatter(locale: SupportedLocale) {
  const cachedFormatter = percentFormatters.get(locale)

  if (cachedFormatter) {
    return cachedFormatter
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  percentFormatters.set(locale, formatter)
  return formatter
}

function getDateFormatter(locale: SupportedLocale) {
  const cachedFormatter = dateFormatters.get(locale)

  if (cachedFormatter) {
    return cachedFormatter
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: locale === 'zh-CN' ? 'long' : 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

  dateFormatters.set(locale, formatter)
  return formatter
}
