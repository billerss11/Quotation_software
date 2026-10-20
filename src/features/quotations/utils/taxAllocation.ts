import { roundMoney } from './moneyMath'
import { normalizeTaxRate } from './quotationTaxes'

interface TaxAllocationRow {
  subtotalAfterMarkup: number
  rootIndex: number
}

export function getTaxRateFraction(rate: number) {
  const fraction = decimalFraction(normalizeTaxRate(rate))
  let numerator = fraction.numerator
  let denominator = fraction.denominator * 100n
  let divisor = numerator
  let remainder = denominator

  while (remainder !== 0n) {
    const nextRemainder = divisor % remainder
    divisor = remainder
    remainder = nextRemainder
  }

  numerator /= divisor
  denominator /= divisor
  return { numerator, denominator }
}

export function calculateExactTaxAmount(taxableAmount: number, rate: number) {
  const fraction = getTaxRateFraction(rate)
  const quotaNumerator = moneyToExactCents(taxableAmount) * fraction.numerator
  const taxCents = (quotaNumerator * 2n + fraction.denominator) / (fraction.denominator * 2n)
  const digits = String(taxCents).padStart(3, '0')
  return Number(`${digits.slice(0, -2)}.${digits.slice(-2)}`)
}

export function allocateTaxCents(rows: TaxAllocationRow[], rate: number, targetTaxAmount: number) {
  const fraction = getTaxRateFraction(rate)
  const allocationRows = rows.map((row) => {
    const subtotalCents = moneyToExactCents(row.subtotalAfterMarkup)
    const quotaNumerator = subtotalCents * fraction.numerator

    return {
      rootIndex: row.rootIndex,
      subtotalCents,
      allocatedTaxCents: quotaNumerator / fraction.denominator,
      remainder: quotaNumerator % fraction.denominator,
    }
  })
  let remainingTaxCents = moneyToExactCents(targetTaxAmount)
    - allocationRows.reduce((total, row) => total + row.allocatedTaxCents, 0n)

  const priorityRows = allocationRows.slice().sort((left, right) => (
    left.remainder === right.remainder
      ? left.rootIndex - right.rootIndex
      : left.remainder > right.remainder ? -1 : 1
  ))

  for (const row of priorityRows) {
    if (remainingTaxCents <= 0n) break
    row.allocatedTaxCents += 1n
    remainingTaxCents -= 1n
  }

  const reverseRows = allocationRows.slice().sort((left, right) => right.rootIndex - left.rootIndex)

  if (remainingTaxCents > 0n) {
    const adjustmentRow = reverseRows.find((row) => row.subtotalCents > 0n) ?? reverseRows[0]
    if (adjustmentRow) adjustmentRow.allocatedTaxCents += remainingTaxCents
  } else if (remainingTaxCents < 0n) {
    for (const row of reverseRows) {
      if (remainingTaxCents === 0n) break
      const reduction = row.allocatedTaxCents < -remainingTaxCents
        ? row.allocatedTaxCents
        : -remainingTaxCents
      row.allocatedTaxCents -= reduction
      remainingTaxCents += reduction
    }
  }

  return allocationRows.map((row) => row.allocatedTaxCents)
}

function moneyToExactCents(amount: number) {
  const fraction = decimalFraction(Math.max(roundMoney(amount), 0))
  return fraction.numerator * 100n / fraction.denominator
}

function decimalFraction(value: number) {
  const [coefficient, exponent = '0'] = String(value).toLowerCase().split('e')
  const [wholePart, fractionPart = ''] = coefficient.split('.')
  const decimalPlaces = fractionPart.length - Number(exponent)
  const numerator = BigInt(`${wholePart}${fractionPart}`)

  return decimalPlaces >= 0
    ? { numerator, denominator: 10n ** BigInt(decimalPlaces) }
    : { numerator: numerator * 10n ** BigInt(-decimalPlaces), denominator: 1n }
}
