import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MIXED_TAX_DOCUMENT_COLUMNS,
  MIXED_TAX_DOCUMENT_COLUMN_DEFINITIONS,
  MIXED_TAX_DOCUMENT_COLUMNS,
  getMixedTaxDocumentColumnDefinitions,
  normalizeMixedTaxDocumentColumns,
  toggleMixedTaxDocumentColumn,
} from './quotationDocumentColumns'

describe('quotation document columns', () => {
  it('keeps mixed-tax column ids and definitions in the same display order', () => {
    expect(MIXED_TAX_DOCUMENT_COLUMN_DEFINITIONS.map((definition) => definition.id)).toEqual(
      MIXED_TAX_DOCUMENT_COLUMNS,
    )
    expect(DEFAULT_MIXED_TAX_DOCUMENT_COLUMNS).toEqual(MIXED_TAX_DOCUMENT_COLUMNS)
  })

  it('normalizes selected columns and returns matching definitions', () => {
    expect(normalizeMixedTaxDocumentColumns(['grossAmount', 'invalid', 'taxRate', 'grossAmount'])).toEqual([
      'grossAmount',
      'taxRate',
    ])
    expect(getMixedTaxDocumentColumnDefinitions(['grossAmount', 'invalid', 'taxRate', 'grossAmount'])
      .map((definition) => definition.id)).toEqual(['taxRate', 'grossAmount'])
  })

  it('uses centralized selector and header metadata for every mixed-tax column', () => {
    MIXED_TAX_DOCUMENT_COLUMN_DEFINITIONS.forEach((definition) => {
      expect(definition.selectorLabelKey).toMatch(/^quotations\.totals\.mixedTaxColumns\.options\./)
      expect(definition.headerLabelKey).toMatch(/^quotations\.document\.table\./)
      expect(definition.cellClass).toMatch(/^col-/)
      expect(definition.colClass).toMatch(/^ledger-col-/)
    })
  })

  it('toggles columns while preserving document column order', () => {
    expect(toggleMixedTaxDocumentColumn(['grossAmount'], 'unitTax', true)).toEqual(['unitTax', 'grossAmount'])
    expect(toggleMixedTaxDocumentColumn(['taxRate', 'unitTax', 'grossAmount'], 'taxRate', false)).toEqual([
      'unitTax',
      'grossAmount',
    ])
  })
})
