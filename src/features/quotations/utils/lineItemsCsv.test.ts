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
  it('creates a UTF-8 CSV template with the canonical headers', () => {
    expect(createLineItemsCsvTemplateContent()).toBe(
      '\uFEFFitem_code,item_name,item_description,qty,qty_unit,manual_unit_price,unit_cost,cost_currency,tax_class,markup_override\n',
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

  it('matches normalized headers by name in any order and reports ignored columns', () => {
    const result = parseLineItemsCsvImport([
      'QTY,Manual Unit-Price,Item Name,Extra Field',
      '2,50,Installation,ignored value',
    ].join('\n'), 'USD')

    expect(result.items).toEqual([
      createItem({
        name: 'Installation',
        quantity: 2,
        quantityUnit: 'EA',
        pricingMethod: 'manual_price',
        manualUnitPrice: 50,
      }),
    ])
    expect(result.rowCount).toBe(1)
    expect(result.recognizedColumns).toEqual(['qty', 'manual_unit_price', 'item_name'])
    expect(result.ignoredColumns).toEqual(['Extra Field'])
    expect(result.warnings).toEqual([
      {
        row: 1,
        column: 'Extra Field',
        code: 'unknown_header_ignored',
        context: { header: 'Extra Field' },
      },
      {
        row: 2,
        column: 'item_code',
        code: 'missing_item_code_assigned',
        context: { itemCode: '1' },
      },
      {
        row: 2,
        column: 'qty_unit',
        code: 'missing_qty_unit_defaulted',
        context: { unit: 'EA' },
      },
    ])
  })

  it('accepts percentage signs as percent points', () => {
    const result = parseLineItemsCsvContent([
      'item_name,qty,unit_cost,cost_currency,markup_override',
      'Valve,1,100,USD,15%',
      'Pump,1,100,USD,0.15',
    ].join('\n'), 'USD')

    expect(result[0]?.markupRate).toBe(15)
    expect(result[1]?.markupRate).toBe(0.15)
  })

  it('reports a group quantity default', () => {
    const result = parseLineItemsCsvImport([
      'item_code,item_name,qty,qty_unit,unit_cost,cost_currency',
      '1,Group,,set,,',
      '1.1,Leaf,1,EA,10,USD',
    ].join('\n'), 'USD')

    expect(result.warnings).toContainEqual({
      row: 2,
      column: 'qty',
      code: 'missing_group_quantity_defaulted',
      context: { quantity: '1' },
    })
  })

  it('warns and ignores invalid pricing values on group rows', () => {
    const result = parseLineItemsCsvImport([
      'item_code,item_name,qty,qty_unit,pricing_basis,manual_unit_price,unit_price,unit_cost,cost_currency',
      '1,Group,1,set,wrong,bad,worse,nope,ZZZ',
      '1.1,Leaf,1,EA,cost_plus,,,10,USD',
    ].join('\n'), 'USD')

    expect(result.items[0]).toMatchObject({
      name: 'Group',
      pricingMethod: 'cost_plus',
      unitCost: 0,
      costCurrency: 'USD',
    })
    expect(result.warnings).toContainEqual({
      row: 2,
      column: 'pricing_basis',
      code: 'group_pricing_ignored',
      context: {
        columns: 'pricing_basis, manual_unit_price, unit_price, unit_cost, cost_currency',
      },
    })
  })

  it('reports quotation-currency defaulting for manual-price analysis cost', () => {
    const result = parseLineItemsCsvImport([
      'item_name,qty,manual_unit_price,unit_cost',
      'Manual item,1,100,20',
    ].join('\n'), 'USD')

    expect(result.warnings).toContainEqual({
      row: 2,
      column: 'cost_currency',
      code: 'manual_cost_currency_defaulted',
      context: { currency: 'USD' },
    })
  })

  it.each([
    {
      name: 'duplicate normalized headers',
      content: 'item_name,Item Name\nValve,Duplicate',
      issue: { row: 1, column: 'item_name', code: 'duplicate_header' },
    },
    {
      name: 'header-only files',
      content: 'item_name,qty,manual_unit_price\n',
      issue: { row: 2, code: 'no_data_rows' },
    },
    {
      name: 'malformed quoting',
      content: 'item_name,qty,manual_unit_price\n"Valve,1,20',
      issue: { row: 2, code: 'malformed_csv' },
    },
    {
      name: 'scientific notation',
      content: 'item_name,qty,manual_unit_price\nValve,1,1e3',
      issue: { row: 2, column: 'manual_unit_price', code: 'invalid_number' },
    },
    {
      name: 'currency symbols',
      content: 'item_name,qty,manual_unit_price\nValve,1,$100',
      issue: { row: 2, column: 'manual_unit_price', code: 'invalid_number' },
    },
    {
      name: 'thousands separators',
      content: 'item_name,qty,manual_unit_price\nValve,1,"1,000"',
      issue: { row: 2, column: 'manual_unit_price', code: 'invalid_number' },
    },
    {
      name: 'hexadecimal numbers',
      content: 'item_name,qty,manual_unit_price\nValve,1,0x64',
      issue: { row: 2, column: 'manual_unit_price', code: 'invalid_number' },
    },
    {
      name: 'NaN',
      content: 'item_name,qty,manual_unit_price\nValve,1,NaN',
      issue: { row: 2, column: 'manual_unit_price', code: 'invalid_number' },
    },
    {
      name: 'infinity',
      content: 'item_name,qty,manual_unit_price\nValve,1,Infinity',
      issue: { row: 2, column: 'manual_unit_price', code: 'invalid_number' },
    },
    {
      name: 'non-positive required prices',
      content: 'item_name,qty,manual_unit_price\nValve,1,0',
      issue: { row: 2, column: 'manual_unit_price', code: 'non_positive_number' },
    },
    {
      name: 'non-positive quantities',
      content: 'item_name,qty,manual_unit_price\nValve,0,20',
      issue: { row: 2, column: 'qty', code: 'non_positive_number' },
    },
    {
      name: 'negative optional money',
      content: 'item_name,qty,manual_unit_price,unit_cost\nValve,1,20,-1',
      issue: { row: 2, column: 'unit_cost', code: 'negative_number' },
    },
    {
      name: 'markup above the UI limit',
      content: 'item_name,qty,unit_cost,cost_currency,markup_override\nValve,1,10,USD,1000.01%',
      issue: { row: 2, column: 'markup_override', code: 'markup_out_of_range' },
    },
    {
      name: 'negative markup',
      content: 'item_name,qty,unit_cost,cost_currency,markup_override\nValve,1,10,USD,-0.01%',
      issue: { row: 2, column: 'markup_override', code: 'markup_out_of_range' },
    },
    {
      name: 'non-empty cells beyond the header',
      content: 'item_name,qty,manual_unit_price\nValve,1,20,unexpected',
      issue: { row: 2, code: 'extra_cells' },
    },
    {
      name: 'a row containing only cells beyond the header',
      content: 'item_name\n,unexpected',
      issue: { row: 2, code: 'extra_cells' },
    },
  ])('rejects $name', ({ content, issue }) => {
    expect(() => parseLineItemsCsvImport(content, 'USD')).toThrowError(CsvImportError)

    try {
      parseLineItemsCsvImport(content, 'USD')
    } catch (error) {
      expect((error as CsvImportError).issues).toContainEqual(expect.objectContaining(issue))
    }
  })

  it('rejects contradictory current and legacy pricing fields', () => {
    const conflictingColumns = [
      'item_name,qty,manual_unit_price,unit_price',
      'Valve,1,20,25',
    ].join('\n')
    const conflictingBasis = [
      'item_name,qty,pricing_basis,unit_price,unit_cost,cost_currency',
      'Valve,1,cost_plus,20,10,USD',
    ].join('\n')

    expect(() => parseLineItemsCsvImport(conflictingColumns, 'USD')).toThrowError(CsvImportError)
    expect(() => parseLineItemsCsvImport(conflictingBasis, 'USD')).toThrowError(CsvImportError)

    try {
      parseLineItemsCsvImport(conflictingColumns, 'USD')
    } catch (error) {
      expect((error as CsvImportError).issues).toContainEqual({
        row: 2,
        column: 'manual_unit_price',
        code: 'conflicting_unit_price',
      })
    }

    try {
      parseLineItemsCsvImport(conflictingBasis, 'USD')
    } catch (error) {
      expect((error as CsvImportError).issues).toContainEqual({
        row: 2,
        column: 'pricing_basis',
        code: 'pricing_basis_conflict',
        context: { pricingBasis: 'cost_plus' },
      })
    }
  })

  it('accepts matching current and legacy manual prices with a warning', () => {
    const result = parseLineItemsCsvImport([
      'item_name,qty,manual_unit_price,unit_price',
      'Valve,1,20,20',
    ].join('\n'), 'USD')

    expect(result.items[0]).toMatchObject({
      pricingMethod: 'manual_price',
      manualUnitPrice: 20,
    })
    expect(result.warnings).toContainEqual({
      row: 2,
      column: 'manual_unit_price',
      code: 'redundant_unit_price',
      context: {},
    })
  })

  it('reports leaf values that do not affect pricing', () => {
    const result = parseLineItemsCsvImport([
      'item_name,qty,manual_unit_price,markup_override,expected_total',
      'Manual item,1,50,10,100',
    ].join('\n'), 'USD')

    expect(result.items[0]).toMatchObject({
      pricingMethod: 'manual_price',
      manualUnitPrice: 50,
      markupRate: 10,
      expectedTotal: undefined,
    })
    expect(result.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
      'manual_markup_ignored',
      'leaf_expected_total_ignored',
    ]))
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
      {
        row: 2,
        column: 'pricing_basis',
        code: 'group_pricing_ignored',
        context: {
          columns: 'pricing_basis, unit_cost, cost_currency',
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
      name: 'missing required item name header',
      content: [
        'item_code,qty',
        '1,3',
      ].join('\n'),
      expectedIssues: [{
        row: 1,
        column: 'item_name',
        code: 'missing_required_header',
        context: {
          header: 'item_name',
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
