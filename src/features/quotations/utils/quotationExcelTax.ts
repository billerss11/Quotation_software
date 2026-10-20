import { getTaxRateFraction } from './taxAllocation'
import { QuotationOutputError } from './quotationOutputValidation'

export const EXCEL_EXACT_INTEGER_LIMIT = 999_999_999_999_999

export function getExcelTaxRate(rate: number) {
  const fraction = getTaxRateFraction(rate)
  let scale = 10_000n
  while (scale % fraction.denominator !== 0n) {
    scale *= 10n
    if (scale > 1_000_000_000_000_000n) throw precisionError()
  }
  const numerator = fraction.numerator * (scale / fraction.denominator)
  const value = Number(numerator) / Number(scale)
  if (Number(value.toPrecision(15)) !== value) throw precisionError()
  return { scale: Number(scale), numerator: Number(numerator), value }
}

export function getExcelTaxQuota(amount: number, rate: ReturnType<typeof getExcelTaxRate>) {
  if (!Number.isFinite(amount) || amount < 0 || amount > EXCEL_EXACT_INTEGER_LIMIT / 100) throw precisionError()
  const cents = BigInt(amount.toFixed(2).replace('.', ''))
  const scale = BigInt(rate.scale)
  const numerator = BigInt(rate.numerator)
  const product = cents % scale * numerator
  if (cents > BigInt(EXCEL_EXACT_INTEGER_LIMIT) || product > BigInt(EXCEL_EXACT_INTEGER_LIMIT)) throw precisionError()
  return {
    cents: Number(cents / scale * numerator + product / scale),
    remainder: Number(product % scale),
  }
}

export function getExcelTaxFormulas(amount: string, numerator: string, denominator: string) {
  const cents = `ROUND((${amount})*100,0)`
  const product = `MOD(${cents},${denominator})*${numerator}`
  const valid = `AND(${cents}<=${EXCEL_EXACT_INTEGER_LIMIT},${product}<=${EXCEL_EXACT_INTEGER_LIMIT})`
  const whole = `QUOTIENT(${cents},${denominator})*${numerator}+QUOTIENT(${product},${denominator})`
  const remainder = `MOD(${product},${denominator})`
  return {
    wholeCents: `IF(${valid},${whole},NA())`,
    remainder: `IF(${valid},${remainder},NA())`,
    amount: `IF(${valid},(${whole}+IF(${remainder}>=${denominator}/2,1,0))/100,NA())`,
  }
}

function precisionError() {
  return new QuotationOutputError('excel_precision_unsupported', 'quotation.totalsConfig.taxClasses')
}
