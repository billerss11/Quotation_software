import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { getQuotationExcelWorkbookLabels } from '../../../shared/i18n/quotationExcelWorkbook'
import type { QuotationDraft, QuotationItem } from '../types'
import {
  calculateQuotationItemSellingAmount,
  calculateQuotationItemTaxBuckets,
  calculateQuotationItemUnitSellingPrice,
  calculateQuotationRootTaxBucketAllocations,
  calculateQuotationTotals,
  getEffectiveMarkupRate,
} from './quotationCalculations'
import { createInitialQuotation, normalizeQuotationDraft } from './quotationDraft'
import { createQuotationExcelWorkbook, type QuotationExcelExportMode } from './quotationExcelExport'
import { createQuotationItem } from './quotationItems'
import { roundMoney } from './moneyMath'

interface Cell {
  value: string | number
  formula?: string
  style: number
}

function decode(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function readPackage(draft: QuotationDraft, mode: QuotationExcelExportMode, locale = 'en-US') {
  const files = Object.fromEntries(Object.entries(unzipSync(createQuotationExcelWorkbook(draft, mode, locale))).map(([path, bytes]) => [path, strFromU8(bytes)]))
  const styles = [...files['xl/styles.xml']!.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)![1]!.matchAll(/<xf\b[^>]*>([\s\S]*?)<\/xf>/g)]
    .map(match => !match[1]!.includes('locked="0"'))
  const sheets = [...files['xl/workbook.xml']!.matchAll(/<sheet\b([^>]*)\/>/g)].map((match, index) => {
    const xml = files[`xl/worksheets/sheet${index + 1}.xml`]!
    const cells = new Map<string, Cell>()
    for (const cell of xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const text = cell[2]!.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1]
      const cached = cell[2]!.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      const formula = cell[2]!.match(/<f>([\s\S]*?)<\/f>/)?.[1]
      cells.set(cell[1]!.match(/\br="([^"]+)"/)![1]!, {
        value: text !== undefined ? decode(text) : /\bt="(?:str|e)"/.test(cell[1]!) ? decode(cached ?? '') : Number(cached),
        style: Number(cell[1]!.match(/\bs="(\d+)"/)?.[1] ?? 0),
        ...(formula === undefined ? {} : { formula: decode(formula) }),
      })
    }
    return {
      name: decode(match[1]!.match(/\bname="([^"]+)"/)![1]!),
      hidden: match[1]!.includes('state="veryHidden"'),
      cells,
      xml,
      locked: (address: string) => styles[cells.get(address)?.style ?? 0],
    }
  })
  return { files, sheets, allXml: Object.values(files).join('\n') }
}

function fixture(version: 1 | 2 = 2) {
  const draft = createInitialQuotation([], 'en-US')
  draft.header.currency = 'USD'
  draft.header.customerCompany = 'Public customer'
  draft.header.notes = 'Public quotation note'
  draft.header.terms = 'Public payment terms'
  draft.exchangeRates = { USD: 1, EUR: 1.085 }
  draft.totalsConfig = {
    globalMarkupRate: 10,
    taxAllocationVersion: version,
    taxMode: 'mixed',
    taxClasses: [{ id: 'standard', label: 'Standard', rate: 13.37 }, { id: 'reduced', label: 'Reduced', rate: 5 }],
    defaultTaxClassId: 'standard',
    extraCharges: [{ id: 'freight', label: 'Freight', amount: 1.005 }, { id: 'packing', label: 'Packing', amount: 2.005 }],
  }
  draft.majorItems = [
    { id: 'supply', kind: 'section_header', title: 'Supply scope' },
    createQuotationItem('USD', {
      name: 'Public package', description: 'Public package description', quantity: 1.5, markupRate: 18,
      children: [createQuotationItem('USD', {
        name: 'Public assembly', description: 'Public assembly description', quantity: 2.5,
        children: [
          createQuotationItem('EUR', { name: 'Public motor', description: 'Public motor description', quantity: 3, unitCost: 1234.567891, markupRate: 37.654321, notes: 'INTERNAL_LEAF_NOTE' }),
          createQuotationItem('USD', { name: 'Public service', description: 'Public service description', quantity: 2, unitCost: 0, pricingMethod: 'manual_price', manualUnitPrice: 8.555, taxClassId: 'reduced' }),
        ],
      })],
    }),
    createQuotationItem('USD', { name: 'Zero quantity', quantity: 0, unitCost: 4321.987654, pricingMethod: 'manual_price', manualUnitPrice: 25 }),
    createQuotationItem('USD', { name: 'Small valve', quantity: 2.75, unitCost: 0.013, markupRate: 0 }),
  ]
  return draft
}

function summaryCell(sheet: ReturnType<typeof readPackage>['sheets'][number], label: string, column: string) {
  const row = [...sheet.cells].find(([address, cell]) => /^B\d+$/.test(address) && cell.value === label)?.[0].slice(1)
  expect(row, `Missing summary: ${label}`).toBeDefined()
  return sheet.cells.get(`${column}${row}`)!
}

function expectCachedCommercialFigures(draft: QuotationDraft, locale: string) {
  const workbook = readPackage(draft, 'internal', locale)
  const labels = getQuotationExcelWorkbookLabels(locale)
  const main = workbook.sheets[0]!
  const calculations = workbook.sheets.at(-1)!
  const roots = draft.majorItems.filter((item): item is QuotationItem => !('kind' in item))
  const totals = calculateQuotationTotals(draft.majorItems, draft.totalsConfig, draft.exchangeRates)
  const allocations = calculateQuotationRootTaxBucketAllocations(draft.majorItems, draft.totalsConfig, draft.exchangeRates)
  const expected = new Map<string, { item: QuotationItem; inheritedMarkup?: number; inheritedTax?: string }>()
  function visit(item: QuotationItem, number: string, inheritedMarkup?: number, inheritedTax?: string) {
    expected.set(number, { item, inheritedMarkup, inheritedTax })
    item.children.forEach((child, index) => visit(child, `${number}.${index + 1}`,
      getEffectiveMarkupRate(item.markupRate, inheritedMarkup ?? draft.totalsConfig.globalMarkupRate), item.taxClassId ?? inheritedTax))
  }
  roots.forEach((item, index) => visit(item, String(index + 1)))
  const checked = new Set<string>()
  for (const [address, cell] of calculations.cells) {
    if (!/^A\d+$/.test(address) || typeof cell.value !== 'string' || !expected.has(cell.value)) continue
    const row = Number(address.slice(1))
    // Allocation helper rows repeat the item number but are below the commercial grid.
    if (calculations.cells.get(`B${row}`)?.value !== expected.get(cell.value)!.item.name) continue
    checked.add(cell.value)
    const { item, inheritedMarkup, inheritedTax } = expected.get(cell.value)!
    const net = calculateQuotationItemSellingAmount(item, draft.totalsConfig.globalMarkupRate, draft.exchangeRates, inheritedMarkup)
    const taxBuckets = cell.value.includes('.')
      ? calculateQuotationItemTaxBuckets(item, draft.totalsConfig, draft.exchangeRates, { inheritedMarkupRate: inheritedMarkup, inheritedTaxClassId: inheritedTax })
      : allocations.get(item.id)!
    const tax = roundMoney(taxBuckets.reduce((sum, bucket) => sum + bucket.taxAmount, 0))
    expect(calculations.cells.get(`F${row}`)?.value).toBe(calculateQuotationItemUnitSellingPrice(item, draft.totalsConfig.globalMarkupRate, draft.exchangeRates, inheritedMarkup))
    expect(calculations.cells.get(`I${row}`)?.value).toBe(tax)
    expect(calculations.cells.get(`J${row}`)?.value).toBe(net)
    expect(calculations.cells.get(`K${row}`)?.value).toBe(roundMoney(net + tax))
  }
  expect(checked.size).toBe(expected.size)
  const amountColumn = 'H'
  roots.forEach((item, index) => {
    const row = 9 + index
    expect(main.cells.get(`C${row}`)?.value).toBe(item.quantity)
    expect(main.cells.get(`${amountColumn}${row}`)?.value).toBe(calculateQuotationItemSellingAmount(item, draft.totalsConfig.globalMarkupRate, draft.exchangeRates))
  })
  expect(main.cells.get('C6')?.value).toBe(totals.grandTotal)
  expect(main.cells.get('F6')?.value).toBe(totals.grandTotal)
  expect(main.cells.get('H6')?.value).toBe(0)
  expect(summaryCell(main, labels.subtotal, amountColumn).value).toBe(totals.subtotalAfterMarkup)
  expect(summaryCell(main, labels.totalTax, amountColumn).value).toBe(totals.taxAmount)
  expect(summaryCell(main, labels.grandTotal, amountColumn).value).toBe(totals.grandTotal)
  for (const bucket of totals.taxBuckets) expect(summaryCell(main, `${bucket.label} (${bucket.rate}%)`, amountColumn).value).toBe(bucket.taxAmount)
  expect(summaryCell(main, labels.baseCost, amountColumn).value).toBe(totals.baseSubtotal)
}

function expectFormulaLimits(workbook: ReturnType<typeof readPackage>) {
  const invalid: string[] = []
  let longest = { address: '', length: 0 }
  let mostArguments = { address: '', count: 0 }
  for (const sheet of workbook.sheets) {
    for (const [address, cell] of sheet.cells) {
      const location = `${sheet.name}!${address}`
      if (typeof cell.value === 'number' && !Number.isFinite(cell.value)) invalid.push(location)
      if (!cell.formula) continue
      if (cell.formula.length > longest.length) longest = { address: location, length: cell.formula.length }
      if (/#REF!|undefined|NaN|Infinity/.test(cell.formula)) invalid.push(location)
      const expression = cell.formula.replace(/"(?:[^"]|"")*"/g, '""')
      const calls: number[] = []
      for (const character of expression) {
        if (character === '(') calls.push(1)
        else if (character === ',') calls[calls.length - 1]! += 1
        else if (character === ')') {
          const count = calls.pop() ?? 0
          if (count > mostArguments.count) mostArguments = { address: location, count }
        }
      }
    }
    for (const match of sheet.xml.matchAll(/\b(?:ref|sqref)="([^"]+)"/g)) {
      for (const reference of match[1]!.split(/[ :]/)) {
        const cell = reference.match(/^([A-Z]+)(\d+)$/)
        if (!cell || Number(cell[2]) < 1 || Number(cell[2]) > 1_048_576) {
          invalid.push(`${sheet.name}: ${reference}`)
          continue
        }
        const column = [...cell[1]!].reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 64, 0)
        if (column > 16_384) invalid.push(`${sheet.name}: ${reference}`)
      }
    }
  }
  expect(invalid).toEqual([])
  expect(longest.length, longest.address).toBeLessThanOrEqual(8192)
  expect(mostArguments.count, mostArguments.address).toBeLessThanOrEqual(255)
}

describe('quotation Excel workbook redesign', () => {
  it.each(['en-US', 'zh-CN'])('packages the internal sheets with protected originals in %s', locale => {
    const labels = getQuotationExcelWorkbookLabels(locale)
    const workbook = readPackage(fixture(), 'internal', locale)
    expect(workbook.sheets.map(sheet => sheet.name)).toEqual([labels.pricingSheet, labels.costsSheet, labels.calculationSheet])
    expect(workbook.sheets.at(-1)!.hidden).toBe(true)
    expect(workbook.files['xl/workbook.xml']).toContain('fullCalcOnLoad="1"')
    const main = workbook.sheets[0]!
    expect(main.xml).toContain('<autoFilter ref="A8:')
    expect(main.xml).toContain('<sheetProtection')
    for (const address of ['A9', 'B9', 'C9', 'C6']) {
      expect(main.locked(address), address).toBe(true)
      expect(main.cells.get(address)?.formula).toBeUndefined()
    }
    for (const address of ['D9', 'G9']) {
      expect(main.cells.get(address)?.value).toBe('')
      expect(main.locked(address), address).toBe(false)
    }
    expect(main.locked('H9')).toBe(true)
    const costs = workbook.sheets[1]!
    expect(costs.locked('F3')).toBe(true)
    expect(costs.locked('F9')).toBe(true)
    expect(costs.cells.get('F9')?.formula).toBeUndefined()
    expect(costs.cells.get('G9')?.value).toBe('')
    expect(costs.locked('G9')).toBe(false)
    for (const [address] of workbook.sheets.at(-1)!.cells) expect(workbook.sheets.at(-1)!.locked(address)).toBe(true)
  })

  it.each([1, 2] as const)('retains app commercial and tax figures in every cached line for policy %s', version => {
    for (const locale of ['en-US', 'zh-CN']) expectCachedCommercialFigures(fixture(version), locale)
  })

  it.each([
    { reason: 'missing FX', currency: 'INR', unitCost: 50 },
    { reason: 'a cost that rounds to zero', currency: 'USD', unitCost: 0.004 },
  ])('requests manual cost review for $reason without changing the fixed price', ({ currency, unitCost }) => {
    const draft = fixture()
    draft.exchangeRates = { USD: 1 }
    const item = createQuotationItem(currency, {
      name: 'Manual service', quantity: 1, unitCost, pricingMethod: 'manual_price', manualUnitPrice: 100,
    })
    draft.majorItems = [item]
    normalizeQuotationDraft(draft)
    const labels = getQuotationExcelWorkbookLabels('en-US')
    const workbook = readPackage(draft, 'internal')
    const main = workbook.sheets[0]!
    const calculations = workbook.sheets.at(-1)!
    expect(calculations.cells.get('R7')?.value).toBe(0)
    expect(calculations.cells.get('U7')).toMatchObject({ value: 1, formula: 'IF(R7<=0,1,0)' })
    expect(main.cells.get('H9')?.value).toBe(100)
    expect(main.cells.get('I9')?.value).toBe('')
    expect(main.cells.get('J9')?.value).toBe(labels.costReview)

    draft.exchangeRates[currency] = 1
    const resolvedItem = draft.majorItems[0] as QuotationItem
    resolvedItem.unitCost = 50
    const resolved = readPackage(draft, 'internal').sheets[0]!
    expect(resolved.cells.get('H9')?.value).toBe(100)
    expect(resolved.cells.get('I9')?.value).toBe(0.5)
    expect(resolved.cells.get('J9')?.value).toBe(labels.fixedPrice)
  })

  it('validates override bounds and exposes invalid-input and changed-input formatting', () => {
    const workbook = readPackage(fixture(), 'internal')
    const main = workbook.sheets[0]!
    const costs = workbook.sheets[1]!
    for (const sheet of [main, costs]) {
      const validations = [...sheet.xml.matchAll(/<dataValidation\b([^>]*)><formula1>([\s\S]*?)<\/formula1><\/dataValidation>/g)]
      expect(validations.length).toBeGreaterThan(0)
      for (const validation of validations) {
        expect(validation[1]).toContain('errorStyle="stop"')
        expect(validation[1]).toContain('showErrorMessage="1"')
        expect(decode(validation[2]!)).toContain('ISNUMBER(')
        expect(decode(validation[2]!)).toContain('=""')
        expect(decode(validation[2]!)).toMatch(/(?:>=|>)0/)
      }
      expect(sheet.xml).toContain('dxfId="0"')
      expect(sheet.xml).toContain('dxfId="1"')
    }
    expect(decode(main.xml)).toContain('D9>=0')
    expect(decode(costs.xml)).toContain('G3<=10')
    const fx = [...costs.cells].filter(([address, cell]) => /^E\d+$/.test(address) && cell.value === 'EUR').at(-1)![0].slice(1)
    expect(decode(costs.xml)).toContain(`G${fx}>0`)
    const calculations = workbook.sheets.at(-1)!
    const quantity = calculations.cells.get('C8')?.formula ?? calculations.cells.get('C7')?.formula
    expect(quantity).toContain('NA()')
    expect(calculations.cells.get('P3')?.formula).toContain('<=10')
    expect(calculations.cells.get('P3')?.formula).toContain('NA()')
  })

  it('uses item-number lookups for root edits, cost edits and displayed results', () => {
    const workbook = readPackage(fixture(), 'internal')
    const main = workbook.sheets[0]!
    const costs = workbook.sheets[1]!
    const calculations = workbook.sheets.at(-1)!
    let rootsChecked = 0
    let costsChecked = 0
    for (const [address, cell] of calculations.cells) {
      if (!/^A\d+$/.test(address) || typeof cell.value !== 'string' || !/^\d+(?:\.\d+)*$/.test(cell.value)) continue
      const row = address.slice(1)
      const quantity = calculations.cells.get(`C${row}`)
      if (cell.value === '1' && quantity?.formula?.includes('Pricing')) {
        rootsChecked++
        expect(quantity.formula).toContain('MATCH("1",')
        expect(quantity.formula).toContain("'Pricing'!$A$9:$A$11")
      }
      const cost = calculations.cells.get(`M${row}`)
      if (cost?.formula?.includes('Costs')) {
        costsChecked++
        expect(cost.formula).toContain(`MATCH("${cell.value}",`)
        expect(cost.formula).toContain("'Costs'!$A$9:")
      }
    }
    expect(rootsChecked).toBe(1)
    expect(costsChecked).toBe(4)
    expect(main.cells.get('H9')?.formula).toContain('MATCH(A9,')
    expect(costs.cells.get('H9')?.formula).toContain('MATCH(A9,')
  })

  it('guards a newly priced mixed-tax package when its original tax proportions are all zero', () => {
    const draft = fixture()
    draft.majorItems = [createQuotationItem('USD', { name: 'Unpriced package', children: [
      createQuotationItem('USD', { name: 'Unpriced standard', unitCost: 0, taxClassId: 'standard' }),
      createQuotationItem('USD', { name: 'Unpriced reduced', unitCost: 0, taxClassId: 'reduced' }),
    ] })]
    const workbook = readPackage(draft, 'internal')
    const calculations = workbook.sheets.at(-1)!
    const guarded = [...calculations.cells].filter(([address, cell]) => /^E\d+$/.test(address) && cell.formula?.includes('NA()'))
    expect(guarded).toHaveLength(2)
    for (const [, cell] of guarded) {
      expect(cell.value).toBe(0)
      expect(cell.formula).toContain('IF(J7=0,0,NA())')
    }
    expect(workbook.sheets[0]!.cells.get('F6')?.formula).toContain('IFERROR(')
  })

  it.each(['roots', 'manual package'] as const)('keeps all worksheet formulas and ranges valid for 1600 %s', kind => {
    const draft = fixture()
    draft.totalsConfig.extraCharges = []
    const items = Array.from({ length: 1600 }, (_value, index) => createQuotationItem('USD', {
      name: `Line ${index + 1}`, quantity: 1.5, unitCost: 1.25,
      ...(kind === 'manual package' ? { pricingMethod: 'manual_price' as const, manualUnitPrice: 2 } : {}),
    }))
    draft.majorItems = kind === 'roots' ? items : [createQuotationItem('USD', { name: 'Large package', children: items })]
    expectFormulaLimits(readPackage(draft, 'internal'))
  })
})
