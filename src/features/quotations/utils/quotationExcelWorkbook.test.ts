import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import type { QuotationItem } from '../types'
import { createInitialQuotation } from './quotationDraft'
import { buildQuotationExcelModel } from './quotationExcelModel'
import { writeQuotationExcelWorkbook } from './quotationExcelWorkbook'
import { createQuotationItem } from './quotationItems'

function expectExcelFormulaLimits(bytes: Uint8Array) {
  const files = unzipSync(bytes)
  const xml = Object.entries(files).filter(([path]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path)).map(([, bytes]) => strFromU8(bytes)).join('\n')
  let formulaCount = 0
  let longestFormula = { address: '', length: 0 }
  let largestCall = { address: '', name: '', arguments: 0 }
  for (const match of xml.matchAll(/<c\b[^>]*r="([^"]+)"[^>]*>([\s\S]*?)<\/c>/g)) {
    const address = match[1]!
    const content = match[2]!.match(/<f>([\s\S]*?)<\/f>/)?.[1]
    if (content === undefined) continue
    const formula = content.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    if (formula.length > longestFormula.length) longestFormula = { address, length: formula.length }
    const calls: { name: string; arguments: number }[] = []
    let quoted = false
    for (let index = 0; index < formula.length; index += 1) {
      const character = formula[index]
      if (character === '"') {
        if (quoted && formula[index + 1] === '"') index += 1
        else quoted = !quoted
      }
      if (quoted) continue
      if (character === '(') calls.push({ name: formula.slice(0, index).match(/[A-Z][A-Z0-9_.]*$/)?.[0] ?? '', arguments: 1 })
      else if (character === ',') {
        const call = calls.at(-1)
        if (call) call.arguments += 1
      } else if (character === ')') {
        const call = calls.pop()
        if (call?.name && call.arguments > largestCall.arguments) largestCall = { address, ...call }
      }
    }
    formulaCount += 1
  }
  expect(formulaCount).toBeGreaterThan(1000)
  expect(longestFormula.length, `${longestFormula.address}: formula length`).toBeLessThanOrEqual(8192)
  expect(largestCall.arguments, `${largestCall.address}: ${largestCall.name} argument count`).toBeLessThanOrEqual(255)
}

function quotation(items: QuotationItem[]) {
  const draft = createInitialQuotation([], 'en-US')
  draft.majorItems = items
  draft.exchangeRates = { USD: 1 }
  draft.totalsConfig = {
    globalMarkupRate: 10,
    taxMode: 'mixed',
    taxClasses: [{ id: 'standard', label: 'Standard', rate: 10 }, { id: 'reduced', label: 'Reduced', rate: 5 }],
    defaultTaxClassId: 'standard',
  }
  return draft
}

function leaf(index: number) {
  return createQuotationItem('USD', { unitCost: 1.25, quantity: 1.5, taxClassId: index % 2 ? 'standard' : 'reduced' })
}

describe('large quotation workbook formula limits', () => {
  it.each(['customer', 'internal'] as const)('supports 1600 disjoint root sums in %s workbooks', (mode) => {
    const draft = quotation(Array.from({ length: 1600 }, () => createQuotationItem('USD', { children: [leaf(0)] })))
    expectExcelFormulaLimits(writeQuotationExcelWorkbook(buildQuotationExcelModel(draft, mode)))
  })

  it.each(['customer', 'internal'] as const)('supports 1600 disjoint child sums in %s workbooks', (mode) => {
    const children = Array.from({ length: 1600 }, () => createQuotationItem('USD', { children: [leaf(0), leaf(1)] }))
    const draft = quotation([createQuotationItem('USD', { children })])
    expectExcelFormulaLimits(writeQuotationExcelWorkbook(buildQuotationExcelModel(draft, mode)))
  })
})
