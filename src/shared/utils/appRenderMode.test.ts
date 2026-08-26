import { describe, expect, it } from 'vitest'

import { resolveAppRenderMode } from './appRenderMode'

describe('app render mode', () => {
  it('uses the normal app shell when no mode is requested', () => {
    expect(resolveAppRenderMode('https://example.test/')).toEqual({
      kind: 'app',
    })
  })

  it('returns quotation print mode when mode and jobId are present', () => {
    expect(resolveAppRenderMode('https://example.test/?mode=quotation-print&jobId=job-123')).toEqual({
      kind: 'quotation-print',
      jobId: 'job-123',
    })
  })

  it('returns goods receipt print mode when mode and jobId are present', () => {
    expect(resolveAppRenderMode('https://example.test/?mode=goods-receipt-print&jobId=job-456')).toEqual({
      kind: 'goods-receipt-print',
      jobId: 'job-456',
    })
  })

  it('returns the lightweight automation mode without a print job id', () => {
    expect(resolveAppRenderMode('https://example.test/?mode=automation')).toEqual({
      kind: 'automation',
    })
  })

  it('falls back to the app shell when the print job id is missing', () => {
    expect(resolveAppRenderMode('https://example.test/?mode=quotation-print')).toEqual({
      kind: 'app',
    })
  })
})
