export const MAX_MARKUP_RATE = 1_000
export const MAX_DISCOUNT_PERCENTAGE = 100
export const MAX_TAX_RATE = 100
export const MIN_EXCHANGE_RATE = 0.000001
export const MAX_EXCHANGE_RATE = 1_000_000

export function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}
