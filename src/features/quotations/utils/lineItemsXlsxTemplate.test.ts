import { readFile } from 'node:fs/promises'

import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { LINE_ITEMS_IMPORT_HEADERS } from './lineItemsCsv'

describe('canonical line-item XLSX template', () => {
  it('keeps its sheets, tables, headers, names, validations, and input formats', async () => {
    const content = new Uint8Array(await readFile(new URL(
      '../../../../file/templates/quotation-line-items-template.xlsx',
      import.meta.url,
    )))
    const files = unzipSync(content)
    const workbookXml = readXml(files, 'xl/workbook.xml')
    const importSheetXml = readXml(files, 'xl/worksheets/sheet3.xml')
    const importTableXml = readXml(files, 'xl/tables/table1.xml')
    const exampleTableXml = readXml(files, 'xl/tables/table2.xml')
    const stylesXml = readXml(files, 'xl/styles.xml')
    const worksheetXml = Object.entries(files)
      .filter(([filePath]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(filePath))
      .map(([, value]) => strFromU8(value))

    expect(findXmlTags(workbookXml, 'sheet').map(tag => getXmlAttribute(tag, 'name'))).toEqual([
      'Instructions 使用说明',
      '_Lists',
      'Import Data',
      'Examples 示例',
    ])
    expect(workbookXml).toContain('<definedName name="QuantityUnits">')
    expect(workbookXml).toContain('<definedName name="CurrencyCodes">')

    expect(getXmlAttribute(importTableXml, 'name')).toBe('ImportDataTable')
    expect(getXmlAttribute(importTableXml, 'ref')).toBe('A1:J2')
    expect(findXmlTags(importTableXml, 'autoFilter')).toHaveLength(1)
    expect(getXmlAttribute(exampleTableXml, 'name')).toBe('ExampleDataTable')
    expect(getXmlAttribute(exampleTableXml, 'ref')).toBe('A1:J4')
    expect(findXmlTags(exampleTableXml, 'autoFilter')).toHaveLength(1)
    expect(findXmlTags(importTableXml, 'tableColumn').map(tag => getXmlAttribute(tag, 'name')))
      .toEqual([...LINE_ITEMS_IMPORT_HEADERS])

    expect(findXmlTags(importSheetXml, 'dataValidation')).toHaveLength(6)
    expect(importSheetXml).not.toContain('sqref="E2:E1001"')
    expect(worksheetXml.every(xml => findXmlTags(xml, 'autoFilter').length === 0)).toBe(true)
    expect(worksheetXml.every(xml => findXmlTags(xml, 'f').length === 0)).toBe(true)
    expect(worksheetXml.every(xml => !/<c\b[^>]*\bt="e"/i.test(xml))).toBe(true)

    const cellXfs = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/i)?.[1] ?? ''
    const inputStyles = findXmlTags(cellXfs, 'xf')
    const itemCodeCell = findXmlTags(importSheetXml, 'c').find(tag => getXmlAttribute(tag, 'r') === 'A2') ?? ''
    const quantityCell = findXmlTags(importSheetXml, 'c').find(tag => getXmlAttribute(tag, 'r') === 'D2') ?? ''
    const itemCodeStyleId = Number(getXmlAttribute(itemCodeCell, 's'))
    const quantityStyleId = Number(getXmlAttribute(quantityCell, 's'))
    const itemCodeColumn = findXmlTags(importSheetXml, 'col').find(tag =>
      getXmlAttribute(tag, 'min') === '1' && getXmlAttribute(tag, 'max') === '1',
    ) ?? ''

    expect(getXmlAttribute(inputStyles[itemCodeStyleId] ?? '', 'numFmtId')).toBe('49')
    expect(getXmlAttribute(inputStyles[quantityStyleId] ?? '', 'numFmtId')).toBe('0')
    expect(getXmlAttribute(itemCodeColumn, 'style')).toBe(String(itemCodeStyleId))
  })
})

function readXml(files: Record<string, Uint8Array>, filePath: string) {
  const content = files[filePath]
  if (!content) throw new Error(`${filePath} not found in template`)
  return strFromU8(content)
}

function findXmlTags(xml: string, localName: string) {
  return xml.match(new RegExp(`<(?:[a-z_][\\w.-]*:)?${localName}\\b[^>]*\\/?>`, 'gi')) ?? []
}

function getXmlAttribute(tag: string, attributeName: string) {
  const match = new RegExp(`(?:^|\\s)${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)
  return match?.[1] ?? match?.[2]
}
