import type { QuotationPdfRenderPayload } from '../contracts/quotationApp'

const STORAGE_KEY = 'quotation-software:web-print-jobs'
const DEFAULT_MAX_AGE_MS = 15 * 60 * 1000

interface StoredPrintJob {
  createdAt: number
  payload: QuotationPdfRenderPayload
}

type StoredPrintJobMap = Record<string, StoredPrintJob>

export function createWebPrintJob(
  payload: QuotationPdfRenderPayload,
  options: {
    now?: () => number
  } = {},
) {
  const now = options.now ?? Date.now
  const nextJobs = loadJobs()
  const jobId = crypto.randomUUID()

  nextJobs[jobId] = {
    createdAt: now(),
    payload,
  }

  saveJobs(nextJobs)

  return jobId
}

export function loadWebPrintJob(jobId: string) {
  return loadJobs()[jobId]?.payload ?? null
}

export function removeWebPrintJob(jobId: string) {
  const nextJobs = loadJobs()

  if (!(jobId in nextJobs)) {
    return
  }

  delete nextJobs[jobId]
  saveJobs(nextJobs)
}

export function pruneExpiredWebPrintJobs(
  options: {
    now?: () => number
    maxAgeMs?: number
  } = {},
) {
  const now = options.now ?? Date.now
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS
  const nextJobs = loadJobs()
  const cutoff = now() - maxAgeMs
  let changed = false

  for (const [jobId, job] of Object.entries(nextJobs)) {
    if (job.createdAt < cutoff) {
      delete nextJobs[jobId]
      changed = true
    }
  }

  if (changed) {
    saveJobs(nextJobs)
  }
}

function loadJobs(): StoredPrintJobMap {
  if (!hasLocalStorage()) {
    return {}
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return {}
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredPrintJobMap
    return isStoredPrintJobMap(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function saveJobs(jobs: StoredPrintJobMap) {
  if (!hasLocalStorage()) {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
}

function hasLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isStoredPrintJobMap(value: unknown): value is StoredPrintJobMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return Object.values(value).every((entry) => (
    typeof entry === 'object'
    && entry !== null
    && typeof (entry as StoredPrintJob).createdAt === 'number'
    && 'payload' in (entry as StoredPrintJob)
  ))
}
