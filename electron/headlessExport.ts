export interface HeadlessExportOptions {
  inputFile: string
  quotationPdf?: string
  goodsReceiptPdf?: string
  resultJson?: string
  refreshExchangeRates?: true
}

const HEADLESS_EXPORT_FLAG = '--headless-export'

export function parseHeadlessExportArguments(args: readonly string[]): HeadlessExportOptions | null {
  if (!args.includes(HEADLESS_EXPORT_FLAG)) {
    return null
  }

  const inputFile = readRequiredArgument(args, '--input')
  const quotationPdf = readOptionalArgument(args, '--quotation-pdf')
  const goodsReceiptPdf = readOptionalArgument(args, '--goods-receipt-pdf')
  const resultJson = readOptionalArgument(args, '--result-json')
  const refreshExchangeRates = args.includes('--refresh-exchange-rates')

  if (!quotationPdf && !goodsReceiptPdf) {
    throw new Error('Headless export requires --quotation-pdf, --goods-receipt-pdf, or both.')
  }

  return {
    inputFile,
    ...(quotationPdf ? { quotationPdf } : {}),
    ...(goodsReceiptPdf ? { goodsReceiptPdf } : {}),
    ...(resultJson ? { resultJson } : {}),
    ...(refreshExchangeRates ? { refreshExchangeRates: true as const } : {}),
  }
}

function readRequiredArgument(args: readonly string[], name: string) {
  const value = readOptionalArgument(args, name)

  if (!value) {
    throw new Error(`Headless export requires ${name} <path>.`)
  }

  return value
}

function readOptionalArgument(args: readonly string[], name: string) {
  const index = args.indexOf(name)

  if (index === -1) {
    return undefined
  }

  const value = args[index + 1]

  if (!value || value.startsWith('--')) {
    throw new Error(`Headless export requires a path after ${name}.`)
  }

  return value
}
