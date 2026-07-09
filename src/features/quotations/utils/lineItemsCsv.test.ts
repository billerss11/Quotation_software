import { describe, expect, it } from 'vitest'

import type { QuotationItem } from '../types'
import {
  createLineItemsCsvContent,
  createLineItemsCsvTemplateContent,
  CsvImportError,
  parseLineItemsCsvImport,
  parseLineItemsCsvContent,
} from './lineItemsCsv'
import type { CsvImportIssueCode } from './lineItemsCsv'

const taxClasses = [
  { id: 'tax-0', label: '0%', rate: 0 },
  { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
  { id: 'tax-service', label: 'Service 6%', rate: 6 },
]

describe('line item CSV import', () => {
  it('creates a CSV template with the exact required headers', () => {
    expect(createLineItemsCsvTemplateContent()).toBe(
      'item_code,item_name,item_description,qty,qty_unit,manual_unit_price,unit_cost,cost_currency,tax_class,markup_override\n',
    )
  })

  it('serializes a valid three-level quotation tree in depth-first order', () => {
    expect(
      createLineItemsCsvContent([
        createItem({
          name: 'Surface Equipment Supply',
          description: 'Supply scope',
          expectedTotal: 120,
          children: [
            createItem({
              name: 'Valve set',
              description: 'Assembly grouping',
              markupRate: 20,
              expectedTotal: 144,
              children: [
                createItem({
                  name: 'Valve body',
                  description: 'Stainless steel',
                  quantity: 2,
                  quantityUnit: 'ea',
                  unitCost: 60,
                  costCurrency: 'USD',
                }),
              ],
            }),
          ],
        }),
        createItem({
          name: 'Installation',
          description: 'Field work',
          quantity: 3,
          quantityUnit: 'days',
          unitCost: 200,
          costCurrency: 'USD',
          markupRate: 15,
        }),
      ]),
    ).toBe(
      [
        '\uFEFFitem_code,item_name,item_description,qty,qty_unit,manual_unit_price,unit_cost,cost_currency,tax_class,markup_override',
        '1,Surface Equipment Supply,Supply scope,1,,,,,,',
        '1.1,Valve set,Assembly grouping,1,,,,,,20',
        '1.1.1,Valve body,Stainless steel,2,ea,,60,USD,,',
        '2,Installation,Field work,3,days,,200,USD,,15',
      ].join('\n'),
    )
  })

  it('escapes commas, quotes, and newlines when exporting CSV', () => {
    expect(
      createLineItemsCsvContent([
        createItem({
          name: 'Valve, "special"',
          description: 'Line 1\nLine 2',
        }),
      ]),
    ).toBe(
      [
        '\uFEFFitem_code,item_name,item_description,qty,qty_unit,manual_unit_price,unit_cost,cost_currency,tax_class,markup_override',
        '1,"Valve, ""special""","Line 1\nLine 2",1,,,0,USD,,',
      ].join('\n'),
    )
  })

  it('roundtrips exported CSV through the importer', () => {
    const items: QuotationItem[] = [
      createItem({
        name: 'Surface Equipment Supply',
        description: 'Supply scope',
        quantityUnit: 'EA',
        children: [
          createItem({
            name: 'Valve set',
            description: 'Assembly grouping',
            quantity: 2,
            quantityUnit: 'sets',
            markupRate: 20,
            children: [
              createItem({
                name: 'Valve body',
                description: 'Stainless steel',
                quantity: 2,
                quantityUnit: 'ea',
                unitCost: 60,
                costCurrency: 'JPY',
              }),
            ],
          }),
        ],
      }),
      createItem({
        name: 'Installation',
        description: 'Field work',
        quantity: 3,
        quantityUnit: 'days',
        pricingMethod: 'manual_price',
        manualUnitPrice: 260,
      }),
    ]

    expect(parseLineItemsCsvContent(createLineItemsCsvContent(items), 'USD')).toEqual<QuotationItem[]>([
      createItem({
        name: 'Surface Equipment Supply',
        description: 'Supply scope',
        quantityUnit: 'EA',
        children: [
          createItem({
            name: 'Valve set',
            description: 'Assembly grouping',
            quantity: 2,
            quantityUnit: 'sets',
            markupRate: 20,
            children: [
              createItem({
                name: 'Valve body',
                description: 'Stainless steel',
                quantity: 2,
                quantityUnit: 'ea',
                unitCost: 60,
                costCurrency: 'JPY',
              }),
            ],
          }),
        ],
      }),
      createItem({
        name: 'Installation',
        description: 'Field work',
        quantity: 3,
        quantityUnit: 'days',
        pricingMethod: 'manual_price',
        manualUnitPrice: 260,
      }),
    ])
  })

  it('parses the simplified CSV format and infers pricing mode from filled price columns', () => {
    const content = [
      'item_code,item_name,item_description,qty,qty_unit,manual_unit_price,unit_cost,cost_currency,tax_class,markup_override',
      '1,Surface Equipment Supply,Supply scope,1,,,,,,',
      '1.1,Valve body,Stainless steel,2,ea,,60,USD,,',
      '1.2,Installation,Field work,3,days,260,,,,',
    ].join('\n')

    expect(parseLineItemsCsvContent(content, 'USD')).toEqual<QuotationItem[]>([
      createItem({
        name: 'Surface Equipment Supply',
        description: 'Supply scope',
        quantity: 1,
        quantityUnit: 'EA',
        unitCost: 0,
        costCurrency: 'USD',
        children: [
          createItem({
            name: 'Valve body',
            description: 'Stainless steel',
            quantity: 2,
            quantityUnit: 'ea',
            unitCost: 60,
            costCurrency: 'USD',
          }),
          createItem({
            name: 'Installation',
            description: 'Field work',
            quantity: 3,
            quantityUnit: 'days',
            pricingMethod: 'manual_price',
            manualUnitPrice: 260,
          }),
        ],
      }),
    ])
  })

  it('imports old pricing-basis CSV files and preserves expected totals', () => {
    const content = [
      'item_code,item_name,item_description,qty,qty_unit,pricing_basis,unit_price,unit_cost,cost_currency,tax_class,markup_override,expected_total',
      '1,Surface Equipment Supply,Supply scope,1,,,,,,,,120',
      '1.1,Valve set,Assembly grouping,1,,,,,,,20,144',
      '1.1.1,Valve body,Stainless steel,2,ea,cost_plus,,60,USD,,',
      '2,Installation,Field work,3,days,manual_price,260,,,,,',
    ].join('\n')

    expect(parseLineItemsCsvContent(content, 'USD')).toEqual<QuotationItem[]>([
      createItem({
        name: 'Surface Equipment Supply',
        description: 'Supply scope',
        quantity: 1,
        quantityUnit: 'EA',
        unitCost: 0,
        costCurrency: 'USD',
        expectedTotal: 120,
        children: [
          createItem({
            name: 'Valve set',
            description: 'Assembly grouping',
            quantity: 1,
            quantityUnit: 'EA',
            unitCost: 0,
            costCurrency: 'USD',
            markupRate: 20,
            expectedTotal: 144,
            children: [
              createItem({
                name: 'Valve body',
                description: 'Stainless steel',
                quantity: 2,
                quantityUnit: 'ea',
                unitCost: 60,
                costCurrency: 'USD',
              }),
            ],
          }),
        ],
      }),
      createItem({
        name: 'Installation',
        description: 'Field work',
        quantity: 3,
        quantityUnit: 'days',
        pricingMethod: 'manual_price',
        manualUnitPrice: 260,
      }),
    ])
  })

  it('imports legacy CSV headers without a pricing basis column as cost-plus rows', () => {
    const content = [
      'item_code,item_name,item_description,qty,qty_unit,unit_cost,cost_currency,markup_override,expected_total',
      '1,Installation,Field work,3,days,200,USD,15,',
    ].join('\n')

    expect(parseLineItemsCsvContent(content, 'USD')).toEqual<QuotationItem[]>([
      createItem({
        name: 'Installation',
        description: 'Field work',
        quantity: 3,
        quantityUnit: 'days',
        pricingMethod: 'cost_plus',
        unitCost: 200,
        costCurrency: 'USD',
        markupRate: 15,
      }),
    ])
  })

  it('assigns missing item codes as top-level rows and defaults missing qty units', () => {
    const content = [
      'item_code,item_name,item_description,qty,qty_unit,pricing_basis,unit_price,unit_cost,cost_currency,tax_class,markup_override,expected_total',
      ',Valve body,Stainless steel,2,,cost_plus,,60,USD,,,',
      ',Installation,Field work,3,,manual_price,260,,,,,',
    ].join('\n')

    const result = parseLineItemsCsvImport(content, 'USD')

    expect(result.items).toEqual<QuotationItem[]>([
      createItem({
        name: 'Valve body',
        description: 'Stainless steel',
        quantity: 2,
        quantityUnit: 'EA',
        unitCost: 60,
        costCurrency: 'USD',
      }),
      createItem({
        name: 'Installation',
        description: 'Field work',
        quantity: 3,
        quantityUnit: 'EA',
        pricingMethod: 'manual_price',
        manualUnitPrice: 260,
      }),
    ])
    expect(result.warnings).toEqual([
      {
        row: 2,
        column: 'item_code',
        code: 'missing_item_code_assigned',
        context: {
          itemCode: '1',
        },
      },
      {
        row: 2,
        column: 'qty_unit',
        code: 'missing_qty_unit_defaulted',
        context: {
          unit: 'EA',
        },
      },
      {
        row: 3,
        column: 'item_code',
        code: 'missing_item_code_assigned',
        context: {
          itemCode: '2',
        },
      },
      {
        row: 3,
        column: 'qty_unit',
        code: 'missing_qty_unit_defaulted',
        context: {
          unit: 'EA',
        },
      },
    ])
  })

  it('assigns missing item codes without colliding with existing top-level codes', () => {
    const content = createPricingBasisCsvContent([
      '2,Existing root,Keep code,1,ea,cost_plus,,10,USD,,,',
      ',Inserted root,Generated code,1,ea,cost_plus,,20,USD,,,',
      '2.1,Existing child,Keep parent,1,ea,cost_plus,,5,USD,,,',
    ])

    const result = parseLineItemsCsvImport(content, 'USD')

    expect(result.items.map((item) => item.name)).toEqual(['Inserted root', 'Existing root'])
    expect(result.items[1]?.children.map((item) => item.name)).toEqual(['Existing child'])
    expect(result.warnings).toEqual([
      {
        row: 3,
        column: 'item_code',
        code: 'missing_item_code_assigned',
        context: {
          itemCode: '1',
        },
      },
    ])
  })

  it.each([
    {
      name: 'empty file',
      content: '',
      expectedIssues: [{ row: 1, code: 'empty_file' }],
    },
    {
      name: 'invalid headers',
      content: [
        'item_code,item_name,qty',
        '1,Installation,3',
      ].join('\n'),
      expectedIssues: [{
        row: 1,
        code: 'invalid_headers',
        context: {
          headers: 'item_code, item_name, item_description, qty, qty_unit, manual_unit_price, unit_cost, cost_currency, tax_class, markup_override',
        },
      }],
    },
    {
      name: 'invalid item code',
      rows: ['null,Installation,Field work,3,days,cost_plus,,200,USD,,,'],
      expectedIssues: [{ row: 2, column: 'item_code', code: 'invalid_item_code' }],
    },
    {
      name: 'missing item name',
      rows: ['1,,Field work,3,days,cost_plus,,200,USD,,,'],
      expectedIssues: [{ row: 2, column: 'item_name', code: 'missing_item_name' }],
    },
    {
      name: 'invalid qty',
      rows: ['1,Installation,Field work,three,days,cost_plus,,200,USD,,,'],
      expectedIssues: [{ row: 2, column: 'qty', code: 'invalid_number' }],
    },
    {
      name: 'invalid manual unit price',
      rows: ['1,Installation,Field work,3,days,manual_price,abc,,,,,'],
      expectedIssues: [{ row: 2, column: 'unit_price', code: 'invalid_number' }],
    },
    {
      name: 'invalid unit cost',
      rows: ['1,Installation,Field work,3,days,cost_plus,,abc,USD,,,'],
      expectedIssues: [{ row: 2, column: 'unit_cost', code: 'invalid_number' }],
    },
    {
      name: 'invalid markup override',
      rows: ['1,Installation,Field work,3,days,cost_plus,,200,USD,,bad,'],
      expectedIssues: [{ row: 2, column: 'markup_override', code: 'invalid_number' }],
    },
    {
      name: 'invalid expected total',
      rows: ['1,Installation,Field work,3,days,cost_plus,,200,USD,,,bad'],
      expectedIssues: [{ row: 2, column: 'expected_total', code: 'invalid_number' }],
    },
    {
      name: 'unsupported pricing basis',
      rows: ['1,Installation,Field work,3,days,rental,,200,USD,,,'],
      expectedIssues: [{ row: 2, column: 'pricing_basis', code: 'unsupported_pricing_basis' }],
    },
    {
      name: 'unsupported currency',
      rows: ['1,Installation,Field work,3,days,cost_plus,,200,ZZZ,,,'],
      expectedIssues: [{ row: 2, column: 'cost_currency', code: 'unsupported_currency' }],
    },
    {
      name: 'unsupported tax class',
      rows: ['1,Installation,Field work,3,days,cost_plus,,200,USD,Bad tax,,'],
      taxClasses,
      expectedIssues: [{ row: 2, column: 'tax_class', code: 'unsupported_tax_class' }],
    },
    {
      name: 'missing parent',
      rows: ['1.1,Valve set,Missing parent,2,ea,cost_plus,,100,USD,,,'],
      expectedIssues: [{
        row: 2,
        column: 'item_code',
        code: 'missing_parent',
        context: { parentCode: '1' },
      }],
    },
    {
      name: 'missing leaf quantity',
      rows: ['1,Installation,Field work,,days,cost_plus,,200,USD,,,'],
      expectedIssues: [{ row: 2, column: 'qty', code: 'missing_leaf_quantity' }],
    },
    {
      name: 'missing manual leaf unit price',
      rows: ['1,Installation,Field work,3,days,manual_price,,,,,,'],
      expectedIssues: [{ row: 2, column: 'unit_price', code: 'missing_leaf_unit_price' }],
    },
    {
      name: 'missing cost-plus leaf unit cost',
      rows: ['1,Installation,Field work,3,days,cost_plus,,,USD,,,'],
      expectedIssues: [{ row: 2, column: 'unit_cost', code: 'missing_leaf_unit_cost' }],
    },
    {
      name: 'missing cost-plus leaf currency',
      rows: ['1,Installation,Field work,3,days,cost_plus,,200,,,,'],
      expectedIssues: [{ row: 2, column: 'cost_currency', code: 'missing_leaf_currency' }],
    },
    {
      name: 'duplicate item code',
      rows: [
        '1,Installation,Field work,3,days,cost_plus,,200,USD,,,',
        '1,Duplicate,Wrong hierarchy,1,ea,cost_plus,,50,USD,,,',
      ],
      expectedIssues: [{
        row: 3,
        column: 'item_code',
        code: 'duplicate_item_code',
        context: { itemCode: '1' },
      }],
    },
  ] satisfies Array<{
    name: string
    content?: string
    rows?: string[]
    taxClasses?: typeof taxClasses
    expectedIssues: Array<{
      row: number
      column?: string
      code: CsvImportIssueCode
      context?: Record<string, string>
    }>
  }>)('keeps $name as an import error', ({ content, rows, taxClasses: caseTaxClasses, expectedIssues }) => {
    const csvContent = content ?? createPricingBasisCsvContent(rows ?? [])

    expect(() => parseLineItemsCsvImport(csvContent, 'USD', caseTaxClasses ?? [])).toThrowError(CsvImportError)

    try {
      parseLineItemsCsvImport(csvContent, 'USD', caseTaxClasses ?? [])
    } catch (error) {
      expect(error).toBeInstanceOf(CsvImportError)
      expect((error as CsvImportError).issues).toEqual(expectedIssues)
    }
  })

  it('rejects orphan child rows and reports row-level errors', () => {
    const content = [
      'item_code,item_name,item_description,qty,qty_unit,unit_cost,cost_currency,markup_override,expected_total',
      '1.1,Valve set,Missing parent,2,ea,100,USD,,',
    ].join('\n')

    expect(() => parseLineItemsCsvContent(content, 'USD')).toThrowError(CsvImportError)

    try {
      parseLineItemsCsvContent(content, 'USD')
    } catch (error) {
      expect(error).toBeInstanceOf(CsvImportError)
      expect((error as CsvImportError).issues).toEqual([
        {
          row: 2,
          column: 'item_code',
          code: 'missing_parent',
          context: {
            parentCode: '1',
          },
        },
      ])
    }
  })

  it('rejects invalid leaf values', () => {
    const content = [
      'item_code,item_name,item_description,qty,qty_unit,unit_cost,cost_currency,markup_override,expected_total',
      '1,Installation,Field work,three,days,200,USD,,',
    ].join('\n')

    expect(() => parseLineItemsCsvContent(content, 'USD')).toThrowError(CsvImportError)

    try {
      parseLineItemsCsvContent(content, 'USD')
    } catch (error) {
      expect(error).toBeInstanceOf(CsvImportError)
      expect((error as CsvImportError).issues).toEqual([
        {
          row: 2,
          column: 'qty',
          code: 'invalid_number',
        },
      ])
    }
  })

  it('rejects invalid manual unit prices in the simplified CSV format', () => {
    const content = [
      'item_code,item_name,item_description,qty,qty_unit,manual_unit_price,unit_cost,cost_currency,tax_class,markup_override',
      '1,Installation,Field work,3,days,abc,,,,',
    ].join('\n')

    expect(() => parseLineItemsCsvContent(content, 'USD')).toThrowError(CsvImportError)

    try {
      parseLineItemsCsvContent(content, 'USD')
    } catch (error) {
      expect(error).toBeInstanceOf(CsvImportError)
      expect((error as CsvImportError).issues).toEqual([
        {
          row: 2,
          column: 'manual_unit_price',
          code: 'invalid_number',
        },
      ])
    }
  })

  it('accepts supported non-default currencies', () => {
    const content = [
      'item_code,item_name,item_description,qty,qty_unit,unit_cost,cost_currency,markup_override,expected_total',
      '1,Installation,Field work,3,days,200,JPY,,',
    ].join('\n')

    expect(parseLineItemsCsvContent(content, 'USD')[0]?.costCurrency).toBe('JPY')
  })

  it('rejects invalid currencies', () => {
    const content = [
      'item_code,item_name,item_description,qty,qty_unit,unit_cost,cost_currency,markup_override,expected_total',
      '1,Installation,Field work,3,days,200,ZZZ,,',
    ].join('\n')

    expect(() => parseLineItemsCsvContent(content, 'USD')).toThrowError(CsvImportError)
  })

  it('rejects non-numeric expected totals when provided', () => {
    const content = [
      'item_code,item_name,item_description,qty,qty_unit,unit_cost,cost_currency,markup_override,expected_total',
      '1,Surface Equipment Supply,Supply scope,,,,,,abc',
      '1.1,Valve body,Stainless steel,2,ea,60,USD,,',
    ].join('\n')

    expect(() => parseLineItemsCsvContent(content, 'USD')).toThrowError(CsvImportError)

    try {
      parseLineItemsCsvContent(content, 'USD')
    } catch (error) {
      expect((error as CsvImportError).issues).toEqual([
        {
          row: 2,
          column: 'expected_total',
          code: 'invalid_number',
        },
      ])
    }
  })

  it('includes a tax_class column in the generated template and exported rows', () => {
    const item = createItem({
      name: 'Commissioning',
      quantity: 1,
      unitCost: 100,
      costCurrency: 'USD',
      taxClassId: 'tax-service',
    })

    expect(createLineItemsCsvTemplateContent()).toContain('tax_class')
    expect(createLineItemsCsvContent([item], taxClasses)).toContain(',,100,USD,Service 6%,')
  })

  it('roundtrips tax class assignments through CSV using quotation tax classes', () => {
    const items: QuotationItem[] = [
      createItem({
        name: 'Equipment',
        quantity: 1,
        quantityUnit: 'EA',
        unitCost: 100,
        costCurrency: 'USD',
        taxClassId: 'tax-goods',
      }),
      createItem({
        name: 'Commissioning',
        quantity: 1,
        quantityUnit: 'EA',
        unitCost: 80,
        costCurrency: 'USD',
        taxClassId: 'tax-service',
      }),
    ]

    expect(
      parseLineItemsCsvContent(
        createLineItemsCsvContent(items, taxClasses),
        'USD',
        taxClasses,
      ),
    ).toEqual<QuotationItem[]>([
      createItem({
        name: 'Equipment',
        quantity: 1,
        quantityUnit: 'EA',
        unitCost: 100,
        costCurrency: 'USD',
        taxClassId: 'tax-goods',
      }),
      createItem({
        name: 'Commissioning',
        quantity: 1,
        quantityUnit: 'EA',
        unitCost: 80,
        costCurrency: 'USD',
        taxClassId: 'tax-service',
      }),
    ])
  })
})

function createItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: overrides.id ?? expect.any(String),
    name: overrides.name ?? 'New item',
    description: overrides.description ?? '',
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? '',
    pricingMethod: (overrides as QuotationItem & { pricingMethod?: 'cost_plus' | 'manual_price' }).pricingMethod ?? 'cost_plus',
    manualUnitPrice: (overrides as QuotationItem & { manualUnitPrice?: number }).manualUnitPrice,
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? 'USD',
    markupRate: overrides.markupRate,
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  } as unknown as QuotationItem
}

function createPricingBasisCsvContent(rows: string[]) {
  return [
    'item_code,item_name,item_description,qty,qty_unit,pricing_basis,unit_price,unit_cost,cost_currency,tax_class,markup_override,expected_total',
    ...rows,
  ].join('\n')
}
