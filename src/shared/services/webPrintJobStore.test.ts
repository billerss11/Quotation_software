// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createInitialQuotation } from '@/features/quotations/utils/quotationDraft'

import {
  createWebPrintJob,
  loadWebPrintJob,
  pruneExpiredWebPrintJobs,
  removeWebPrintJob,
} from './webPrintJobStore'

describe('webPrintJobStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('stores and retrieves print jobs by id', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-1111-1111-111111111111')

    const payload = createPayload()
    const jobId = createWebPrintJob(payload, {
      now: () => 1234,
    })

    expect(jobId).toBe('11111111-1111-1111-1111-111111111111')
    expect(loadWebPrintJob(jobId)).toEqual(payload)
  })

  it('prunes expired print jobs and keeps recent ones', () => {
    const expiredJobId = createWebPrintJob(createPayload(), {
      now: () => 0,
    })
    const activeJobId = createWebPrintJob(createPayload(), {
      now: () => 60_000,
    })

    pruneExpiredWebPrintJobs({
      now: () => 60_000,
      maxAgeMs: 1_000,
    })

    expect(loadWebPrintJob(expiredJobId)).toBeNull()
    expect(loadWebPrintJob(activeJobId)).not.toBeNull()
  })

  it('removes print jobs explicitly', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('22222222-2222-2222-2222-222222222222')

    const jobId = createWebPrintJob(createPayload())
    removeWebPrintJob(jobId)

    expect(loadWebPrintJob(jobId)).toBeNull()
  })
})

function createPayload() {
  const quotation = createInitialQuotation([], 'en-US')

  return {
    quotation,
    summaries: [],
    totals: {
      baseSubtotal: 0,
      markupAmount: 0,
      subtotalAfterMarkup: 0,
      discountAmount: 0,
      taxableSubtotal: 0,
      taxAmount: 0,
      grandTotal: 0,
      taxBuckets: [],
    },
    globalMarkupRate: quotation.totalsConfig.globalMarkupRate,
    exchangeRates: quotation.exchangeRates,
    companyProfile: {
      companyName: 'ACME',
      email: '',
      phone: '',
    },
    defaultFileName: 'quotation.pdf',
  }
}
