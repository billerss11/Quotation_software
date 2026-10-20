import fs from 'node:fs/promises'
import path from 'node:path'
import { strFromU8, unzipSync } from 'fflate'
import { createServer } from 'vite'

function decodeXml(value) {
  return value.replace(/&(?:amp|lt|gt|quot|apos);/g, entity => ({
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  })[entity])
}

// The app's XLSX writer uses inline strings and numeric values. Read the emitted
// addresses so adding customer metadata does not make native checks row-dependent.
function readCustomerSnapshot(bytes) {
  const files = unzipSync(bytes)
  const sheetPaths = Object.keys(files).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
  if (sheetPaths.length !== 1) throw new Error('Customer export must contain one worksheet.')
  const xml = strFromU8(files[sheetPaths[0]])
  if (/<f(?:\s|>)/.test(xml)) throw new Error('Customer export must contain values without formulas.')
  if (/<sheetProtection\b/.test(xml)) throw new Error('Customer export must be unprotected.')
  const workbook = strFromU8(files['xl/workbook.xml'])
  const sheet = decodeXml(workbook.match(/<sheet\b[^>]*\bname="([^"]+)"/)?.[1] ?? '')
  if (!sheet) throw new Error('Customer export worksheet name is missing.')
  const cells = [...xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map(([, attributes, content]) => {
    const cell = attributes.match(/\br="([^"]+)"/)?.[1]
    const type = attributes.match(/\bt="([^"]+)"/)?.[1]
    const value = type === 'inlineStr'
      ? [...content.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(([, text]) => decodeXml(text)).join('')
      : type === 'str' ? decodeXml(content.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '')
        : Number(content.match(/<v>([^<]*)<\/v>/)?.[1])
    if (!cell || (typeof value === 'number' && !Number.isFinite(value))) {
      throw new Error(`Customer export has an unsupported value at ${cell ?? 'unknown cell'}.`)
    }
    return { sheet, cell, value }
  })
  return { sheet, cells }
}

// Synthetic fixtures only. No quotation files or app storage are read or changed.
const directory = path.resolve(process.argv[2] ?? 'output/qa/excel-redesign')
await fs.mkdir(directory, { recursive: true })
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createInitialQuotation } = await server.ssrLoadModule('/src/features/quotations/utils/quotationDraft.ts')
  const { createQuotationItem } = await server.ssrLoadModule('/src/features/quotations/utils/quotationItems.ts')
  const { createQuotationExcelWorkbook } = await server.ssrLoadModule('/src/features/quotations/utils/quotationExcelExport.ts')
  const { calculateQuotationTotals } = await server.ssrLoadModule('/src/features/quotations/utils/quotationCalculations.ts')
  const { messages } = await server.ssrLoadModule('/src/shared/i18n/messages.ts')
  const item = (name, cost, taxClassId, more = {}) => createQuotationItem('USD', {
    name, unitCost: cost, quantity: 1, taxClassId, description: `${name} specification`, ...more,
  })
  const quote = createInitialQuotation([], 'en-US')
  Object.assign(quote.header, { quotationNumber: 'EXCEL-VERIFY', customerCompany: 'Example Customer', projectName: 'Pricing verification', terms: 'Delivery within 30 days.' })
  quote.exchangeRates = { USD: 1, EUR: 1, CNY: 0.14 }
  quote.totalsConfig = { globalMarkupRate: 0, taxAllocationVersion: 2, taxMode: 'mixed',
    taxClasses: [{ id: 'standard', label: 'Standard', rate: 10 }, { id: 'reduced', label: 'Reduced', rate: 5 }],
    defaultTaxClassId: 'standard', extraCharges: [] }
  quote.majorItems = [
    item('Z', 10, 'standard'),
    item('A', 20, 'reduced', { costCurrency: 'EUR', pricingMethod: 'manual_price', manualUnitPrice: 20 }),
    item('M', 30, 'standard'),
  ]
  const manifest = { workbooks: [] }
  const assertion = (sheet, cell, value, error = false) => ({ sheet, cell, value, ...(error ? { error: true } : {}) })
  const edit = (sheet, cell, value, paste = false) => ({ sheet, cell, value, ...(paste ? { paste: true } : {}) })
  async function add(file, draft, mode, scenarios = []) {
    await fs.writeFile(path.join(directory, file), createQuotationExcelWorkbook(draft, mode))
    const sheet = mode === 'customer' ? 'Quotation' : 'Pricing'
    const priceCol = mode === 'customer' ? 'F' : 'G'
    const amountCol = mode === 'customer' ? 'G' : 'H'
    const baseline = calculateQuotationTotals(draft.majorItems, draft.totalsConfig, draft.exchangeRates).grandTotal
    const definition = { file, baseline: [assertion(sheet, 'C6', baseline), assertion(sheet, 'F6', baseline), assertion(sheet, 'H6', 0)],
      locked: [{ sheet, cell: 'B9' }, { sheet, cell: `${amountCol}9` }, { sheet, cell: 'C6' }],
      unlocked: [{ sheet, cell: 'D9' }, { sheet, cell: `${priceCol}9` }], scenarios }
    if (mode === 'internal') {
      definition.locked.push({ sheet: 'Costs', cell: 'F9' }, { sheet: 'Costs', cell: 'H9' })
      definition.unlocked.push({ sheet: 'Costs', cell: 'G9' }, { sheet: 'Costs', cell: 'G3' })
    }
    manifest.workbooks.push(definition)
  }
  async function addCustomer(file, draft) {
    const bytes = createQuotationExcelWorkbook(draft, 'customer')
    const { sheet, cells } = readCustomerSnapshot(bytes)
    const locale = draft.header.documentLocale === 'zh-CN' ? 'zh-CN' : 'en-US'
    const totalLabel = cells.find(cell => cell.value === messages[locale].quotations.document.total)
    if (!totalLabel) throw new Error(`${file}: customer total label was not found.`)
    const totalRow = totalLabel.cell.match(/\d+$/)[0]
    const total = cells.find(cell => cell.cell.endsWith(totalRow)
      && cell.cell.match(/\d+$/)[0] === totalRow && typeof cell.value === 'number')
    if (!total) throw new Error(`${file}: customer total must be numeric.`)
    total.value = calculateQuotationTotals(draft.majorItems, draft.totalsConfig, draft.exchangeRates).grandTotal
    const numeric = cells.filter(cell => typeof cell.value === 'number')
    numeric.forEach(cell => { cell.readable = true })
    await fs.writeFile(path.join(directory, file), bytes)
    manifest.workbooks.push({
      file, protected: false, baseline: cells,
      locked: [{ sheet, cell: total.cell }], unlocked: [],
      scenarios: [{ name: 'static values survive save and reopen', steps: [{ assertions: numeric, reopen: true }] }],
    })
  }
  await addCustomer('customer.xlsx', quote)
  const customerLegacy = structuredClone(quote)
  customerLegacy.totalsConfig.taxAllocationVersion = 1
  await addCustomer('customer-legacy.xlsx', customerLegacy)
  const customerZero = structuredClone(quote)
  customerZero.majorItems[0].quantity = 0
  await addCustomer('customer-zero-quantity.xlsx', customerZero)
  const customerMixed = structuredClone(quote)
  customerMixed.majorItems = [item('Mixed package', 0, 'standard', { quantity: 2, children: [item('Sensor', 10, 'standard'), item('Service', 20, 'reduced')] })]
  await addCustomer('customer-mixed.xlsx', customerMixed)
  customerMixed.majorItems[0].children.forEach(child => { child.unitCost = 0 })
  await addCustomer('customer-unallocated.xlsx', customerMixed)
  const customerChinese = structuredClone(quote)
  customerChinese.header.documentLocale = 'zh-CN'
  await addCustomer('customer-zh.xlsx', customerChinese)

  for (const mode of ['internal']) {
    const s = mode === 'customer' ? 'Quotation' : 'Pricing'
    const pc = mode === 'customer' ? 'F' : 'G'
    const ac = mode === 'customer' ? 'G' : 'H'
    const sc = mode === 'customer' ? 'H' : 'J'
    const scenarios = [
      { name: 'quantity zero and clear', steps: [
        { edits: [edit(s, 'D9', 2)], assertions: [assertion(s, 'F6', 76), assertion(s, `${ac}9`, 20)] },
        { edits: [edit(s, 'D9', 0)], assertions: [assertion(s, 'F6', 54), assertion(s, `${ac}9`, 0)] },
        { edits: [edit(s, 'D9', null)], assertions: [assertion(s, 'F6', 65)], reopen: true },
      ] },
      { name: 'price override zero and clear', steps: [
        { edits: [edit(s, `${pc}9`, 15)], assertions: [assertion(s, 'F6', 70.5)] },
        { edits: [edit(s, `${pc}9`, 0)], assertions: [assertion(s, 'F6', 54)] },
        { edits: [edit(s, `${pc}9`, null)], assertions: [assertion(s, 'F6', 65)] },
      ] },
      { name: 'invalid pasted price and recovery', steps: [
        { edits: [edit(s, `${pc}9`, 'wrong', true)], assertions: [assertion(s, `${ac}9`, null, true), assertion(s, `${sc}9`, 'Invalid input')] },
        { edits: [edit(s, `${pc}9`, -1, true)], assertions: [assertion(s, `${ac}9`, null, true)] },
        { edits: [edit(s, `${pc}9`, null)], assertions: [assertion(s, 'F6', 65)] },
      ] },
      { name: 'sort preserves ownership then edit and reopen', steps: [
        { sort: { sheet: s, range: `A8:${sc}11`, key: 'B9:B11', idColumn: 1, firstRow: 9, lastRow: 11, resultColumns: [3, mode === 'customer' ? 5 : 6, mode === 'customer' ? 7 : 8] },
          assertions: [assertion(s, 'F6', 65), assertion(s, 'A9', '2')] },
        { edits: [edit(s, 'D9', 2)], assertions: [assertion(s, 'F6', 86), assertion(s, `${ac}9`, 40)], reopen: true },
      ] },
    ]
    if (mode === 'internal') scenarios.push(
      { name: 'source costs follow calculation or fixed price', steps: [
        { edits: [edit('Costs', 'G9', 20)], assertions: [assertion(s, 'F6', 76), assertion(s, 'F9', 20)] },
        { edits: [edit(s, 'G9', 15), edit('Costs', 'G9', 30)], assertions: [assertion(s, 'F6', 70.5), assertion(s, 'F9', 30), assertion(s, 'H9', 15), assertion(s, 'I9', -1), assertion(s, 'J9', 'Fixed price')], reopen: true },
        { edits: [edit(s, 'G9', null)], assertions: [assertion(s, 'F6', 87)] },
      ] },
      { name: 'manual prices stay fixed with FX or markup', steps: [
        { edits: [edit('Costs', 'G16', 2)], assertions: [assertion(s, 'F6', 65), assertion(s, 'E10', 40), assertion(s, 'H10', 20), assertion(s, 'I10', -1)] },
        { edits: [edit('Costs', 'G3', 0.2)], assertions: [assertion(s, 'F6', 73.8), assertion(s, 'H10', 20)] },
        { edits: [edit('Costs', 'G3', null), edit('Costs', 'G16', null)], assertions: [assertion(s, 'F6', 65)] },
      ] },
      { name: 'invalid cost and FX stay visible', steps: [
        { edits: [edit('Costs', 'G9', 'bad', true)], assertions: [assertion(s, 'H9', null, true), assertion(s, 'J9', 'Invalid input')] },
        { edits: [edit('Costs', 'G9', null), edit('Costs', 'G15', 0, true)], assertions: [assertion(s, 'H9', null, true)] },
        { edits: [edit('Costs', 'G15', null)], assertions: [assertion(s, 'F6', 65)] },
      ] },
      { name: 'zero manual cost requests review without inventing margin', steps: [
        { edits: [edit('Costs', 'G10', 0)], assertions: [assertion(s, 'F6', 65), assertion(s, 'I10', ''), assertion(s, 'J10', 'Cost review')] },
        { edits: [edit('Costs', 'G10', null)], assertions: [assertion(s, 'F6', 65), assertion(s, 'I10', 0)] },
      ] },
      { name: 'cost rows sort without reassignment', steps: [
        { sort: { sheet: 'Costs', range: 'A8:J11', key: 'B9:B11', idColumn: 1, firstRow: 9, lastRow: 11, resultColumns: [3, 4, 6, 8, 10] },
          assertions: [assertion('Costs', 'A9', '2'), assertion(s, 'F6', 65)] },
        { edits: [edit('Costs', 'G9', 40)], assertions: [assertion(s, 'E10', 40), assertion(s, 'I10', -1), assertion(s, 'F6', 65)], reopen: true },
      ] },
    )
    await add(`${mode}.xlsx`, quote, mode, scenarios)
    const legacy = structuredClone(quote)
    legacy.totalsConfig.taxAllocationVersion = 1
    await add(`${mode}-legacy.xlsx`, legacy, mode, [scenarios[3]])
    const zero = structuredClone(quote)
    zero.majorItems[0].quantity = 0
    await add(`${mode}-zero-quantity.xlsx`, zero, mode, [{ name: 'original zero quantity can become positive', steps: [
      { edits: [edit(s, 'D9', 2)], assertions: [assertion(s, 'F6', 76)] },
    ] }])
    const mixed = structuredClone(quote)
    mixed.majorItems = [item('Mixed package', 0, 'standard', { quantity: 2, children: [item('Sensor', 10, 'standard'), item('Service', 20, 'reduced')] })]
    await add(`${mode}-mixed.xlsx`, mixed, mode, [{ name: 'mixed package repricing and quantity', steps: [
      { edits: [edit(s, `${pc}9`, 40)], assertions: [assertion(s, 'F6', 85.34)] },
      { edits: [edit(s, `${pc}9`, null), edit(s, 'D9', 3)], assertions: [assertion(s, 'F6', 96)] },
    ] }])
    mixed.majorItems[0].children.forEach(child => { child.unitCost = 0 })
    await add(`${mode}-unallocated.xlsx`, mixed, mode, [{ name: 'zero mixed basis never invents tax split', steps: [
      { edits: [edit(s, `${pc}9`, 10)], assertions: [assertion(s, 'F6', 'Check inputs'), assertion(s, `${sc}9`, 'Invalid input')] },
    ] }])
  }
  const charged = structuredClone(quote)
  charged.totalsConfig.extraCharges = [{ id: 'freight', label: 'Freight', amount: 2 }]
  await addCustomer('customer-charges.xlsx', charged)
  const largeCustomer = structuredClone(quote)
  largeCustomer.majorItems = [item('Large contract', 1, 'standard', { pricingMethod: 'manual_price', manualUnitPrice: 1_000_000_000_000 })]
  await addCustomer('customer-large.xlsx', largeCustomer)
  const missingFx = structuredClone(quote)
  missingFx.exchangeRates = { USD: 1 }
  missingFx.majorItems = [item('Imported fixed-price item', 50, 'standard', {
    costCurrency: 'INR', pricingMethod: 'manual_price', manualUnitPrice: 100,
  })]
  await add('internal-missing-fx.xlsx', missingFx, 'internal', [{ name: 'missing FX suppresses margin until supplied', steps: [
    { assertions: [assertion('Pricing', 'I9', ''), assertion('Pricing', 'J9', 'Cost review')] },
    { edits: [edit('Costs', 'G13', 0.02)], assertions: [assertion('Pricing', 'F6', 110), assertion('Pricing', 'I9', 0.99), assertion('Pricing', 'J9', 'Fixed price')], reopen: true },
    { edits: [edit('Costs', 'G13', null)], assertions: [assertion('Pricing', 'I9', ''), assertion('Pricing', 'J9', 'Cost review')] },
  ] }])
  const roundedCost = structuredClone(quote)
  roundedCost.majorItems = [item('Small recorded cost', 0.001, 'standard', {
    pricingMethod: 'manual_price', manualUnitPrice: 100,
  })]
  await add('internal-rounded-cost.xlsx', roundedCost, 'internal', [{ name: 'rounded zero cost requests review', steps: [
    { assertions: [assertion('Pricing', 'I9', ''), assertion('Pricing', 'J9', 'Cost review')] },
    { edits: [edit('Costs', 'G9', 0.01)], assertions: [assertion('Pricing', 'I9', 0.9999), assertion('Pricing', 'J9', 'Fixed price')] },
  ] }])
  const nested = structuredClone(quote)
  nested.exchangeRates.EUR = 1.085
  nested.totalsConfig.globalMarkupRate = 10
  nested.majorItems = [item('Package', 0, 'standard', { quantity: 2, children: [
    item('Assembly', 0, 'standard', { quantity: 3, children: [
      item('Part', 1.235, 'reduced', { quantity: 1.5, costCurrency: 'EUR' }),
      item('Service', 2, 'standard', { quantity: 2, pricingMethod: 'manual_price', manualUnitPrice: 5 }),
    ] }),
  ] })]
  const changedNested = structuredClone(nested)
  changedNested.majorItems[0].quantity = 3
  changedNested.majorItems[0].children[0].children[0].unitCost = 2.345
  const nestedTotal = calculateQuotationTotals(changedNested.majorItems, changedNested.totalsConfig, changedNested.exchangeRates).grandTotal
  await add('internal-nested.xlsx', nested, 'internal', [{ name: 'nested fractional rollups match the app after edits', steps: [
    { edits: [edit('Pricing', 'D9', 3), edit('Costs', 'G9', 2.345)],
      assertions: [assertion('Pricing', 'F6', nestedTotal), assertion('Costs', 'D9', 13.5)], reopen: true },
  ] }])
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`Created ${manifest.workbooks.length} synthetic workbooks in ${directory}`)
} finally {
  await server.close()
}
