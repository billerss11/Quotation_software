import type { CurrencyCode } from '../types'

const currencyOptions: CurrencyCode[] = ['USD', 'EUR', 'CNY', 'GBP']

export function getCurrencyOptions(): CurrencyCode[] {
  return [...currencyOptions]
}
