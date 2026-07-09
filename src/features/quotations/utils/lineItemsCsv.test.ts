import { describe, expect, it } from 'vitest'

import type { QuotationItem } from '../types'
import {
  createLineItemsCsvContent,
  createLineItemsCsvTemplateContent,
  CsvImportError,
  parseLineItemsCsvImport,
  parseLineItemsCsvContent,
} from './lineItemsCsv'

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
