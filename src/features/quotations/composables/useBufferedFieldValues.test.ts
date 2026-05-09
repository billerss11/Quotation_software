import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { flushLineItemEditBuffers } from '../utils/lineItemEditBuffers'
import { useBufferedFieldValues } from './useBufferedFieldValues'

describe('useBufferedFieldValues', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('buffers commits until the delay elapses', () => {
    const commits: Array<[string, unknown]> = []
    const buffer = useBufferedFieldValues((key, value) => {
      commits.push([key, value])
    })

    buffer.queueBufferedValue('globalMarkupRate', 25)

    expect(buffer.getBufferedValue('globalMarkupRate', 10)).toBe(25)
    expect(commits).toEqual([])

    vi.advanceTimersByTime(160)

    expect(commits).toEqual([
      ['globalMarkupRate', 25],
    ])

    buffer.dispose()
  })

  it('flushes a buffered value immediately on demand', () => {
    const commits: Array<[string, unknown]> = []
    const buffer = useBufferedFieldValues((key, value) => {
      commits.push([key, value])
    })

    buffer.queueBufferedValue('rate:EUR', 0.95)
    buffer.flushBufferedValue('rate:EUR')

    expect(commits).toEqual([
      ['rate:EUR', 0.95],
    ])
  })

  it('participates in the shared pending-edit flush cycle', () => {
    const commits: Array<[string, unknown]> = []
    const buffer = useBufferedFieldValues((key, value) => {
      commits.push([key, value])
    })

    buffer.queueBufferedValue('discountValue', 12)
    flushLineItemEditBuffers()

    expect(commits).toEqual([
      ['discountValue', 12],
    ])
  })
})
