import { readFile } from 'node:fs/promises'

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { LINE_ITEMS_IMPORT_HEADERS } from './lineItemsCsv'
import { parseLineItemsXlsxImport } from './lineItemsXlsx'

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
    const visibleWorkbookText = decodeXmlEntities(Object.entries(files)
      .filter(([filePath]) => /^xl\/(?:worksheets|comments)\/.*\.xml$/.test(filePath))
      .map(([, value]) => strFromU8(value))
      .join('\n'))

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
    expect(visibleWorkbookText).toContain('Three steps')
    expect(visibleWorkbookText).toContain('只要三步')
    expect(visibleWorkbookText).toContain('这个项目下面有 1.1 和 1.2')
    expect(visibleWorkbookText).not.toMatch(/叶子行|leaf row/i)

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

    let populatedImportSheetXml = setCellValue(importSheetXml, 'A2', '<is><t>1</t></is>', 'inlineStr')
    populatedImportSheetXml = setCellValue(populatedImportSheetXml, 'B2', '<is><t>Test item</t></is>', 'inlineStr')
    populatedImportSheetXml = setCellValue(populatedImportSheetXml, 'D2', '<v>2</v>')
    populatedImportSheetXml = setCellValue(populatedImportSheetXml, 'F2', '<v>100</v>')
    const parsed = await parseLineItemsXlsxImport(zipSync({
      ...files,
      'xl/worksheets/sheet3.xml': strToU8(populatedImportSheetXml),
    }), 'USD')

    expect(parsed.rowCount).toBe(1)
    expect(parsed.items).toMatchObject([{
      name: 'Test item',
      quantity: 2,
      pricingMethod: 'manual_price',
      manualUnitPrice: 100,
      children: [],
    }])
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

function decodeXmlEntities(value: string) {
  return value.replace(/&#x([0-9a-f]+);|&#(\d+);/gi, (_match, hex: string, decimal: string) =>
    String.fromCodePoint(Number.parseInt(hex || decimal, hex ? 16 : 10)),
  )
}

function setCellValue(xml: string, cell: string, valueXml: string, type?: string) {
  const cellPattern = new RegExp(`<c\\b([^>]*\\br="${cell}"[^>]*)>[\\s\\S]*?<\\/c>`)
  const updated = xml.replace(cellPattern, (_match, attributes: string) => {
    const attributesWithoutType = attributes.replace(/\s+t="[^"]*"/, '')
    return `<c${attributesWithoutType}${type ? ` t="${type}"` : ''}>${valueXml}</c>`
  })

  if (updated === xml) throw new Error(`${cell} not found in template`)
  return updated
}
