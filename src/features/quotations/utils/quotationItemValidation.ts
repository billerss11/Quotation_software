import type { ExchangeRateTable, QuotationItem } from '../types'
import { calculateQuotationItemSellingAmount } from './quotationCalculations'

export interface QuotationItemAmountMismatch {
  expectedTotal: number
  actualTotal: number
  difference: number
}

const amountTolerance = 0.01

export function getQuotationItemAmountMismatch(
  item: QuotationItem,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  inheritedMarkupRate?: number,
): QuotationItemAmountMismatch | null {
  if (item.children.length === 0 || typeof item.expectedTotal !== 'number' || !Number.isFinite(item.expectedTotal)) {
    return null
  }

  const expectedTotal = roundMoney(item.expectedTotal)
  const actualTotal = calculateQuotationItemSellingAmount(item, globalMarkupRate, exchangeRates, inheritedMarkupRate)
  const difference = roundMoney(Math.abs(actualTotal - expectedTotal))

  if (difference <= amountTolerance) {
    return null
  }

  return {
    expectedTotal,
    actualTotal,
    difference,
  }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
