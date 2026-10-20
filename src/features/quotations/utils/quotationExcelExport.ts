import { getQuotationExcelWorkbookLabels } from '@/shared/i18n/quotationExcelWorkbook'

import type { QuotationDraft, QuotationItem, QuotationTaxBucket } from '../types'
import {
  calculateQuotationItemBaseSubtotal,
  calculateQuotationItemSellingAmount,
  calculateQuotationItemTaxBuckets,
  calculateQuotationItemUnitSellingPrice,
  calculateQuotationRootTaxBucketAllocations,
  calculateQuotationTotals,
  getEffectiveMarkupRate,
} from './quotationCalculations'
import { isQuotationItem } from './quotationItems'
import { roundMoney } from './moneyMath'
import { normalizeQuotationOutputItemDetailLevel } from './quotationOutputSettings'
import { getExcelTaxFormulas, getExcelTaxQuota, getExcelTaxRate } from './quotationExcelTax'
import { excelColumn, excelSumFormula as sumFormula, EXCEL_STYLE as style, writeQuotationExcelWorkbook, type ExcelCell } from './quotationExcelWorkbook'

export type QuotationExcelExportMode = 'customer' | 'internal'

interface ExportNode {
  item: QuotationItem
  number: string
  row: number
  endRow: number
  parent?: ExportNode
  children: ExportNode[]
  collapsed: boolean
  markup: number
  inheritedMarkup?: number
  inheritedTax?: string
  net: number
  unitPrice: number
  cost: number
  buckets: QuotationTaxBucket[]
  allocations: QuotationTaxBucket[]
  bucketRows: Map<string, number>
}

function positive(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(value ?? 0, 0) : 0
}

export function createQuotationExcelWorkbook(
  quotation: QuotationDraft,
  mode: QuotationExcelExportMode,
  locale: string = quotation.header.documentLocale,
): Uint8Array {
  const internal = mode === 'internal'
  const exactAllocation = quotation.totalsConfig.taxAllocationVersion === 2
  const labels = getQuotationExcelWorkbookLabels(locale)
  const cells = new Map<string, ExcelCell>()
  const set = (address: string, value: string | number, cellStyle: number = style.text, formula?: string) => {
    cells.set(address, { value, style: cellStyle, ...(formula === undefined ? {} : { formula }) })
  }
  const totals = calculateQuotationTotals(quotation.majorItems, quotation.totalsConfig, quotation.exchangeRates)
  const commercialColumns = ['number', 'item', 'quantity', 'unit', 'taxRate', 'unitPrice', 'unitTax', 'unitPriceWithTax', 'taxAmount', 'netAmount', 'grossAmount']
  const columns = internal ? [...commercialColumns, 'costCurrency', 'unitCost', 'exchangeRate', 'convertedCost', 'markup', 'manualPrice', 'costAmount'] : commercialColumns
  const column = (name: string) => {
    const index = columns.indexOf(name)
    return index < 0 ? undefined : excelColumn(index + 1)
  }
  const address = (node: ExportNode, name: string) => `${column(name)}${node.row}`
  const widths = columns.map(name => name === 'number' ? 9 : name === 'item' ? 38 : name === 'quantity' || name === 'unit' ? 10 : 17)
  while (widths.length < (exactAllocation ? 10 : 12)) widths.push(17)
  const totalColumn = column('grossAmount')!
  const hiddenRows = new Set<number>()
  const nodes: ExportNode[] = []
  const roots: ExportNode[] = []
  const sections: { title: string; row: number }[] = []
  const rootAllocations = calculateQuotationRootTaxBucketAllocations(quotation.majorItems, quotation.totalsConfig, quotation.exchangeRates)
  const detailLevel = internal ? 3 : normalizeQuotationOutputItemDetailLevel(quotation.outputSettings?.itemDetailLevel)
  let nextRow = 7
  function addNode(item: QuotationItem, number: string, parent?: ExportNode): ExportNode {
    const inheritedMarkup = parent?.markup
    const inheritedTax = parent ? parent.item.taxClassId ?? parent.inheritedTax : undefined
    const buckets = calculateQuotationItemTaxBuckets(item, quotation.totalsConfig, quotation.exchangeRates, {
      inheritedMarkupRate: inheritedMarkup,
      inheritedTaxClassId: inheritedTax,
    })
    const node: ExportNode = {
      item, number, row: nextRow++, endRow: 0, parent, children: [],
      collapsed: !internal && number.split('.').length >= detailLevel && item.children.length > 0,
      inheritedMarkup, inheritedTax,
      markup: getEffectiveMarkupRate(item.markupRate, inheritedMarkup ?? quotation.totalsConfig.globalMarkupRate),
      net: calculateQuotationItemSellingAmount(item, quotation.totalsConfig.globalMarkupRate, quotation.exchangeRates, inheritedMarkup),
      unitPrice: calculateQuotationItemUnitSellingPrice(item, quotation.totalsConfig.globalMarkupRate, quotation.exchangeRates, inheritedMarkup),
      cost: calculateQuotationItemBaseSubtotal(item, quotation.exchangeRates),
      buckets,
      allocations: parent ? buckets : rootAllocations.get(item.id) ?? buckets,
      bucketRows: new Map(),
    }
    nodes.push(node)
    if (!node.collapsed) node.children = item.children.map((child, index) => addNode(child, `${number}.${index + 1}`, node))
    node.endRow = nextRow - 1
    return node
  }
  for (const item of quotation.majorItems) {
    if (isQuotationItem(item)) roots.push(addNode(item, String(roots.length + 1)))
    else sections.push({ title: item.title, row: nextRow++ })
  }
  const subtotalRow = nextRow + 1
  const taxRows = new Map(totals.taxBuckets.map((bucket, index) => [bucket.taxClassId, subtotalRow + index + 1]))
  const totalTaxRow = subtotalRow + totals.taxBuckets.length + 1
  const extraCharges = quotation.totalsConfig.extraCharges ?? []
  const extraStartRow = totalTaxRow + 1
  const grandTotalRow = extraStartRow + extraCharges.length
  const costTotalRow = grandTotalRow + 1
  let lastRow = internal ? costTotalRow : grandTotalRow
  const fxRows = new Map<string, number>()
  if (internal) {
    const currencies = [...new Set([...Object.keys(quotation.exchangeRates), ...nodes.filter(node => !node.children.length).map(node => node.item.costCurrency)])]
    set(`B${lastRow + 2}`, labels.exchangeRates, style.section)
    currencies.forEach((currency, index) => fxRows.set(currency, lastRow + 3 + index))
    lastRow += currencies.length + 2
  }
  const helperTitleRow = lastRow + 2
  const allocationNote = !internal && nodes.some(node => node.collapsed && node.buckets.length > 1)
  {
    nextRow = helperTitleRow + (allocationNote ? 3 : 2)
    for (const node of nodes) {
      for (const bucket of node.buckets) node.bucketRows.set(bucket.taxClassId, nextRow++)
    }
    lastRow = nextRow - 1
  }
  const bucketLastRow = lastRow
  const allocationClassRows = new Map<string, number>()
  const taxContributorCounts = new Map<string, number>()
  const initialTaxPriorities = new Map<string, Map<string, number>>()
  const exactRates = new Map(totals.taxBuckets.map(bucket => [bucket.taxClassId, exactAllocation ? getExcelTaxRate(bucket.rate) : null]))
  const classHeaderRow = bucketLastRow + 3
  for (const bucket of totals.taxBuckets) {
    const ordered = roots.flatMap((node, index) => {
      const contribution = node.buckets.find(candidate => candidate.taxClassId === bucket.taxClassId)
      if (!contribution) return []
      const cents = contribution.taxableSubtotal * bucket.rate
      return [{ id: node.item.id, index, remainder: cents - Math.floor(cents + 1e-9) }]
    })
    taxContributorCounts.set(bucket.taxClassId, ordered.length)
    if (ordered.length <= 1 && !exactAllocation) continue
    allocationClassRows.set(bucket.taxClassId, classHeaderRow + allocationClassRows.size + 1)
    if (!exactAllocation) {
      ordered.sort((left, right) => right.remainder - left.remainder || left.index - right.index)
      initialTaxPriorities.set(bucket.taxClassId, new Map(ordered.map((entry, index) => [entry.id, index + 1])))
    }
  }
  if (allocationClassRows.size) lastRow = classHeaderRow + allocationClassRows.size
  const rateValue = (taxClassId: string, rate: number) => exactRates.get(taxClassId)?.value ?? rate / 100
  if (exactAllocation) {
    for (const bucket of totals.taxBuckets) getExcelTaxQuota(bucket.taxableSubtotal, exactRates.get(bucket.taxClassId)!)
  }
  const firstBucketRow = nodes[0]?.bucketRows.values().next().value ?? helperTitleRow + 2
  const nodeByRow = new Map(nodes.map(node => [node.row, node]))
  const itemRange = (name: string) => `$${column(name)}$7:$${column(name)}$${Math.max(7, subtotalRow - 2)}`
  const taxRange = (columnName: string) => `$${columnName}$${firstBucketRow}:$${columnName}$${Math.max(firstBucketRow, bucketLastRow)}`
  const taxClassNumber = (taxId: string) => totals.taxBuckets.findIndex(bucket => bucket.taxClassId === taxId) + 1
  const rootSum = (name: string) => `SUMIF(${itemRange('number')},"<>*.*",${itemRange(name)})`
  const childRange = (node: ExportNode, columnName: string) => `$${columnName}$${node.row + 1}:$${columnName}$${node.endRow}`
  const childSum = (node: ExportNode, name: string) => `SUMIFS(${childRange(node, column(name)!)},${childRange(node, 'A')},"${node.number}.*",${childRange(node, 'A')},"<>${node.number}.*.*")`
  function childTaxRange(node: ExportNode, columnName: string) {
    const firstRow = node.children[0]!.bucketRows.values().next().value!
    const lastRow = [...nodeByRow.get(node.endRow)!.bucketRows.values()].at(-1)!
    return `$${columnName}$${firstRow}:$${columnName}$${lastRow}`
  }
  function unitFormula(node: ExportNode): string {
    const reference = address(node, 'unitPrice')
    return internal ? reference : `ROUND(MAX(${reference},0),2)`
  }
  function netFormula(node: ExportNode): string {
    return address(node, 'netAmount')
  }
  function nodeTaxFormula(node: ExportNode) {
    return sumFormula([...node.bucketRows.values()].map(row => `G${row}`))
  }
  function markupFormula(node: ExportNode): string {
    const markup = address(node, 'markup')
    const fallback = node.parent ? markupFormula(node.parent) : `$${column('markup')}$3`
    return `IF(ISNUMBER(${markup}),MIN(MAX(${markup},0),10),${fallback})`
  }
  set('B1', internal ? labels.internalTitle : labels.customerTitle, style.title)
  set('E1', quotation.header.quotationNumber, style.title)
  set('D2', labels.date, style.note)
  set('E2', quotation.header.quotationDate)
  set('D4', labels.revision, style.note)
  set('E4', quotation.header.revisionNumber ?? 1)
  set('A3', labels.customer, style.note)
  set('B3', quotation.header.customerCompany)
  set('D3', labels.currency, style.note)
  set('E3', quotation.header.currency)
  set('A4', labels.project, style.note)
  set('B4', quotation.header.projectName)
  set('A5', internal ? labels.internalLegend : labels.customerLegend, style.note)
  if (internal) {
    set(`${column('convertedCost')}3`, labels.defaultMarkup, style.note)
    set(`${column('markup')}3`, getEffectiveMarkupRate(undefined, quotation.totalsConfig.globalMarkupRate) / 100, style.inputPercent)
    for (const [currency, row] of fxRows) {
      set(`A${row}`, currency)
      set(`B${row}`, positive(quotation.exchangeRates[currency]), style.inputPrecision)
    }
  }
  columns.forEach((name, index) => set(`${excelColumn(index + 1)}6`, labels[name as keyof typeof labels], style.header))
  for (const section of sections) {
    for (let index = 1; index <= columns.length; index += 1) set(`${excelColumn(index)}${section.row}`, index === 2 ? section.title : '', style.section)
  }
  for (const node of nodes) {
    const quantity = positive(node.item.quantity)
    set(`A${node.row}`, node.number)
    set(`B${node.row}`, node.item.name)
    set(`C${node.row}`, quantity, style.inputNumber)
    set(`D${node.row}`, node.item.quantityUnit)
    if (internal) {
      if (!node.children.length) {
        const rate = positive(quotation.exchangeRates[node.item.costCurrency])
        const converted = positive(node.item.unitCost) * rate
        set(address(node, 'costCurrency'), node.item.costCurrency, style.inputText)
        set(address(node, 'unitCost'), positive(node.item.unitCost), style.inputPrecision)
        const fxTableRows = [...fxRows.values()]
        set(address(node, 'exchangeRate'), rate, style.precision, `VLOOKUP(${address(node, 'costCurrency')},$A$${fxTableRows[0]}:$B$${fxTableRows.at(-1)},2,FALSE)`)
        set(address(node, 'convertedCost'), converted, style.precision, `MAX(${address(node, 'unitCost')},0)*MAX(${address(node, 'exchangeRate')},0)`)
        set(address(node, 'manualPrice'), node.item.pricingMethod === 'manual_price' ? positive(node.item.manualUnitPrice) : '', style.inputMoney)
        set(address(node, 'unitPrice'), node.unitPrice, style.money, `IF(ISNUMBER(${address(node, 'manualPrice')}),ROUND(MAX(${address(node, 'manualPrice')},0),2),ROUND(${address(node, 'convertedCost')}+ROUND(${address(node, 'convertedCost')}*(${markupFormula(node)}),2),2))`)
      } else {
        const unitCost = node.children.reduce((sum, child) => sum + child.cost, 0)
        set(address(node, 'convertedCost'), unitCost, style.money, childSum(node, 'costAmount'))
        set(address(node, 'unitPrice'), node.unitPrice, style.money, `ROUND(${childSum(node, 'netAmount')},2)`)
      }
      set(address(node, 'markup'), typeof node.item.markupRate === 'number' && Number.isFinite(node.item.markupRate) ? getEffectiveMarkupRate(node.item.markupRate, 0) / 100 : '', style.inputPercent)
      set(address(node, 'netAmount'), node.net, style.money, `ROUND(MAX(C${node.row},0)*${address(node, 'unitPrice')},2)`)
      set(address(node, 'costAmount'), node.cost, style.money, `ROUND(MAX(C${node.row},0)*${address(node, 'convertedCost')},2)`)
    } else {
      set(address(node, 'unitPrice'), node.unitPrice, node.children.length ? style.money : style.inputMoney,
        node.children.length ? `ROUND(${childSum(node, 'netAmount')},2)` : undefined)
      set(address(node, 'netAmount'), node.net, style.money, `ROUND(MAX(C${node.row},0)*(${unitFormula(node)}),2)`)
    }
    {
      const taxAmount = roundMoney(node.allocations.reduce((sum, bucket) => sum + bucket.taxAmount, 0))
      const gross = roundMoney(node.net + taxAmount)
      const moneyValues: Record<'taxAmount' | 'grossAmount' | 'unitTax' | 'unitPriceWithTax', { value: number | string; formula: string }> = {
        taxAmount: { value: taxAmount, formula: `ROUND(${nodeTaxFormula(node)},2)` },
        grossAmount: { value: gross, formula: `ROUND((${netFormula(node)})+${nodeTaxFormula(node)},2)` },
        unitTax: { value: quantity > 0 ? roundMoney(taxAmount / quantity) : '', formula: `IF(C${node.row}>0,ROUND(${nodeTaxFormula(node)}/C${node.row},2),"")` },
        unitPriceWithTax: { value: quantity > 0 ? roundMoney(gross / quantity) : '', formula: `IF(C${node.row}>0,ROUND(((${netFormula(node)})+${nodeTaxFormula(node)})/C${node.row},2),"")` },
      }
      for (const [name, calculation] of Object.entries(moneyValues)) {
        set(address(node, name), calculation.value, style.money, calculation.formula)
      }
      const isMixed = node.buckets.length > 1
      const rate = isMixed ? node.net > 0 ? roundMoney(taxAmount / node.net * 100) / 100 : labels.mixed : rateValue(node.buckets[0]?.taxClassId ?? '', node.buckets[0]?.rate ?? 0)
      set(address(node, 'taxRate'), rate, isMixed ? style.mixedPercent : style.percent,
        isMixed ? `IF((${netFormula(node)})>0,ROUND(${nodeTaxFormula(node)}/(${netFormula(node)})*100,2)/100,"${labels.mixed}")` : `C${node.bucketRows.values().next().value}`)
    }
  }
  set(`B${subtotalRow}`, quotation.outputSettings?.subtotalLabel?.trim() || labels.subtotal, style.section)
  set(`${totalColumn}${subtotalRow}`, totals.subtotalAfterMarkup, style.total, `ROUND(${rootSum('netAmount')},2)`)
  for (const bucket of totals.taxBuckets) {
    const row = taxRows.get(bucket.taxClassId)!
    set(`B${row}`, `${labels.taxAmount} · ${bucket.label}`)
    set(`C${row}`, rateValue(bucket.taxClassId, bucket.rate), style.inputPercent)
    const taxable = `SUMIFS(${taxRange('F')},${taxRange('B')},${taxClassNumber(bucket.taxClassId)},${taxRange('A')},"<>*.*")`
    const classRow = allocationClassRows.get(bucket.taxClassId)
    const formula = exactAllocation
      ? getExcelTaxFormulas(taxable, `$D$${classRow}`, `$C$${classRow}`).amount
      : `ROUND((${taxable})*MIN(MAX(C${row},0),1),2)`
    set(`${totalColumn}${row}`, bucket.taxAmount, style.money, formula)
  }
  set(`B${totalTaxRow}`, labels.totalTax)
  set(`${totalColumn}${totalTaxRow}`, totals.taxAmount, style.money, `ROUND(${sumFormula([...taxRows.values()].map(row => `${totalColumn}${row}`))},2)`)
  extraCharges.forEach((charge, index) => {
    set(`B${extraStartRow + index}`, charge.label)
    set(`${totalColumn}${extraStartRow + index}`, positive(charge.amount), internal ? style.inputPrecision : style.inputMoney)
  })
  set(`B${grandTotalRow}`, labels.grandTotal, style.section)
  const extras = extraCharges.length ? `SUMIF(${totalColumn}${extraStartRow}:${totalColumn}${grandTotalRow - 1},">0")` : '0'
  set(`${totalColumn}${grandTotalRow}`, totals.grandTotal, style.total, `ROUND(${totalColumn}${subtotalRow}+${totalColumn}${totalTaxRow}+ROUND(${extras},2),2)`)
  if (internal) {
    set(`B${costTotalRow}`, labels.baseCost)
    set(`${column('costAmount')}${costTotalRow}`, totals.baseSubtotal, style.money, `ROUND(${rootSum('costAmount')},2)`)
  }
  {
    set(`B${helperTitleRow}`, labels.taxAllocations, style.section)
    if (allocationNote) {
      set(`B${helperTitleRow + 1}`, labels.allocationNote, style.note)
    }
    const headerRow = nodes[0]?.bucketRows.values().next().value
    if (headerRow !== undefined) {
      const headings = [labels.number, labels.classId, labels.taxRate, labels.unitBasis, labels.rawTaxable, labels.taxableAmount, labels.taxAmount, labels.allocationGroup, labels.taxCents, exactAllocation ? labels.integerRemainder : labels.remainder,
        ...(!exactAllocation ? [labels.originalTaxable, labels.originalPriority] : [])]
      for (let index = 0; index < headings.length; index += 1) {
        set(`${excelColumn(index + 1)}${headerRow - 1}`, headings[index]!, style.header)
      }
    }
    for (const node of nodes) {
      const mixed = node.buckets.length > 1
      const basis = mixed && node.collapsed ? calculateQuotationItemTaxBuckets({ ...node.item, quantity: 1 }, quotation.totalsConfig, quotation.exchangeRates, {
        inheritedMarkupRate: node.inheritedMarkup, inheritedTaxClassId: node.inheritedTax,
      }) : node.buckets
      const helperRows = [...node.bucketRows.values()]
      const rawValues = mixed ? node.buckets.map(bucket => {
        const unitBasis = node.collapsed
          ? basis.find(candidate => candidate.taxClassId === bucket.taxClassId)?.taxableSubtotal ?? 0
          : node.children.reduce((sum, child) => sum + (child.buckets.find(candidate => candidate.taxClassId === bucket.taxClassId)?.taxableSubtotal ?? 0), 0)
        return roundMoney(unitBasis * positive(node.item.quantity))
      }) : []
      const rawSum = sumFormula(helperRows.map(row => `E${row}`))
      const adjustment = `ROUND((${netFormula(node)})-${rawSum},2)`
      for (const [index, bucket] of node.buckets.entries()) {
        const row = node.bucketRows.get(bucket.taxClassId)!
        set(`A${row}`, node.number)
        set(`B${row}`, taxClassNumber(bucket.taxClassId))
        set(`C${row}`, rateValue(bucket.taxClassId, bucket.rate), style.percent, `$C$${taxRows.get(bucket.taxClassId)}`)
        if (mixed) {
          const unitBasis = node.collapsed
            ? basis.find(candidate => candidate.taxClassId === bucket.taxClassId)?.taxableSubtotal ?? 0
            : node.children.reduce((sum, child) => sum + (child.buckets.find(candidate => candidate.taxClassId === bucket.taxClassId)?.taxableSubtotal ?? 0), 0)
          const unitBasisFormula = node.collapsed ? undefined : `SUMIFS(${childTaxRange(node, 'F')},${childTaxRange(node, 'B')},${taxClassNumber(bucket.taxClassId)},${childTaxRange(node, 'A')},"${node.number}.*",${childTaxRange(node, 'A')},"<>${node.number}.*.*")`
          set(`D${row}`, unitBasis, node.collapsed ? style.inputMoney : style.money, unitBasisFormula)
          const basisSum = sumFormula(helperRows.map(basisRow => `D${basisRow}`))
          const rawFormula = node.collapsed
            ? `IF(${basisSum}>0,ROUND(D${row}*MAX(C${node.row},0)*(${unitFormula(node)})/${basisSum},2),${index === 0 ? netFormula(node) : '0'})`
            : `ROUND(D${row}*MAX(C${node.row},0),2)`
          set(`E${row}`, rawValues[index]!, style.money, rawFormula)
          const later = sumFormula(helperRows.slice(index + 1).map(laterRow => `E${laterRow}`))
          const lastPositive = index === helperRows.length - 1
            ? `OR(AND(E${row}>0,${later}=0),${rawSum}=0)`
            : `AND(E${row}>0,${later}=0)`
          set(`F${row}`, bucket.taxableSubtotal, style.money, `IF((${adjustment})>=0,ROUND(E${row}+IF(${lastPositive},${adjustment},0),2),MAX(0,ROUND(E${row}-MAX(0,-(${adjustment})-${later}),2)))`)
        } else set(`F${row}`, bucket.taxableSubtotal, style.money, netFormula(node))
        const classRow = allocationClassRows.get(bucket.taxClassId)
        const quota = exactAllocation ? getExcelTaxQuota(bucket.taxableSubtotal, exactRates.get(bucket.taxClassId)!) : null
        const exactFormulas = exactAllocation ? getExcelTaxFormulas(`F${row}`, `$D$${classRow}`, `$C$${classRow}`) : null
        let taxFormula = exactFormulas?.amount ?? `ROUND(F${row}*MIN(MAX(C${row},0),1),2)`
        if (!node.parent) {
          const first = headerRow!
          if (classRow === undefined || taxContributorCounts.get(bucket.taxClassId) === 1) taxFormula = `${totalColumn}${taxRows.get(bucket.taxClassId)}`
          else {
            const groups = `$H$${first}:$H$${bucketLastRow}`
            const remainders = `$J$${first}:$J$${bucketLastRow}`
            const editedRank = `SUMPRODUCT(--(${groups}=H${row}),--(${remainders}>J${row}))+SUMPRODUCT(--($H$${first}:H${row}=H${row}),--($J$${first}:J${row}=J${row}))`
            set(`H${row}`, totals.taxBuckets.findIndex(candidate => candidate.taxClassId === bucket.taxClassId) + 1)
            if (exactAllocation) {
              set(`I${row}`, quota!.cents, style.precision, exactFormulas!.wholeCents)
              set(`J${row}`, quota!.remainder, style.precision, exactFormulas!.remainder)
              const laterFloors = row < bucketLastRow ? `SUMIF(H${row + 1}:H${bucketLastRow},H${row},I${row + 1}:I${bucketLastRow})` : '0'
              const laterBases = row < bucketLastRow ? `SUMIF(H${row + 1}:H${bucketLastRow},H${row},F${row + 1}:F${bucketLastRow})` : '0'
              const remaining = `$E$${classRow}`
              const extra = `IF(AND(F${row}>0,${laterBases}=0),MAX(${remaining}-$F$${classRow},0),0)`
              taxFormula = `IF(${remaining}<0,MAX(0,I${row}-MAX(0,-${remaining}-${laterFloors})),I${row}+IF((${editedRank})<=${remaining},1,0)+${extra})/100`
            } else {
              const rank = `IF($D$${classRow}=1,L${row},${editedRank})`
              const exactCents = bucket.taxableSubtotal * bucket.rate
              const floorCents = Math.floor(exactCents + 1e-9)
              set(`I${row}`, floorCents, style.precision, `INT(F${row}*(MIN(MAX(C${row},0),1)*100)+0.000000001)`)
              set(`J${row}`, Math.round((exactCents - floorCents) * 1e10) / 1e10, style.precision, `ROUND(F${row}*(MIN(MAX(C${row},0),1)*100)-I${row},10)`)
              set(`K${row}`, bucket.taxableSubtotal, style.money)
              set(`L${row}`, initialTaxPriorities.get(bucket.taxClassId)!.get(node.item.id)!)
              taxFormula = `(I${row}+IF((${rank})<=$E$${classRow},1,0))/100`
            }
          }
        }
        set(`G${row}`, node.allocations.find(candidate => candidate.taxClassId === bucket.taxClassId)?.taxAmount ?? bucket.taxAmount, style.money, taxFormula)
      }
    }
  }
  if (allocationClassRows.size) {
    set(`A${classHeaderRow - 1}`, exactAllocation ? labels.classControls : labels.legacyControls, style.section)
    const headings = exactAllocation
      ? [labels.classId, labels.taxClass, labels.rateScale, labels.rateNumerator, labels.remainingCents, labels.contributors]
      : [labels.classId, labels.taxClass, labels.originalRate, labels.unchanged, labels.remainingCents]
    headings.forEach((heading, index) => set(`${excelColumn(index + 1)}${classHeaderRow}`, heading, style.header))
  }
  for (const [taxClassId, row] of allocationClassRows) {
    const bucket = totals.taxBuckets.find(candidate => candidate.taxClassId === taxClassId)!
    const groups = `$H$${firstBucketRow}:$H$${bucketLastRow}`
    const contributions = roots.flatMap(node => node.buckets.filter(candidate => candidate.taxClassId === taxClassId))
    const floorCents = contributions.reduce((sum, contribution) => sum + (exactAllocation
      ? getExcelTaxQuota(contribution.taxableSubtotal, exactRates.get(taxClassId)!).cents
      : Math.floor(contribution.taxableSubtotal * bucket.rate + 1e-9)), 0)
    set(`A${row}`, taxClassNumber(taxClassId))
    set(`B${row}`, bucket.label)
    if (exactAllocation) {
      const rate = exactRates.get(taxClassId)!
      const input = `MIN(MAX($C$${taxRows.get(taxClassId)},0),1)`
      const numerator = `ROUND(${input}*C${row},0)`
      set(`C${row}`, rate.scale, style.precision)
      set(`D${row}`, rate.numerator, style.precision, `IF(${numerator}/C${row}=${input},${numerator},NA())`)
      if (contributions.length > 1) set(`F${row}`, contributions.length, style.precision)
    } else {
      const changedBases = `SUMPRODUCT(--(${groups}=A${row}),--($F$${firstBucketRow}:$F$${bucketLastRow}<>$K$${firstBucketRow}:$K$${bucketLastRow}))`
      set(`C${row}`, bucket.rate / 100, style.percent)
      set(`D${row}`, 1, style.precision, `IF(AND(${changedBases}=0,$C$${taxRows.get(taxClassId)}=C${row}),1,0)`)
    }
    if (contributions.length > 1) {
      set(`E${row}`, Math.round(bucket.taxAmount * 100) - floorCents, style.precision, `ROUND(${totalColumn}${taxRows.get(taxClassId)}*100,0)-SUMIF(${groups},A${row},$I$${firstBucketRow}:$I$${bucketLastRow})`)
    }
  }
  for (let row = helperTitleRow; row <= lastRow; row += 1) hiddenRows.add(row)
  return writeQuotationExcelWorkbook({
    sheetName: internal ? labels.internalSheet : labels.customerSheet,
    cells, widths, hiddenRows, lastRow, printLastRow: internal ? costTotalRow : grandTotalRow, printColumnCount: Math.max(columns.length, 6), mixedLabel: labels.mixed,
  })
}
