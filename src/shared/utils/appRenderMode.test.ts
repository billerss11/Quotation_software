import { describe, expect, it } from 'vitest'

import { resolveAppRenderMode } from './appRenderMode'

describe('app render mode', () => {
  it('uses the normal app shell when no mode is requested', () => {
    expect(resolveAppRenderMode('https://example.test/')).toEqual({
      kind: 'app',
    })
  })

  it('returns quotation PDF mode when mode and jobId are present', () => {
    expect(resolveAppRenderMode('https://example.test/?mode=quotation-pdf&jobId=job-123')).toEqual({
      kind: 'quotation-pdf',
      jobId: 'job-123',
    })
  })

  it('falls back to the app shell when the PDF job id is missing', () => {
    expect(resolveAppRenderMode('https://example.test/?mode=quotation-pdf')).toEqual({
      kind: 'app',
    })
  })
})
