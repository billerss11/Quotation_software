import { strFromU8, unzipSync } from 'fflate'
import { readSheet } from 'read-excel-file/universal'
import { describe, expect, it } from 'vitest'

import type { QuotationDraft, QuotationItem, QuotationRootItem } from '../types'
import { createInitialQuotation } from './quotationDraft'
import { buildQuotationExcelModel, type QuotationExcelExportMode } from './quotationExcelModel'
import { createQuotationItem } from './quotationItems'
import { calculateQuotationItemSellingAmount, calculateQuotationItemTaxBuckets, calculateQuotationItemUnitSellingPrice, calculateQuotationRootTaxBucketAllocations, calculateQuotationTotals, getEffectiveMarkupRate } from './quotationCalculations'
import { roundMoney } from './moneyMath'
import { excelColumn, excelSumFormula, EXCEL_STYLE, writeQuotationExcelWorkbook } from './quotationExcelWorkbook'
import { getQuotationExcelWorkbookLabels } from '../../../shared/i18n/quotationExcelWorkbook'

interface Cell {
  value: string | number | null
  formula?: string
}

function readWorkbook(quotation: QuotationDraft, mode: QuotationExcelExportMode = 'internal', locale = 'en-US') {
  const bytes = writeQuotationExcelWorkbook(buildQuotationExcelModel(quotation, mode, locale))
  const files = unzipSync(bytes)
  const xml = strFromU8(files['xl/worksheets/sheet1.xml']!)
  const cells = new Map<string, Cell>()
  const decode = (value: string) => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  for (const match of xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
    const attributes = match[1]!
    const content = match[2]!
    const formula = content.match(/<f>([\s\S]*?)<\/f>/)?.[1]
    const text = content.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1]
    const value = content.match(/<v>([\s\S]*?)<\/v>/)?.[1]
    const cellAddress = attributes.match(/\br="([^"]+)"/)![1]!
    cells.set(cellAddress, {
      value: text === undefined ? /\bt="str"/.test(attributes) ? decode(value ?? '') : value === undefined ? null : Number(value) : decode(text),
      ...(formula ? { formula: decode(formula) } : {}),
    })
  }
  function evaluate(address: string, overrides: Record<string, string | number | null> = {}, pending = new Set<string>(), computed = new Map<string, string | number | null>()): string | number | null {
    if (Object.hasOwn(overrides, address)) return overrides[address]!
    if (computed.has(address)) return computed.get(address)!
    const cell = cells.get(address)
    if (!cell?.formula) return cell?.value === '' ? null : cell?.value ?? null
    if (pending.has(address)) throw new Error(`Circular reference: ${address}`)
    const visiting = new Set(pending).add(address)
    const strings: string[] = []
    const expression = cell.formula.replace(/"(?:[^"]|"")*"/g, literal => {
      strings.push(literal.slice(1, -1).replace(/""/g, '"'))
      return `strings[${strings.length - 1}]`
    }).replace(/\$/g, '').replace(/\b[A-Z]+\d+:[A-Z]+\d+\b|\b[A-Z]+\d+\b/g, reference => reference.includes(':') ? `range('${reference}')` : `reference('${reference}')`)
      .replace(/<>/g, '!==').replace(/(?<![<>=!])=(?!=)/g, '===').replace(/&/g, '+')
      .replace(/--\((range\('[A-Z]+\d+:[A-Z]+\d+'\))([<>=!]+)((?:reference|range)\('[A-Z]+\d+(?::[A-Z]+\d+)?'\))\)/g, 'compare($1,$3,"$2")')
      .replace(/\bFALSE\b/g, 'false')
    const sum = (...values: unknown[]) => values.flat().reduce<number>((total, value) => total + (typeof value === 'number' ? value : 0), 0)
    const criterion = (value: unknown, condition: unknown): boolean => {
      if (typeof condition !== 'string') return value === condition
      if (condition.startsWith('<>')) return !criterion(value, condition.slice(2))
      if (condition.startsWith('>')) return Number(value) > Number(condition.slice(1))
      if (condition.includes('*') || condition.includes('?')) {
        const pattern = condition.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
        return new RegExp(`^${pattern}$`, 'i').test(String(value ?? ''))
      }
      return value === condition
    }
    const countifs = (...pairs: unknown[]) => (pairs[0] as unknown[]).reduce<number>((count, _value, index) => count + (pairs.every((pair, pairIndex) => pairIndex % 2 === 1 || criterion((pair as unknown[])[index], pairs[pairIndex + 1])) ? 1 : 0), 0)
    const result = new Function('reference', 'range', 'strings', 'SUM', 'ROUND', 'MAX', 'MIN', 'IF', 'AND', 'OR', 'ISNUMBER', 'INT', 'COUNTIFS', 'SUMIF', 'SUMIFS', 'SUMPRODUCT', 'compare', 'VLOOKUP', 'IFERROR', 'QUOTIENT', 'MOD', 'NA', `return (${expression})`)(
      (reference: string) => evaluate(reference, overrides, visiting, computed),
      (reference: string) => {
        const [start, end] = reference.split(':')
        const columnNumber = (value: string) => Array.from(value.replace(/\d/g, '')).reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0)
        const firstColumn = columnNumber(start!)
        const lastColumn = columnNumber(end!)
        return Array.from({ length: Number(end!.replace(/\D/g, '')) - Number(start!.replace(/\D/g, '')) + 1 }, (_value, index) => {
          const row = Number(start!.replace(/\D/g, '')) + index
          const values = Array.from({ length: lastColumn - firstColumn + 1 }, (_entry, columnIndex) => evaluate(`${excelColumn(firstColumn + columnIndex)}${row}`, overrides, visiting, computed))
          return firstColumn === lastColumn ? values[0] : values
        })
      }, strings,
      sum, (value: number, digits: number) => digits === 2 ? roundMoney(value) : Math.round(value * 10 ** digits) / 10 ** digits,
      Math.max, Math.min, (condition: unknown, yes: unknown, no: unknown) => condition ? yes : no,
      (...values: unknown[]) => values.every(Boolean), (...values: unknown[]) => values.some(Boolean),
      (value: unknown) => typeof value === 'number', Math.floor, countifs,
      (values: unknown[], condition: unknown, amounts: unknown[] = values) => sum(...amounts.filter((_amount, index) => criterion(values[index], condition))),
      (amounts: unknown[], ...pairs: unknown[]) => sum(...amounts.filter((_amount, index) => pairs.every((pair, pairIndex) => pairIndex % 2 === 1 || criterion((pair as unknown[])[index], pairs[pairIndex + 1])))),
      (...values: number[][]) => values[0]!.reduce((total, _value, index) => total + values.reduce((product, series) => product * series[index]!, 1), 0),
      (values: number[], other: number | number[], operator: string) => values.map((value, index) => {
        const target = Array.isArray(other) ? other[index] : other
        return operator === '>' ? Number(value > target!) : operator === '!==' ? Number(value !== target) : Number(value === target)
      }),
      (value: unknown, rows: unknown[][], index: number) => rows.find(row => row[0] === value)?.[index - 1] ?? Number.NaN,
      (value: unknown, fallback: unknown) => typeof value === 'number' && !Number.isFinite(value) ? fallback : value,
      (numerator: number, denominator: number) => Math.trunc(numerator / denominator),
      (numerator: number, denominator: number) => numerator % denominator,
      () => Number.NaN,
    ) as string | number
    if (typeof result === 'number' && !Number.isFinite(result)) throw new Error(`Invalid formula result: ${address}`)
    computed.set(address, result)
    return result
  }
  function summaryAddress(label: string) {
    const labelCell = [...cells.entries()].find(([address, cell]) => address.startsWith('B') && cell.value === label)
    if (!labelCell) throw new Error(`Summary missing: ${label}`)
    const row = labelCell[0].replace(/\D/g, '')
    return [...cells.keys()].filter(address => address.replace(/\D/g, '') === row).at(-1)!
  }
  return { bytes, files, cells, xml, evaluate, summaryAddress }
}

function item(overrides: Partial<QuotationItem> = {}) {
  return createQuotationItem('USD', { id: crypto.randomUUID(), name: 'Valve', ...overrides })
}

function quotation(items: QuotationRootItem[]) {
  const draft = createInitialQuotation([], 'en-US')
  draft.majorItems = items
  draft.exchangeRates = { USD: 1, EUR: 1.085, CNY: 0.14 }
  draft.totalsConfig = {
    globalMarkupRate: 10,
    taxMode: 'mixed',
    taxClasses: [{ id: 'standard', label: 'Standard', rate: 10 }, { id: 'reduced', label: 'Reduced', rate: 5 }],
    defaultTaxClassId: 'standard',
  }
  return draft
}

function expectFormulasMatchCache(workbook: ReturnType<typeof readWorkbook>) {
  const computed = new Map<string, string | number | null>()
  for (const [address, cell] of workbook.cells) {
    if (cell.formula) {
      const result = workbook.evaluate(address, {}, new Set(), computed)
      if (typeof cell.value === 'number') expect(result, `${address}: ${cell.formula}`).toBeCloseTo(cell.value, 8)
      else expect(result, `${address}: ${cell.formula}`).toBe(cell.value)
    }
  }
}

function expectCommercialFigures(workbook: ReturnType<typeof readWorkbook>, draft: QuotationDraft, overrides: Record<string, string | number> = {}) {
  const computed = new Map<string, string | number | null>()
  const subtotalRow = Number(workbook.summaryAddress('Subtotal').slice(1))
  const roots = draft.majorItems.filter((entry): entry is QuotationItem => !('kind' in entry))
  const allocations = calculateQuotationRootTaxBucketAllocations(draft.majorItems, draft.totalsConfig, draft.exchangeRates)
  for (const [address, cell] of workbook.cells) {
    if (!/^A\d+$/.test(address) || Number(address.slice(1)) >= subtotalRow || typeof cell.value !== 'string' || !/^\d+(?:\.\d+)*$/.test(cell.value)) continue
    const path = cell.value.split('.').map(Number)
    let parent: QuotationItem | undefined
    let siblings = roots
    let inheritedMarkup: number | undefined
    let inheritedTax: string | undefined
    for (const index of path.slice(0, -1)) {
      parent = siblings[index - 1]!
      inheritedMarkup = getEffectiveMarkupRate(parent.markupRate, inheritedMarkup ?? draft.totalsConfig.globalMarkupRate)
      inheritedTax = parent.taxClassId ?? inheritedTax
      siblings = parent.children
    }
    const entry = siblings[path.at(-1)! - 1]!
    const buckets = calculateQuotationItemTaxBuckets(entry, draft.totalsConfig, draft.exchangeRates, { inheritedMarkupRate: inheritedMarkup, inheritedTaxClassId: inheritedTax })
    const net = calculateQuotationItemSellingAmount(entry, draft.totalsConfig.globalMarkupRate, draft.exchangeRates, inheritedMarkup)
    const tax = roundMoney((parent ? buckets : allocations.get(entry.id)!).reduce((total, bucket) => total + bucket.taxAmount, 0))
    const gross = roundMoney(net + tax)
    const expected = [
      buckets.length > 1 ? net > 0 ? roundMoney(tax / net * 100) / 100 : 'Mixed' : (buckets[0]?.rate ?? 0) / 100,
      calculateQuotationItemUnitSellingPrice(entry, draft.totalsConfig.globalMarkupRate, draft.exchangeRates, inheritedMarkup),
      entry.quantity > 0 ? roundMoney(tax / entry.quantity) : '',
      entry.quantity > 0 ? roundMoney(gross / entry.quantity) : '',
      tax, net, gross,
    ]
    const row = address.slice(1)
    for (const [index, value] of expected.entries()) {
      const output = `${excelColumn(index + 5)}${row}`
      const actual = workbook.evaluate(output, overrides, new Set(), computed)
      if (index === 0 && typeof value === 'number') expect(actual, output).toBeCloseTo(value, 12)
      else expect(actual, output).toBe(value)
      if (!Object.keys(overrides).length) {
        if (index === 0 && typeof value === 'number') expect(workbook.cells.get(output)?.value, output).toBeCloseTo(value, 12)
        else expect(workbook.cells.get(output)?.value, output).toBe(value)
      }
    }
  }
  const totals = calculateQuotationTotals(draft.majorItems, draft.totalsConfig, draft.exchangeRates)
  for (const [label, value] of [['Subtotal', totals.subtotalAfterMarkup], ['Total tax', totals.taxAmount], ['TOTAL', totals.grandTotal]] as const) {
    const address = workbook.summaryAddress(label)
    expect(workbook.evaluate(address, overrides, new Set(), computed), label).toBe(value)
    if (!Object.keys(overrides).length) expect(workbook.cells.get(address)?.value, label).toBe(value)
  }
}

function expectExcelFormulaLimits(workbook: ReturnType<typeof readWorkbook>) {
  for (const cell of workbook.cells.values()) {
    if (!cell.formula) continue
    expect(cell.formula.length).toBeLessThanOrEqual(8192)
    const expression = cell.formula.replace(/"(?:[^"]|"")*"/g, '""')
    const calls: { name: string | undefined; arguments: number }[] = []
    for (let index = 0; index < expression.length; index += 1) {
      const character = expression[index]
      if (character === '(') calls.push({ name: expression.slice(0, index).match(/[A-Z_][A-Z0-9_.]*$/)?.[0], arguments: 1 })
      else if (character === ',') calls.at(-1)!.arguments += 1
      else if (character === ')') {
        const call = calls.pop()!
        if (call.name) expect(call.arguments, `${call.name} exceeds Excel argument limits`).toBeLessThanOrEqual(255)
      }
    }
  }
}

describe('quotation Excel calculation core', () => {
  it.each(['customer', 'internal'] as const)('uses Excel-compatible solid header fills in %s workbooks', (mode) => {
    const workbook = readWorkbook(quotation([item({ unitCost: 100 })]), mode)
    const stylesXml = strFromU8(workbook.files['xl/styles.xml']!)
    const fills = [...stylesXml.match(/<fills\b[^>]*>([\s\S]*?)<\/fills>/)![1]!.matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map(match => match[1]!)
    const styles = [...stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)![1]!.matchAll(/<xf\b([^>]*)>/g)].map(match => match[1]!)

    expect(fills).toHaveLength(6)
    expect(fills[0]).toContain('patternType="none"')
    expect(fills[1]).toContain('patternType="gray125"')
    for (const [styleIndex, color] of [
      [EXCEL_STYLE.header, 'FF173A4A'],
      [EXCEL_STYLE.inputMoney, 'FFF3F8FE'],
      [EXCEL_STYLE.section, 'FFE8F0F2'],
    ] as const) {
      const attributes = styles[styleIndex]!
      const fillId = Number(attributes.match(/fillId="(\d+)"/)![1])
      expect(fillId).toBeGreaterThan(1)
      expect(fills[fillId]).toContain('patternType="solid"')
      expect(fills[fillId]).toContain(`fgColor rgb="${color}"`)
      expect(attributes).toContain('applyFill="1"')
    }
    expect(workbook.xml).toContain(`r="A6" s="${EXCEL_STYLE.header}"`)
    expect([...workbook.xml.matchAll(/<c\b[^>]* s="2"/g)].length).toBeGreaterThan(11)
  })

  it('writes a real single-sheet workbook with numeric inputs, cached formulas and frozen headings', async () => {
    const draft = quotation([item({ quantity: 3, unitCost: 125.555 })])
    draft.totalsConfig.taxMode = 'single'
    const workbook = readWorkbook(draft, 'customer')
    expect(strFromU8(workbook.files['xl/workbook.xml']!)).toContain('fullCalcOnLoad="1"')
    expect(Object.keys(workbook.files).filter(path => /worksheets\/sheet\d+\.xml$/.test(path))).toHaveLength(1)
    expect(workbook.xml).toContain('topLeftCell="C7"')
    expect(workbook.xml).toContain('hidden="1"')
    expect(workbook.xml).not.toMatch(/<row r="7"[^>]*hidden="1"/)
    expect(workbook.xml).not.toContain('ref="A7:')
    expect(workbook.cells.get('C7')?.value).toBe(3)
    expect(workbook.cells.get('J7')?.formula).toBe('ROUND(MAX(C7,0)*(ROUND(MAX(F7,0),2)),2)')
    expectFormulasMatchCache(workbook)
    expectCommercialFigures(workbook, draft)
    const rows = await readSheet(Uint8Array.from(workbook.bytes).buffer)
    expect(rows[6]?.slice(0, 11)).toEqual(['1', 'Valve', 3, 'EA', 0.1, 138.12, 13.81, 151.93, 41.44, 414.36, 455.8])
  })

  it.each([1.005, -1.005])('rounds edited customer unit price %s before calculating amounts and tax', (unitPrice) => {
    const draft = quotation([item({ quantity: 2, unitCost: 1, markupRate: 0 })])
    const workbook = readWorkbook(draft, 'customer')
    const changed = structuredClone(draft)
    const changedItem = changed.majorItems[0] as QuotationItem
    changedItem.pricingMethod = 'manual_price'
    changedItem.manualUnitPrice = unitPrice
    const expected = calculateQuotationTotals(changed.majorItems, changed.totalsConfig, changed.exchangeRates)

    expect(workbook.evaluate('J7', { F7: unitPrice })).toBe(expected.subtotalAfterMarkup)
    expect(workbook.evaluate('I7', { F7: unitPrice })).toBe(expected.taxAmount)
    expect(workbook.evaluate(workbook.summaryAddress('TOTAL'), { F7: unitPrice })).toBe(expected.grandTotal)
  })

  it('allows changing to an unused configured currency and surfaces missing currencies', () => {
    const draft = quotation([item({ quantity: 2, unitCost: 100 })])
    draft.exchangeRates = { USD: 1, EUR: 1.2 }
    const workbook = readWorkbook(draft)
    const changed = structuredClone(draft)
    ;(changed.majorItems[0] as QuotationItem).costCurrency = 'EUR'

    expect([...workbook.cells.entries()].some(([address, cell]) => /^A\d+$/.test(address) && cell.value === 'EUR')).toBe(true)
    expect(workbook.evaluate('N7', { L7: 'EUR' })).toBe(1.2)
    expectCommercialFigures(workbook, changed, { L7: 'EUR' })
    expect(workbook.cells.get('N7')?.formula).not.toContain('IFERROR')
    expect(() => workbook.evaluate('N7', { L7: 'JPY' })).toThrow('Invalid formula result: N7')
  })

  it('recalculates FX, inherited markup, manual prices, hierarchy, charges and tax from editable cells', () => {
    const draft = quotation([item({ name: 'Skid', quantity: 1.5, markupRate: 18, children: [
      item({ name: 'Assembly', quantity: 2.5, taxClassId: 'reduced', children: [
        item({ name: 'Motor', quantity: 3, unitCost: 19.995, costCurrency: 'EUR' }),
        item({ name: 'Manual service', quantity: 2, unitCost: 0, pricingMethod: 'manual_price', manualUnitPrice: 8.555, taxClassId: 'standard' }),
      ] }),
      item({ name: 'Pipe', quantity: 4, unitCost: 0.567, markupRate: 0 }),
    ] })])
    draft.totalsConfig.extraCharges = [{ id: 'freight', label: 'Freight', amount: 1.005 }, { id: 'packing', label: 'Packing', amount: 2.005 }]
    const workbook = readWorkbook(draft)
    expectFormulasMatchCache(workbook)
    expectCommercialFigures(workbook, draft)
    const grand = workbook.summaryAddress('TOTAL')
    const fxCurrency = [...workbook.cells.entries()].find(([cellAddress, cell]) => /^A\d+$/.test(cellAddress) && cell.value === 'EUR')?.[0]
    const fxInput = fxCurrency?.replace('A', 'B')
    expect(fxInput).toBeTruthy()
    const changed = structuredClone(draft)
    const root = changed.majorItems[0] as QuotationItem
    root.quantity = 2.25
    root.markupRate = 25
    root.children[0]!.children[1]!.manualUnitPrice = 11.25
    root.children[0]!.children[0]!.unitCost = 21.005
    changed.exchangeRates.EUR = 1.2
    const expected = calculateQuotationTotals(changed.majorItems, changed.totalsConfig, changed.exchangeRates)
    expect(workbook.evaluate(grand, { C7: 2.25, P7: 0.25, Q10: 11.25, M9: 21.005, [fxInput!]: 1.2 })).toBe(expected.grandTotal)
    expectCommercialFigures(workbook, changed, { C7: 2.25, P7: 0.25, Q10: 11.25, M9: 21.005, [fxInput!]: 1.2 })
    root.children[0]!.children[0]!.costCurrency = 'USD'
    expect(workbook.evaluate(grand, { C7: 2.25, P7: 0.25, Q10: 11.25, M9: 21.005, L9: 'USD', [fxInput!]: 1.2 })).toBe(calculateQuotationTotals(changed.majorItems, changed.totalsConfig, changed.exchangeRates).grandTotal)
    expectCommercialFigures(workbook, changed, { C7: 2.25, P7: 0.25, Q10: 11.25, M9: 21.005, L9: 'USD', [fxInput!]: 1.2 })
  })

  it('allocates bucket tax once across roots and breaks equal cent remainders in quotation order', () => {
    const draft = quotation([item({ unitCost: 0.05, markupRate: 0 }), item({ unitCost: 0.05, markupRate: 0 })])
    const workbook = readWorkbook(draft)
    expectFormulasMatchCache(workbook)
    expect(workbook.evaluate('I7')).toBe(0.01)
    expect(workbook.evaluate('I8')).toBe(0)
    expect(workbook.evaluate(workbook.summaryAddress('Total tax'))).toBe(0.01)
    expect(workbook.evaluate('I7', { C8: 1.1 })).toBe(0)
    expect(workbook.evaluate('I8', { C8: 1.1 })).toBe(0.01)
  })

  it('keeps range totals scoped to direct children and distinct tax IDs with duplicate labels', () => {
    const draft = quotation([
      { id: 'equipment-section', kind: 'section_header', title: 'Equipment' },
      item({ quantity: 2, children: [
        item({ quantity: 3, children: [
          item({ quantity: 4, unitCost: 7, taxClassId: 'standard' }),
          item({ quantity: 2, unitCost: 5, taxClassId: 'reduced' }),
        ] }),
        item({ quantity: 1, unitCost: 11, taxClassId: 'reduced' }),
      ] }),
      ...Array.from({ length: 8 }, (_value, index) => item({ unitCost: index + 1 })),
      { id: 'services-section', kind: 'section_header', title: 'Services' },
      item({ quantity: 3, children: [item({ quantity: 2, unitCost: 19, taxClassId: 'reduced' })] }),
    ])
    draft.totalsConfig.taxClasses = [
      { id: 'standard', label: 'Shared label', rate: 10 },
      { id: 'reduced', label: 'Shared label', rate: 5 },
    ]
    for (const mode of ['customer', 'internal'] as const) {
      const workbook = readWorkbook(draft, mode)
      expectFormulasMatchCache(workbook)
      expectCommercialFigures(workbook, draft)
    }
  })

  it('preserves initial floating-point penny priorities and recalculates rounded ties after edits', () => {
    const draft = quotation([item({ unitCost: 0.03, markupRate: 0 }), item({ unitCost: 0.13, markupRate: 0 })])
    for (const mode of ['customer', 'internal'] as const) {
      const workbook = readWorkbook(draft, mode)
      expectFormulasMatchCache(workbook)
      expectCommercialFigures(workbook, draft)
      expect(workbook.evaluate('I7')).toBe(0)
      expect(workbook.evaluate('I8')).toBe(0.02)
      const changed = structuredClone(draft)
      ;(changed.majorItems[0] as QuotationItem).unitCost = 1.03
      const overrides = { [mode === 'internal' ? 'M7' : 'F7']: 1.03 }
      expectCommercialFigures(workbook, changed, overrides)
      expect(workbook.evaluate('I7', overrides)).toBe(0.11)
      expect(workbook.evaluate('I8', overrides)).toBe(0.01)
    }
  })

  it('recalculates edited tax rates for both shared and sole root contributions', () => {
    const draft = quotation([
      item({ unitCost: 0.05, markupRate: 0 }),
      item({ unitCost: 0.05, markupRate: 0 }),
      item({ unitCost: 0.15, markupRate: 0, taxClassId: 'reduced' }),
    ])
    for (const mode of ['customer', 'internal'] as const) {
      const workbook = readWorkbook(draft, mode)
      expectCommercialFigures(workbook, draft)
      const standardRate = workbook.summaryAddress('Tax · Standard').replace(/^K/, 'C')
      const reducedRate = workbook.summaryAddress('Tax · Reduced').replace(/^K/, 'C')
      const changed = structuredClone(draft)
      changed.totalsConfig.taxClasses![0]!.rate = 20
      changed.totalsConfig.taxClasses![1]!.rate = 25
      expectCommercialFigures(workbook, changed, { [standardRate]: 0.2, [reducedRate]: 0.25 })
      changed.totalsConfig.taxClasses![1]!.rate = 0
      expectCommercialFigures(workbook, changed, { [standardRate]: 0.2, [reducedRate]: 0 })
    }
  })

  it('keeps every commercial column in single and mixed tax modes regardless of PDF selections', () => {
    const draft = quotation([item({ quantity: 2.5, unitCost: 1.235, taxClassId: 'reduced' })])
    draft.totalsConfig.mixedTaxColumns = ['grossAmount']
    const headings = ['No.', 'Item', 'Qty', 'Unit', 'Tax rate', 'Unit price', 'Unit tax', 'Unit price incl. tax', 'Tax', 'Amount excl. tax', 'Amount incl. tax']
    for (const taxMode of ['single', 'mixed'] as const) {
      draft.totalsConfig.taxMode = taxMode
      for (const mode of ['customer', 'internal'] as const) {
        const workbook = readWorkbook(draft, mode)
        expect(headings.map((_heading, index) => workbook.cells.get(`${excelColumn(index + 1)}6`)?.value)).toEqual(headings)
        expect([...workbook.cells.keys()].filter(address => /^[A-Z]+6$/.test(address))).toHaveLength(mode === 'internal' ? 18 : 11)
        expectCommercialFigures(workbook, draft)
      }
    }
  })

  it('reconciles rounded mixed-tax bases for fractional group quantities', () => {
    const draft = quotation([item({ quantity: 0.5, markupRate: 0, children: [
      item({ unitCost: 0.01, taxClassId: 'standard' }),
      item({ unitCost: 0.01, taxClassId: 'reduced' }),
    ] })])
    for (const mode of ['customer', 'internal'] as const) {
      for (const detail of [1, 2, 3] as const) {
        draft.outputSettings = { itemDetailLevel: detail }
        const workbook = readWorkbook(draft, mode)
        expectFormulasMatchCache(workbook)
        expectCommercialFigures(workbook, draft)
        expect(workbook.evaluate(workbook.summaryAddress('Subtotal'))).toBe(0.01)
      }
    }
  })

  it('keeps customer files free of internal data, descriptions, notes and collapsed item names', () => {
    const draft = quotation([item({ name: 'Public skid', unitCost: 9876.54321, quantity: 2, children: [
      item({ name: 'PRIVATE CHILD NAME', description: 'LONG DESCRIPTION SECRET', notes: 'INTERNAL NOTE SECRET', unitCost: 1234.56789, costCurrency: 'EUR', markupRate: 37.654321, taxClassId: 'reduced' }),
      item({ name: 'SECOND PRIVATE CHILD', unitCost: 4321.98765, taxClassId: 'standard' }),
    ] })])
    draft.outputSettings = { itemDetailLevel: 1 }
    draft.totalsConfig.mixedTaxColumns = ['taxRate', 'grossAmount']
    const workbook = readWorkbook(draft, 'customer')
    const allXml = Object.values(workbook.files).map(content => strFromU8(content)).join('\n')
    for (const secret of ['PRIVATE CHILD', 'LONG DESCRIPTION SECRET', 'INTERNAL NOTE SECRET', '9876.54321', '1234.56789', '4321.98765', '37.654321', 'Cost currency', 'Manual unit price', 'Default markup', 'FX rate']) expect(allXml).not.toContain(secret)
    expect(workbook.cells.get('E6')?.value).toBe('Tax rate')
    expect(workbook.cells.get('F6')?.value).toBe('Unit price')
    expect(workbook.cells.get('I6')?.value).toBe('Tax')
    expect(workbook.cells.get('K6')?.value).toBe('Amount incl. tax')
    expect(workbook.cells.get('L6')).toBeUndefined()
    expectFormulasMatchCache(workbook)
    const changed = workbook.evaluate(workbook.summaryAddress('TOTAL'), { C7: 3 })
    const expectedDraft = structuredClone(draft)
    ;(expectedDraft.majorItems[0] as QuotationItem).quantity = 3
    expect(changed).toBe(calculateQuotationTotals(expectedDraft.majorItems, expectedDraft.totalsConfig, expectedDraft.exchangeRates).grandTotal)
  })

  it('handles zero quantities, section rows and both workbook locales without formula injection', () => {
    const draft = quotation([{ id: 'section', kind: 'section_header', title: 'Scope' }, item({ name: '=SUM(1,2) & <test>', quantity: 0, pricingMethod: 'manual_price', manualUnitPrice: 25 })])
    draft.totalsConfig.mixedTaxColumns = ['unitPriceWithTax', 'unitTax', 'grossAmount']
    for (const locale of ['en-US', 'zh-CN']) {
      const workbook = readWorkbook(draft, 'customer', locale)
      expectFormulasMatchCache(workbook)
      expect(workbook.cells.get('B8')).toEqual({ value: '=SUM(1,2) & <test>' })
      expect(workbook.cells.get('G8')?.value).toBe('')
      expect(workbook.cells.get('H8')?.value).toBe('')
      expect(workbook.xml).toContain('&amp; &lt;test&gt;')
      expect(workbook.xml).toContain(locale === 'zh-CN' ? '报价单' : 'QUOTATION')
    }
  })
  it('keeps tax-allocation formulas compact for more than one hundred root items', () => {
    const draft = quotation(Array.from({ length: 120 }, (_value, index) => item({ unitCost: (index + 1) / 100, quantity: 0.5 + index % 3, taxClassId: index % 2 ? 'standard' : 'reduced' })))
    const workbook = readWorkbook(draft)
    for (const cell of workbook.cells.values()) if (cell.formula) expect(cell.formula.length).toBeLessThan(8192)
    expect(workbook.evaluate(workbook.summaryAddress('TOTAL'))).toBe(calculateQuotationTotals(draft.majorItems, draft.totalsConfig, draft.exchangeRates).grandTotal)
    const changed = structuredClone(draft)
    ;(changed.majorItems[119] as QuotationItem).quantity = 7.25
    expect(workbook.evaluate(workbook.summaryAddress('TOTAL'), { C126: 7.25 })).toBe(calculateQuotationTotals(changed.majorItems, changed.totalsConfig, changed.exchangeRates).grandTotal)
    const allocated = Array.from({ length: 120 }, (_value, index) => Number(workbook.evaluate(`I${index + 7}`)))
    expect(roundMoney(allocated.reduce((total, value) => total + value, 0))).toBe(calculateQuotationTotals(draft.majorItems, draft.totalsConfig, draft.exchangeRates).taxAmount)
  })

  it('supports more than 404 roots and siblings within Excel formula limits and ignores informational selections', () => {
    expect(excelSumFormula(['A1', 'A2', 'A3', 'C2'])).toBe('SUM(A1:A3,C2)')
    expect(excelSumFormula(Array.from({ length: 405 }, (_value, index) => `A${index * 2 + 1}`))).toMatch(/^SUM\(SUM\(/)
    for (const siblings of [false, true]) {
      const items = Array.from({ length: 405 }, (_value, index) => item({ unitCost: (index + 1) / 100, quantity: 0.5 + index % 3, taxClassId: index % 2 ? 'standard' : 'reduced' }))
      const rootItems = siblings ? [item({ name: 'Large package', quantity: 1.25, children: items })] : items
      const draft = quotation([{ id: 'large-section', kind: 'section_header', title: 'Large scope' }, ...rootItems])
      draft.outputSettings = {
        itemDetailLevel: 3,
        showInformationalTotals: true,
        informationalTotals: [
          { id: 'all-items', label: 'Selected large scope', source: 'items', sectionIds: [], itemIds: items.map(entry => entry.id), visible: true },
          { id: 'section', label: 'Large section total', sectionIds: ['large-section'], visible: true },
        ],
      }
      for (const mode of ['customer', 'internal'] as const) {
        draft.totalsConfig.mixedTaxColumns = ['grossAmount']
        const workbook = readWorkbook(draft, mode)
        expectExcelFormulaLimits(workbook)
        const expected = calculateQuotationTotals(draft.majorItems, draft.totalsConfig, draft.exchangeRates)
        expect(workbook.evaluate(workbook.summaryAddress('TOTAL'))).toBe(expected.grandTotal)
        expect(workbook.xml).not.toContain('Selected large scope')
        expect(workbook.xml).not.toContain('Large section total')
      }
    }
  })

  it('omits informational breakdown even when enabled, selected, hidden or invalid', () => {
    const leaf = item({ name: 'Private selected valve', quantity: 1.5, unitCost: 0.013, markupRate: 0 })
    const group = item({ name: 'Assembly', quantity: 0.5, children: [leaf, item({ unitCost: 0.027, quantity: 1.75, markupRate: 0 })] })
    const root = item({ name: 'Public package', quantity: 1.5, children: [group, item({ unitCost: 0.023, markupRate: 0 })] })
    const draft = quotation([{ id: 'supply', kind: 'section_header', title: 'Supply' }, root])
    draft.outputSettings = {
      itemDetailLevel: 3,
      showInformationalTotals: true,
      informationalTotals: [
        { id: 'sections', label: 'Supply total', sectionIds: ['supply'], visible: true },
        { id: 'valve', label: 'Selected equipment', sectionIds: [], source: 'items', itemIds: [leaf.id], visible: true },
        { id: 'dedup', label: 'Selected package', sectionIds: [], source: 'items', itemIds: [root.id, leaf.id], visible: true },
        { id: 'hidden', label: 'DO NOT EXPORT HIDDEN TOTAL', sectionIds: ['supply'], visible: false },
        { id: 'missing', label: 'Invalid selection', source: 'items', sectionIds: [], itemIds: ['missing-item'], visible: true },
        { id: 'missing-section', label: 'Invalid section', sectionIds: ['missing-section'], visible: true },
      ],
    }
    for (const mode of ['customer', 'internal'] as const) {
      for (const detail of [1, 2, 3] as const) {
        draft.outputSettings.itemDetailLevel = detail
        const workbook = readWorkbook(draft, mode)
        expectFormulasMatchCache(workbook)
        expectCommercialFigures(workbook, draft)
        for (const total of draft.outputSettings.informationalTotals!) expect(workbook.xml).not.toContain(total.label)
        expect(workbook.xml).not.toContain('Breakdown')
        if (mode === 'customer' && detail < 3) expect(workbook.xml).not.toContain('Private selected valve')
      }
    }
    draft.outputSettings.showInformationalTotals = false
    expect(readWorkbook(draft).xml).not.toContain('Selected equipment')
  })

  it('recalculates a collapsed single-tax group from zero without duplicate tax-basis helpers', () => {
    const selected = item({ name: 'Private selected child', unitCost: 4, markupRate: 0 })
    const root = item({ name: 'Public package', quantity: 0, markupRate: 0, children: [selected, item({ unitCost: 6, markupRate: 0 })] })
    const draft = quotation([root])
    draft.outputSettings = {
      itemDetailLevel: 1,
      showInformationalTotals: true,
      informationalTotals: [{ id: 'selected', label: 'Selected equipment', source: 'items', sectionIds: [], itemIds: [selected.id], visible: true }],
    }
    const workbook = readWorkbook(draft, 'customer')
    expectFormulasMatchCache(workbook)
    expectCommercialFigures(workbook, draft)
    const changed = structuredClone(draft)
    ;(changed.majorItems[0] as QuotationItem).quantity = 1
    expectCommercialFigures(workbook, changed, { C7: 1 })
    const helper = [...workbook.cells.entries()].find(([address, cell]) => /^F\d+$/.test(address) && cell.formula === 'J7')?.[0].slice(1)
    expect(helper).toBeTruthy()
    for (const column of ['D', 'E', 'H', 'I', 'J', 'K', 'L', 'M']) expect(workbook.cells.has(`${column}${helper}`)).toBe(false)
    expect(workbook.cells.get(`G${helper}`)?.formula).toBe(workbook.summaryAddress('Tax · Standard'))
    expect(workbook.xml).not.toContain('Selected equipment')
    expect(workbook.xml).not.toContain('Private selected child')
  })

  it('keeps legacy compatibility helpers bounded in a 400-row single-tax workbook', () => {
    const draft = quotation(Array.from({ length: 400 }, (_value, index) => item({ unitCost: (index + 1) / 100, markupRate: 0 })))
    const workbook = readWorkbook(draft, 'customer')
    const hiddenRows = new Set([...workbook.xml.matchAll(/<row r="(\d+)"[^>]*hidden="1"/g)].map(match => match[1]))
    const hiddenCells = [...workbook.cells.entries()].filter(([address]) => hiddenRows.has(address.replace(/\D/g, '')))
    expect(hiddenRows.size).toBe(405)
    expect(hiddenCells).toHaveLength(4024)
    expect(hiddenCells.filter(([, cell]) => cell.formula)).toHaveLength(2002)
    expect(hiddenCells.filter(([, cell]) => cell.formula?.includes('SUMIF('))).toHaveLength(1)
    expect(hiddenCells.filter(([, cell]) => cell.formula?.includes('<>'))).toHaveLength(1)
    expect(hiddenCells.filter(([address]) => address.startsWith('M'))).toHaveLength(0)
    expectExcelFormulaLimits(workbook)
    expectCommercialFigures(workbook, draft)
    const changed = structuredClone(draft)
    ;(changed.majorItems[399] as QuotationItem).quantity = 2.75
    expectCommercialFigures(workbook, changed, { C406: 2.75 })
  })

  it('removes original-value helpers from a 400-row exact-allocation workbook', () => {
    const draft = quotation(Array.from({ length: 400 }, (_value, index) => item({ unitCost: (index + 1) / 100, markupRate: 0 })))
    draft.totalsConfig.taxAllocationVersion = 2
    const workbook = readWorkbook(draft, 'customer')
    const hiddenRows = new Set([...workbook.xml.matchAll(/<row r="(\d+)"[^>]*hidden="1"/g)].map(match => match[1]))
    const hiddenCells = [...workbook.cells.entries()].filter(([address]) => hiddenRows.has(address.replace(/\D/g, '')))
    expect(hiddenCells).toHaveLength(3224)
    expect(hiddenCells.filter(([address]) => /^[K-M]/.test(address))).toHaveLength(0)
    expectExcelFormulaLimits(workbook)
    expectCommercialFigures(workbook, draft)
  })

  it.each(['customer', 'internal'] as const)('allocates tied cents deterministically in %s workbooks without original-value helpers', mode => {
    const draft = quotation([item({ unitCost: 0.03, markupRate: 0 }), item({ unitCost: 0.13, markupRate: 0 })])
    const legacy = readWorkbook(draft, mode)
    expectFormulasMatchCache(legacy)
    expect(legacy.evaluate('I7')).toBe(0)
    expect(legacy.evaluate('I8')).toBe(0.02)
    draft.totalsConfig.taxAllocationVersion = 2
    const workbook = readWorkbook(draft, mode)
    expectFormulasMatchCache(workbook)
    expectCommercialFigures(workbook, draft)
    expect(workbook.evaluate('I7')).toBe(0.01)
    expect(workbook.evaluate('I8')).toBe(0.01)
    expect(workbook.evaluate(workbook.summaryAddress('TOTAL'))).toBe(legacy.evaluate(legacy.summaryAddress('TOTAL')))
    expect(workbook.xml).not.toContain('Original taxable amount')
    expect(workbook.xml).not.toContain('Original rounding priority')
    const changed = structuredClone(draft)
    ;(changed.majorItems[0] as QuotationItem).quantity = 3
    expectCommercialFigures(workbook, changed, { C7: 3 })
  })

  it.each([0, 0.07, 5, 10, 13.37, 12.3456, 0.0000001, 100])('matches app formulas for %s percent tax after edits', rate => {
    const draft = quotation([item({ unitCost: 17.21, markupRate: 0 }), item({ unitCost: 0.13, markupRate: 0 }), item({ unitCost: 29.87, markupRate: 0 })])
    draft.totalsConfig.taxAllocationVersion = 2
    draft.totalsConfig.taxClasses![0]!.rate = rate
    for (const mode of ['customer', 'internal'] as const) {
      const workbook = readWorkbook(draft, mode)
      expectFormulasMatchCache(workbook)
      expectCommercialFigures(workbook, draft)
      const changed = structuredClone(draft)
      ;(changed.majorItems[1] as QuotationItem).quantity = 2.75
      expectCommercialFigures(workbook, changed, { C8: 2.75 })
      changed.totalsConfig.taxClasses![0]!.rate = 13.37
      const rateRow = workbook.summaryAddress('Tax · Standard').slice(1)
      expectCommercialFigures(workbook, changed, { C8: 2.75, [`C${rateRow}`]: 1337 / 10000 })
    }
  })

  it('reconciles mixed nested packages and zero quantities under the exact policy', () => {
    const draft = quotation(Array.from({ length: 4 }, (_value, index) => item({
      quantity: index / 2,
      children: [item({ unitCost: 0.03, markupRate: 0 }), item({ unitCost: 19.97, taxClassId: 'reduced', markupRate: 0 })],
    })))
    draft.totalsConfig.taxAllocationVersion = 2
    for (const mode of ['customer', 'internal'] as const) {
      const workbook = readWorkbook(draft, mode)
      expectFormulasMatchCache(workbook)
      expectCommercialFigures(workbook, draft)
      const changed = structuredClone(draft)
      ;(changed.majorItems[0] as QuotationItem).quantity = 2.75
      expectCommercialFigures(workbook, changed, { C7: 2.75 })
    }
  })

  it.each(['customer', 'internal'] as const)('rounds class and descendant half-cent taxes exactly in %s workbooks', mode => {
    const draft = quotation([item({ quantity: 1, children: [item({ unitCost: 31372950, markupRate: 0 })] })])
    draft.totalsConfig.taxClasses![0]!.rate = 13.37
    expect(calculateQuotationTotals(draft.majorItems, draft.totalsConfig, draft.exchangeRates).taxAmount).toBe(4194563.41)
    draft.totalsConfig.taxAllocationVersion = 2
    const workbook = readWorkbook(draft, mode)
    expectFormulasMatchCache(workbook)
    expectCommercialFigures(workbook, draft)
    expect(workbook.evaluate(workbook.summaryAddress('Total tax'))).toBe(4194563.42)
    expect(workbook.evaluate('I7')).toBe(4194563.42)
    expect(workbook.evaluate('I8')).toBe(4194563.42)
  })

  it.each([1, 2] as const)('labels every occupied helper column for policy %s in both languages', taxAllocationVersion => {
    const draft = quotation([item({ unitCost: 0.03 }), item({ unitCost: 0.13 })])
    draft.totalsConfig.taxAllocationVersion = taxAllocationVersion
    for (const locale of ['en-US', 'zh-CN']) {
      const workbook = readWorkbook(draft, 'customer', locale)
      const labels = getQuotationExcelWorkbookLabels(locale)
      const allocationHeader = [...workbook.cells.entries()].find(([address, cell]) => address.startsWith('J') && cell.value === (taxAllocationVersion === 2 ? labels.integerRemainder : labels.remainder))![0].slice(1)
      const classHeader = [...workbook.cells.entries()].find(([address, cell]) => address.startsWith('E') && cell.value === labels.remainingCents)![0].slice(1)
      for (const [address, cell] of workbook.cells) {
        const row = Number(address.replace(/\D/g, ''))
        if (row <= Number(allocationHeader) || typeof cell.value !== 'number') continue
        const heading = `${address.replace(/\d/g, '')}${row > Number(classHeader) ? classHeader : allocationHeader}`
        expect(typeof workbook.cells.get(heading)?.value, heading).toBe('string')
      }
      expect(workbook.cells.get(`L${allocationHeader}`)?.value).toBe(taxAllocationVersion === 1 ? labels.originalPriority : undefined)
    }
  })

  it('fails clearly when edits exceed exact rate or aggregate precision', () => {
    const draft = quotation([item({ unitCost: 1, markupRate: 0 }), item({ unitCost: 1, markupRate: 0 })])
    draft.totalsConfig.taxAllocationVersion = 2
    const workbook = readWorkbook(draft, 'customer')
    const tax = workbook.summaryAddress('Tax · Standard')
    expect(() => workbook.evaluate(tax, { [`C${tax.slice(1)}`]: 0.133700001 })).toThrow('Invalid formula result')
    expect(() => workbook.evaluate(tax, { F7: 6000000000000, F8: 6000000000000 })).toThrow('Invalid formula result')
  })
})
