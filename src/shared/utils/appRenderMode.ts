export type AppRenderMode =
  | {
      kind: 'app'
    }
  | {
      kind: 'quotation-print'
      jobId: string
    }

export function resolveAppRenderMode(locationHref: string): AppRenderMode {
  const url = new URL(locationHref)
  const mode = url.searchParams.get('mode')
  const jobId = url.searchParams.get('jobId')

  if (mode === 'quotation-print' && jobId) {
    return {
      kind: 'quotation-print',
      jobId,
    }
  }

  return {
    kind: 'app',
  }
}
