export type AppRenderMode =
  | {
      kind: 'app'
    }
  | {
      kind: 'quotation-pdf'
      jobId: string
    }

export function resolveAppRenderMode(locationHref: string): AppRenderMode {
  const url = new URL(locationHref)
  const mode = url.searchParams.get('mode')
  const jobId = url.searchParams.get('jobId')

  if (mode === 'quotation-pdf' && jobId) {
    return {
      kind: 'quotation-pdf',
      jobId,
    }
  }

  return {
    kind: 'app',
  }
}
