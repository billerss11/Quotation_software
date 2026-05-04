import type { QuotationDraft } from '../types'
import { parseCurrencyCode } from './currencyCodes'
import { normalizeQuotationDraft } from './quotationDraft'

const QUOTATION_FILE_SCHEMA_VERSION = 1
const QUOTATION_FILE_APP = 'quotation-software'

export type QuotationFileErrorCode =
  | 'invalid_envelope'
  | 'missing_quotation'
  | 'unsupported_currency'
  | 'not_object'
  | 'invalid_json'

interface QuotationFileEnvelope {
  schemaVersion: number
  app: string
  exportedAt: string
  quotation: QuotationDraft
}

export class QuotationFileError extends Error {
  constructor(public readonly code: QuotationFileErrorCode) {
    super(code)
    this.name = 'QuotationFileError'
  }
}

export function createQuotationFileContent(quotation: QuotationDraft) {
  const envelope: QuotationFileEnvelope = {
    schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
    app: QUOTATION_FILE_APP,
    exportedAt: new Date().toISOString(),
    quotation,
  }

  return `${JSON.stringify(envelope, null, 2)}\n`
}

export function parseQuotationFileContent(content: string) {
  const parsed = parseJsonObject(content)

  if (!hasValidEnvelope(parsed)) {
    throw new QuotationFileError('invalid_envelope')
  }

  const quotation = parsed.quotation

  if (!isRecord(quotation)) {
    throw new QuotationFileError('missing_quotation')
  }

  const header = quotation.header
  if (!isRecord(header) || !parseCurrencyCode(header.currency)) {
    throw new QuotationFileError('unsupported_currency')
  }

  return normalizeQuotationDraft(quotation as unknown as QuotationDraft, { ensureAtLeastOneItem: false })
}
function parseJsonObject(content: string) {
  try {
    const parsed: unknown = JSON.parse(content)

    if (!isRecord(parsed)) {
      throw new QuotationFileError('not_object')
    }

    return parsed
  } catch (error) {
    if (error instanceof QuotationFileError) {
      throw error
    }

    throw new QuotationFileError('invalid_json')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasValidEnvelope(value: Record<string, unknown>) {
  return (
    value.schemaVersion === QUOTATION_FILE_SCHEMA_VERSION
    && value.app === QUOTATION_FILE_APP
    && isIsoDateString(value.exportedAt)
  )
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false
  }

  return Number.isNaN(Date.parse(value)) === false && new Date(value).toISOString() === value
}
