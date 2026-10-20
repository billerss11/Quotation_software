import { strToU8, zipSync } from 'fflate'

export interface ExcelCell {
  value: string | number
  formula?: string
  style?: number
  error?: boolean
}

export interface ExcelWorksheet {
  sheetName: string
  cells: Map<string, ExcelCell>
  widths: number[]
  lastRow: number
  printLastRow: number
  printColumnCount: number
  paperSize?: number
  hiddenRows?: Set<number>
  hiddenColumns?: Set<number>
  state?: 'hidden' | 'veryHidden'
  merges?: string[]
  freezeRows?: number
  freezeColumns?: number
  headerRow?: number
  autoFilter?: string
  protected?: boolean
  validations?: {
    range: string
    formula: string
    errorTitle: string
    error: string
    promptTitle?: string
    prompt?: string
  }[]
  conditionalFormats?: { range: string; formula: string; kind: 'changed' | 'error' }[]
  rowHeights?: Map<number, number>
}

export const EXCEL_STYLE = {
  text: 0,
  title: 1,
  header: 2,
  money: 3,
  inputMoney: 4,
  inputNumber: 5,
  percent: 6,
  inputPercent: 7,
  section: 8,
  total: 9,
  note: 10,
  inputText: 11,
  precision: 12,
  inputPrecision: 13,
  mixedPercent: 14,
  textWrap: 15,
  warning: 16,
  date: 17,
  centered: 18,
  inputCenteredNumber: 19,
  centeredNote: 20,
} as const

export function excelColumn(column: number): string {
  let result = ''
  let remaining = column
  while (remaining > 0) {
    remaining -= 1
    result = String.fromCharCode(65 + remaining % 26) + result
    remaining = Math.floor(remaining / 26)
  }
  return result
}

export function excelSumFormula(references: string[]): string {
  if (!references.length) return '0'
  const terms: string[] = []
  let start = 0
  while (start < references.length) {
    let end = start
    const first = references[start]!.match(/^(\$?[A-Z]+)(\$?)(\d+)$/)
    if (first) {
      while (end + 1 < references.length) {
        const next = references[end + 1]!.match(/^(\$?[A-Z]+)(\$?)(\d+)$/)
        if (!next || next[1] !== first[1] || next[2] !== first[2] || Number(next[3]) !== Number(first[3]) + end - start + 1) break
        end += 1
      }
    }
    terms.push(end > start ? `${references[start]}:${references[end]}` : references[start]!)
    start = end + 1
  }
  if (terms.length <= 200) return `SUM(${terms.join(',')})`
  const chunks: string[] = []
  for (let index = 0; index < terms.length; index += 200) chunks.push(`SUM(${terms.slice(index, index + 200).join(',')})`)
  return excelSumFormula(chunks)
}

function escapeXml(value: string) {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

const namespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const relNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const inputStyles: number[] = [EXCEL_STYLE.inputMoney, EXCEL_STYLE.inputNumber, EXCEL_STYLE.inputPercent, EXCEL_STYLE.inputText, EXCEL_STYLE.inputPrecision, EXCEL_STYLE.inputCenteredNumber]
const styleDefinitions = [
  [0, 0, 0], [1, 0, 0], [2, 2, 0], [0, 0, 164], [3, 3, 164],
  [3, 3, 0], [0, 0, 165], [3, 3, 165], [1, 4, 0], [1, 4, 164],
  [4, 0, 0], [3, 3, 0], [0, 0, 166], [3, 3, 166], [0, 0, 167],
  [0, 0, 0], [0, 5, 0], [0, 0, 168],
  [0, 0, 0], [3, 3, 0], [4, 0, 0],
]

function columnIndex(address: string) {
  return Array.from(address.replace(/\d/g, ''))
    .reduce((result, character) => result * 26 + character.charCodeAt(0) - 64, 0)
}

function writeWorksheet(sheet: ExcelWorksheet) {
  const rows = new Map<number, [string, ExcelCell][]>()
  for (const [address, cell] of sheet.cells) {
    const row = Number(address.match(/\d+$/)?.[0])
    const cells = rows.get(row) ?? []
    cells.push([address, cell])
    rows.set(row, cells)
  }
  for (const row of sheet.rowHeights?.keys() ?? []) if (!rows.has(row)) rows.set(row, [])
  const lastColumn = excelColumn(Math.max(1, sheet.widths.length))
  const merges = sheet.merges ?? []
  const mergedWidths = new Map<string, number>()
  for (const merge of merges) {
    const [start, end] = merge.split(':')
    if (!start || !end || start.match(/\d+$/)?.[0] !== end.match(/\d+$/)?.[0]) continue
    mergedWidths.set(start, sheet.widths.slice(columnIndex(start) - 1, columnIndex(end)).reduce((sum, width) => sum + width, 0))
  }
  const sheetData = Array.from(rows).sort(([left], [right]) => left - right).map(([row, cells]) => {
    const textHeight = cells.reduce((height, [address, cell]) => {
      if (typeof cell.value !== 'string' || !cell.value || sheet.hiddenColumns?.has(columnIndex(address))) return height
      const width = Math.max(1, (mergedWidths.get(address) ?? sheet.widths[columnIndex(address) - 1] ?? 17) - 2)
      const lines = cell.value.split(/\r?\n/).reduce((count, part) => count + Math.max(1, Math.ceil(Array.from(part).reduce((length, character) => length + (character.charCodeAt(0) > 255 ? 2 : 1), 0) / width)), 0)
      return Math.max(height, lines * 15 + 6)
    }, 21)
    const defaultHeight = row === sheet.headerRow || cells.some(([, cell]) => cell.style === EXCEL_STYLE.header) ? 36 : row === 1 ? 28 : 21
    const height = Math.min(409, sheet.rowHeights?.get(row) ?? Math.max(defaultHeight, textHeight))
    const content = cells.sort(([left], [right]) => columnIndex(left) - columnIndex(right)).map(([address, cell]) => {
      let style = cell.style ?? EXCEL_STYLE.text
      const inputIndex = inputStyles.indexOf(style)
      if (cell.formula !== undefined && inputIndex >= 0) style = styleDefinitions.length + inputIndex
      const attributes = `r="${address}" s="${style}"`
      const valueType = cell.error ? ' t="e"' : typeof cell.value === 'string' ? ' t="str"' : ''
      if (cell.formula !== undefined) {
        return `<c ${attributes}${valueType}><f>${escapeXml(cell.formula.replace(/^=/, ''))}</f><v>${escapeXml(String(cell.value))}</v></c>`
      }
      if (cell.error) return `<c ${attributes} t="e"><v>${escapeXml(String(cell.value))}</v></c>`
      if (typeof cell.value === 'number') return `<c ${attributes}><v>${cell.value}</v></c>`
      return `<c ${attributes} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`
    }).join('')
    return `<row r="${row}" ht="${height}" customHeight="1"${sheet.hiddenRows?.has(row) ? ' hidden="1"' : ''}>${content}</row>`
  }).join('')
  const freezeRows = Math.max(0, sheet.freezeRows ?? 0)
  const freezeColumns = Math.max(0, sheet.freezeColumns ?? 0)
  const activePane = freezeRows && freezeColumns ? 'bottomRight' : freezeRows ? 'bottomLeft' : 'topRight'
  const pane = freezeRows || freezeColumns ? `<pane${freezeColumns ? ` xSplit="${freezeColumns}"` : ''}${freezeRows ? ` ySplit="${freezeRows}"` : ''} topLeftCell="${excelColumn(freezeColumns + 1)}${freezeRows + 1}" activePane="${activePane}" state="frozen"/>` : ''
  const protection = sheet.protected === false ? '' : '<sheetProtection sheet="1" objects="1" scenarios="1" formatCells="1" formatColumns="1" formatRows="1" insertColumns="1" insertRows="1" deleteColumns="1" deleteRows="1" sort="1" autoFilter="0" pivotTables="1"/>'
  const autoFilter = sheet.autoFilter ? `<autoFilter ref="${escapeXml(sheet.autoFilter)}"/>` : ''
  const mergeCells = merges.length ? `<mergeCells count="${merges.length}">${merges.map(range => `<mergeCell ref="${escapeXml(range)}"/>`).join('')}</mergeCells>` : ''
  const conditionalFormats = (sheet.conditionalFormats ?? []).map((rule, index) => `<conditionalFormatting sqref="${escapeXml(rule.range)}"><cfRule type="expression" dxfId="${rule.kind === 'changed' ? 0 : 1}" priority="${index + 1}"><formula>${escapeXml(rule.formula.replace(/^=/, ''))}</formula></cfRule></conditionalFormatting>`).join('')
  const validations = sheet.validations?.length ? `<dataValidations count="${sheet.validations.length}">${sheet.validations.map(rule => `<dataValidation type="custom" errorStyle="stop" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="${escapeXml(rule.errorTitle)}" error="${escapeXml(rule.error)}"${rule.promptTitle ? ` promptTitle="${escapeXml(rule.promptTitle)}"` : ''}${rule.prompt ? ` prompt="${escapeXml(rule.prompt)}"` : ''} sqref="${escapeXml(rule.range)}"><formula1>${escapeXml(rule.formula.replace(/^=/, ''))}</formula1></dataValidation>`).join('')}</dataValidations>` : ''
  return `<worksheet xmlns="${namespace}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${lastColumn}${sheet.lastRow}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="21"/><cols>${sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"${sheet.hiddenColumns?.has(index + 1) ? ' hidden="1"' : ''}/>`).join('')}</cols><sheetData>${sheetData}</sheetData>${protection}${autoFilter}${mergeCells}${conditionalFormats}${validations}<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.15" footer="0.15"/><pageSetup paperSize="${sheet.paperSize ?? 9}" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;P / &amp;N</oddFooter></headerFooter></worksheet>`
}

function writeStyles(mixedLabel: string, centerMoney = false) {
  const formats = [
    '#,##0.00;(#,##0.00);0.00',
    '0.00%;(0.00%);0.00%',
    '#,##0.00####;(#,##0.00####);0.00',
    `"${mixedLabel.replace(/"/g, '""')} ("0.00%")"`,
    'yyyy-mm-dd',
  ]
  const definitions = [...styleDefinitions, ...inputStyles.map(index => styleDefinitions[index]!)]
  const centeredStyles: number[] = [
    EXCEL_STYLE.header, EXCEL_STYLE.centered, EXCEL_STYLE.inputCenteredNumber, EXCEL_STYLE.centeredNote,
    ...(centerMoney ? [EXCEL_STYLE.money, EXCEL_STYLE.total, EXCEL_STYLE.precision] : []),
  ]
  const styles = definitions.map(([font, fill, format], index) => {
    const originalStyle = index < styleDefinitions.length ? index : inputStyles[index - styleDefinitions.length]!
    return `<xf numFmtId="${format}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyFill="1" applyNumberFormat="1" applyAlignment="1" applyProtection="1"><alignment vertical="center"${centeredStyles.includes(originalStyle) ? ' horizontal="center"' : ''}${format === 0 && font !== 1 ? ' wrapText="1"' : ''}/><protection locked="${inputStyles.includes(index) ? 0 : 1}"/></xf>`
  }).join('')
  const fill = (color: string) => `<fill><patternFill patternType="solid"><fgColor rgb="${color}"/><bgColor indexed="64"/></patternFill></fill>`
  return `<styleSheet xmlns="${namespace}"><numFmts count="${formats.length}">${formats.map((format, index) => `<numFmt numFmtId="${164 + index}" formatCode="${escapeXml(format)}"/>`).join('')}</numFmts><fonts count="5"><font><sz val="10"/><color rgb="FF202D39"/><name val="Arial"/></font><font><b/><sz val="12"/><color rgb="FF173A4A"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><sz val="10"/><color rgb="FF1763B0"/><name val="Arial"/></font><font><sz val="9"/><color rgb="FF657480"/><name val="Arial"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill('FF173A4A')}${fill('FFF3F8FE')}${fill('FFE8F0F2')}${fill('FFFFF2CC')}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${definitions.length}">${styles}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="2"><dxf>${fill('FFFFF2CC')}</dxf><dxf>${fill('FFFCE4D6')}</dxf></dxfs></styleSheet>`
}

export function writeQuotationExcelWorkbook(options: ((ExcelWorksheet & { mixedLabel: string }) | { sheets: ExcelWorksheet[]; mixedLabel: string }) & { centerMoney?: boolean }) {
  const sheets = 'sheets' in options ? options.sheets : [{
    ...options,
    merges: options.merges ?? [`A5:${excelColumn(options.widths.length)}5`],
    freezeRows: options.freezeRows ?? 6,
    freezeColumns: options.freezeColumns ?? 2,
    headerRow: options.headerRow ?? 6,
  }]
  const relationship = (id: string, type: string, target: string) => `<Relationship Id="${id}" Type="${relNamespace}/${type}" Target="${target}"/>`
  const relationshipFile = (content: string) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${content}</Relationships>`
  const sheetEntries = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.sheetName)}" sheetId="${index + 1}" r:id="rId${index + 1}"${sheet.state ? ` state="${sheet.state}"` : ''}/>`).join('')
  const definedNames = sheets.map((sheet, index) => {
    const name = escapeXml(sheet.sheetName.replace(/'/g, "''"))
    return `<definedName name="_xlnm.Print_Area" localSheetId="${index}">'${name}'!$A$1:$${excelColumn(sheet.printColumnCount)}$${sheet.printLastRow}</definedName>${sheet.headerRow ? `<definedName name="_xlnm.Print_Titles" localSheetId="${index}">'${name}'!$${sheet.headerRow}:$${sheet.headerRow}</definedName>` : ''}`
  }).join('')
  const files: Record<string, string> = {
    '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_sheet, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': relationshipFile(relationship('rId1', 'officeDocument', 'xl/workbook.xml')),
    'xl/workbook.xml': `<workbook xmlns="${namespace}" xmlns:r="${relNamespace}"><sheets>${sheetEntries}</sheets><definedNames>${definedNames}</definedNames><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`,
    'xl/_rels/workbook.xml.rels': relationshipFile(sheets.map((_sheet, index) => relationship(`rId${index + 1}`, 'worksheet', `worksheets/sheet${index + 1}.xml`)).join('') + relationship(`rId${sheets.length + 1}`, 'styles', 'styles.xml')),
    'xl/styles.xml': writeStyles(options.mixedLabel, options.centerMoney),
  }
  sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = writeWorksheet(sheet) })
  return zipSync(Object.fromEntries(Object.entries(files).map(([path, xml]) => [path, strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xml}`)])))
}
