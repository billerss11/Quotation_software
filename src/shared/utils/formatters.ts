import type { CurrencyCode } from '@/features/quotations/types'

export function formatCurrency(amount: number, currency: CurrencyCode) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}
