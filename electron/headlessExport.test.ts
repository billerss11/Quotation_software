import { describe, expect, it } from 'vitest'

import { parseHeadlessExportArguments } from './headlessExport'

describe('parseHeadlessExportArguments', () => {
  it('returns null for a normal desktop launch', () => {
    expect(parseHeadlessExportArguments(['Quotation Software.exe'])).toBeNull()
  })

  it('parses quotation and goods-receipt output paths', () => {
    expect(parseHeadlessExportArguments([
      'Quotation Software.exe',
      '--headless-export',
      '--input',
      'C:\\Work Files\\quotation.json',
      '--quotation-pdf',
      'C:\\Work Files\\quotation.pdf',
      '--goods-receipt-pdf',
      'C:\\Work Files\\goods receipt.pdf',
      '--result-json',
      'C:\\Work Files\\result.json',
      '--refresh-exchange-rates',
    ])).toEqual({
      inputFile: 'C:\\Work Files\\quotation.json',
      quotationPdf: 'C:\\Work Files\\quotation.pdf',
      goodsReceiptPdf: 'C:\\Work Files\\goods receipt.pdf',
      resultJson: 'C:\\Work Files\\result.json',
      refreshExchangeRates: true,
    })
  })

  it('requires an input and at least one PDF output', () => {
    expect(() => parseHeadlessExportArguments([
      '--headless-export',
      '--quotation-pdf',
      'quotation.pdf',
    ])).toThrow('requires --input')

    expect(() => parseHeadlessExportArguments([
      '--headless-export',
      '--input',
      'quotation.json',
    ])).toThrow('requires --quotation-pdf, --goods-receipt-pdf, or both')
  })
})
