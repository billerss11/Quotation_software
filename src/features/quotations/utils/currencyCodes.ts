export const STANDARD_CURRENCY_CODES = ['USD', 'EUR', 'CNY', 'GBP'] as const

const runtimeSupportedCurrencyCodes = new Map<string, boolean>()
const knownRuntimeCurrencyCodes = typeof Intl.supportedValuesOf === 'function'
  ? new Set(Intl.supportedValuesOf('currency'))
  : null

export function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toUpperCase()

  if (!/^[A-Z]{3}$/.test(normalized)) {
    return null
  }

  return normalized
}

export function isSupportedCurrencyCode(code: string): boolean {
  const normalized = normalizeCurrencyCode(code)

  if (!normalized) {
    return false
  }

  const cached = runtimeSupportedCurrencyCodes.get(normalized)

  if (cached !== undefined) {
    return cached
  }

  if (knownRuntimeCurrencyCodes) {
    const isKnownCurrency = knownRuntimeCurrencyCodes.has(normalized)
    runtimeSupportedCurrencyCodes.set(normalized, isKnownCurrency)
    return isKnownCurrency
  }

  try {
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalized,
    }).format(1)

    runtimeSupportedCurrencyCodes.set(normalized, true)
    return true
  } catch {
    runtimeSupportedCurrencyCodes.set(normalized, false)
    return false
  }
}

export function parseCurrencyCode(value: unknown): string | null {
  const normalized = normalizeCurrencyCode(value)

  return normalized && isSupportedCurrencyCode(normalized) ? normalized : null
}

export function sortCurrencyCodes(codes: Iterable<string>, baseCurrency?: string): string[] {
  const normalizedBaseCurrency = parseCurrencyCode(baseCurrency)
  const uniqueCodes = new Set<string>()

  for (const code of codes) {
    const normalized = parseCurrencyCode(code)

    if (normalized) {
      uniqueCodes.add(normalized)
    }
  }

  const sortedCodes = [...uniqueCodes].sort((left, right) => left.localeCompare(right))

  if (!normalizedBaseCurrency || !uniqueCodes.has(normalizedBaseCurrency)) {
    return sortedCodes
  }

  return [normalizedBaseCurrency, ...sortedCodes.filter((code) => code !== normalizedBaseCurrency)]
}
