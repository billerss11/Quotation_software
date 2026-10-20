import { getQuotationExcelWorkbookLabels } from '@/shared/i18n/quotationExcelWorkbook'
import type { QuotationDraft, QuotationItem } from '../types'
import { buildQuotationExcelModel, excelOverride, type QuotationExcelExportMode } from './quotationExcelModel'
import { normalizeQuotationOutputItemDetailLevel } from './quotationOutputSettings'
import { isQuotationItem } from './quotationItems'
import { createCustomerQuotationExcelWorkbook } from './quotationCustomerExcel'
import { excelColumn, EXCEL_STYLE as style, writeQuotationExcelWorkbook, type ExcelCell, type ExcelWorksheet } from './quotationExcelWorkbook'

export type { QuotationExcelExportMode } from './quotationExcelModel'

const HEADER_ROW = 8
const FIRST_ROW = HEADER_ROW + 1
const literal = (value: string) => `"${value.replace(/"/g, '""')}"`
const sheetRef = (name: string) => `'${name.replace(/'/g, "''")}'!`

function put(sheet: ExcelWorksheet, address: string, value: string | number, cellStyle: number = style.text, formula?: string) {
  sheet.cells.set(address, { value, style: cellStyle, ...(formula === undefined ? {} : { formula }) })
}

/** Blank overrides stay blank through lookups; Excel normally returns zero for a blank cell. */
function inputLookup(sheet: string, id: string, column: string, lastRow: number) {
  const reference = `${sheetRef(sheet)}$${column}$${FIRST_ROW}:$${column}$${Math.max(FIRST_ROW, lastRow)}`
  const match = `MATCH(${literal(id)},${sheetRef(sheet)}$A$${FIRST_ROW}:$A$${Math.max(FIRST_ROW, lastRow)},0)`
  const value = `INDEX(${reference},${match})`
  return `IF(${value}="","",${value})`
}

function input(sheet: ExcelWorksheet, address: string, labels: ReturnType<typeof getQuotationExcelWorkbookLabels>, cellStyle: number, maximum?: number, positiveOnly = false) {
  put(sheet, address, '', cellStyle)
  const valid = `OR(${address}="",AND(ISNUMBER(${address}),${address}${positiveOnly ? '>' : '>='}0${maximum === undefined ? '' : `,${address}<=${maximum}`}))`
  sheet.validations!.push({ range: address, formula: valid, errorTitle: labels.invalidInput, error: labels.inputError })
  sheet.conditionalFormats!.push(
    { range: address, formula: `NOT(${valid})`, kind: 'error' },
    { range: address, formula: `${address}<>""`, kind: 'changed' },
  )
}

function makeSheet(sheetName: string, widths: number[]): ExcelWorksheet {
  return {
    sheetName, cells: new Map<string, ExcelCell>(), widths, lastRow: HEADER_ROW, printLastRow: HEADER_ROW,
    printColumnCount: widths.length, merges: [], rowHeights: new Map(), freezeRows: HEADER_ROW,
    freezeColumns: 2, headerRow: HEADER_ROW, protected: true, validations: [], conditionalFormats: [],
  }
}

function finish(sheet: ExcelWorksheet, row: number) {
  sheet.lastRow = row
  sheet.printLastRow = row
}

export function createQuotationExcelWorkbook(
  quotation: QuotationDraft,
  mode: QuotationExcelExportMode,
  locale: string = quotation.header.documentLocale,
): Uint8Array {
  if (mode === 'customer') return createCustomerQuotationExcelWorkbook(quotation, locale)
  const labels = getQuotationExcelWorkbookLabels(locale)
  const roots = quotation.majorItems.filter(isQuotationItem)
  const leaves: { item: QuotationItem; number: string; path: string; ancestors: string[] }[] = []
  function visit(item: QuotationItem, number: string, path: string, ancestors: string[]) {
    if (!item.children.length) leaves.push({ item, number, path, ancestors })
    item.children.forEach((child, index) => visit(child, `${number}.${index + 1}`, `${path} / ${child.name}`, [...ancestors, number]))
  }
  roots.forEach((item, index) => visit(item, String(index + 1), item.name, []))
  const main = makeSheet(labels.pricingSheet, [7, 40, 10, 10, 13, 14, 14, 15, 11, 18])
  const costs = makeSheet(labels.costsSheet, [9, 43, 12, 13, 10, 15, 15, 16, 18, 13])
  const end = HEADER_ROW + roots.length
  const costsEnd = HEADER_ROW + leaves.length
  const modelName = labels.calculationSheet
  const priceColumn = 'G'
  const amountColumn = 'H'
  const statusColumn = 'J'
  const fxStart = costsEnd + 4
  const currencies = [...new Set(leaves.map(leaf => leaf.item.costCurrency))]
  const fxRows = new Map(currencies.map((currency, index) => [currency, fxStart + index]))
  const model = buildQuotationExcelModel(quotation, 'internal', locale, {
    quantity: node => inputLookup(main.sheetName, node.number, 'D', end),
    price: node => inputLookup(main.sheetName, node.number, priceColumn, end),
    cost: node => inputLookup(costs.sheetName, node.number, 'G', costsEnd),
    fx: currency => `${sheetRef(costs.sheetName)}$G$${fxRows.get(currency)!}`,
    markup: `${sheetRef(costs.sheetName)}$G$3`,
  })
  const modelEnd = Math.max(7, model.subtotalRow - 2)
  const modelRange = (column: string) => `${sheetRef(modelName)}$${column}$7:$${column}$${modelEnd}`
  const lookup = (column: string, id: string) => `INDEX(${modelRange(column)},MATCH(${id},${modelRange('A')},0))`
  const modelCell = (cell: string) => `${sheetRef(modelName)}${cell}`
  const nodes = new Map(model.nodes.map(node => [node.number, node]))
  const unconfirmedCosts = new Map<string, number>()
  for (const node of [...model.nodes].reverse()) {
    const count = node.children.length
      ? node.children.reduce((sum, child) => sum + unconfirmedCosts.get(child.number)!, 0)
      : node.item.pricingMethod === 'manual_price' && node.cost <= 0 ? 1 : 0
    unconfirmedCosts.set(node.number, count)
    const range = `$A$${node.row + 1}:$A$${node.endRow}`
    const formula = node.children.length
      ? `SUMIFS($U$${node.row + 1}:$U$${node.endRow},${range},"${node.number}.*",${range},"<>${node.number}.*.*")`
      : node.item.pricingMethod === 'manual_price' ? `IF(R${node.row}<=0,1,0)` : '0'
    model.cells.set(`U${node.row}`, { value: count, formula })
  }
  const totalFormula = modelCell(`K${model.grandTotalRow}`)
  const priceBasis = labels.priceBasis.replace('{currency}', quotation.header.currency)

  function heading(sheet: ExcelWorksheet, title: string, legend: string) {
    const last = excelColumn(sheet.widths.length)
    sheet.merges!.push('A1:D1', `E1:${last}1`, 'A2:D2', `E2:${last}2`, 'A3:D3', `A4:${last}4`, `A5:${last}5`, `A7:${last}7`)
    put(sheet, 'A1', title, style.title)
    put(sheet, 'E1', `${quotation.header.quotationNumber} / ${labels.revision} ${quotation.header.revisionNumber ?? 1}`, style.title)
    put(sheet, 'A2', `${labels.customer}: ${quotation.header.customerCompany}`)
    put(sheet, 'E2', `${labels.date}: ${quotation.header.quotationDate}`)
    put(sheet, 'A3', `${labels.project}: ${quotation.header.projectName}`)
    put(sheet, 'A4', priceBasis, style.note)
    put(sheet, 'A5', legend, style.note)
    put(sheet, 'A7', labels.sortHint, style.note)
    sheet.rowHeights!.set(5, 34)
    sheet.rowHeights!.set(7, 28)
  }
  heading(main, labels.internalTitle, labels.internalLegend)
  main.merges!.push('A6:B6', 'D6:E6')
  put(main, 'A6', labels.quotedTotal, style.section)
  put(main, 'C6', model.totals.grandTotal, style.money)
  put(main, 'D6', labels.revisedTotal, style.section)
  put(main, 'F6', model.totals.grandTotal, style.money, `IFERROR(${totalFormula},${literal(labels.invalidTotals)})`)
  put(main, 'G6', labels.change, style.section)
  put(main, 'H6', 0, style.money, `IFERROR(${totalFormula}-C6,${literal(labels.invalidTotals)})`)
  const headings = [labels.number, labels.item, labels.quotedQuantity, labels.newQuantity, labels.unitCostQuote, labels.calculatedPrice, labels.newPrice, labels.netAmount, labels.margin, labels.pricingStatus]
  headings.forEach((label, index) => put(main, `${excelColumn(index + 1)}${HEADER_ROW}`, label, style.header))
  if (roots.length) main.autoFilter = `A${HEADER_ROW}:${excelColumn(headings.length)}${end}`
  let section = ''
  const sections = new Map<string, string>()
  for (const entry of quotation.majorItems) {
    if (isQuotationItem(entry)) sections.set(entry.id, section)
    else section = entry.title
  }
  model.roots.forEach((node, index) => {
    const row = FIRST_ROW + index
    const id = `A${row}`
    const item = roots[index]!
    put(main, id, node.number, style.centered)
    put(main, `B${row}`, `${item.name} (${item.quantityUnit})`)
    put(main, `C${row}`, item.quantity, style.centered)
    input(main, `D${row}`, labels, style.inputCenteredNumber)
    input(main, `${priceColumn}${row}`, labels, style.inputMoney)
    const net = lookup('J', id)
    put(main, `${amountColumn}${row}`, node.net, style.money, net)
    const unitCost = Number(model.cells.get(`O${node.row}`)!.value)
    put(main, `E${row}`, unitCost, style.money, lookup('O', id))
    put(main, `F${row}`, node.unitPrice, style.money, lookup('S', id))
    // A zero converted line cost leaves a manual price's margin unconfirmed.
    const incomplete = unconfirmedCosts.get(node.number)!
    const cost = lookup('R', id)
    const margin = node.net > 0 && !incomplete ? (node.net - node.cost) / node.net : ''
    put(main, `I${row}`, margin, style.percent, `IF(OR(${lookup('U', id)}>0,${net}<=0),"",(${net}-${cost})/${net})`)
    const fixed = item.children.length === 0 && item.pricingMethod === 'manual_price'
    put(main, `${statusColumn}${row}`, incomplete ? labels.costReview : fixed ? labels.fixedPrice : labels.calculatedPriceStatus, style.centeredNote,
      `IFERROR(IF(ISNUMBER(${net}+${cost}+${lookup('I', id)}),IF(${lookup('U', id)}>0,${literal(labels.costReview)},IF(OR(${priceColumn}${row}<>"",${fixed ? 'TRUE' : 'FALSE'}),${literal(labels.fixedPrice)},${literal(labels.calculatedPriceStatus)})),${literal(labels.invalidInput)}),${literal(labels.invalidInput)})`)
  })
  let row = end + 2
  const summary = (label: string, value: number, formula: string, total = false) => {
    put(main, `B${row}`, label, total ? style.section : style.text)
    put(main, `${amountColumn}${row}`, value, total ? style.total : style.money, `IFERROR(${formula},${literal(labels.invalidTotals)})`)
    row++
  }
  summary(labels.subtotal, model.totals.subtotalAfterMarkup, modelCell(`K${model.subtotalRow}`))
  for (const bucket of model.totals.taxBuckets) {
    summary(`${bucket.label} (${bucket.rate}%)`, bucket.taxAmount, modelCell(`K${model.taxRows.get(bucket.taxClassId)!}`))
  }
  summary(labels.totalTax, model.totals.taxAmount, modelCell(`K${model.totalTaxRow}`))
  if (quotation.totalsConfig.extraCharges?.length) {
    put(main, `B${row}`, labels.charge, style.header)
    put(main, `F${row}`, labels.quotedAmount, style.header)
    put(main, `${priceColumn}${row}`, labels.newAmount, style.header)
    put(main, `${amountColumn}${row}`, labels.effectiveAmount, style.header)
    row++
    quotation.totalsConfig.extraCharges.forEach((charge, index) => {
      put(main, `B${row}`, charge.label)
      // Charges are rounded together by the app, so retain visible source
      // precision rather than displaying independently rounded line amounts.
      put(main, `F${row}`, charge.amount, style.precision)
      input(main, `${priceColumn}${row}`, labels, style.inputPrecision)
      const effective = excelOverride(`${priceColumn}${row}`, `F${row}`)
      put(main, `${amountColumn}${row}`, charge.amount, style.precision, effective)
      model.cells.set(`K${model.extraStartRow + index}`, { value: charge.amount, formula: `${sheetRef(main.sheetName)}${amountColumn}${row}` })
      row++
    })
    model.cells.get(`K${model.grandTotalRow}`)!.formula =
      `ROUND(K${model.subtotalRow}+K${model.totalTaxRow}+ROUND(SUM(K${model.extraStartRow}:K${model.grandTotalRow - 1}),2),2)`
  }
  summary(labels.grandTotal, model.totals.grandTotal, totalFormula, true)
  summary(labels.baseCost, model.totals.baseSubtotal, modelCell(`R${model.costTotalRow}`))
  function note(text: string) {
    if (!text.trim()) return
    main.merges!.push(`B${row}:${excelColumn(main.widths.length)}${row}`)
    put(main, `B${row}`, text, style.note)
    row++
  }
  row++
  if (model.roots.some(node => node.buckets.length > 1)) note(labels.mixedTaxNote)
  note(labels.pricingModeNote)
  note(labels.costIncompleteNote)
  note(`${labels.supplier}: ${[quotation.companyProfileSnapshot.companyName, quotation.companyProfileSnapshot.email, quotation.companyProfileSnapshot.phone].filter(Boolean).join(' / ')}`)
  if (quotation.header.contactPerson || quotation.header.contactDetails) note(`${labels.contact}: ${[quotation.header.contactPerson, quotation.header.contactDetails].filter(Boolean).join(' / ')}`)
  if (quotation.header.validityPeriod) note(`${labels.validity}: ${quotation.header.validityPeriod}`)
  if (quotation.header.terms) note(`${labels.terms}: ${quotation.header.terms}`)
  if (quotation.header.notes) note(`${labels.notes}: ${quotation.header.notes}`)
  const detail = normalizeQuotationOutputItemDetailLevel(quotation.outputSettings?.itemDetailLevel)
  if (roots.some(item => item.description || sections.get(item.id) || (detail > 1 && item.children.length))) {
    row++
    note(labels.scope)
    note(labels.scopeNote)
    function scope(item: QuotationItem, number: string, depth: number) {
      if (depth > detail) return
      if (depth === 1) {
        note([sections.get(item.id), `${number}  ${item.name}`, item.description].filter(Boolean).join('\n'))
      } else {
        note(`${number}  ${item.name} — ${item.quantity} ${item.quantityUnit} (${labels.quantityPerParent})\n${item.description}`.trim())
      }
      item.children.forEach((child, index) => scope(child, `${number}.${index + 1}`, depth + 1))
    }
    roots.forEach((item, index) => scope(item, String(index + 1), 1))
  }
  finish(main, row)

  heading(costs, labels.costsSheet, labels.costsLegend)
  costs.merges = costs.merges!.filter(range => range !== 'E2:J2')
  put(costs, 'E2', '')
  put(costs, 'F2', labels.sourceMarkup, style.note)
  put(costs, 'G2', labels.newMarkup, style.note)
  put(costs, 'H2', labels.markup, style.note)
  put(costs, 'E3', labels.defaultMarkup, style.note)
  put(costs, 'F3', quotation.totalsConfig.globalMarkupRate / 100, style.percent)
  input(costs, 'G3', labels, style.inputPercent, 10)
  put(costs, 'H3', quotation.totalsConfig.globalMarkupRate / 100, style.percent, modelCell('P3'))
  costs.merges!.push('A6:J6')
  put(costs, 'A6', labels.inheritedMarkupNote, style.note)
  const costHeaders = [labels.number, labels.item, labels.quantityPerParent, labels.totalQuantity, labels.costCurrency, labels.originalCost, labels.newCost, labels.convertedCost, labels.pricingMethod, labels.markup]
  costHeaders.forEach((label, index) => put(costs, `${excelColumn(index + 1)}${HEADER_ROW}`, label, style.header))
  if (leaves.length) costs.autoFilter = `A${HEADER_ROW}:J${costsEnd}`
  leaves.forEach((leaf, index) => {
    const r = FIRST_ROW + index
    const node = nodes.get(leaf.number)!
    put(costs, `A${r}`, leaf.number, style.centered)
    put(costs, `B${r}`, [leaf.path, leaf.item.description].filter(Boolean).join('\n'))
    put(costs, `C${r}`, leaf.item.quantity, style.centered)
    const quantityNodes = [...leaf.ancestors, leaf.number].map(number => nodes.get(number)!)
    put(costs, `D${r}`, quantityNodes.reduce((value, ancestor) => value * ancestor.item.quantity, 1), style.centered,
      quantityNodes.map(ancestor => lookup('C', literal(ancestor.number))).join('*'))
    put(costs, `E${r}`, leaf.item.costCurrency, style.centered)
    put(costs, `F${r}`, leaf.item.unitCost, style.precision)
    input(costs, `G${r}`, labels, style.inputPrecision)
    put(costs, `H${r}`, Number(model.cells.get(`O${node.row}`)!.value), style.precision, lookup('O', `A${r}`))
    const manual = leaf.item.pricingMethod === 'manual_price'
    const markupSource = typeof leaf.item.markupRate === 'number' ? labels.localSource
      : leaf.ancestors.some(number => typeof nodes.get(number)!.item.markupRate === 'number') ? labels.parentSource : labels.defaultSource
    put(costs, `I${r}`, manual ? labels.manualPriceMethod : `${labels.costPlus}\n${markupSource}`, style.centered)
    put(costs, `J${r}`, manual ? '' : node.markup / 100, style.percent, manual ? undefined : lookup('T', `A${r}`))
  })
  put(costs, `B${fxStart - 2}`, labels.exchangeRates, style.section)
  for (const [column, label] of [['E', labels.costCurrency], ['F', labels.originalFx], ['G', labels.newFx], ['H', labels.effectiveFx]]) {
    put(costs, `${column}${fxStart - 1}`, label!, style.header)
  }
  for (const [currency, r] of fxRows) {
    put(costs, `E${r}`, currency, style.centered)
    put(costs, `F${r}`, quotation.exchangeRates[currency] ?? 0, style.precision)
    input(costs, `G${r}`, labels, style.inputPrecision, undefined, true)
    put(costs, `H${r}`, quotation.exchangeRates[currency] ?? 0, style.precision, modelCell(`B${model.fxRows.get(currency)!}`))
  }
  finish(costs, fxStart + currencies.length)
  const calculations: ExcelWorksheet = {
    ...model, sheetName: modelName, state: 'veryHidden', protected: true,
    // No editable cells in the model: source constants and formulas are fixed.
    cells: new Map([...model.cells].map(([address, cell]) => [address, {
      ...cell, style: cell.style === style.inputMoney ? style.money : cell.style === style.inputPercent ? style.percent
        : cell.style === style.inputPrecision ? style.precision : cell.style === style.inputNumber || cell.style === style.inputText ? style.text : cell.style,
    }])),
  }
  while (calculations.widths.length < 21) calculations.widths.push(17)
  return writeQuotationExcelWorkbook({ sheets: [main, costs, calculations], mixedLabel: labels.mixed })
}
