const MONEY_DECIMAL_PLACES = 2

export function roundMoney(value: number) {
  return roundDecimal(value, MONEY_DECIMAL_PLACES)
}

export function roundMoneyDivision(amount: number, divisor: number) {
  if (!Number.isFinite(divisor) || divisor <= 0) {
    return 0
  }

  return roundMoney(amount / divisor)
}

function roundDecimal(value: number, decimalPlaces: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  const sign = value < 0 ? -1 : 1
  const plainValue = toPlainDecimalString(Math.abs(value))
  const [wholePart, fractionPart = ''] = plainValue.split('.')
  const paddedFraction = fractionPart.padEnd(decimalPlaces + 1, '0')
  const keptFraction = paddedFraction.slice(0, decimalPlaces)
  const roundingDigit = Number(paddedFraction[decimalPlaces] ?? '0')
  const scaledDigits = `${wholePart || '0'}${keptFraction}`.replace(/^0+(?=\d)/, '')
  let scaledValue = BigInt(scaledDigits || '0')

  if (roundingDigit >= 5) {
    scaledValue += 1n
  }

  return sign * (Number(scaledValue) / (10 ** decimalPlaces))
}

function toPlainDecimalString(value: number) {
  const valueText = String(value)

  if (!/[eE]/.test(valueText)) {
    return valueText
  }

  const [coefficient, exponentText] = valueText.toLowerCase().split('e')
  const exponent = Number(exponentText)

  if (!Number.isInteger(exponent)) {
    return value.toFixed(MONEY_DECIMAL_PLACES + 1)
  }

  const [wholePart, fractionPart = ''] = coefficient.split('.')
  const digits = `${wholePart}${fractionPart}`
  const decimalIndex = wholePart.length + exponent

  if (decimalIndex <= 0) {
    return `0.${'0'.repeat(Math.abs(decimalIndex))}${digits}`
  }

  if (decimalIndex >= digits.length) {
    return `${digits}${'0'.repeat(decimalIndex - digits.length)}`
  }

  return `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`
}
