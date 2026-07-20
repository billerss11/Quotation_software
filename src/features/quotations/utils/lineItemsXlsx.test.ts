import { readFile } from 'node:fs/promises'

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { CsvImportError } from './lineItemsCsv'
import { parseLineItemsXlsxImport } from './lineItemsXlsx'

describe('line item XLSX import', () => {
  it('parses the exact Import Data sheet with hierarchy and bilingual text', async () => {
    const result = await parseFixture('valid-line-items.xlsx')

    expect(result.rowCount).toBe(3)
    expect(result.recognizedColumns).toEqual([
      'item_code',
      'item_name',
      'item_description',
      'qty',
      'qty_unit',
      'manual_unit_price',
      'unit_cost',
      'cost_currency',
      'markup_override',
      'tax_class',
    ])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      name: '设备 Equipment',
      description: '中英文说明 Bilingual description',
      children: [
        {
          name: '摄像机 Camera',
          description: '室外 Outdoor',
          pricingMethod: 'manual_price',
          manualUnitPrice: 199.5,
        },
        {
          name: '安装 Installation',
          description: '现场服务 Field service',
          pricingMethod: 'cost_plus',
          unitCost: 100,
          costCurrency: 'CNY',
          markupRate: 15,
        },
      ],
    })
  })

  it('requires a sheet named exactly Import Data', async () => {
    await expect(parseFixture('missing-import-sheet.xlsx')).rejects.toMatchObject({
      code: 'missing_import_sheet',
    })
  })

  it('requires the exact template headers in row one', async () => {
    await expect(parseFixture('wrong-headers.xlsx')).rejects.toMatchObject({
      code: 'invalid_headers',
    })
  })

  it('rejects corrupt workbook bytes', async () => {
    await expect(parseFixture('corrupt.xlsx')).rejects.toMatchObject({
      code: 'invalid_workbook',
    })
  })

  it('rejects oversized compressed workbook input before parsing', async () => {
    const oversizedContent = new Uint8Array(10 * 1024 * 1024 + 1)

    await expect(parseLineItemsXlsxImport(oversizedContent, 'USD')).rejects.toMatchObject({
      code: 'invalid_workbook',
    })
  })

  it('rejects workbooks with excessive uncompressed XML', async () => {
    const content = new Uint8Array(await readFile(new URL('./fixtures/valid-line-items.xlsx', import.meta.url)))
    const files = unzipSync(content)
    files['xl/worksheets/oversized.xml'] = new Uint8Array(17 * 1024 * 1024)

    await expect(parseLineItemsXlsxImport(zipSync(files), 'USD')).rejects.toMatchObject({
      code: 'invalid_workbook',
    })
  })

  it('rejects unsupported cell values with their cell address', async () => {
    await expect(parseFixture('unsupported-boolean.xlsx')).rejects.toMatchObject({
      code: 'unsupported_cell_type',
      row: 2,
      column: 'B2',
    })
  })

  it('uses the shared row validator for empty workbooks and row errors', async () => {
    await expect(parseFixture('empty-data.xlsx')).rejects.toSatisfy((error: unknown) =>
      error instanceof CsvImportError
      && error.issues.some(issue => issue.code === 'no_data_rows'),
    )
    await expect(parseFixture('row-error.xlsx')).rejects.toSatisfy((error: unknown) =>
      error instanceof CsvImportError
      && error.issues.some(issue => issue.code === 'missing_item_name'),
    )
  })

  it('rejects formulas instead of using their cached values', async () => {
    await expect(parseFixture('formula.xlsx')).rejects.toMatchObject({
      code: 'unsupported_formula',
      row: 2,
      column: 'B2',
    })

    await expect(parseFixtureWithWorksheetXml('valid-line-items.xlsx', xml =>
      xml.replace(
        /<c r="B2"[^>]*>[\s\S]*?<\/c>/,
        '<c r="B2" t="str"><f>CONCAT("Cached"," value")</f><v>Cached value</v></c>',
      ),
    )).rejects.toMatchObject({
      code: 'unsupported_formula',
      row: 2,
      column: 'B2',
    })
  })

  it('decodes XML entities exactly once', async () => {
    const result = await parseFixtureWithWorksheetXml('valid-line-items.xlsx', xml =>
      xml
        .replace('&#35774;&#22791; Equipment', 'R&amp;D &lt;Equipment&gt; &#x4E2D;')
        .replace(
          '&#20013;&#33521;&#25991;&#35828;&#26126; Bilingual description',
          'Literal &amp;#65; &amp;amp; &quot;quoted&quot; &apos;single&apos;',
        ),
    )

    expect(result.items[0]).toMatchObject({
      name: 'R&D <Equipment> 中',
      description: 'Literal &#65; &amp; "quoted" \'single\'',
    })
    expect(result.items[0]?.children[0]?.name).toBe('摄像机 Camera')
  })

  it('converts Excel percentage-formatted markup to percentage points', async () => {
    const content = new Uint8Array(await readFile(new URL('./fixtures/valid-line-items.xlsx', import.meta.url)))
    const files = unzipSync(content)
    const worksheetPath = 'xl/worksheets/sheet1.xml'
    const stylesPath = 'xl/styles.xml'
    const worksheet = files[worksheetPath]
    const styles = files[stylesPath]

    if (!worksheet || !styles) throw new Error('Fixture worksheet or styles file is missing')

    files[worksheetPath] = strToU8(strFromU8(worksheet).replace(
      /(<row r="2"[\s\S]*?)(<\/row>)/,
      '$1<c r="I2" s="1" t="n"><v>0.15</v></c>$2',
    ))
    files[stylesPath] = strToU8(strFromU8(styles).replace(
      /<cellXfs count="1">([\s\S]*?)<\/cellXfs>/,
      '<cellXfs count="2">$1<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>',
    ))

    const result = await parseLineItemsXlsxImport(zipSync(files), 'USD')

    expect(result.items[0]?.markupRate).toBe(15)
  })

  it('preserves shared row validation warnings', async () => {
    const result = await parseFixture('row-warning.xlsx')

    expect(result.items[0]).toMatchObject({ name: 'Standalone 独立项' })
    expect(result.warnings.map(warning => warning.code)).toEqual([
      'missing_item_code_assigned',
      'missing_qty_unit_defaulted',
    ])
  })
})

async function parseFixture(fileName: string) {
  const content = new Uint8Array(await readFile(new URL(`./fixtures/${fileName}`, import.meta.url)))
  return parseLineItemsXlsxImport(content, 'USD')
}

async function parseFixtureWithWorksheetXml(fileName: string, transform: (xml: string) => string) {
  const content = new Uint8Array(await readFile(new URL(`./fixtures/${fileName}`, import.meta.url)))
  const files = unzipSync(content)
  const worksheetPath = 'xl/worksheets/sheet1.xml'
  const worksheet = files[worksheetPath]

  if (!worksheet) throw new Error(`${worksheetPath} not found in ${fileName}`)

  const xml = strFromU8(worksheet)
  const transformedXml = transform(xml)
  if (transformedXml === xml) throw new Error(`Worksheet transform did not change ${fileName}`)

  files[worksheetPath] = strToU8(transformedXml)
  return parseLineItemsXlsxImport(zipSync(files), 'USD')
}
