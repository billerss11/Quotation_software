import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createInitialQuotation } from '../utils/quotationDraft'
import { createSetValueMutation } from '../utils/quotationHistoryCommands'
import { useQuotationUndoHistory } from './useQuotationUndoHistory'

describe('useQuotationUndoHistory performance', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not serialize a large quotation for a small edit', () => {
    const stringifySpy = vi.spyOn(JSON, 'stringify')
    const quotation = ref(createInitialQuotation([], 'en-US', {
      quotationNumber: 'Q-2026-001',
    }))
    quotation.value.header.notes = 'x'.repeat(300_000)
    const quotationBefore = quotation.value
    const headerBefore = quotation.value.header
    const history = useQuotationUndoHistory({ quotation })
    stringifySpy.mockClear()

    history.execute([
      createSetValueMutation({ scope: 'header' }, 'projectName', '', 'Pump station'),
    ])
    history.undo()
    history.redo()

    expect(stringifySpy).not.toHaveBeenCalled()
    expect(quotation.value).toBe(quotationBefore)
    expect(quotation.value.header).toBe(headerBefore)
  })

  it('keeps unaffected branches stable through undo and redo', () => {
    const quotation = ref(createInitialQuotation([], 'en-US', {
      quotationNumber: 'Q-2026-001',
    }))
    const itemsBefore = quotation.value.majorItems
    const totalsBefore = quotation.value.totalsConfig
    const history = useQuotationUndoHistory({ quotation })

    history.execute([
      createSetValueMutation({ scope: 'header' }, 'projectName', '', 'Pump station'),
    ])
    history.undo()
    history.redo()

    expect(quotation.value.majorItems).toBe(itemsBefore)
    expect(quotation.value.totalsConfig).toBe(totalsBefore)
  })
})
