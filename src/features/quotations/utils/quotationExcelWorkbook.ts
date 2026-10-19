import { strToU8, zipSync } from 'fflate'

export interface ExcelCell {
  value: string | number
  formula?: string
  style?: number
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

export function writeQuotationExcelWorkbook(options: {
  sheetName: string
  cells: Map<string, ExcelCell>
  widths: number[]
  lastRow: number
  printLastRow: number
  printColumnCount: number
  hiddenRows: Set<number>
  mixedLabel: string
}) {
  const rows = new Map<number, [string, ExcelCell][]>()
  for (const [address, cell] of options.cells) {
    const row = Number(address.match(/\d+$/)?.[0])
    const cells = rows.get(row) ?? []
    cells.push([address, cell])
    rows.set(row, cells)
  }
  const lastColumn = excelColumn(options.widths.length)
  const printLastColumn = excelColumn(options.printColumnCount)
  const sheetData = Array.from(rows).sort(([left], [right]) => left - right).map(([row, cells]) => {
    const itemText = cells.find(([address]) => address === `B${row}`)?.[1].value
    const textLines = typeof itemText === 'string' ? itemText.split('\n').reduce((lines, part) => lines + Math.max(1, Math.ceil(Array.from(part).reduce((length, character) => length + (character.charCodeAt(0) > 255 ? 2 : 1), 0) / (options.widths[1] ?? 38))), 0) : 1
    const height = row === 1 ? ' ht="28" customHeight="1"' : cells.some(([, cell]) => cell.style === EXCEL_STYLE.header) || row === 5 ? ' ht="32" customHeight="1"' : textLines > 1 ? ` ht="${textLines * 16}" customHeight="1"` : ''
    const content = cells.sort(([left], [right]) => {
      const columnIndex = (address: string) => Array.from(address.replace(/\d/g, ''))
        .reduce((result, character) => result * 26 + character.charCodeAt(0) - 64, 0)
      return columnIndex(left) - columnIndex(right)
    }).map(([address, cell]) => {
      const attributes = `r="${address}" s="${cell.style ?? 0}"`
      if (cell.formula !== undefined) {
        return `<c ${attributes}${typeof cell.value === 'string' ? ' t="str"' : ''}><f>${escapeXml(cell.formula)}</f><v>${escapeXml(String(cell.value))}</v></c>`
      }
      if (typeof cell.value === 'number') return `<c ${attributes}><v>${cell.value}</v></c>`
      return `<c ${attributes} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`
    }).join('')
    return `<row r="${row}"${height}${options.hiddenRows.has(row) ? ' hidden="1"' : ''}>${content}</row>`
  }).join('')
  const namespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  const relNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const worksheet = `<worksheet xmlns="${namespace}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${lastColumn}${options.lastRow}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="2" ySplit="6" topLeftCell="C7" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="21"/><cols>${options.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetData}</sheetData><mergeCells count="1"><mergeCell ref="A5:${lastColumn}5"/></mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;P / &amp;N</oddFooter></headerFooter></worksheet>`
  const formats = [
    '#,##0.00;(#,##0.00);–',
    '0.00%;(0.00%);0.00%',
    '#,##0.00####;(#,##0.00####);–',
    `"${options.mixedLabel} ("0.00%")"`,
  ]
  const styles = [
    [0, 0, 0], [1, 0, 0], [2, 2, 0], [0, 0, 164], [3, 3, 164],
    [3, 3, 0], [0, 0, 165], [3, 3, 165], [1, 4, 0], [1, 4, 164],
    [4, 0, 0], [3, 3, 0], [0, 0, 166], [3, 3, 166], [0, 0, 167],
  ].map(([font, fill, format]) => `<xf numFmtId="${format}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"${format === 0 && font !== 1 ? ' wrapText="1"' : ''}/></xf>`).join('')
  const stylesXml = `<styleSheet xmlns="${namespace}"><numFmts count="4">${formats.map((format, index) => `<numFmt numFmtId="${164 + index}" formatCode="${escapeXml(format)}"/>`).join('')}</numFmts><fonts count="5"><font><sz val="10"/><color rgb="FF202D39"/><name val="Arial"/></font><font><b/><sz val="12"/><color rgb="FF173A4A"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><sz val="10"/><color rgb="FF1763B0"/><name val="Arial"/></font><font><sz val="9"/><color rgb="FF657480"/><name val="Arial"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173A4A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F8FE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F0F2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="15">${styles}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  const relationship = (id: string, type: string, target: string) => `<Relationship Id="${id}" Type="${relNamespace}/${type}" Target="${target}"/>`
  const relationshipFile = (content: string) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${content}</Relationships>`
  const files = {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': relationshipFile(relationship('rId1', 'officeDocument', 'xl/workbook.xml')),
    'xl/workbook.xml': `<workbook xmlns="${namespace}" xmlns:r="${relNamespace}"><sheets><sheet name="${escapeXml(options.sheetName)}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'${escapeXml(options.sheetName.replace(/'/g, "''"))}'!$A$1:$${printLastColumn}$${options.printLastRow}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">'${escapeXml(options.sheetName.replace(/'/g, "''"))}'!$6:$6</definedName></definedNames><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`,
    'xl/_rels/workbook.xml.rels': relationshipFile(relationship('rId1', 'worksheet', 'worksheets/sheet1.xml') + relationship('rId2', 'styles', 'styles.xml')),
    'xl/worksheets/sheet1.xml': worksheet,
    'xl/styles.xml': stylesXml,
  }
  return zipSync(Object.fromEntries(Object.entries(files).map(([path, xml]) => [path, strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xml}`)])))
}
