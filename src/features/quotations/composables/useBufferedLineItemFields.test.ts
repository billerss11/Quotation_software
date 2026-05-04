import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuotationItemField } from '../types'
import { useBufferedLineItemFields } from './useBufferedLineItemFields'

describe('useBufferedLineItemFields', () => {
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
