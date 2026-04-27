import type { QuotationDraft } from '../types'

const QUOTATION_FILE_SCHEMA_VERSION = 1
const QUOTATION_FILE_APP = 'quotation-software'

interface QuotationFileEnvelope {
  schemaVersion: number
  app: string
  exportedAt: string
  quotation: QuotationDraft
}

export function createQuotationFileContent(quotation: QuotationDraft) {
  const envelope: QuotationFileEnvelope = {
    schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
    app: QUOTATION_FILE_APP,
    exportedAt: new Date().toISOString(),
    quotation: createSerializableQuotation(quotation),
  }

  return `${JSON.stringify(envelope, null, 2)}\n`
}

function createSerializableQuotation(quotation: QuotationDraft): QuotationDraft {
  return JSON.parse(JSON.stringify(quotation)) as QuotationDraft
}

export function parseQuotationFileContent(content: string) {
  const parsed = parseJsonObject(content)
  const quotation = parsed.quotation

  if (!isRecord(quotation)) {
    throw new Error('Quotation file is missing quotation data.')
  }

  const header = quotation.header
  if (!isRecord(header) || !isSupportedCurrency(header.currency)) {
    throw new Error('Quotation file has an unsupported quotation currency.')
  }

  return quotation as unknown as QuotationDraft
}

function parseJsonObject(content: string) {
  try {
    const parsed: unknown = JSON.parse(content)

    if (!isRecord(parsed)) {
      throw new Error('Quotation file must contain a JSON object.')
    }

    return parsed
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Quotation file')) {
      throw error
    }

    throw new Error('Quotation file is not valid JSON.')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSupportedCurrency(value: unknown) {
  return value === 'USD' || value === 'EUR' || value === 'CNY' || value === 'GBP'
}
