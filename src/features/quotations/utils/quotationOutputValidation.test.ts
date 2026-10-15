import { describe, expect, it } from 'vitest'

import { createInitialQuotation } from './quotationDraft'
import {
  QuotationOutputError,
  assertQuotationInformationalTotalsReadyForOutput,
  assertQuotationReadyForOutput,
} from './quotationOutputValidation'

describe('assertQuotationReadyForOutput', () => {
  it('rejects a blank quotation number with the active-header field path', () => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.header.quotationNumber = '   '

    try {
      assertQuotationReadyForOutput(quotation)
      throw new Error('Expected output validation to fail.')
    } catch (error) {
      expect(error).toBeInstanceOf(QuotationOutputError)
      expect(error).toMatchObject({
        code: 'quotation_number_required',
        fieldPath: 'quotation.header.quotationNumber',
      })
    }
  })

  it('accepts a nonblank quotation number without modifying it', () => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.header.quotationNumber = ' Q-2026-001 '

    assertQuotationReadyForOutput(quotation)

    expect(quotation.header.quotationNumber).toBe(' Q-2026-001 ')
  })
})

describe('informational total output readiness', () => {
  it.each([
    { itemIds: [], code: 'informational_total_items_selection_required', messageKey: 'quotations.summaryDisplay.itemsSelectionRequired' },
    { itemIds: ['deleted'], code: 'informational_total_items_missing', messageKey: 'quotations.summaryDisplay.itemsMissing' },
  ])('validates active item selections ($code) while preserving draft saving', ({ itemIds, code, messageKey }) => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.outputSettings = {
      itemDetailLevel: 3, showInformationalTotals: true,
      informationalTotals: [{ id: 'row', label: 'Equipment', source: 'items', sectionIds: ['also-deleted'], itemIds, visible: true }],
    }
    expect(() => assertQuotationReadyForOutput(quotation)).not.toThrow()
    try {
      assertQuotationInformationalTotalsReadyForOutput(quotation)
      throw new Error('Expected item selection validation to fail.')
    } catch (error) {
      expect(error).toMatchObject({ code, messageKey, params: expect.objectContaining({ label: 'Equipment' }), fieldPath: 'quotation.outputSettings.informationalTotals[0].itemIds' })
    }
  })

  it('accepts existing nested item references and ignores inactive or hidden missing selections', () => {
    const quotation = createInitialQuotation([], 'en-US')
    const root = quotation.majorItems[0]!
    if (!('children' in root)) throw new Error('Expected a priced root item.')
    root.children = [{ ...root, id: 'nested', children: [] }]
    quotation.outputSettings = {
      itemDetailLevel: 1, showInformationalTotals: true,
      informationalTotals: [
        { id: 'valid', label: '', source: 'items', sectionIds: ['deleted-section'], itemIds: ['nested'], visible: true },
        { id: 'hidden', label: '', source: 'items', sectionIds: [], itemIds: ['deleted-item'], visible: false },
      ],
    }
    expect(() => assertQuotationInformationalTotalsReadyForOutput(quotation)).not.toThrow()
  })

  it.each([
    { sectionIds: [], code: 'informational_total_selection_required', messageKey: 'quotations.summaryDisplay.selectionRequired' },
    { sectionIds: ['deleted'], code: 'informational_total_sections_missing', messageKey: 'quotations.summaryDisplay.sectionsMissing' },
  ])('blocks visible invalid rows ($code), while allowing normal draft saving', ({ sectionIds, code, messageKey }) => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.outputSettings = {
      itemDetailLevel: 3, showInformationalTotals: true,
      informationalTotals: [{ id: 'row', label: 'Equipment', sectionIds, visible: true }],
    }

    expect(() => assertQuotationReadyForOutput(quotation)).not.toThrow()
    try {
      assertQuotationInformationalTotalsReadyForOutput(quotation)
      throw new Error('Expected informational total validation to fail.')
    } catch (error) {
      expect(error).toMatchObject({ code, messageKey, params: expect.objectContaining({ label: 'Equipment' }), fieldPath: 'quotation.outputSettings.informationalTotals[0].sectionIds' })
    }
  })

  it('allows hidden incomplete rows and disabled informational totals', () => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.outputSettings = {
      itemDetailLevel: 3, showInformationalTotals: true,
      informationalTotals: [{ id: 'row', label: '', sectionIds: [], visible: false }],
    }
    expect(() => assertQuotationInformationalTotalsReadyForOutput(quotation)).not.toThrow()
    quotation.outputSettings.informationalTotals![0]!.visible = true
    quotation.outputSettings.showInformationalTotals = false
    expect(() => assertQuotationInformationalTotalsReadyForOutput(quotation)).not.toThrow()
  })
})
