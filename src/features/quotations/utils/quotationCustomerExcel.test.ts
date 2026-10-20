import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { messages } from '../../../shared/i18n/messages'
import { getQuotationExcelWorkbookLabels } from '../../../shared/i18n/quotationExcelWorkbook'
import type { SupportedLocale } from '../../../shared/i18n/locale'
import type { QuotationDraft, QuotationItem, QuotationOutputItemDetailLevel, TaxMode } from '../types'
import { formatChineseCurrencyAmount } from './chineseCurrencyAmount'
import { createCalculationTotalsConfig, formatTaxRatePercentage } from './quotationTaxes'
import { createInitialQuotation } from './quotationDraft'
import { getMixedTaxDocumentColumnDefinitions, MIXED_TAX_DOCUMENT_COLUMNS } from './quotationDocumentColumns'
import { EMPTY_QUOTATION_PREVIEW_ROW_PRICING, getMixedTaxDocumentColumnValue, getQuotationPreviewRowAmount, getQuotationPreviewRowUnitPrice } from './quotationDocumentColumnValues'
import { createQuotationExcelWorkbook } from './quotationExcelExport'
import { createQuotationItem } from './quotationItems'
import { createQuotationPreviewRowPricingMap } from './quotationPreviewPricing'
import { createQuotationPreviewRows } from './quotationPreviewRows'
import { createQuotationSnapshotPayload } from './quotationSnapshotPayload'
import { getQuotationSections, getQuotationSummaryItems, resolveQuotationInformationalTotals } from './quotationSummaryDisplay'

function translate(locale: SupportedLocale, key: string, params: Record<string, string> = {}) {
  let value: unknown = messages[locale]
  for (const part of key.split('.')) value = (value as Record<string, unknown>)[part]
  return String(value).replace(/\{(\w+)\}/g, (placeholder, name: string) => params[name] ?? placeholder)
}

function decode(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function readCustomer(draft: QuotationDraft, locale: SupportedLocale = draft.header.documentLocale) {
  const files = Object.fromEntries(Object.entries(unzipSync(createQuotationExcelWorkbook(draft, 'customer', locale))).map(([path, bytes]) => [path, strFromU8(bytes)]))
  const xml = files['xl/worksheets/sheet1.xml']!
  const cells = new Map<string, { value: string | number; style: number }>()
  for (const match of xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
    const text = match[2]!.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1]
    const value = match[2]!.match(/<v>([\s\S]*?)<\/v>/)?.[1]
    cells.set(match[1]!.match(/\br="([^"]+)"/)![1]!, {
      value: text === undefined ? Number(value) : decode(text),
      style: Number(match[1]!.match(/\bs="(\d+)"/)?.[1] ?? 0),
    })
  }
  const rows = new Map<number, (string | number)[]>()
  for (const [address, cell] of cells) {
    const row = Number(address.match(/\d+$/)![0])
    const column = [...address.replace(/\d/g, '')].reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 64, 0)
    const values = rows.get(row) ?? []
    values[column - 1] = cell.value
    rows.set(row, values)
  }
  const t = (key: string) => translate(locale, key)
  const header = [...rows].find(([, row]) => [t('quotations.document.table.no'), t('quotations.document.table.noShort')].includes(String(row[0])) && row[1] === t('quotations.document.table.description'))
  expect(header, 'Quotation item headings missing').toBeDefined()
  const widths = [...xml.matchAll(/<col\b[^>]*\bwidth="([^"]+)"/g)].map(match => Number(match[1]))
  return { files, xml, cells, rows, widths, header: header!, allXml: Object.values(files).join('\n') }
}

function fixture(locale: SupportedLocale = 'en-US', detail: QuotationOutputItemDetailLevel = 3, taxMode: TaxMode = 'mixed') {
  const draft = createInitialQuotation([], locale)
  draft.header.currency = 'USD'
  draft.header.quotationNumber = 'Q-PUBLIC-123'
  draft.header.projectName = 'Public project'
  draft.header.customerCompany = 'Public customer'
  draft.header.contactPerson = 'Public contact'
  draft.header.contactDetails = 'contact@example.com'
  draft.header.validityPeriod = '30 days'
  draft.header.notes = 'Public quotation notes'
  draft.header.terms = 'Public payment terms'
  draft.companyProfileSnapshot.companyName = 'Public supplier'
  draft.companyProfileSnapshot.email = 'supplier@example.com'
  draft.companyProfileSnapshot.phone = '+86 12345'
  draft.exchangeRates = { USD: 1, EUR: 1.0854321 }
  draft.totalsConfig = {
    globalMarkupRate: 17.654321,
    taxAllocationVersion: 2,
    taxMode,
    taxClasses: [{ id: 'standard', label: 'Standard', rate: 13.37 }, { id: 'reduced', label: 'Reduced', rate: 5 }],
    defaultTaxClassId: 'standard',
    mixedTaxColumns: [...MIXED_TAX_DOCUMENT_COLUMNS],
    extraCharges: [{ id: 'freight', label: 'Freight', amount: 12.5 }],
  }
  draft.majorItems = [
    { id: 'supply', kind: 'section_header', title: 'Public supply section' },
    createQuotationItem('USD', { id: 'package', name: 'Public package', description: 'Package description', quantity: 1.5, children: [
      createQuotationItem('USD', { id: 'assembly', name: 'Public assembly', description: 'Assembly description', quantity: 2.5, children: [
        createQuotationItem('EUR', { id: 'motor', name: 'Public motor', description: 'Motor description', quantity: 3, unitCost: 1234.567891, markupRate: 37.654321, notes: 'INTERNAL_ITEM_NOTE' }),
        createQuotationItem('USD', { id: 'service', name: 'Public service', description: 'Service description', quantity: 2, unitCost: 0, pricingMethod: 'manual_price', manualUnitPrice: 8.555, taxClassId: taxMode === 'mixed' ? 'reduced' : 'standard' }),
      ] }),
    ] }),
    createQuotationItem('USD', { id: 'zero', name: 'Zero quantity', description: 'Zero quantity description', quantity: 0, pricingMethod: 'manual_price', manualUnitPrice: 25, unitCost: 4321.987654 }),
    createQuotationItem('USD', { id: 'small', name: 'Small valve', description: 'Small valve description', quantity: 2.75, unitCost: 0.013, markupRate: 0 }),
  ]
  draft.outputSettings = { itemDetailLevel: detail }
  return draft
}

function expectSummary(workbook: ReturnType<typeof readCustomer>, label: string, expected: number | null) {
  const matches = [...workbook.rows.values()].filter(row => row.some(value => value === label))
  expect(matches.length, `Missing summary ${label}`).toBeGreaterThan(0)
  const numbers = matches.flatMap(row => row.filter((value): value is number => typeof value === 'number'))
  if (expected === null) expect(numbers).toEqual([])
  else expect(numbers).toContain(expected)
}

function expectDocumentRows(draft: QuotationDraft, locale: SupportedLocale) {
  const source = structuredClone(draft)
  const snapshot = createQuotationSnapshotPayload(draft)
  const detail = draft.outputSettings?.itemDetailLevel
  const expectedRows = createQuotationPreviewRows(draft.majorItems, snapshot.summaries, { itemDetailLevel: detail })
  const pricing = createQuotationPreviewRowPricingMap(draft.majorItems, snapshot.globalMarkupRate, snapshot.exchangeRates,
    createCalculationTotalsConfig(draft.totalsConfig), { itemDetailLevel: detail })
  const workbook = readCustomer(draft, locale)
  const columns = getMixedTaxDocumentColumnDefinitions(draft.totalsConfig.mixedTaxColumns)
  const mixed = draft.totalsConfig.taxMode === 'mixed'
  expect(workbook.header[1]).toHaveLength(mixed ? 4 + columns.length : 6)
  if (mixed) columns.forEach((column, index) => {
    const heading = [translate(locale, column.headerLabelKey), locale === 'en-US' && column.headerNoteKey ? translate(locale, column.headerNoteKey) : ''].filter(Boolean).join('\n')
    expect(workbook.header[1][index + 4]).toBe(heading)
  })
  const labels = {
    mixed: translate(locale, 'quotations.document.mixedTax'),
    mixedEffective: (rate: string) => translate(locale, 'quotations.document.mixedTaxEffective', { rate }),
  }
  let cursor = workbook.header[0]
  for (const expected of expectedRows) {
    const actual = [...workbook.rows].find(([row, values]) => row > cursor && (expected.type === 'section'
      ? values.includes(expected.description) : String(values[0]) === expected.itemNumber))
    expect(actual, `Missing preview row ${expected.key}`).toBeDefined()
    cursor = actual![0]
    const values = actual![1]
    const description = expected.type === 'section' ? String(values.find(value => value === expected.description)) : String(values[1])
    expect(description).toContain(expected.description)
    if (expected.detail) expect(description).toContain(expected.detail)
    if (expected.type === 'section') continue
    expect(values[2] ?? '').toBe(expected.quantity ?? '')
    expect(values[3] ?? '').toBe(expected.quantityUnit)
    const rowPricing = pricing.get(expected.key) ?? EMPTY_QUOTATION_PREVIEW_ROW_PRICING
    const figures = mixed ? columns.map(column => getMixedTaxDocumentColumnValue(column.id, expected, rowPricing, labels).value)
      : [getQuotationPreviewRowUnitPrice(expected, rowPricing), getQuotationPreviewRowAmount(expected, rowPricing)]
    figures.forEach((value, index) => expect(values[index + 4] ?? '', `${expected.key}: column ${index + 5}`).toBe(value ?? ''))
  }
  expectSummary(workbook, translate(locale, 'quotations.document.subtotal'), snapshot.totals.subtotalAfterMarkup)
  if (mixed) {
    for (const bucket of snapshot.totals.taxBuckets.filter(bucket => bucket.taxableSubtotal > 0)) {
      expectSummary(workbook, translate(locale, 'quotations.document.taxBucket', { label: bucket.label }), bucket.taxAmount)
    }
  } else if (snapshot.totals.taxAmount > 0) {
    const tax = draft.totalsConfig.taxClasses!.find(item => item.id === draft.totalsConfig.defaultTaxClassId) ?? draft.totalsConfig.taxClasses![0]!
    expectSummary(workbook, translate(locale, 'quotations.document.taxWithRate', { rate: formatTaxRatePercentage(tax.rate) }), snapshot.totals.taxAmount)
  }
  expectSummary(workbook, translate(locale, 'quotations.document.total'), snapshot.totals.grandTotal)
  expect(draft).toEqual(source)
  return workbook
}

describe('customer quotation Excel document', () => {
  it.each(['en-US', 'zh-CN'] as const)('exports an ordinary values-only document in %s', locale => {
    const workbook = readCustomer(fixture(locale), locale)
    const sheets = [...workbook.files['xl/workbook.xml']!.matchAll(/<sheet\b[^>]*\/>/g)]
    expect(sheets).toHaveLength(1)
    expect(sheets[0]![0]).toContain(`name="${getQuotationExcelWorkbookLabels(locale).customerSheet}"`)
    expect(Object.keys(workbook.files).filter(path => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))).toHaveLength(1)
    expect(workbook.allXml).not.toMatch(/<f>|<sheetProtection\b|<dataValidation\b|<conditionalFormatting\b|state="(?:hidden|veryHidden)"/)
    expect([...workbook.cells.values()].some(cell => [4, 5, 7, 11, 13].includes(cell.style))).toBe(false)
    const labels = getQuotationExcelWorkbookLabels(locale)
    for (const control of [labels.newQuantity, labels.newPrice, labels.revisedTotal, labels.newCost, labels.newFx]) expect(workbook.allXml).not.toContain(control)
  })

  it.each([1, 2, 3] as const)('matches PDF item visibility and values at detail level %s', detail => {
    for (const locale of ['en-US', 'zh-CN'] as const) for (const mode of ['single', 'mixed'] as const) expectDocumentRows(fixture(locale, detail, mode), locale)
  })

  it.each(['en-US', 'zh-CN'] as const)('respects a partial or empty mixed-tax column selection in %s', locale => {
    for (const selection of [['grossAmount', 'taxRate'], []] as const) {
      const draft = fixture(locale)
      draft.totalsConfig.mixedTaxColumns = [...selection]
      expectDocumentRows(draft, locale)
    }
  })

  it.each(['en-US', 'zh-CN'] as const)('includes the public document context, custom summary and visible informational totals in %s', locale => {
    const draft = fixture(locale)
    draft.outputSettings = {
      itemDetailLevel: 1,
      subtotalLabel: 'Custom supply total',
      showInformationalTotals: true,
      informationalTotalsNote: 'Public informational note',
      informationalTotals: [
        { id: 'section', label: 'Supply breakdown', sectionIds: ['supply'], visible: true },
        { id: 'items', label: 'Selected scope', sectionIds: [], source: 'items', itemIds: ['package', 'motor'], visible: true },
        { id: 'hidden', label: 'HIDDEN_INFORMATIONAL_ROW', sectionIds: ['supply'], visible: false },
      ],
    }
    const snapshot = createQuotationSnapshotPayload(draft)
    const informationals = resolveQuotationInformationalTotals(draft.outputSettings,
      getQuotationSections(draft.majorItems, snapshot.summaries), getQuotationSummaryItems(draft, snapshot.summaries))
    const workbook = readCustomer(draft, locale)
    expectSummary(workbook, 'Custom supply total', snapshot.totals.subtotalAfterMarkup)
    expectSummary(workbook, 'Freight', 12.5)
    expectSummary(workbook, translate(locale, 'quotations.document.total'), snapshot.totals.grandTotal)
    for (const row of informationals.filter(row => row.isVisible)) expectSummary(workbook, row.label, row.amount)
    for (const text of [draft.header.quotationNumber, draft.header.customerCompany, draft.header.contactPerson,
      draft.header.contactDetails, draft.header.projectName, draft.header.validityPeriod, draft.companyProfileSnapshot.companyName,
      draft.companyProfileSnapshot.email, draft.companyProfileSnapshot.phone, draft.header.notes, draft.header.terms!, 'Public informational note']) expect(workbook.allXml).toContain(text)
    expect(workbook.allXml).not.toContain('HIDDEN_INFORMATIONAL_ROW')
  })

  it.each(['en-US', 'zh-CN'] as const)('uses the PDF default terms and informational note when omitted in %s', locale => {
    const draft = fixture(locale)
    draft.header.notes = ''
    draft.header.terms = ''
    draft.outputSettings = { itemDetailLevel: 1, subtotalLabel: 'Supply value', showInformationalTotals: true,
      informationalTotals: [{ id: 'supply', label: 'Supply breakdown', sectionIds: ['supply'], visible: true }] }
    const workbook = readCustomer(draft, locale)
    expect(workbook.allXml).toContain(translate(locale, 'quotations.document.defaultTerms'))
    expect(workbook.allXml).toContain(translate(locale, 'quotations.summaryDisplay.documentNote', { subtotalLabel: 'Supply value' }))
    draft.outputSettings.showInformationalTotals = false
    const disabled = readCustomer(draft, locale)
    expect(disabled.allXml).not.toContain('Supply breakdown')
    expect(disabled.allXml).not.toContain(translate(locale, 'quotations.summaryDisplay.documentTitle'))
  })

  it('rejects incomplete visible informational totals using the PDF output rules', () => {
    const draft = fixture()
    draft.outputSettings = { itemDetailLevel: 1, showInformationalTotals: true,
      informationalTotals: [{ id: 'missing', label: 'Unavailable scope', sectionIds: ['removed-section'], visible: true }] }
    expect(() => createQuotationExcelWorkbook(draft, 'customer')).toThrow()
    draft.outputSettings.informationalTotals![0]!.visible = false
    expect(() => createQuotationExcelWorkbook(draft, 'customer')).not.toThrow()
  })

  it('includes the Chinese amount in words using the quotation currency', () => {
    const draft = fixture('zh-CN')
    draft.header.currency = 'CNY'
    const snapshot = createQuotationSnapshotPayload(draft)
    const workbook = readCustomer(draft)
    expect(workbook.allXml).toContain(translate('zh-CN', 'quotations.document.amountInWords', {
      amount: formatChineseCurrencyAmount(snapshot.totals.grandTotal, 'CNY'),
    }))
    expect(workbook.allXml).toContain('人民币')
  })

  it.each(['en-US', 'zh-CN'] as const)('excludes internal and undisclosed data from every ZIP part in %s', locale => {
    const draft = fixture(locale, 1)
    const root = draft.majorItems[1] as QuotationItem
    root.children[0]!.name = 'UNDISCLOSED_CHILD_NAME'
    root.children[0]!.description = 'UNDISCLOSED_CHILD_DESCRIPTION'
    const workbook = readCustomer(draft, locale)
    for (const secret of ['INTERNAL_ITEM_NOTE', 'UNDISCLOSED_CHILD_NAME', 'UNDISCLOSED_CHILD_DESCRIPTION', 'Public motor',
      'Motor description', '1234.567891', '4321.987654', '37.654321', '17.654321', '1.0854321', 'EUR']) expect(workbook.allXml).not.toContain(secret)
    const labels = getQuotationExcelWorkbookLabels(locale)
    for (const label of [labels.costCurrency, labels.unitCost, labels.defaultMarkup, labels.exchangeRates]) expect(workbook.allXml).not.toContain(label)
  })

  it('preserves long descriptions across visible rows within Excel cell and row-height limits', () => {
    const draft = fixture()
    const description = '长说明 SCOPE-0123456789 '.repeat(2000)
    ;(draft.majorItems[1] as QuotationItem).description = description
    const workbook = readCustomer(draft)
    const descriptionCells = [...workbook.cells].filter(([address]) => /^B\d+$/.test(address)).map(([, cell]) => String(cell.value))
    expect(descriptionCells.join('').replace(/\s/g, '')).toContain(description.replace(/\s/g, ''))
    expect(descriptionCells.filter(text => text.includes('SCOPE-0123456789')).length).toBeGreaterThan(1)
    expect([...workbook.cells.values()].every(cell => typeof cell.value !== 'string' || cell.value.length <= 32767)).toBe(true)
    for (const row of workbook.xml.matchAll(/<row\b[^>]*\bht="([^"]+)"/g)) expect(Number(row[1])).toBeLessThanOrEqual(409.5)
    expect(workbook.xml).not.toContain(' hidden="1"')
  })

  it('keeps ordinary quotation money columns compact', () => {
    expect(readCustomer(fixture()).widths).toEqual([8, 54, 10, 11, 21, 16, 16, 16, 16, 16, 16])
    expect(readCustomer(fixture('en-US', 3, 'single')).widths).toEqual([8, 54, 10, 11, 17, 19])
  })

  it.each(['single', 'mixed', 'empty'] as const)('fits large monetary values while retaining numeric cells with %s columns', mode => {
    const draft = fixture('en-US', 3, mode === 'single' ? 'single' : 'mixed')
    draft.majorItems = [createQuotationItem('USD', {
      name: 'Large package', quantity: 1, pricingMethod: 'manual_price', manualUnitPrice: 1e12,
    })]
    draft.totalsConfig.taxClasses = [{ id: 'standard', label: 'Standard', rate: 100 }]
    draft.totalsConfig.extraCharges = [{ id: 'freight', label: 'Freight', amount: 1e12 }]
    if (mode === 'empty') draft.totalsConfig.mixedTaxColumns = []
    const workbook = readCustomer(draft)
    const item = [...workbook.rows.values()].find(values => values[0] === '1')!
    if (mode === 'empty') {
      // The summary spans C:D; retain the compact quantity column and grow its neighbour.
      expect(workbook.widths[2]).toBe(10)
      expect(workbook.widths[2]! + workbook.widths[3]!).toBeGreaterThanOrEqual(28)
    } else {
      const moneyColumns = mode === 'single' ? [4, 5] : [5, 6, 7, 8, 9, 10]
      for (const column of moneyColumns) {
        expect(workbook.widths[column]).toBeGreaterThanOrEqual(22)
        expect(typeof item[column]).toBe('number')
        expect(item[column]).toBeGreaterThanOrEqual(1e12)
      }
      expect(workbook.widths.at(-1)).toBeGreaterThanOrEqual(28)
    }
    expectSummary(workbook, 'Freight', 1e12)
    expectSummary(workbook, translate('en-US', 'quotations.document.total'), 3e12)
    expect(workbook.allXml).not.toMatch(/<f>|<sheetProtection\b/)
  })
})
