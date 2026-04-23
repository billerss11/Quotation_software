import { describe, expect, it } from 'vitest'

import { createNextQuotationNumber } from './quotationNumbering'

describe('quotation numbering', () => {
  it('starts the current year at the first sequence', () => {
    expect(createNextQuotationNumber([], new Date('2026-04-22'))).toBe('Q-2026-001')
  })

  it('increments the highest quotation number for the current year', () => {
    expect(
      createNextQuotationNumber(
        ['Q-2025-010', 'Q-2026-001', 'Q-2026-009', 'Q-2026-003'],
        new Date('2026-04-22'),
      ),
    ).toBe('Q-2026-010')
  })
})
