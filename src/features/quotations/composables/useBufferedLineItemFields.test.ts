import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { QuotationItemField } from '../types'
import { flushLineItemEditBuffers } from '../utils/lineItemEditBuffers'
import { useBufferedLineItemFields } from './useBufferedLineItemFields'

describe('useBufferedLineItemFields', () => {
  it.each(['save', 'dispose'])('preserves punctuation in item IDs during %s and commits only once', mode => {
    const commits: Array<[string, QuotationItemField, unknown]> = []
    const scope = effectScope()
    const buffer = scope.run(() => useBufferedLineItemFields((...args) => commits.push(args)))!
    const itemId = 'vendor:item:"1"\\part'

    buffer.queueBufferedField(itemId, 'unitCost', 125)
    buffer.queueBufferedField(itemId, 'unitCost', 250)
    expect(buffer.getBufferedFieldValue(itemId, 'unitCost', 0)).toBe(250)

    if (mode === 'save') flushLineItemEditBuffers()
    else scope.stop()
    vi.advanceTimersByTime(160)
    scope.stop()

    expect(commits).toEqual([[itemId, 'unitCost', 250]])
  })

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('buffers updates until the commit delay elapses', () => {
    const commits: Array<[string, QuotationItemField, unknown]> = []
    const buffer = useBufferedLineItemFields((itemId, field, value) => {
      commits.push([itemId, field, value])
    })

    buffer.queueBufferedField('item-1', 'name', 'Updated item')

    expect(buffer.getBufferedFieldValue('item-1', 'name', '')).toBe('Updated item')
    expect(commits).toEqual([])

    vi.advanceTimersByTime(160)

    expect(commits).toEqual([
      ['item-1', 'name', 'Updated item'],
    ])

    buffer.dispose()
  })

  it('flushes pending updates when disposed', () => {
    const commits: Array<[string, QuotationItemField, unknown]> = []
    const buffer = useBufferedLineItemFields((itemId, field, value) => {
      commits.push([itemId, field, value])
    })

    buffer.queueBufferedField('item-1', 'description', 'Pending description')
    buffer.dispose()

    expect(commits).toEqual([
      ['item-1', 'description', 'Pending description'],
    ])
  })
})
