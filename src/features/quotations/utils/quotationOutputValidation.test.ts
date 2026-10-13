import { describe, expect, it } from 'vitest'

import { createInitialQuotation } from './quotationDraft'
import {
  QuotationOutputError,
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
